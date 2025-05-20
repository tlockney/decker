/**
 * Decker Application
 *
 * The main application class that integrates all components.
 */

import { DeviceManager } from "./devices/device_manager.ts";
import { DeviceEventType, StreamDeckInfo } from "./types/types.ts";
import { RenderingManager } from "./rendering/rendering_manager.ts";
import { StateRenderer } from "./rendering/state_renderer.ts";
import {
  EnhancedStateManager,
  EnhancedStateManagerEvent,
  NavigationEvent,
  PersistenceEvent,
} from "./state/state_manager_enhanced.ts";
import {
  ButtonAddedEvent,
  ButtonRemovedEvent,
  ConfigurationChangedEvent,
  PageActivatedEvent,
  StateManagerEvent,
  StateResetEvent,
} from "./state/state_manager.ts";
import { DeckerConfig } from "./config/schema.ts";
import { ConfigLoader } from "./config/loader.ts";
import { ConfigValidator } from "./config/validator.ts";
import { ActionRegistry } from "./actions/registry.ts";
import { ActionFactory } from "./actions/types.ts";
import { EventHandler } from "./state/events.ts";
import {
  ActionExecutionEventData,
  ActionExecutor,
  ActionResultEventData,
  ExecutorEvent,
  ExecutorEventData,
  QueueClearedEventData,
} from "./actions/executor.ts";
import { StateActionIntegration } from "./actions/state_integration.ts";
import { StreamDeckDevice } from "./devices/stream_deck_device.ts";
import { PersistenceOptions } from "./state/persistence.ts";

// Import built-in action factories
import { LaunchAppActionFactory } from "./actions/launch_app_action.ts";
import { ExecuteScriptActionFactory } from "./actions/execute_script_action.ts";
import { HttpRequestActionFactory } from "./actions/http_request_action.ts";
import { PageSwitchActionFactory } from "./actions/page_switch_action.ts";
import { InlineCodeActionFactory } from "./actions/inline_code_action.ts";

/**
 * Options for application initialization
 */
export interface DeckerAppOptions {
  /** Path to configuration file */
  configPath?: string;

  /** Configuration object (used if configPath not provided) */
  config?: DeckerConfig;

  /** Whether to auto-connect to devices on startup */
  autoConnect?: boolean;

  /** Whether to auto-trigger actions on button press */
  autoTriggerActions?: boolean;

  /** Whether to update button visual state during action execution */
  updateVisualState?: boolean;

  /** Whether to log events to console */
  logEvents?: boolean;

  /** Device polling interval in milliseconds (0 to disable) */
  devicePollingInterval?: number;

  /** Whether to validate configuration */
  validateConfig?: boolean;

  /** Whether to enable persistence */
  enablePersistence?: boolean;

  /** Options for persistence */
  persistenceOptions?: PersistenceOptions;

  /** Whether to load persisted state on startup */
  loadPersistedState?: boolean;
}

/**
 * Default application options
 */
const DEFAULT_OPTIONS: Required<DeckerAppOptions> = {
  configPath: undefined as unknown as string,
  config: undefined as unknown as DeckerConfig,
  autoConnect: true,
  autoTriggerActions: true,
  updateVisualState: true,
  logEvents: true,
  devicePollingInterval: 2000,
  validateConfig: true,
  enablePersistence: false,
  persistenceOptions: undefined as unknown as PersistenceOptions,
  loadPersistedState: true,
};

/**
 * Main application class for Decker
 */
export class DeckerApp {
  /** Device manager for Stream Deck hardware */
  private deviceManager: DeviceManager;

  /** State manager for button state */
  private stateManager: EnhancedStateManager;

  /** Rendering manager for button visuals */
  private renderingManager: RenderingManager;

  /** State renderer to connect state and rendering */
  private stateRenderer: StateRenderer;

  /** Action registry for registering action types */
  private actionRegistry: ActionRegistry;

  /** Action executor for running actions */
  private actionExecutor: ActionExecutor;

  /** State action integration to connect state and actions */
  private stateActionIntegration!: StateActionIntegration;

  /** Cleanup functions for event handlers */
  private cleanupFunctions: Array<() => void> = [];

  /** Configuration object */
  private config: DeckerConfig;

  /** Application options */
  private options: Required<DeckerAppOptions>;

  /** Whether the application is initialized */
  private initialized = false;

  /** Whether the application is running */
  private running = false;

  /**
   * Creates a new Decker application
   * @param options Application options
   */
  constructor(options?: DeckerAppOptions) {
    // Set options with defaults
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    // Create the device manager
    this.deviceManager = new DeviceManager();

    // Create the rendering manager
    this.renderingManager = new RenderingManager();

    // Create action registry
    this.actionRegistry = new ActionRegistry();

    // Create action executor
    this.actionExecutor = new ActionExecutor();

    // Create initial empty config if not provided
    this.config = this.options.config || {
      version: "1.0.0",
      global_settings: {},
      devices: {},
    };

    // Create enhanced state manager with config
    this.stateManager = new EnhancedStateManager(
      this.config,
      this.options.enablePersistence ? this.options.persistenceOptions : undefined,
    );

    // Create state renderer
    this.stateRenderer = new StateRenderer(this.stateManager, this.renderingManager);

    // Register built-in actions
    this.registerBuiltInActions();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load configuration if path provided
      if (this.options.configPath) {
        await this.loadConfig(this.options.configPath);
      }

      // Validate configuration if enabled
      if (this.options.validateConfig) {
        this.validateConfig();
      }

      // Load persisted state if enabled
      if (this.options.enablePersistence && this.options.loadPersistedState) {
        const loaded = await this.loadState();
        if (this.options.logEvents && loaded) {
          console.log("Persisted state loaded");
        }
      }

      // Create the state action integration
      this.stateActionIntegration = new StateActionIntegration(
        this.stateManager,
        this.actionRegistry,
        this.actionExecutor,
        {
          autoTriggerActions: this.options.autoTriggerActions,
          updateVisualState: this.options.updateVisualState,
        },
      );

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize the device manager
      await this.deviceManager.initialize(
        this.options.autoConnect,
        this.options.devicePollingInterval,
      );

      // Register existing devices with the state renderer
      this.setupExistingDevices();

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Decker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Initialize if not already initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Set running flag
    this.running = true;

    if (this.options.logEvents) {
      console.log("Decker application started");
    }
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Save state if persistence is enabled
    if (this.options.enablePersistence) {
      await this.saveState();
    }

    // Stop device polling
    this.deviceManager.stopPolling();

    // Close all devices
    await this.deviceManager.close();

    // Clean up event handlers
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];

    // Dispose state action integration
    this.stateActionIntegration.dispose();

    // Reset state
    this.running = false;
    this.initialized = false;

    if (this.options.logEvents) {
      console.log("Decker application stopped");
    }
  }

  /**
   * Get all connected devices
   * @returns A map of connected devices by serial number
   */
  getConnectedDevices(): Map<string, StreamDeckDevice> {
    return this.deviceManager.getConnectedDevices();
  }

  /**
   * Get a device by serial number
   * @param serialNumber The device serial number
   * @returns The device or undefined if not found
   */
  getDevice(serialNumber: string): StreamDeckDevice | undefined {
    return this.deviceManager.getDevice(serialNumber);
  }

  /**
   * Get the current active page for a device
   * @param deviceSerial The device serial number
   * @returns The active page ID or undefined if not found
   */
  getActivePage(deviceSerial: string): string | undefined {
    return this.stateManager.getActivePage(deviceSerial);
  }

  /**
   * Activate a page on a device
   * @param deviceSerial The device serial number
   * @param pageId The page ID to activate
   * @param options Options for page activation
   * @returns Whether the page was activated
   */
  activatePage(
    deviceSerial: string,
    pageId: string,
    options?: { animate?: boolean; pushToStack?: boolean },
  ): Promise<boolean> {
    return this.stateManager.activatePage(deviceSerial, pageId, options);
  }

  /**
   * Navigate back to the previous page
   * @param deviceSerial The device serial number
   * @param options Options for page navigation
   * @returns Whether navigation was successful
   */
  navigateBack(
    deviceSerial: string,
    options?: { animate?: boolean },
  ): Promise<boolean> {
    return this.stateManager.navigateBack(deviceSerial, options);
  }

  /**
   * Get navigation history for a device
   * @param deviceSerial The device serial number
   * @returns Array of page IDs or empty array if no history
   */
  getNavigationHistory(deviceSerial: string): string[] {
    return this.stateManager.getDeviceNavigationHistory(deviceSerial);
  }

  /**
   * Save the current state
   * @param path Optional path to save to
   */
  async saveState(path?: string): Promise<void> {
    if (!this.options.enablePersistence) {
      return;
    }

    await this.stateManager.saveState(path);

    if (this.options.logEvents) {
      console.log("State saved");
    }
  }

  /**
   * Load state from file
   * @param path Optional path to load from
   * @returns Whether state was loaded
   */
  async loadState(path?: string): Promise<boolean> {
    if (!this.options.enablePersistence) {
      return false;
    }

    return await this.stateManager.loadState(path);
  }

  /**
   * Check if a state file exists
   * @param path Optional path to check
   * @returns Whether the state file exists
   */
  async hasState(path?: string): Promise<boolean> {
    if (!this.options.enablePersistence) {
      return false;
    }

    return await this.stateManager.hasState(path);
  }

  /**
   * Register a custom action factory
   * @param factory The action factory to register
   */
  registerAction(factory: ActionFactory): void {
    this.actionRegistry.register(factory);
  }

  /**
   * Update the application configuration
   * @param config The new configuration
   * @param validate Whether to validate the configuration
   */
  updateConfig(config: DeckerConfig, validate = true): void {
    // Validate if requested
    if (validate && this.options.validateConfig) {
      const validator = new ConfigValidator();
      validator.validate(config);
    }

    // Update internal config
    this.config = config;

    // Update state manager
    this.stateManager.updateConfig(config);
  }

  /**
   * Load configuration from a file
   * @param configPath Path to the configuration file
   */
  async loadConfig(configPath: string): Promise<void> {
    try {
      const loader = new ConfigLoader();
      const result = await loader.loadConfig(configPath);
      const config = result.config;

      // Validate if enabled
      if (this.options.validateConfig) {
        const validator = new ConfigValidator();
        validator.validate(config);
      }

      // Update config
      this.config = config;

      // Update state manager
      this.stateManager.updateConfig(config);

      if (this.options.logEvents) {
        console.log(`Configuration loaded from ${configPath}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate the current configuration
   */
  validateConfig(): void {
    const validator = new ConfigValidator();
    validator.validate(this.config);
  }

  /**
   * Register a callback for device events
   * @param event The event type
   * @param callback The callback function
   * @returns Function to remove the listener
   */
  onDeviceEvent(event: DeviceEventType, callback: (data: unknown) => void): () => void {
    // Node.js EventEmitter returns 'this', so we need to use a different approach
    this.deviceManager.on(event, callback);

    // Return a function that removes the listener
    const unsubscribe = () => {
      this.deviceManager.removeListener(event, callback);
    };

    this.cleanupFunctions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Register a callback for action events
   * @param event The event type
   * @param callback The callback function
   * @returns Unsubscribe function
   */
  onActionEvent(
    event: ExecutorEvent.ACTION_STARTED,
    callback: (data: ActionExecutionEventData) => void,
  ): () => void;
  onActionEvent(
    event:
      | ExecutorEvent.ACTION_COMPLETED
      | ExecutorEvent.ACTION_FAILED
      | ExecutorEvent.ACTION_CANCELLED,
    callback: (data: ActionResultEventData) => void,
  ): () => void;
  onActionEvent(
    event: ExecutorEvent.QUEUE_CLEARED,
    callback: (data: QueueClearedEventData) => void,
  ): () => void;
  // Implementation signature must match or be more general than overload signatures
  onActionEvent<T extends ExecutorEventData>(
    event: ExecutorEvent,
    callback:
      | ((data: ActionExecutionEventData) => void)
      | ((data: ActionResultEventData) => void)
      | ((data: QueueClearedEventData) => void)
      | ((data: T) => void),
  ): () => void {
    // Use type casting to handle the various event types
    if (event === ExecutorEvent.ACTION_STARTED) {
      const unsubscribe = this.actionExecutor.on(
        ExecutorEvent.ACTION_STARTED,
        callback as (data: ActionExecutionEventData) => void,
      );
      this.cleanupFunctions.push(unsubscribe);
      return unsubscribe;
    } else if (
      event === ExecutorEvent.ACTION_COMPLETED ||
      event === ExecutorEvent.ACTION_FAILED ||
      event === ExecutorEvent.ACTION_CANCELLED
    ) {
      const unsubscribe = this.actionExecutor.on(
        event as
          | ExecutorEvent.ACTION_COMPLETED
          | ExecutorEvent.ACTION_FAILED
          | ExecutorEvent.ACTION_CANCELLED,
        callback as (data: ActionResultEventData) => void,
      );
      this.cleanupFunctions.push(unsubscribe);
      return unsubscribe;
    } else if (event === ExecutorEvent.QUEUE_CLEARED) {
      const unsubscribe = this.actionExecutor.on(
        ExecutorEvent.QUEUE_CLEARED,
        callback as (data: QueueClearedEventData) => void,
      );
      this.cleanupFunctions.push(unsubscribe);
      return unsubscribe;
    } else {
      // Fallback for any future event types
      const unsubscribe = this.actionExecutor.on(
        event,
        callback as (data: ExecutorEventData) => void,
      );
      this.cleanupFunctions.push(unsubscribe);
      return unsubscribe;
    }
  }

  /**
   * Register a callback for state events
   * @param event The event type
   * @param callback The callback function
   * @returns Unsubscribe function
   */
  // Enhanced state manager events
  onStateEvent(
    event: EnhancedStateManagerEvent.NAVIGATION_UPDATED,
    callback: (data: NavigationEvent) => void,
  ): () => void;
  onStateEvent(
    event: EnhancedStateManagerEvent.STATE_SAVED | EnhancedStateManagerEvent.STATE_LOADED,
    callback: (data: PersistenceEvent) => void,
  ): () => void;

  // Regular state manager events
  onStateEvent(
    event: StateManagerEvent.BUTTON_ADDED,
    callback: (data: ButtonAddedEvent) => void,
  ): () => void;
  onStateEvent(
    event: StateManagerEvent.BUTTON_REMOVED,
    callback: (data: ButtonRemovedEvent) => void,
  ): () => void;
  onStateEvent(
    event: StateManagerEvent.PAGE_ACTIVATED,
    callback: (data: PageActivatedEvent) => void,
  ): () => void;
  onStateEvent(
    event: StateManagerEvent.STATE_RESET,
    callback: (data: StateResetEvent) => void,
  ): () => void;
  onStateEvent(
    event: StateManagerEvent.CONFIGURATION_CHANGED,
    callback: (data: ConfigurationChangedEvent) => void,
  ): () => void;

  // Implementation signature must match or be more general than overload signatures
  onStateEvent(
    event: EnhancedStateManagerEvent | StateManagerEvent | string,
    callback:
      | ((data: NavigationEvent) => void)
      | ((data: PersistenceEvent) => void)
      | ((data: ButtonAddedEvent) => void)
      | ((data: ButtonRemovedEvent) => void)
      | ((data: PageActivatedEvent) => void)
      | ((data: StateResetEvent) => void)
      | ((data: ConfigurationChangedEvent) => void)
      | ((data: unknown) => void),
  ): () => void {
    // Handle enhanced state manager events
    if (Object.values(EnhancedStateManagerEvent).includes(event as EnhancedStateManagerEvent)) {
      const unsubscribe = this.stateManager.onEnhanced(
        event,
        callback as unknown as EventHandler<unknown>,
      );
      this.cleanupFunctions.push(unsubscribe);
      return unsubscribe;
    }

    // Handle regular state manager events
    if (Object.values(StateManagerEvent).includes(event as StateManagerEvent)) {
      const unsubscribe = this.stateManager.on(
        event as StateManagerEvent,
        callback as EventHandler<unknown>,
      );
      this.cleanupFunctions.push(unsubscribe);
      return unsubscribe;
    }

    // Fallback for any other event types
    const unsubscribe = this.stateManager.on(
      event as StateManagerEvent,
      callback as EventHandler<unknown>,
    );
    this.cleanupFunctions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Register built-in action factories
   */
  private registerBuiltInActions(): void {
    // Register launch app action
    this.actionRegistry.register(new LaunchAppActionFactory());

    // Register execute script action
    this.actionRegistry.register(new ExecuteScriptActionFactory());

    // Register HTTP request action
    this.actionRegistry.register(new HttpRequestActionFactory());

    // Register inline code action
    this.actionRegistry.register(new InlineCodeActionFactory());

    // Register page switch action
    this.actionRegistry.register(new PageSwitchActionFactory(this.stateManager));
  }

  /**
   * Set up event handlers for devices
   */
  private setupEventHandlers(): void {
    // Device connected event
    const onDeviceConnected = (deviceInfo: unknown) => {
      if (this.options.logEvents) {
        console.log(
          `Device connected: ${(deviceInfo as StreamDeckInfo).type} (${
            (deviceInfo as StreamDeckInfo).serialNumber
          })`,
        );
      }

      // Get the device
      const serialNumber = (deviceInfo as StreamDeckInfo).serialNumber;
      const device = this.deviceManager.getDevice(serialNumber);

      if (device) {
        // Register with state renderer
        this.stateRenderer.registerDevice(device);
      }
    };

    this.deviceManager.on(DeviceEventType.DEVICE_CONNECTED, onDeviceConnected);

    // Add cleanup function
    this.cleanupFunctions.push(() => {
      this.deviceManager.removeListener(DeviceEventType.DEVICE_CONNECTED, onDeviceConnected);
    });

    // Device disconnected event
    const onDeviceDisconnected = (event: unknown) => {
      if (this.options.logEvents) {
        console.log(`Device disconnected: ${(event as { deviceSerial: string }).deviceSerial}`);
      }

      // Unregister from state renderer
      this.stateRenderer.unregisterDevice((event as { deviceSerial: string }).deviceSerial);
    };

    this.deviceManager.on(DeviceEventType.DEVICE_DISCONNECTED, onDeviceDisconnected);

    // Add cleanup function
    this.cleanupFunctions.push(() => {
      this.deviceManager.removeListener(DeviceEventType.DEVICE_DISCONNECTED, onDeviceDisconnected);
    });

    // Action execution events
    if (this.options.logEvents) {
      // Action started
      const onActionStarted = (data: ExecutorEventData) => {
        if (
          "action" in data && typeof data.action === "object" && data.action !== null &&
          "getType" in data.action
        ) {
          const actionType = (data.action as { getType: () => string }).getType();
          console.log(`Action started: ${actionType}`);
        }
      };

      this.actionExecutor.on(ExecutorEvent.ACTION_STARTED, onActionStarted);

      // Add cleanup function
      this.cleanupFunctions.push(() => {
        this.actionExecutor.off(ExecutorEvent.ACTION_STARTED, onActionStarted);
      });

      // Action completed
      const onActionCompleted = (data: ExecutorEventData) => {
        if (
          "action" in data && "result" in data &&
          typeof data.action === "object" && data.action !== null && "getType" in data.action &&
          typeof data.result === "object" && data.result !== null && "message" in data.result
        ) {
          const actionType = (data.action as { getType: () => string }).getType();
          const message = (data.result as { message: string }).message;
          console.log(`Action completed: ${actionType} - ${message}`);
        }
      };

      this.actionExecutor.on(ExecutorEvent.ACTION_COMPLETED, onActionCompleted);

      // Add cleanup function
      this.cleanupFunctions.push(() => {
        this.actionExecutor.off(ExecutorEvent.ACTION_COMPLETED, onActionCompleted);
      });

      // Action failed
      const onActionFailed = (data: ActionResultEventData) => {
        console.error(
          `Action failed: ${data.action.getType()} - ${data.result.message || "Unknown error"}`,
        );
      };

      this.actionExecutor.on(ExecutorEvent.ACTION_FAILED, onActionFailed);

      // Add cleanup function
      this.cleanupFunctions.push(() => {
        this.actionExecutor.off(ExecutorEvent.ACTION_FAILED, onActionFailed);
      });

      // State persistence events
      if (this.options.enablePersistence) {
        this.cleanupFunctions.push(
          this.stateManager.onEnhanced(
            EnhancedStateManagerEvent.STATE_SAVED,
            (_data: PersistenceEvent) => {
              console.log("State saved");
            },
          ),
        );

        this.cleanupFunctions.push(
          this.stateManager.onEnhanced(
            EnhancedStateManagerEvent.STATE_LOADED,
            (_data: PersistenceEvent) => {
              console.log("State loaded");
            },
          ),
        );
      }
    }
  }

  /**
   * Set up already connected devices
   */
  private setupExistingDevices(): void {
    const devices = this.deviceManager.getConnectedDevices();

    if (this.options.logEvents) {
      console.log(`Found ${devices.size} Stream Deck device(s)`);
    }

    // Register each device with the state renderer
    for (const [serialNumber, device] of devices) {
      const info = device.getInfo();

      if (this.options.logEvents) {
        console.log(`  ${info.type} (S/N: ${serialNumber})`);
      }

      // Register with state renderer
      this.stateRenderer.registerDevice(device);
    }
  }
}
