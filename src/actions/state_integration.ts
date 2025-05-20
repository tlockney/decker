/**
 * State Integration for Action Framework
 *
 * Connects the action framework to the button state system.
 */

import { ButtonState, ButtonStateEvent } from "../state/button_state.ts";
import { StateManager, StateManagerEvent } from "../state/state_manager.ts";
import { Action, ActionContext, ActionResult } from "./types.ts";
import {
  ActionExecutionEventData,
  ActionExecutor,
  ActionResultEventData,
  ExecutorEvent,
} from "./executor.ts";
import { ActionRegistry } from "./registry.ts";

/**
 * Options for state integration
 */
export interface StateIntegrationOptions {
  /** Whether to automatically trigger actions on button press */
  autoTriggerActions?: boolean;

  /** Whether to update button visual state during action execution */
  updateVisualState?: boolean;

  /** Whether to replay actions on page activation */
  replayActionsOnPageActivation?: boolean;
}

/**
 * Default options for state integration
 */
const DEFAULT_OPTIONS: Required<StateIntegrationOptions> = {
  autoTriggerActions: true,
  updateVisualState: true,
  replayActionsOnPageActivation: false,
};

/**
 * Connects the action framework to the button state system
 */
export class StateActionIntegration {
  /** The state manager */
  private stateManager: StateManager;

  /** The action registry */
  private registry: ActionRegistry;

  /** The action executor */
  private executor: ActionExecutor;

  /** Configuration options */
  private options: Required<StateIntegrationOptions>;

  /** Map of active actions by button ID */
  private activeActions: Map<string, string[]> = new Map();

  /** Cleanup functions for event listeners */
  private cleanupFunctions: Array<() => void> = [];

  /**
   * Create a new state action integration
   * @param stateManager The state manager
   * @param registry The action registry
   * @param executor The action executor
   * @param options Configuration options
   */
  constructor(
    stateManager: StateManager,
    registry: ActionRegistry,
    executor: ActionExecutor,
    options?: StateIntegrationOptions,
  ) {
    this.stateManager = stateManager;
    this.registry = registry;
    this.executor = executor;

    // Ensure all options are properly defined with defaults
    this.options = {
      autoTriggerActions: options?.autoTriggerActions ?? DEFAULT_OPTIONS.autoTriggerActions,
      updateVisualState: options?.updateVisualState ?? DEFAULT_OPTIONS.updateVisualState,
      replayActionsOnPageActivation: options?.replayActionsOnPageActivation ??
        DEFAULT_OPTIONS.replayActionsOnPageActivation,
    };

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for state changes
   */
  private setupEventListeners(): void {
    // Listen for button added events
    if (this.options.autoTriggerActions) {
      this.cleanupFunctions.push(
        this.stateManager.on(StateManagerEvent.BUTTON_ADDED, (data) => {
          this.setupButtonListeners((data as { buttonState: ButtonState }).buttonState);
        }),
      );
    }

    // Listen for page activation events
    if (this.options.replayActionsOnPageActivation) {
      this.cleanupFunctions.push(
        this.stateManager.on(StateManagerEvent.PAGE_ACTIVATED, (data) => {
          this.handlePageActivation(
            (data as { deviceSerial: string }).deviceSerial,
            (data as { pageId: string }).pageId,
          );
        }),
      );
    }

    // Listen for action execution events
    if (this.options.updateVisualState) {
      this.cleanupFunctions.push(
        this.executor.on(ExecutorEvent.ACTION_STARTED, (data) => {
          this.handleActionStarted(
            (data as ActionExecutionEventData).action,
            (data as ActionExecutionEventData).context,
            (data as ActionExecutionEventData).executionId,
          );
        }),
      );

      this.cleanupFunctions.push(
        this.executor.on(ExecutorEvent.ACTION_COMPLETED, (data) => {
          this.handleActionCompleted(
            (data as ActionResultEventData).action,
            (data as ActionResultEventData).context,
            (data as ActionResultEventData).result,
            (data as ActionResultEventData).executionId,
          );
        }),
      );

      this.cleanupFunctions.push(
        this.executor.on(ExecutorEvent.ACTION_FAILED, (data) => {
          this.handleActionFailed(
            (data as ActionResultEventData).action,
            (data as ActionResultEventData).context,
            (data as ActionResultEventData).result,
            (data as ActionResultEventData).executionId,
          );
        }),
      );

      this.cleanupFunctions.push(
        this.executor.on(ExecutorEvent.ACTION_CANCELLED, (data) => {
          this.handleActionCancelled(
            (data as ActionResultEventData).action,
            (data as ActionResultEventData).context,
            (data as ActionResultEventData).result,
            (data as ActionResultEventData).executionId,
          );
        }),
      );
    }
  }

  /**
   * Set up event listeners for a button
   * @param buttonState The button state
   */
  private setupButtonListeners(buttonState: ButtonState): void {
    // Track button press/release for action triggering
    buttonState.on(ButtonStateEvent.PRESSED, () => {
      if (this.options.autoTriggerActions) {
        this.triggerButtonAction(buttonState);
      }
    });
  }

  /**
   * Get button ID for tracking
   * @param buttonState The button state
   * @returns Button ID string
   */
  private getButtonId(buttonState: ButtonState): string {
    return `${buttonState.deviceSerial}:${buttonState.buttonIndex}`;
  }

  /**
   * Trigger action for a button
   * @param buttonState The button state
   * @returns Execution ID if action was triggered, undefined otherwise
   */
  async triggerButtonAction(buttonState: ButtonState): Promise<string | undefined> {
    const buttonConfig = buttonState.config;

    // Skip if no action type
    if (!buttonConfig.type) {
      return undefined;
    }

    // Skip if no factory for this action type
    if (!this.registry.hasFactory(buttonConfig.type)) {
      console.warn(`No action factory registered for type "${buttonConfig.type}"`);
      return undefined;
    }

    try {
      // Create the action
      const action = this.registry.createAction(buttonConfig.type, buttonConfig);

      // Create execution context
      const context: ActionContext = {
        buttonState,
        data: {
          customState: buttonState.customState,
          isPressed: buttonState.isPressed,
        },
      };

      // Execute the action
      const { executionId } = await this.executor.execute(action, context);

      // Track active action for this button
      const buttonId = this.getButtonId(buttonState);
      if (!this.activeActions.has(buttonId)) {
        this.activeActions.set(buttonId, []);
      }
      this.activeActions.get(buttonId)!.push(executionId);

      return executionId;
    } catch (error) {
      console.error(
        `Error triggering action for button ${buttonState.deviceSerial}:${buttonState.buttonIndex}:`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Cancel all active actions for a button
   * @param buttonState The button state
   * @returns Number of actions cancelled
   */
  async cancelButtonActions(buttonState: ButtonState): Promise<number> {
    const buttonId = this.getButtonId(buttonState);
    const executionIds = this.activeActions.get(buttonId) || [];

    let cancelledCount = 0;
    for (const executionId of executionIds) {
      if (await this.executor.cancelExecution(executionId)) {
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Handle page activation event
   * @param deviceSerial The device serial number
   * @param pageId The page ID
   */
  private handlePageActivation(deviceSerial: string, pageId: string): void {
    if (!this.options.replayActionsOnPageActivation) {
      return;
    }

    // Get all buttons for the page
    const buttons = this.stateManager.getPageButtons(deviceSerial, pageId);

    // Trigger actions for stateful buttons
    for (const button of buttons) {
      if (button.config.stateful && button.customState === "active") {
        this.triggerButtonAction(button).catch(console.error);
      }
    }
  }

  /**
   * Handle action started event
   * @param action The action
   * @param context The execution context
   * @param executionId The execution ID
   */
  private handleActionStarted(
    _action: Action,
    context: ActionContext,
    _executionId: string,
  ): void {
    if (!this.options.updateVisualState) {
      return;
    }

    const buttonState = context.buttonState;

    // Update button visual to indicate action is running
    buttonState.updateVisual({
      // Add a subtle indicator that action is running
      // This could be customized based on action type
      text: buttonState.visual.text ? `${buttonState.visual.text} ⋯` : "⋯",
    });
  }

  /**
   * Handle action completed event
   * @param action The action
   * @param context The execution context
   * @param result The action result
   * @param executionId The execution ID
   */
  private handleActionCompleted(
    _action: Action,
    context: ActionContext,
    _result: ActionResult,
    executionId: string,
  ): void {
    if (!this.options.updateVisualState) {
      return;
    }

    const buttonState = context.buttonState;

    // Remove action from tracking
    const buttonId = this.getButtonId(buttonState);
    const executionIds = this.activeActions.get(buttonId) || [];
    const index = executionIds.indexOf(executionId);

    if (index !== -1) {
      executionIds.splice(index, 1);
      this.activeActions.set(buttonId, executionIds);
    }

    // Update button visual based on result
    if (buttonState.config.stateful) {
      // For stateful buttons, the state will be managed by the button state system
      // We just need to reset the text if we modified it
      buttonState.updateVisual({
        text: buttonState.visual.text?.replace(" ⋯", ""),
      });
    } else {
      // For non-stateful buttons, restore original visual
      buttonState.reset();
    }
  }

  /**
   * Handle action failed event
   * @param action The action
   * @param context The execution context
   * @param result The action result
   * @param executionId The execution ID
   */
  private handleActionFailed(
    _action: Action,
    context: ActionContext,
    _result: ActionResult,
    executionId: string,
  ): void {
    if (!this.options.updateVisualState) {
      return;
    }

    const buttonState = context.buttonState;

    // Remove action from tracking
    const buttonId = this.getButtonId(buttonState);
    const executionIds = this.activeActions.get(buttonId) || [];
    const index = executionIds.indexOf(executionId);

    if (index !== -1) {
      executionIds.splice(index, 1);
      this.activeActions.set(buttonId, executionIds);
    }

    // Update button visual to indicate failure
    buttonState.updateVisual({
      text: buttonState.visual.text?.replace(" ⋯", " ✗"),
      color: "#FF0000", // Red background for error
    });

    // Set up a timer to reset the visual
    setTimeout(() => {
      if (buttonState.config.stateful && buttonState.customState === "active") {
        // For active stateful buttons, maintain active state
        buttonState.updateVisual({
          text: buttonState.visual.text?.replace(" ✗", ""),
          color: buttonState.config.color,
        });
      } else {
        // Otherwise reset to default
        buttonState.reset();
      }
    }, 2000);
  }

  /**
   * Handle action cancelled event
   * @param action The action
   * @param context The execution context
   * @param result The action result
   * @param executionId The execution ID
   */
  private handleActionCancelled(
    _action: Action,
    context: ActionContext,
    _result: ActionResult,
    executionId: string,
  ): void {
    // Similar to failed but with different visual indicator
    if (!this.options.updateVisualState) {
      return;
    }

    const buttonState = context.buttonState;

    // Remove action from tracking
    const buttonId = this.getButtonId(buttonState);
    const executionIds = this.activeActions.get(buttonId) || [];
    const index = executionIds.indexOf(executionId);

    if (index !== -1) {
      executionIds.splice(index, 1);
      this.activeActions.set(buttonId, executionIds);
    }

    // Update button visual to indicate cancellation
    buttonState.updateVisual({
      text: buttonState.visual.text?.replace(" ⋯", " ⨯"),
      color: "#FFA500", // Orange background for cancelled
    });

    // Set up a timer to reset the visual
    setTimeout(() => {
      if (buttonState.config.stateful && buttonState.customState === "active") {
        // For active stateful buttons, maintain active state
        buttonState.updateVisual({
          text: buttonState.visual.text?.replace(" ⨯", ""),
          color: buttonState.config.color,
        });
      } else {
        // Otherwise reset to default
        buttonState.reset();
      }
    }, 2000);
  }

  /**
   * Dispose of the state action integration
   */
  dispose(): void {
    // Clean up all event listeners
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }

    this.cleanupFunctions = [];
    this.activeActions.clear();
  }
}
