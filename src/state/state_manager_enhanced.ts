/**
 * Enhanced State Manager
 *
 * Extends the StateManager with navigation history and persistence.
 */

import { StateManager } from "./state_manager.ts";
import { ButtonState } from "./button_state.ts";
import { DeckerConfig } from "../config/schema.ts";
import { EventBus, EventHandler } from "./events.ts";
import {
  PersistedState,
  PersistenceOptions,
  StateManagerForPersistence,
  StatePersistence,
} from "./persistence.ts";

/**
 * Additional events for the enhanced state manager
 */
export enum EnhancedStateManagerEvent {
  /** Navigation stack updated */
  NAVIGATION_UPDATED = "navigation_updated",

  /** State saved */
  STATE_SAVED = "state_saved",

  /** State loaded */
  STATE_LOADED = "state_loaded",
}

/**
 * Interface for navigation options
 */
export interface NavigationOptions {
  /** Whether to animate the transition */
  animate?: boolean;

  /** Whether to push to navigation stack */
  pushToStack?: boolean;
}

/**
 * Interface for navigation event data
 */
export interface NavigationEvent {
  /** Device serial number */
  deviceSerial: string;

  /** Navigation history */
  history: string[];
}

/**
 * Interface for persistence event data
 */
export interface PersistenceEvent {
  /** Path to the state file */
  path: string;

  /** Timestamp when the event occurred */
  timestamp: number;
}

/**
 * Enhanced state manager with navigation history and persistence
 */
export class EnhancedStateManager extends StateManager implements StateManagerForPersistence {
  /** Navigation history for each device */
  private navigationHistory = new Map<string, string[]>();

  /** State persistence manager */
  private persistence?: StatePersistence;

  /** Whether navigation is enabled */
  private navigationEnabled = true;

  /** Whether persistence is enabled */
  private persistenceEnabled = false;

  /** Private event bus for enhanced state manager events */
  private enhancedEvents = new EventBus();

  /**
   * Creates a new enhanced state manager
   * @param config Initial configuration
   * @param persistenceOptions Options for state persistence
   */
  constructor(config: DeckerConfig, persistenceOptions?: PersistenceOptions) {
    super(config);

    if (persistenceOptions) {
      this.enablePersistence(persistenceOptions);
    }
  }

  /**
   * Enable state persistence
   * @param options Options for persistence
   */
  enablePersistence(options?: PersistenceOptions): void {
    this.persistenceEnabled = true;
    this.persistence = new StatePersistence(this, options);
  }

  /**
   * Disable state persistence
   */
  disablePersistence(): void {
    this.persistenceEnabled = false;
    if (this.persistence) {
      this.persistence.dispose();
      this.persistence = undefined;
    }
  }

  /**
   * Enable navigation
   */
  enableNavigation(): void {
    this.navigationEnabled = true;
  }

  /**
   * Disable navigation
   */
  disableNavigation(): void {
    this.navigationEnabled = false;
    this.navigationHistory.clear();
  }

  /**
   * Gets the navigation history for a device
   * @param deviceSerial The device serial number
   * @returns Array of page IDs in the navigation history
   */
  getDeviceNavigationHistory(deviceSerial: string): string[] {
    return [...(this.navigationHistory.get(deviceSerial) || [])];
  }

  /**
   * Gets the navigation history for all devices
   * @returns Map of navigation history by device serial
   */
  getNavigationHistory(): Map<string, string[]> {
    const result = new Map<string, string[]>();

    // Create a deep copy of the navigation history
    for (const [deviceSerial, history] of this.navigationHistory.entries()) {
      result.set(deviceSerial, [...history]);
    }

    return result;
  }

  /**
   * Gets all button states in the manager
   * Implements StateManagerForPersistence interface
   * @returns Array of all button states
   */
  override getAllButtons(): ButtonState[] {
    return super.getAllButtons();
  }

  /**
   * Gets all active pages by device serial
   * Implements StateManagerForPersistence interface
   * @returns Map of active pages by device serial
   */
  override getActivePages(): Map<string, string> {
    return super.getActivePages();
  }

  /**
   * Activates a page on a device with navigation support
   * @param deviceSerial The device serial number
   * @param pageId The page ID to activate
   * @param options Navigation options
   * @returns Promise that resolves to whether the page was activated
   */
  override activatePage(
    deviceSerial: string,
    pageId: string,
    options?: NavigationOptions,
  ): Promise<boolean> {
    const opts = {
      animate: options?.animate ?? false,
      pushToStack: options?.pushToStack ?? true,
    };

    // Get the current active page
    const currentPage = this.getActivePage(deviceSerial);

    // Activate the page in the base state manager
    const activated = this.setActivePage(deviceSerial, pageId);
    if (!activated) {
      return Promise.resolve(false);
    }

    // Update navigation history if enabled and requested
    if (this.navigationEnabled && opts.pushToStack && currentPage && currentPage !== pageId) {
      if (!this.navigationHistory.has(deviceSerial)) {
        this.navigationHistory.set(deviceSerial, []);
      }

      const history = this.navigationHistory.get(deviceSerial)!;
      history.push(currentPage);

      // Emit navigation updated event
      this.emitEnhancedEvent(EnhancedStateManagerEvent.NAVIGATION_UPDATED, {
        deviceSerial,
        history: [...history],
      });
    }

    // Auto-save state if persistence is enabled
    this.autoSaveState();

    return Promise.resolve(true);
  }

  /**
   * Navigates back to the previous page
   * @param deviceSerial The device serial number
   * @param options Navigation options
   * @returns Whether navigation was successful
   */
  navigateBack(
    deviceSerial: string,
    _options?: NavigationOptions, // Prefixed with underscore to indicate intentionally unused
  ): Promise<boolean> {
    if (!this.navigationEnabled) {
      return Promise.resolve(false);
    }

    // Animation option is handled in the parent class
    // We don't need to use it here, just pass it through

    // Check if there's history to navigate to
    if (
      !this.navigationHistory.has(deviceSerial) ||
      this.navigationHistory.get(deviceSerial)!.length === 0
    ) {
      return Promise.resolve(false);
    }

    // Get the previous page
    const history = this.navigationHistory.get(deviceSerial)!;
    const previousPage = history.pop();

    // Emit navigation updated event
    this.emitEnhancedEvent(EnhancedStateManagerEvent.NAVIGATION_UPDATED, {
      deviceSerial,
      history: [...history],
    });

    // If there's no previous page, return false
    if (!previousPage) {
      return Promise.resolve(false);
    }

    // Activate the previous page without adding to navigation history
    const activated = this.setActivePage(deviceSerial, previousPage);

    // Auto-save state if persistence is enabled
    this.autoSaveState();

    return Promise.resolve(activated);
  }

  /**
   * Save the current state
   * @param path Optional path to save to
   */
  async saveState(path?: string): Promise<void> {
    if (!this.persistenceEnabled || !this.persistence) {
      return;
    }

    await this.persistence.saveState(path);

    const savePath = path || this.persistence["statePath"];
    this.emitEnhancedEvent(EnhancedStateManagerEvent.STATE_SAVED, {
      path: savePath,
      timestamp: Date.now(),
    });
  }

  /**
   * Load state from file
   * @param path Optional path to load from
   * @returns Whether the state was loaded
   */
  async loadState(path?: string): Promise<boolean> {
    if (!this.persistenceEnabled || !this.persistence) {
      return false;
    }

    const state = await this.persistence.loadState(path);
    if (!state) {
      return false;
    }

    this.applyState(state);

    const loadPath = path || this.persistence["statePath"];
    this.emitEnhancedEvent(EnhancedStateManagerEvent.STATE_LOADED, {
      path: loadPath,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Check if a state file exists
   * @param path Optional path to check
   * @returns Whether the state file exists
   */
  async hasState(path?: string): Promise<boolean> {
    if (!this.persistenceEnabled || !this.persistence) {
      return false;
    }

    return await this.persistence.hasState(path);
  }

  /**
   * Apply a loaded state
   * @param state The state to apply
   */
  private applyState(state: PersistedState): void {
    if (!this.persistence) {
      return;
    }

    // Apply button states
    this.persistence.applyState(state);

    // Apply navigation history
    if (state.navigationHistory) {
      this.navigationHistory.clear();

      for (const [deviceSerial, history] of Object.entries(state.navigationHistory)) {
        if (Array.isArray(history)) {
          this.navigationHistory.set(deviceSerial, [...history]);
        }
      }
    }

    // Apply active pages
    for (const devicePage of state.devicePages) {
      if (devicePage.isActive) {
        this.setActivePage(devicePage.deviceSerial, devicePage.pageId);
      }
    }
  }

  /**
   * Auto-save state if enabled
   */
  private autoSaveState(): void {
    if (this.persistenceEnabled && this.persistence) {
      // We don't await this to avoid blocking
      this.persistence.saveState().catch(console.error);
    }
  }

  /**
   * Override reset to also clear navigation history
   */
  override reset(): void {
    super.reset();
    this.navigationHistory.clear();
  }

  /**
   * Override dispose to clean up persistence
   */
  override dispose(): void {
    super.dispose();
    if (this.persistence) {
      this.persistence.dispose();
    }
    this.enhancedEvents.clearAllListeners();
  }

  /**
   * Private method to emit enhanced state manager events
   * @param eventName The name of the event to emit
   * @param data The data to pass to the event handlers
   */
  private emitEnhancedEvent<T = unknown>(eventName: string, data: T): void {
    this.enhancedEvents.emit(eventName, data);
  }

  /**
   * Subscribe to enhanced state manager events
   * @param eventName The name of the event to subscribe to
   * @param handler The function to call when the event is emitted
   * @returns An unsubscribe function
   */
  public onEnhanced<T = unknown>(eventName: string, handler: EventHandler<T>): () => void {
    return this.enhancedEvents.on(eventName, handler);
  }
}
