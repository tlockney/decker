/**
 * Decker - A Stream Deck Management Application
 *
 * This file exports the public API for the Decker application.
 */

// Export main application class
export { DeckerApp, type DeckerAppOptions } from "./src/app.ts";

// Re-export types
export * from "./src/types/types.ts";

// Re-export version info
export * from "./src/version.ts";

// Re-export device management classes
export { DeviceManager } from "./src/devices/device_manager.ts";
export { StreamDeckDevice } from "./src/devices/stream_deck_device.ts";

// Re-export CLI tools
export * from "./src/cli/mod.ts";

// Re-export configuration system
export { ConfigLoader, ConfigurationError, DEFAULT_CONFIG_FILENAME } from "./src/config/loader.ts";
export type { ConfigLoadResult } from "./src/config/loader.ts";
export {
  configSchema,
  ConfigValidator,
  validateButton,
  validateConfig,
  validateDevice,
  validateDial,
  validateGlobalSettings,
  validatePage,
  ValidationError,
} from "./src/config/validator.ts";
export * from "./src/config/schema.ts";
export type { ButtonVisual } from "./src/config/schema.ts";

// Re-export action framework core
export { ActionEvent, ActionStatus } from "./src/actions/types.ts";
export type {
  Action,
  ActionContext,
  ActionEventData,
  ActionFactory,
  ActionOptions,
  ActionResult,
} from "./src/actions/types.ts";
export { ActionRegistry } from "./src/actions/registry.ts";
export { ActionExecutor, ExecutorEvent } from "./src/actions/executor.ts";
export type {
  ActionExecutionEventData,
  ActionResultEventData,
  ExecutorEventData,
} from "./src/actions/executor.ts";
export { BaseAction } from "./src/actions/base_action.ts";
export { StateActionIntegration } from "./src/actions/state_integration.ts";

// Re-export specific action implementations
export { LaunchAppAction, LaunchAppActionFactory } from "./src/actions/launch_app_action.ts";
export {
  ExecuteScriptAction,
  ExecuteScriptActionFactory,
} from "./src/actions/execute_script_action.ts";
export { HttpRequestAction, HttpRequestActionFactory } from "./src/actions/http_request_action.ts";
export { PageSwitchAction, PageSwitchActionFactory } from "./src/actions/page_switch_action.ts";
export { InlineCodeAction, InlineCodeActionFactory } from "./src/actions/inline_code_action.ts";

// Re-export state management
export { ButtonState, ButtonStateEvent } from "./src/state/button_state.ts";
export type { ButtonStateData } from "./src/state/button_state.ts";
export { StateManager, StateManagerEvent } from "./src/state/state_manager.ts";
export {
  EnhancedStateManager,
  EnhancedStateManagerEvent,
} from "./src/state/state_manager_enhanced.ts";
export { type PersistenceOptions, StatePersistence } from "./src/state/persistence.ts";
export { EventBus } from "./src/state/events.ts";
export type { EventEmitter } from "./src/state/events.ts";

// Re-export rendering system
export { RenderingManager } from "./src/rendering/rendering_manager.ts";
export type { ButtonRenderer, ButtonVisualProps, RGB } from "./src/rendering/renderer.ts";
export { BasicButtonRenderer, BasicRendererFactory } from "./src/rendering/basic_renderer.ts";
export { ImageButtonRenderer, ImageRendererFactory } from "./src/rendering/image_renderer.ts";
export { StateRenderer } from "./src/rendering/state_renderer.ts";

// Re-export utility functions
export * from "./src/utils/utils.ts";
