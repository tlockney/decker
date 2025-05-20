/**
 * Device Event Action
 *
 * Action type that triggers when specific device events occur.
 */

import { BaseAction } from "./base_action.ts";
import { DeviceManager } from "../devices/device_manager.ts";
import { DeviceEvent, DeviceEventType } from "../types/types.ts";
import { ActionContext, ActionEvent, ActionFactory, ActionResult } from "./types.ts";

/**
 * Device event action configuration
 */
export interface DeviceEventConfig {
  /** The event type to listen for */
  eventType: DeviceEventType | string;

  /** Optional device serial to filter events (if not provided, listens to all devices) */
  deviceSerial?: string;

  /** Optional button index to filter button events */
  buttonIndex?: number;

  /** Optional dial index to filter dial events */
  dialIndex?: number;

  /** Whether to show a visual indicator when event occurs */
  showIndicator?: boolean;

  /** How long to wait for the event before timing out (0 = no timeout) */
  timeout?: number;

  /** Whether to execute once and then detach, or continue listening */
  executeOnce?: boolean;
}

/**
 * Action that responds to Stream Deck device events
 */
export class DeviceEventAction extends BaseAction {
  /** Device event configuration */
  private config: DeviceEventConfig;

  /** Device manager reference */
  private deviceManager: DeviceManager;

  /** Event handler unsubscribe function */
  private unsubscribe?: () => void;

  /** Timeout ID if a timeout is set */
  private timeoutId?: number;

  /** Promise resolver for event handling */
  private resolvePromise?: (result: ActionResult) => void;

  /**
   * Creates a new device event action
   * @param config Configuration for the action
   * @param deviceManager Reference to the device manager
   */
  constructor(config: Record<string, unknown>, deviceManager: DeviceManager) {
    super("device_event");
    this.deviceManager = deviceManager;

    // Validate and extract configuration
    if (typeof config.eventType !== "string" || config.eventType.trim() === "") {
      throw new Error("Device event action requires a valid event type");
    }

    const deviceSerial = typeof config.deviceSerial === "string" ? config.deviceSerial : undefined;
    const buttonIndex = typeof config.buttonIndex === "number" ? config.buttonIndex : undefined;
    const dialIndex = typeof config.dialIndex === "number" ? config.dialIndex : undefined;
    const showIndicator = typeof config.showIndicator === "boolean" ? config.showIndicator : true;
    const timeout = typeof config.timeout === "number" ? config.timeout : 0;
    const executeOnce = typeof config.executeOnce === "boolean" ? config.executeOnce : true;

    this.config = {
      eventType: config.eventType as string,
      deviceSerial,
      buttonIndex,
      dialIndex,
      showIndicator,
      timeout,
      executeOnce,
    };
  }

  /**
   * Execute the device event action
   * @param context Action execution context
   * @returns Action result
   */
  protected executeAction(context: ActionContext): Promise<ActionResult> {
    // Return a promise that resolves when the event occurs or times out
    return new Promise<ActionResult>((resolve) => {
      this.resolvePromise = resolve;

      // Set up the event handler
      this.setupEventHandler(context);

      // Show indicator if enabled
      if (this.config.showIndicator) {
        this.showEventWaitingIndicator(context);
      }

      // Set up timeout if configured
      if (this.config.timeout && this.config.timeout > 0) {
        this.timeoutId = setTimeout(() => {
          this.cleanup();
          resolve(this.createFailureResult(
            new Error(`Timed out waiting for ${this.config.eventType} event`),
            context,
          ));
        }, this.config.timeout) as unknown as number;
      }
    });
  }

  /**
   * Set up event handler to listen for the specified event
   * @param context Action context
   */
  private setupEventHandler(context: ActionContext): void {
    // Define event handler function
    const handleEvent = (event: DeviceEvent) => {
      // Skip if the event type doesn't match
      if (event.type !== this.config.eventType) {
        return;
      }

      // Filter by device serial if specified
      if (this.config.deviceSerial && event.deviceSerial !== this.config.deviceSerial) {
        return;
      }

      // Filter by button index if applicable
      if (
        this.config.buttonIndex !== undefined &&
        (event.type === DeviceEventType.BUTTON_PRESSED ||
          event.type === DeviceEventType.BUTTON_RELEASED) &&
        "buttonIndex" in event &&
        event.buttonIndex !== this.config.buttonIndex
      ) {
        return;
      }

      // Filter by dial index if applicable
      if (
        this.config.dialIndex !== undefined &&
        (event.type === DeviceEventType.DIAL_PRESSED ||
          event.type === DeviceEventType.DIAL_RELEASED ||
          event.type === DeviceEventType.DIAL_ROTATED) &&
        "dialIndex" in event &&
        event.dialIndex !== this.config.dialIndex
      ) {
        return;
      }

      // Event matches our criteria - handle it
      this.handleMatchingEvent(event, context);
    };

    // Subscribe to deviceEvent
    this.deviceManager.on("deviceEvent", handleEvent);

    // Store the unsubscribe function
    this.unsubscribe = () => {
      this.deviceManager.off("deviceEvent", handleEvent);
    };
  }

  /**
   * Handle an event that matches our criteria
   * @param event The matching event
   * @param context Action context
   */
  private handleMatchingEvent(event: DeviceEvent, context: ActionContext): void {
    // Clean up resources
    this.cleanup();

    // Show indicator if enabled
    if (this.config.showIndicator) {
      this.showEventTriggeredIndicator(context, event);
    }

    // Resolve the promise with success
    if (this.resolvePromise) {
      this.resolvePromise(this.createSuccessResult(
        {
          eventType: event.type,
          deviceSerial: event.deviceSerial,
          timestamp: event.timestamp,
          eventData: event,
        },
        context,
      ));
      this.resolvePromise = undefined;
    }
  }

  /**
   * Clean up resources (timeout and event handler)
   */
  private cleanup(): void {
    // Clear timeout if set
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    // Unsubscribe from events if set
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  /**
   * Show a visual indicator that we're waiting for an event
   * @param context Action context
   */
  private showEventWaitingIndicator(context: ActionContext): void {
    // Store original button state
    const originalVisual = { ...context.buttonState.visual };

    // Update the button to show we're waiting
    context.buttonState.updateVisual({
      text: `Waiting for ${this.getEventTypeName(this.config.eventType)}...`,
      color: "#444444",
    });

    // Set a timer to restore the original visual after execution (success or failure)
    const restoreVisual = () => {
      if (!this.isExecuting()) {
        context.buttonState.updateVisual(originalVisual);
      }
    };

    // Add a listener for completion
    this.on(ActionEvent.COMPLETED, restoreVisual);
    this.on(ActionEvent.FAILED, restoreVisual);
    this.on(ActionEvent.CANCELLED, restoreVisual);
  }

  /**
   * Show a visual indicator that the event was triggered
   * @param context Action context
   * @param event The event that was triggered
   */
  private showEventTriggeredIndicator(context: ActionContext, event: DeviceEvent): void {
    // Only show if indicator is enabled
    if (!this.config.showIndicator) return;

    // Update the button to show the event was triggered
    context.buttonState.updateVisual({
      text: `${this.getEventTypeName(event.type)}!`,
      color: "#007700",
    });

    // Reset after a short delay
    setTimeout(() => {
      context.buttonState.reset();
    }, 1000);
  }

  /**
   * Get a human-readable name for an event type
   * @param eventType The event type
   * @returns Human-readable name
   */
  private getEventTypeName(eventType: string): string {
    switch (eventType) {
      case DeviceEventType.BUTTON_PRESSED:
        return "Button Press";
      case DeviceEventType.BUTTON_RELEASED:
        return "Button Release";
      case DeviceEventType.DIAL_PRESSED:
        return "Dial Press";
      case DeviceEventType.DIAL_RELEASED:
        return "Dial Release";
      case DeviceEventType.DIAL_ROTATED:
        return "Dial Rotation";
      case DeviceEventType.DEVICE_CONNECTED:
        return "Device Connected";
      case DeviceEventType.DEVICE_DISCONNECTED:
        return "Device Disconnected";
      default:
        return eventType;
    }
  }

  /**
   * Cancel the action if it's in progress
   */
  override cancel(): Promise<boolean> {
    if (!this.isExecuting()) {
      return Promise.resolve(false);
    }

    // Call base implementation to mark as cancelled
    super.cancel();

    // Clean up resources
    this.cleanup();

    // Resolve with cancelled result if promise is still pending
    if (this.resolvePromise) {
      this.resolvePromise(this.createCancelledResult("Action cancelled by user"));
      this.resolvePromise = undefined;
    }

    return Promise.resolve(true);
  }

  /**
   * Check if the action is cancellable
   */
  override isCancellable(): boolean {
    return this.isExecuting();
  }
}

/**
 * Factory for creating device event actions
 */
export class DeviceEventActionFactory implements ActionFactory<DeviceEventAction> {
  /** Reference to the device manager */
  private deviceManager: DeviceManager;

  /**
   * Create a new device event action factory
   * @param deviceManager Reference to the device manager
   */
  constructor(deviceManager: DeviceManager) {
    this.deviceManager = deviceManager;
  }

  /**
   * Create a new device event action
   * @param config Action configuration
   * @returns New device event action instance
   */
  create(config: Record<string, unknown>): DeviceEventAction {
    return new DeviceEventAction(config, this.deviceManager);
  }

  /**
   * Get the type identifier for this action factory
   */
  getType(): string {
    return "device_event";
  }

  /**
   * Validate device event action configuration
   * @param config Configuration to validate
   * @returns true if valid, false otherwise
   */
  validate(config: Record<string, unknown>): boolean {
    // EventType is required and must be a non-empty string
    if (typeof config.eventType !== "string" || config.eventType.trim() === "") {
      return false;
    }

    // Validate that eventType is a valid DeviceEventType if it's one of the predefined types
    const isValidEventType = Object.values(DeviceEventType).includes(
      config.eventType as DeviceEventType,
    );
    if (!isValidEventType) {
      // Allow custom event types, but warn in the console
      console.warn(`Using custom event type: ${config.eventType}`);
    }

    // DeviceSerial must be a string if present
    if (config.deviceSerial !== undefined && typeof config.deviceSerial !== "string") {
      return false;
    }

    // ButtonIndex must be a number if present
    if (config.buttonIndex !== undefined && typeof config.buttonIndex !== "number") {
      return false;
    }

    // DialIndex must be a number if present
    if (config.dialIndex !== undefined && typeof config.dialIndex !== "number") {
      return false;
    }

    // ShowIndicator must be a boolean if present
    if (config.showIndicator !== undefined && typeof config.showIndicator !== "boolean") {
      return false;
    }

    // Timeout must be a number if present
    if (config.timeout !== undefined && typeof config.timeout !== "number") {
      return false;
    }

    // ExecuteOnce must be a boolean if present
    if (config.executeOnce !== undefined && typeof config.executeOnce !== "boolean") {
      return false;
    }

    return true;
  }
}
