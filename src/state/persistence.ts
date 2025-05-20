/**
 * State Persistence
 *
 * Provides functionality for saving and loading application state.
 */

import { exists } from "@std/fs/exists";
import { ensureDir } from "@std/fs/ensure_dir";
import { dirname, join } from "@std/path";
import { ButtonState } from "./button_state.ts";
import { ButtonVisual } from "../config/schema.ts";

/**
 * Button state data format for persistence
 */
export interface ButtonStateData {
  /** Index of the button */
  buttonIndex: number;

  /** Device serial number */
  deviceSerial: string;

  /** Page ID */
  pageId: string;

  /** Custom state value */
  customState?: string;

  /** Is the button pressed */
  isPressed: boolean;

  /** Visual properties override */
  visual: {
    text?: string;
    color?: string;
    text_color?: string;
    image?: string;
  };
}

/**
 * Persistence entry for a device page's state
 */
export interface DevicePageState {
  /** Device serial number */
  deviceSerial: string;

  /** Page ID */
  pageId: string;

  /** Button states for this page */
  buttons: ButtonStateData[];

  /** Whether this is the active page */
  isActive: boolean;
}

/**
 * Persisted state format
 */
export interface PersistedState {
  /** Version of the state format */
  version: string;

  /** Timestamp when the state was saved */
  timestamp: number;

  /** State data for each device and page */
  devicePages: DevicePageState[];

  /** Navigation history for each device */
  navigationHistory: Record<string, string[]>;
}

/**
 * Options for state persistence
 */
export interface PersistenceOptions {
  /** Directory to store state files */
  stateDir?: string;

  /** File name for the state file */
  stateFile?: string;

  /** Whether to pretty-print saved state */
  prettyPrint?: boolean;

  /** Interval for auto-saving state in milliseconds (0 to disable) */
  autoSaveInterval?: number;
}

/**
 * Default options for state persistence
 */
const DEFAULT_OPTIONS: Required<PersistenceOptions> = {
  stateDir: join(Deno.env.get("HOME") || ".", ".decker"),
  stateFile: "state.json",
  prettyPrint: false,
  autoSaveInterval: 30000, // 30 seconds
};

/**
 * Interface for state manager functionality needed by persistence
 */
export interface StateManagerForPersistence {
  /** Get all button states */
  getAllButtons: () => ButtonState[];
  /** Get active pages map (deviceSerial -> pageId) */
  getActivePages: () => Map<string, string>;
  /** Get navigation history (deviceSerial -> pageId[]) */
  getNavigationHistory: () => Map<string, string[]>;
}

/**
 * Manages persistence of application state
 */
export class StatePersistence {
  /** StateManager instance */
  private stateManager: StateManagerForPersistence;

  /** Options for state persistence */
  private options: Required<PersistenceOptions>;

  /** Path to the state file */
  private statePath: string;

  /** Interval ID for auto-saving */
  private autoSaveIntervalId?: number;

  /** Whether persistence is enabled */
  private enabled = true;

  /**
   * Creates a new state persistence manager
   * @param stateManager Reference to the state manager
   * @param options Options for state persistence
   */
  constructor(
    stateManager: StateManagerForPersistence,
    options?: PersistenceOptions,
  ) {
    this.stateManager = stateManager;

    // Set options with defaults
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    // Create full path to state file
    this.statePath = join(this.options.stateDir, this.options.stateFile);

    // Start auto-save if enabled
    if (this.options.autoSaveInterval > 0) {
      this.startAutoSave();
    }
  }

  /**
   * Enable or disable persistence
   * @param enabled Whether persistence is enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    // Start or stop auto-save based on new state
    if (enabled && this.options.autoSaveInterval > 0 && !this.autoSaveIntervalId) {
      this.startAutoSave();
    } else if (!enabled && this.autoSaveIntervalId) {
      this.stopAutoSave();
    }
  }

  /**
   * Start automatic state saving
   */
  startAutoSave(): void {
    if (this.autoSaveIntervalId || !this.enabled) {
      return;
    }

    this.autoSaveIntervalId = setInterval(() => {
      this.saveState().catch(console.error);
    }, this.options.autoSaveInterval);
  }

  /**
   * Stop automatic state saving
   */
  stopAutoSave(): void {
    if (this.autoSaveIntervalId) {
      clearInterval(this.autoSaveIntervalId);
      this.autoSaveIntervalId = undefined;
    }
  }

  /**
   * Save current state to file
   * @param path Optional path to save to (uses default if not provided)
   */
  async saveState(path?: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const savePath = path || this.statePath;

    try {
      // Ensure directory exists
      await ensureDir(dirname(savePath));

      // Get current state from state manager
      const state = this.collectState();

      // Serialize state to JSON
      const json = this.options.prettyPrint
        ? JSON.stringify(state, null, 2)
        : JSON.stringify(state);

      // Write to file
      await Deno.writeTextFile(savePath, json);
    } catch (error) {
      console.error("Error saving state:", error);
      throw error;
    }
  }

  /**
   * Load state from file
   * @param path Optional path to load from (uses default if not provided)
   * @returns The loaded state or undefined if not found
   */
  async loadState(path?: string): Promise<PersistedState | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const loadPath = path || this.statePath;

    try {
      // Check if state file exists
      if (!await exists(loadPath)) {
        return undefined;
      }

      // Read and parse state
      const json = await Deno.readTextFile(loadPath);
      const state = JSON.parse(json) as PersistedState;

      return state;
    } catch (error) {
      console.error("Error loading state:", error);
      return undefined;
    }
  }

  /**
   * Check if a state file exists
   * @param path Optional path to check (uses default if not provided)
   * @returns Whether the state file exists
   */
  async hasState(path?: string): Promise<boolean> {
    const checkPath = path || this.statePath;
    return await exists(checkPath);
  }

  /**
   * Delete the state file
   * @param path Optional path to delete (uses default if not provided)
   */
  async deleteState(path?: string): Promise<void> {
    const deletePath = path || this.statePath;

    try {
      if (await exists(deletePath)) {
        await Deno.remove(deletePath);
      }
    } catch (error) {
      console.error("Error deleting state:", error);
      throw error;
    }
  }

  /**
   * Apply loaded state to the state manager
   * @param state The state to apply
   */
  applyState(state: PersistedState): void {
    // Validation checks
    if (!state || typeof state !== "object") {
      throw new Error("Invalid state format");
    }

    if (!state.devicePages || !Array.isArray(state.devicePages)) {
      throw new Error("Invalid state: missing devicePages array");
    }

    // Loop through device pages
    for (const devicePage of state.devicePages) {
      if (!devicePage.buttons || !Array.isArray(devicePage.buttons)) {
        continue;
      }

      // Loop through buttons
      for (const buttonData of devicePage.buttons) {
        // Try to find the button in the state manager
        const buttons = this.stateManager.getAllButtons();
        const button = buttons.find((b) =>
          b.deviceSerial === buttonData.deviceSerial &&
          b.buttonIndex === buttonData.buttonIndex
        );

        // Skip if button not found
        if (!button) {
          continue;
        }

        // Apply custom state
        if (buttonData.customState !== undefined) {
          button.customState = buttonData.customState;
        }

        // Apply visual overrides
        if (buttonData.visual) {
          // Use type that matches expected ButtonVisual type
          const visual: Partial<ButtonVisual> = {};

          if (buttonData.visual.text !== undefined) {
            visual.text = buttonData.visual.text;
          }

          if (buttonData.visual.color !== undefined) {
            // Convert hex string to RGB and store as hex string
            visual.color = buttonData.visual.color;
          }

          if (buttonData.visual.text_color !== undefined) {
            // Store text color as hex string
            visual.text_color = buttonData.visual.text_color;
          }

          if (buttonData.visual.image !== undefined) {
            visual.image = buttonData.visual.image;
          }

          if (Object.keys(visual).length > 0) {
            button.updateVisual(visual);
          }
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAutoSave();
  }

  /**
   * Collect current state from state manager
   * @returns The collected state
   */
  private collectState(): PersistedState {
    const buttons = this.stateManager.getAllButtons();
    const activePages = this.stateManager.getActivePages();
    const navigationHistory = this.stateManager.getNavigationHistory();

    // Group buttons by device and page
    const devicePagesMap = new Map<string, Map<string, ButtonStateData[]>>();

    for (const button of buttons) {
      // Skip non-stateful buttons and buttons without custom state
      if (!button.config.stateful && button.customState === undefined) {
        continue;
      }

      const deviceSerial = button.deviceSerial;
      const pageId = button.pageId;
      // (Prefixing with underscore to indicate unused variable)
      // const _key = `${deviceSerial}:${pageId}`;

      // Get or create device map
      if (!devicePagesMap.has(deviceSerial)) {
        devicePagesMap.set(deviceSerial, new Map());
      }

      // Get or create page array
      const deviceMap = devicePagesMap.get(deviceSerial)!;
      if (!deviceMap.has(pageId)) {
        deviceMap.set(pageId, []);
      }

      // Create button state data
      const buttonData: ButtonStateData = {
        buttonIndex: button.buttonIndex,
        deviceSerial,
        pageId,
        customState: button.customState,
        isPressed: button.isPressed,
        visual: {},
      };

      // Only include visual overrides
      if (button.visual.text !== button.config.text) {
        buttonData.visual.text = button.visual.text;
      }

      // Only store colors that differ from the config
      const configColor = button.config.color || "#000000";
      if (button.visual.color !== undefined && button.visual.color !== configColor) {
        buttonData.visual.color = button.visual.color;
      }

      const configTextColor = button.config.text_color || "#FFFFFF";
      if (button.visual.text_color !== undefined && button.visual.text_color !== configTextColor) {
        buttonData.visual.text_color = button.visual.text_color;
      }

      // Add to the page array
      deviceMap.get(pageId)!.push(buttonData);
    }

    // Convert to array format
    const devicePages: DevicePageState[] = [];

    for (const [deviceSerial, deviceMap] of devicePagesMap.entries()) {
      for (const [pageId, buttons] of deviceMap.entries()) {
        devicePages.push({
          deviceSerial,
          pageId,
          buttons,
          isActive: activePages.get(deviceSerial) === pageId,
        });
      }
    }

    // Convert navigation history
    const navigationHistoryObj: Record<string, string[]> = {};
    for (const [deviceSerial, history] of navigationHistory.entries()) {
      navigationHistoryObj[deviceSerial] = [...history];
    }

    // Build the final state object
    return {
      version: "1.0.0",
      timestamp: Date.now(),
      devicePages,
      navigationHistory: navigationHistoryObj,
    };
  }

  // Color conversion functions have been removed since we're storing colors in their original format
}
