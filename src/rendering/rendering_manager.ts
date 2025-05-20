/**
 * Rendering Manager
 *
 * Coordinates rendering operations for Stream Deck buttons across different devices.
 */

import { Buffer } from "node:buffer";
import { ButtonRenderer, ButtonVisualProps, RendererFactory, RGB } from "./renderer.ts";
import { BasicButtonRenderer, BasicRendererFactory } from "./basic_renderer.ts";
import { StreamDeckDevice } from "../devices/stream_deck_device.ts";
import { StreamDeckInfo } from "../types/types.ts";

/**
 * Device-specific rendering information
 */
interface DeviceRenderInfo {
  /** Width of each button in pixels */
  buttonWidth: number;
  /** Height of each button in pixels */
  buttonHeight: number;
  /** Renderer instance for this device */
  renderer: ButtonRenderer;
}

/**
 * Manages button rendering across all Stream Deck devices
 */
export class RenderingManager {
  /** Map of device renderers by device type */
  private renderers: Map<string, DeviceRenderInfo> = new Map();
  /** Default renderer factory */
  private defaultFactory: RendererFactory;
  /** Custom renderer factories by device type */
  private factories: Map<string, RendererFactory> = new Map();

  /**
   * Creates a new RenderingManager
   * @param defaultFactory Optional custom default renderer factory
   */
  constructor(defaultFactory?: RendererFactory) {
    this.defaultFactory = defaultFactory || new BasicRendererFactory();
  }

  /**
   * Registers a device type with the rendering manager
   * @param deviceInfo Information about the device
   * @returns The renderer created for this device
   */
  registerDevice(deviceInfo: StreamDeckInfo): ButtonRenderer {
    // Get appropriate factory for this device type
    const factory = this.factories.get(deviceInfo.type) || this.defaultFactory;

    // Create the renderer
    const renderer = factory.createRenderer(deviceInfo.type) || new BasicButtonRenderer();

    // Determine button dimensions based on device type
    // For now, we'll use some defaults, but this should be improved
    // to account for different device models

    // Defaults based on Stream Deck MK.2 (72x72 pixels per key)
    let buttonWidth = 72;
    let buttonHeight = 72;

    // In a real implementation, we'd have a proper mapping of device models to
    // button dimensions. This is a simplified example.
    if (deviceInfo.type.includes("XL")) {
      buttonWidth = 96;
      buttonHeight = 96;
    } else if (deviceInfo.type.includes("Mini")) {
      buttonWidth = 64;
      buttonHeight = 64;
    }

    // Store the device render info
    this.renderers.set(deviceInfo.serialNumber, {
      buttonWidth,
      buttonHeight,
      renderer,
    });

    return renderer;
  }

  /**
   * Registers a custom renderer factory for a device type
   * @param deviceType The device type
   * @param factory The renderer factory
   */
  registerRendererFactory(deviceType: string, factory: RendererFactory): void {
    this.factories.set(deviceType, factory);
  }

  /**
   * Renders a button for a specific device
   * @param deviceSerial The device serial number
   * @param props The visual properties to render
   * @returns A Buffer containing the rendered image data
   */
  renderButton(
    deviceSerial: string,
    props: ButtonVisualProps,
  ): Promise<Buffer> {
    const deviceInfo = this.renderers.get(deviceSerial);

    if (!deviceInfo) {
      throw new Error(`Device ${deviceSerial} not registered with rendering manager`);
    }

    return deviceInfo.renderer.render(props, {
      width: deviceInfo.buttonWidth,
      height: deviceInfo.buttonHeight,
      cache: true,
    });
  }

  /**
   * Sets a solid color on a button
   * @param device The Stream Deck device
   * @param buttonIndex The button index
   * @param color The RGB color values
   */
  async setButtonColor(
    device: StreamDeckDevice,
    buttonIndex: number,
    color: RGB,
  ): Promise<void> {
    // For solid colors, we can use the device's native color setting
    // which is more efficient than generating an image
    await device.setButtonColor(buttonIndex, color.r, color.g, color.b);
  }

  /**
   * Sets text on a button
   * @param device The Stream Deck device
   * @param buttonIndex The button index
   * @param text The text to display
   * @param backgroundColor Optional background color
   * @param textColor Optional text color
   */
  async setButtonText(
    device: StreamDeckDevice,
    buttonIndex: number,
    text: string,
    backgroundColor?: RGB,
    textColor?: RGB,
  ): Promise<void> {
    const deviceInfo = device.getInfo();
    const buffer = await this.renderButton(deviceInfo.serialNumber, {
      text,
      backgroundColor,
      textColor,
    });

    await device.setButtonImage(buttonIndex, buffer);
  }

  /**
   * Renders and sets a complete button with all visual properties
   * @param device The Stream Deck device
   * @param buttonIndex The button index
   * @param props The visual properties
   */
  async updateButton(
    device: StreamDeckDevice,
    buttonIndex: number,
    props: ButtonVisualProps,
  ): Promise<void> {
    // Simple solid color optimization
    if (!props.text && !props.imagePath && !props.imageBuffer && props.backgroundColor) {
      await this.setButtonColor(
        device,
        buttonIndex,
        props.backgroundColor,
      );
      return;
    }

    // Full rendering with all properties
    const deviceInfo = device.getInfo();
    const buffer = await this.renderButton(deviceInfo.serialNumber, props);
    await device.setButtonImage(buttonIndex, buffer);
  }

  /**
   * Clears the render cache for all renderers
   */
  clearCache(): void {
    for (const info of this.renderers.values()) {
      info.renderer.clearCache();
    }
  }

  /**
   * Unregisters a device from the rendering manager
   * @param deviceSerial The device serial number
   */
  unregisterDevice(deviceSerial: string): void {
    this.renderers.delete(deviceSerial);
  }
}
