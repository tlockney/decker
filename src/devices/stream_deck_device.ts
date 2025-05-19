/**
 * Stream Deck device wrapper.
 *
 * Provides an interface for interacting with a single Stream Deck device.
 */

import { EventEmitter } from "node:events";
import { Buffer } from "node:buffer";
import {
  DialDownEvent,
  DialRotateEvent,
  DialUpEvent,
  KeyDownEvent,
  KeyUpEvent,
  StreamDeck,
} from "../../types/stream-deck.d.ts";
import {
  ButtonEvent,
  DeviceEventType,
  DialPressEvent,
  DialRotationEvent,
  StreamDeckInfo,
} from "../types/types.ts";

/**
 * Wraps a Stream Deck device, providing a clean interface for interacting with it.
 */
export class StreamDeckDevice extends EventEmitter {
  private streamDeck: StreamDeck;
  private info: StreamDeckInfo;
  private isConnected = true;

  /**
   * Creates a new StreamDeckDevice.
   * @param streamDeck The underlying Stream Deck device.
   * @param info Information about the device.
   */
  constructor(streamDeck: StreamDeck, info: StreamDeckInfo) {
    super();
    this.streamDeck = streamDeck;
    this.info = info;

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Gets information about the device.
   * @returns Device info.
   */
  getInfo(): StreamDeckInfo {
    return { ...this.info };
  }

  /**
   * Gets the device's serial number.
   * @returns Serial number.
   */
  getSerialNumber(): string {
    return this.info.serialNumber;
  }

  /**
   * Gets the device's type/model.
   * @returns Device type.
   */
  getType(): string {
    return this.info.type;
  }

  /**
   * Gets the button layout of the device.
   * @returns Object with columns and rows.
   */
  getLayout(): { columns: number; rows: number } {
    return { ...this.info.layout };
  }

  /**
   * Gets the number of buttons on the device.
   * @returns Button count.
   */
  getButtonCount(): number {
    return this.info.buttonCount;
  }

  /**
   * Checks if the device has dials.
   * @returns True if the device has dials.
   */
  hasDials(): boolean {
    return this.info.hasDials;
  }

  /**
   * Checks if the device has an LCD touchscreen.
   * @returns True if the device has an LCD.
   */
  hasLCD(): boolean {
    return this.info.hasLCD;
  }

  /**
   * Checks if the device is still connected.
   * @returns True if connected.
   */
  isDeviceConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Sets a button's fill color.
   * @param buttonIndex The button index (0-based).
   * @param r Red component (0-255).
   * @param g Green component (0-255).
   * @param b Blue component (0-255).
   */
  async setButtonColor(
    buttonIndex: number,
    r: number,
    g: number,
    b: number,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Device is not connected");
    }

    try {
      await this.streamDeck.fillKeyColor(buttonIndex, r, g, b);
    } catch (error) {
      console.error(
        `Error setting button color for button ${buttonIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Sets a button's image.
   * @param buttonIndex The button index (0-based).
   * @param buffer The image buffer.
   */
  async setButtonImage(buttonIndex: number, buffer: Buffer): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Device is not connected");
    }

    try {
      await this.streamDeck.fillKeyBuffer(buttonIndex, buffer);
    } catch (error) {
      console.error(
        `Error setting button image for button ${buttonIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clears a button's image/color.
   * @param buttonIndex The button index (0-based).
   */
  async clearButton(buttonIndex: number): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Device is not connected");
    }

    try {
      await this.streamDeck.clearKey(buttonIndex);
    } catch (error) {
      console.error(`Error clearing button ${buttonIndex}:`, error);
      throw error;
    }
  }

  /**
   * Clears all buttons on the device.
   */
  async clearAllButtons(): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Device is not connected");
    }

    try {
      await this.streamDeck.clearPanel();
    } catch (error) {
      console.error("Error clearing all buttons:", error);
      throw error;
    }
  }

  /**
   * Closes the device connection and cleans up resources.
   */
  async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      this.isConnected = false;
      await this.streamDeck.clearPanel();
      this.streamDeck.removeAllListeners();
      this.streamDeck = null as unknown as StreamDeck;
      this.removeAllListeners();
    } catch (error) {
      console.error(`Error closing device ${this.info.serialNumber}:`, error);
    }
  }

  /**
   * Sets up event listeners for the device.
   * @private
   */
  private setupEventListeners(): void {
    // Button events
    this.streamDeck.on("down", (event: KeyDownEvent) => {
      if (event.type !== "button") return;

      const buttonEvent: ButtonEvent = {
        type: DeviceEventType.BUTTON_PRESSED,
        deviceSerial: this.info.serialNumber,
        buttonIndex: event.index,
        timestamp: Date.now(),
      };

      this.emit("event", buttonEvent);
      this.emit(DeviceEventType.BUTTON_PRESSED, buttonEvent);
    });

    this.streamDeck.on("up", (event: KeyUpEvent) => {
      if (event.type !== "button") return;

      const buttonEvent: ButtonEvent = {
        type: DeviceEventType.BUTTON_RELEASED,
        deviceSerial: this.info.serialNumber,
        buttonIndex: event.index,
        timestamp: Date.now(),
      };

      this.emit("event", buttonEvent);
      this.emit(DeviceEventType.BUTTON_RELEASED, buttonEvent);
    });

    // Dial events (only on supported devices)
    if (this.info.hasDials) {
      this.streamDeck.on("dialDown", (event: DialDownEvent) => {
        const dialEvent: DialPressEvent = {
          type: DeviceEventType.DIAL_PRESSED,
          deviceSerial: this.info.serialNumber,
          dialIndex: event.index,
          timestamp: Date.now(),
        };

        this.emit("event", dialEvent);
        this.emit(DeviceEventType.DIAL_PRESSED, dialEvent);
      });

      this.streamDeck.on("dialUp", (event: DialUpEvent) => {
        const dialEvent: DialPressEvent = {
          type: DeviceEventType.DIAL_RELEASED,
          deviceSerial: this.info.serialNumber,
          dialIndex: event.index,
          timestamp: Date.now(),
        };

        this.emit("event", dialEvent);
        this.emit(DeviceEventType.DIAL_RELEASED, dialEvent);
      });

      this.streamDeck.on("dialRotate", (event: DialRotateEvent) => {
        const dialEvent: DialRotationEvent = {
          type: DeviceEventType.DIAL_ROTATED,
          deviceSerial: this.info.serialNumber,
          dialIndex: event.index,
          rotation: event.ticks, // Positive for clockwise, negative for counter-clockwise
          timestamp: Date.now(),
        };

        this.emit("event", dialEvent);
        this.emit(DeviceEventType.DIAL_ROTATED, dialEvent);
      });
    }

    // Device errors
    this.streamDeck.on("error", (error: Error) => {
      console.error(`Device ${this.info.serialNumber} error:`, error);
      this.emit("error", error);
    });
  }
}
