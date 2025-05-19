/**
 * Core type definitions for the Decker application.
 */

/**
 * Represents a physical Stream Deck device.
 */
export interface StreamDeckInfo {
  /** The device's serial number */
  serialNumber: string;
  /** The device's type/model */
  type: string;
  /** The number of buttons on the device */
  buttonCount: number;
  /** The physical layout (columns x rows) */
  layout: {
    columns: number;
    rows: number;
  };
  /** Whether the device has dials */
  hasDials: boolean;
  /** Whether the device has an LCD touchscreen */
  hasLCD: boolean;
}

/**
 * Event types that can be emitted by the device manager and devices.
 */
export enum DeviceEventType {
  /** Emitted when a device is connected */
  DEVICE_CONNECTED = "deviceConnected",
  /** Emitted when a device is disconnected */
  DEVICE_DISCONNECTED = "deviceDisconnected",
  /** Emitted when a button is pressed */
  BUTTON_PRESSED = "buttonPressed",
  /** Emitted when a button is released */
  BUTTON_RELEASED = "buttonReleased",
  /** Emitted when a dial is rotated */
  DIAL_ROTATED = "dialRotated",
  /** Emitted when a dial is pressed */
  DIAL_PRESSED = "dialPressed",
  /** Emitted when a dial is released */
  DIAL_RELEASED = "dialReleased",
}

/**
 * Base event interface for all device events.
 */
export interface DeviceEvent {
  /** The type of event */
  type: DeviceEventType;
  /** The serial number of the device */
  deviceSerial: string;
  /** Timestamp when the event occurred */
  timestamp: number;
}

/**
 * Event emitted when a button is pressed or released.
 */
export interface ButtonEvent extends DeviceEvent {
  type: DeviceEventType.BUTTON_PRESSED | DeviceEventType.BUTTON_RELEASED;
  /** The button index (0-based) */
  buttonIndex: number;
}

/**
 * Event emitted when a dial is rotated.
 */
export interface DialRotationEvent extends DeviceEvent {
  type: DeviceEventType.DIAL_ROTATED;
  /** The dial index (0-based) */
  dialIndex: number;
  /** The rotation value (positive for clockwise, negative for counter-clockwise) */
  rotation: number;
}

/**
 * Event emitted when a dial is pressed or released.
 */
export interface DialPressEvent extends DeviceEvent {
  type: DeviceEventType.DIAL_PRESSED | DeviceEventType.DIAL_RELEASED;
  /** The dial index (0-based) */
  dialIndex: number;
}
