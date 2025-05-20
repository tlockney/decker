/**
 * State Renderer
 *
 * Connects the button state management system to the rendering system.
 */

import { StreamDeckDevice } from "../devices/stream_deck_device.ts";
import { ButtonState, ButtonStateEvent, VisualChangedEvent } from "../state/button_state.ts";
import { StateManager, StateManagerEvent } from "../state/state_manager.ts";
import { ButtonVisualProps, RGB } from "./renderer.ts";
import { RenderingManager } from "./rendering_manager.ts";

/**
 * Options for configuring the state renderer
 */
export interface StateRendererOptions {
  /** Whether to automatically render visual changes */
  autoRenderVisualChanges?: boolean;
  /** Whether to automatically render button press state */
  autoRenderPressState?: boolean;
  /** Whether to use optimized rendering where possible */
  useOptimizedRendering?: boolean;
}

/**
 * Default options for the state renderer
 */
const DEFAULT_OPTIONS: StateRendererOptions = {
  autoRenderVisualChanges: true,
  autoRenderPressState: true,
  useOptimizedRendering: true,
};

/**
 * Maps button visuals from state to rendering props
 */
function mapVisualToProps(buttonState: ButtonState): ButtonVisualProps {
  const props: ButtonVisualProps = {};

  // Map basic visual properties
  if (buttonState.visual.text) {
    props.text = buttonState.visual.text;
  }

  if (buttonState.visual.image) {
    props.imagePath = buttonState.visual.image;
  }

  if (buttonState.visual.color) {
    // Convert hex color to RGB
    const color = buttonState.visual.color;
    const hex = color.replace("#", "");

    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      props.backgroundColor = { r, g, b };
    }
  }

  if (buttonState.visual.text_color) {
    // Convert hex color to RGB
    const color = buttonState.visual.text_color;
    const hex = color.replace("#", "");

    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      props.textColor = { r, g, b };
    }
  }

  if (buttonState.visual.font_size) {
    props.fontSize = buttonState.visual.font_size;
  }

  return props;
}

/**
 * Connects the button state management system to the rendering system
 */
export class StateRenderer {
  /** The state manager to observe */
  private stateManager: StateManager;
  /** The rendering manager to use */
  private renderingManager: RenderingManager;
  /** Map of device objects by serial number */
  private devices: Map<string, StreamDeckDevice> = new Map();
  /** Configuration options */
  private options: StateRendererOptions;
  /** Cleanup functions for event listeners */
  private cleanupFunctions: Array<() => void> = [];
  /** Whether we're currently updating the state */
  private isUpdating = false;

  /**
   * Creates a new state renderer
   * @param stateManager The state manager to observe
   * @param renderingManager The rendering manager to use
   * @param options Configuration options
   */
  constructor(
    stateManager: StateManager,
    renderingManager: RenderingManager,
    options: StateRendererOptions = {},
  ) {
    this.stateManager = stateManager;
    this.renderingManager = renderingManager;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.setupEventListeners();
  }

  /**
   * Register a device to be managed by the state renderer
   * @param device The Stream Deck device
   */
  registerDevice(device: StreamDeckDevice): void {
    const info = device.getInfo();
    this.devices.set(info.serialNumber, device);

    // Register with the rendering manager
    this.renderingManager.registerDevice(info);

    // Set up device event handlers
    this.setupDeviceEventListeners(device);

    // Render the initial state
    this.renderDeviceState(info.serialNumber);
  }

  /**
   * Unregister a device from the state renderer
   * @param deviceSerial The device serial number
   */
  unregisterDevice(deviceSerial: string): void {
    this.devices.delete(deviceSerial);
    this.renderingManager.unregisterDevice(deviceSerial);
  }

  /**
   * Set up event listeners for the state manager
   */
  private setupEventListeners(): void {
    if (this.options.autoRenderVisualChanges) {
      // Listen for button added events
      this.cleanupFunctions.push(
        this.stateManager.on(StateManagerEvent.BUTTON_ADDED, (data) => {
          this.handleButtonAdded((data as { buttonState: ButtonState }).buttonState);
        }),
      );

      // Listen for page activated events to update all buttons on the page
      this.cleanupFunctions.push(
        this.stateManager.on(StateManagerEvent.PAGE_ACTIVATED, (data) => {
          this.renderDeviceState((data as { deviceSerial: string }).deviceSerial);
        }),
      );
    }
  }

  /**
   * Set up event listeners for a device
   * @param device The Stream Deck device
   */
  private setupDeviceEventListeners(device: StreamDeckDevice): void {
    const deviceSerial = device.getInfo().serialNumber;

    // Set up button press/release listeners
    device.on(DeviceEventType.BUTTON_PRESSED, (event) => {
      const buttonState = this.stateManager.getButtonState(deviceSerial, event.buttonIndex);
      if (buttonState) {
        // Prevent infinite loops by checking if we're already updating
        if (!this.isUpdating) {
          this.isUpdating = true;
          buttonState.setPressed(true);
          this.isUpdating = false;
        }

        // Optionally render press state directly
        if (this.options.autoRenderPressState) {
          this.renderButtonPressState(device, buttonState, true);
        }
      }
    });

    device.on(DeviceEventType.BUTTON_RELEASED, (event) => {
      const buttonState = this.stateManager.getButtonState(deviceSerial, event.buttonIndex);
      if (buttonState) {
        // Prevent infinite loops by checking if we're already updating
        if (!this.isUpdating) {
          this.isUpdating = true;
          buttonState.setPressed(false);
          this.isUpdating = false;
        }

        // Optionally render press state directly
        if (this.options.autoRenderPressState) {
          this.renderButtonPressState(device, buttonState, false);
        }
      }
    });
  }

  /**
   * Handle a button being added to the state manager
   * @param buttonState The button state that was added
   */
  private handleButtonAdded(buttonState: ButtonState): void {
    // Set up event listeners for the button state
    this.cleanupFunctions.push(
      buttonState.on(ButtonStateEvent.VISUAL_CHANGED, (_data: VisualChangedEvent) => {
        this.renderButtonVisual(buttonState);
      }),
    );

    // Initial render of the button
    this.renderButtonVisual(buttonState);
  }

  /**
   * Render a button's visual state
   * @param buttonState The button state to render
   */
  private renderButtonVisual(buttonState: ButtonState): void {
    const device = this.devices.get(buttonState.deviceSerial);
    if (!device) return;

    const visualProps = mapVisualToProps(buttonState);
    this.renderingManager.updateButton(device, buttonState.buttonIndex, visualProps);
  }

  /**
   * Render a button's press state
   * @param device The Stream Deck device
   * @param buttonState The button state
   * @param isPressed Whether the button is pressed
   */
  private renderButtonPressState(
    device: StreamDeckDevice,
    buttonState: ButtonState,
    isPressed: boolean,
  ): void {
    // For simplicity, we'll just darken the button when pressed
    const visualProps = mapVisualToProps(buttonState);

    if (isPressed && visualProps.backgroundColor) {
      // Darken the background color
      const bg = visualProps.backgroundColor as RGB;
      visualProps.backgroundColor = {
        r: Math.max(0, bg.r - 40),
        g: Math.max(0, bg.g - 40),
        b: Math.max(0, bg.b - 40),
      };
    }

    this.renderingManager.updateButton(device, buttonState.buttonIndex, visualProps);
  }

  /**
   * Render all buttons for a device/page
   * @param deviceSerial The device serial number
   */
  renderDeviceState(deviceSerial: string): void {
    const device = this.devices.get(deviceSerial);
    if (!device) return;

    const activePage = this.stateManager.getActivePage(deviceSerial);
    if (!activePage) return;

    const buttons = this.stateManager.getPageButtons(deviceSerial, activePage);

    // Clear all buttons first
    device.clearAllButtons().catch(console.error);

    // Render each button
    for (const buttonState of buttons) {
      this.renderButtonVisual(buttonState);
    }
  }

  /**
   * Manually render a specific button
   * @param deviceSerial The device serial number
   * @param buttonIndex The button index
   * @returns True if the button was rendered, false if not found
   */
  renderButton(deviceSerial: string, buttonIndex: number): boolean {
    const device = this.devices.get(deviceSerial);
    if (!device) return false;

    const buttonState = this.stateManager.getButtonState(deviceSerial, buttonIndex);
    if (!buttonState) return false;

    this.renderButtonVisual(buttonState);
    return true;
  }

  /**
   * Cleanup resources used by the state renderer
   */
  dispose(): void {
    // Clean up all event listeners
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];

    // Clear renderers
    for (const deviceSerial of this.devices.keys()) {
      this.renderingManager.unregisterDevice(deviceSerial);
    }

    this.devices.clear();
  }
}

// Re-export the DeviceEventType from the types module for convenience
import { DeviceEventType } from "../types/types.ts";
