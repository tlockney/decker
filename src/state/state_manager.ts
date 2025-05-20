/**
 * State Manager
 *
 * Manages the state of all buttons and pages across devices.
 */

import { DeckerConfig, PageConfig } from "../config/schema.ts";
import { ButtonState, ButtonStateEvent } from "./button_state.ts";
import { EventBus, EventEmitter } from "./events.ts";

/**
 * Events emitted by the state manager
 */
export enum StateManagerEvent {
  BUTTON_ADDED = "button_added",
  BUTTON_REMOVED = "button_removed",
  PAGE_ACTIVATED = "page_activated",
  STATE_RESET = "state_reset",
  CONFIGURATION_CHANGED = "configuration_changed",
}

/**
 * Interface for button added event data
 */
export interface ButtonAddedEvent {
  buttonState: ButtonState;
}

/**
 * Interface for button removed event data
 */
export interface ButtonRemovedEvent {
  deviceSerial: string;
  buttonIndex: number;
}

/**
 * Interface for page activated event data
 */
export interface PageActivatedEvent {
  deviceSerial: string;
  pageId: string;
  previousPageId: string | undefined;
}

/**
 * Type for state reset event data (no additional data)
 */
export type StateResetEvent = Record<string, never>;

/**
 * Interface for configuration changed event data
 */
export interface ConfigurationChangedEvent {
  oldConfig: DeckerConfig;
  newConfig: DeckerConfig;
}

/**
 * Type for button identifiers
 */
export interface ButtonId {
  deviceSerial: string;
  buttonIndex: number;
}

/**
 * Interface for page identifiers
 */
export interface PageId {
  deviceSerial: string;
  pageId: string;
}

/**
 * Class for managing button states and active pages
 */
export class StateManager {
  /** Event bus for state manager events */
  private events: EventEmitter;

  /** Map of button states indexed by device serial and button index */
  private buttonStates: Map<string, Map<number, ButtonState>> = new Map();

  /** Map of active pages indexed by device serial */
  private activePages: Map<string, string> = new Map();

  /** Current configuration */
  private config: DeckerConfig;

  /**
   * Create a new state manager
   *
   * @param config Initial configuration
   */
  constructor(config: DeckerConfig) {
    this.config = config;
    this.events = new EventBus();
    this.initializeFromConfig(config);
  }

  /**
   * Initialize state from configuration
   *
   * @param config The configuration to initialize from
   */
  private initializeFromConfig(config: DeckerConfig): void {
    // Reset existing state
    this.reset();

    // Initialize device states
    for (const [deviceSerial, deviceConfig] of Object.entries(config.devices)) {
      // Determine the active page
      const defaultPage = deviceConfig.default_page ||
        (Object.keys(deviceConfig.pages).length > 0
          ? Object.keys(deviceConfig.pages)[0]
          : undefined);

      if (defaultPage) {
        this.activePages.set(deviceSerial, defaultPage);

        // Create button states for the active page
        this.initializePageButtons(deviceSerial, defaultPage, deviceConfig.pages[defaultPage]);
      }
    }
  }

  /**
   * Initialize buttons for a page
   *
   * @param deviceSerial The device serial number
   * @param pageId The page identifier
   * @param pageConfig The page configuration
   */
  private initializePageButtons(
    deviceSerial: string,
    pageId: string,
    pageConfig: PageConfig,
  ): void {
    for (const [buttonIndex, buttonConfig] of Object.entries(pageConfig.buttons)) {
      const buttonIndexNum = parseInt(buttonIndex, 10);

      const buttonState = new ButtonState({
        deviceSerial,
        buttonIndex: buttonIndexNum,
        pageId,
        config: buttonConfig,
        visual: {
          image: buttonConfig.image,
          text: buttonConfig.text,
          color: buttonConfig.color,
          font_size: buttonConfig.font_size,
          text_color: buttonConfig.text_color,
        },
      });

      this.addButton(buttonState);
    }
  }

  /**
   * Add a button state
   *
   * @param buttonState The button state to add
   */
  public addButton(buttonState: ButtonState): void {
    const { deviceSerial, buttonIndex } = buttonState;

    // Create the device map if it doesn't exist
    if (!this.buttonStates.has(deviceSerial)) {
      this.buttonStates.set(deviceSerial, new Map());
    }

    // Add the button state
    this.buttonStates.get(deviceSerial)!.set(buttonIndex, buttonState);

    // Subscribe to button events
    buttonState.on(ButtonStateEvent.PRESSED, () => {
      // Propagate button events if needed
    });

    buttonState.on(ButtonStateEvent.RELEASED, () => {
      // Propagate button events if needed
    });

    buttonState.on(ButtonStateEvent.STATE_CHANGED, () => {
      // Propagate state changes if needed
    });

    // Emit button added event
    this.events.emit(StateManagerEvent.BUTTON_ADDED, { buttonState });
  }

  /**
   * Remove a button state
   *
   * @param deviceSerial The device serial number
   * @param buttonIndex The button index
   */
  public removeButton(deviceSerial: string, buttonIndex: number): void {
    const buttonState = this.getButtonState(deviceSerial, buttonIndex);

    if (buttonState) {
      // Dispose the button state
      buttonState.dispose();

      // Remove from the map
      this.buttonStates.get(deviceSerial)?.delete(buttonIndex);

      // Emit button removed event
      this.events.emit(StateManagerEvent.BUTTON_REMOVED, {
        deviceSerial,
        buttonIndex,
      });

      // Clean up empty device maps
      if (this.buttonStates.get(deviceSerial)?.size === 0) {
        this.buttonStates.delete(deviceSerial);
      }
    }
  }

  /**
   * Get the state of a button
   *
   * @param deviceSerial The device serial number
   * @param buttonIndex The button index
   * @returns The button state or undefined if not found
   */
  public getButtonState(deviceSerial: string, buttonIndex: number): ButtonState | undefined {
    return this.buttonStates.get(deviceSerial)?.get(buttonIndex);
  }

  /**
   * Get all button states for a device
   *
   * @param deviceSerial The device serial number
   * @returns Map of button states indexed by button index
   */
  public getDeviceButtons(deviceSerial: string): Map<number, ButtonState> | undefined {
    return this.buttonStates.get(deviceSerial);
  }

  /**
   * Get all button states for a page
   *
   * @param deviceSerial The device serial number
   * @param pageId The page identifier
   * @returns Array of button states for the page
   */
  public getPageButtons(deviceSerial: string, pageId: string): ButtonState[] {
    const deviceButtons = this.buttonStates.get(deviceSerial);
    if (!deviceButtons) return [];

    return Array.from(deviceButtons.values())
      .filter((button) => button.pageId === pageId);
  }

  /**
   * Get the active page for a device
   *
   * @param deviceSerial The device serial number
   * @returns The active page ID or undefined
   */
  public getActivePage(deviceSerial: string): string | undefined {
    return this.activePages.get(deviceSerial);
  }

  /**
   * Get all button states in the manager
   *
   * @returns Array of all button states
   */
  public getAllButtons(): ButtonState[] {
    const allButtons: ButtonState[] = [];

    for (const deviceButtons of this.buttonStates.values()) {
      for (const button of deviceButtons.values()) {
        allButtons.push(button);
      }
    }

    return allButtons;
  }

  /**
   * Get all active pages by device serial
   *
   * @returns Map of active pages by device serial
   */
  public getActivePages(): Map<string, string> {
    // Return a copy of the active pages map
    return new Map(this.activePages);
  }

  /**
   * Set the active page for a device
   *
   * @param deviceSerial The device serial number
   * @param pageId The page identifier
   * @returns True if the page was activated, false if it doesn't exist
   */
  public setActivePage(deviceSerial: string, pageId: string): boolean {
    // Verify the page exists in the config
    const deviceConfig = this.config.devices[deviceSerial];
    if (!deviceConfig || !deviceConfig.pages[pageId]) {
      return false;
    }

    const currentPage = this.activePages.get(deviceSerial);

    // If it's already the active page, do nothing
    if (currentPage === pageId) {
      return true;
    }

    // Remove buttons from the current page
    if (currentPage) {
      const currentButtons = this.getPageButtons(deviceSerial, currentPage);
      for (const button of currentButtons) {
        this.removeButton(deviceSerial, button.buttonIndex);
      }
    }

    // Set the new active page
    this.activePages.set(deviceSerial, pageId);

    // Initialize buttons for the new page
    this.initializePageButtons(deviceSerial, pageId, deviceConfig.pages[pageId]);

    // Emit page activated event
    this.events.emit(StateManagerEvent.PAGE_ACTIVATED, {
      deviceSerial,
      pageId,
      previousPageId: currentPage,
    });

    return true;
  }

  /**
   * Reset the state manager to its initial state
   */
  public reset(): void {
    // Dispose all button states
    for (const deviceButtons of this.buttonStates.values()) {
      for (const buttonState of deviceButtons.values()) {
        buttonState.dispose();
      }
    }

    // Clear all maps
    this.buttonStates.clear();
    this.activePages.clear();

    // Emit reset event
    this.events.emit(StateManagerEvent.STATE_RESET, {});
  }

  /**
   * Update the configuration
   *
   * @param newConfig The new configuration
   */
  public updateConfig(newConfig: DeckerConfig): void {
    const oldConfig = this.config;
    this.config = newConfig;

    // Reinitialize state from the new config
    this.initializeFromConfig(newConfig);

    // Emit configuration changed event
    this.events.emit(StateManagerEvent.CONFIGURATION_CHANGED, {
      oldConfig,
      newConfig,
    });
  }

  /**
   * Subscribe to state manager events
   *
   * @param event The event to subscribe to
   * @param handler The handler function
   * @returns An unsubscribe function
   */
  public on<T = unknown>(event: StateManagerEvent, handler: (data: T) => void): () => void {
    return this.events.on(event, handler);
  }

  /**
   * Subscribe to state manager events once
   *
   * @param event The event to subscribe to
   * @param handler The handler function
   * @returns An unsubscribe function
   */
  public once<T = unknown>(event: StateManagerEvent, handler: (data: T) => void): () => void {
    return this.events.once(event, handler);
  }

  /**
   * Unsubscribe from state manager events
   *
   * @param event The event to unsubscribe from
   * @param handler The handler function
   */
  public off<T = unknown>(event: StateManagerEvent, handler: (data: T) => void): void {
    this.events.off(event, handler);
  }

  /**
   * Dispose of the state manager
   */
  public dispose(): void {
    this.reset();
    (this.events as EventBus).clearAllListeners();
  }

  /**
   * Check if a page exists for a device
   *
   * @param deviceSerial The device serial number
   * @param pageId The page identifier
   * @returns True if the page exists, false otherwise
   */
  public hasPage(deviceSerial: string, pageId: string): boolean {
    const deviceConfig = this.config.devices[deviceSerial];
    return !!deviceConfig && !!deviceConfig.pages[pageId];
  }

  /**
   * Activate a page for a device with animation and navigation support
   *
   * @param deviceSerial The device serial number
   * @param pageId The page identifier
   * @param options Options for page activation
   * @returns A promise that resolves when the page is activated
   */
  public async activatePage(
    deviceSerial: string,
    pageId: string,
    options: { animate?: boolean; pushToStack?: boolean } = {},
  ): Promise<boolean> {
    // Use default options
    const animate = options.animate ?? true;
    // For future navigation stack implementation
    // Comment out variable to avoid unused variable warning
    // const pushToStack = options.pushToStack ?? true;

    // Check if the page exists
    if (!this.hasPage(deviceSerial, pageId)) {
      return false;
    }

    // Get the current page
    const currentPage = this.getActivePage(deviceSerial);

    // If already on this page, do nothing
    if (currentPage === pageId) {
      return true;
    }

    // Handle animation if needed
    if (animate) {
      // Animation would go here in a real implementation
      // For now we'll just add a small delay
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Set the new active page
    const result = this.setActivePage(deviceSerial, pageId);

    // Page navigation history would be handled here if pushToStack is true
    // This would be used for "back" functionality

    return result;
  }
}
