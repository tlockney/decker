/**
 * Configuration Schema Definitions
 *
 * This module defines the TypeScript interfaces that represent the
 * JSON configuration structure for the Decker application.
 */

/**
 * Global settings for the application
 */
export interface GlobalSettings {
  /** Path to the log file */
  log_file?: string;
  /** Log level (debug, info, warn, error) */
  log_level?: "debug" | "info" | "warn" | "error";
}

/**
 * Basic visual properties that can be applied to buttons
 */
export interface ButtonVisual {
  /** Path to the button image file */
  image?: string;
  /** Text to display on the button */
  text?: string;
  /** Background color in hex format (#RRGGBB) */
  color?: string;
  /** Font size for text */
  font_size?: number;
  /** Text color in hex format (#RRGGBB) */
  text_color?: string;
}

/**
 * Button configuration with action type and parameters
 */
export interface ButtonConfig extends ButtonVisual {
  /** The type of action this button performs */
  type: string;
  /** Additional state-specific images */
  state_images?: Record<string, string>;
  /** Whether the button maintains state */
  stateful?: boolean;
  /** Additional action-specific parameters */
  [key: string]: unknown;
}

/**
 * Configuration for dial controls (on supported devices)
 */
export interface DialConfig {
  /** The type of control this dial represents */
  type: string;
  /** Text to display for this dial */
  text?: string;
  /** Additional type-specific parameters */
  [key: string]: unknown;
}

/**
 * Layout of buttons and dials for a specific page
 */
export interface PageConfig {
  /** Button configurations indexed by position */
  buttons: Record<string, ButtonConfig>;
  /** Dial configurations indexed by position (on supported devices) */
  dials?: Record<string, DialConfig>;
}

/**
 * Configuration for a single Stream Deck device
 */
export interface DeviceConfig {
  /** Optional friendly name for the device */
  name?: string;
  /** Pages available on this device */
  pages: Record<string, PageConfig>;
  /** The default page to show on startup */
  default_page?: string;
}

/**
 * The complete configuration structure
 */
export interface DeckerConfig {
  /** Device configurations indexed by serial number */
  devices: Record<string, DeviceConfig>;
  /** Global application settings */
  global_settings?: GlobalSettings;
  /** Application version that created this configuration */
  version?: string;
}

/**
 * Action type definitions (placeholders for now, to be expanded)
 */

/** Launch application action parameters */
export interface LaunchAppAction extends ButtonConfig {
  type: "launch_app";
  /** Path to the application */
  path: string;
}

/** Execute script action parameters */
export interface ExecuteScriptAction extends ButtonConfig {
  type: "script";
  /** Path to the script */
  script: string;
  /** Optional arguments to pass to the script */
  args?: string[];
}

/** Page switch action parameters */
export interface PageSwitchAction extends ButtonConfig {
  type: "page_switch";
  /** Target page to switch to */
  target_page: string;
}

/** HTTP request action parameters */
export interface HttpRequestAction extends ButtonConfig {
  type: "http";
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** URL to send the request to */
  url: string;
  /** Optional request headers */
  headers?: Record<string, string>;
  /** Optional request body */
  body?: unknown;
}

/** Inline code execution action parameters */
export interface InlineCodeAction extends ButtonConfig {
  type: "inline_code";
  /** Programming language for the code */
  language: "javascript";
  /** Code to execute */
  code: string;
}

/**
 * Type guard to check if a button config is a specific action type
 */
export function isActionType<T extends ButtonConfig>(
  config: ButtonConfig,
  type: string,
): config is T {
  return config.type === type;
}
