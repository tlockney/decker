# Decker Event System

This document describes the event system used in Decker for handling Stream Deck interactions.

## Overview

Decker provides an event-based system for responding to Stream Deck device events, including button presses, dial rotations, and device connections. The event system is built on top of Node.js's EventEmitter pattern, allowing you to subscribe to specific events.

## Event Types

Decker defines several event types in the `DeviceEventType` enum:

```typescript
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
```

## Event Objects

Each event type has a corresponding event object structure:

### Base Event Interface

All device events inherit from this base interface:

```typescript
interface DeviceEvent {
  /** The type of event */
  type: DeviceEventType;
  /** The serial number of the device */
  deviceSerial: string;
  /** Timestamp when the event occurred */
  timestamp: number;
}
```

### Button Events

Events emitted when buttons are pressed or released:

```typescript
interface ButtonEvent extends DeviceEvent {
  type: DeviceEventType.BUTTON_PRESSED | DeviceEventType.BUTTON_RELEASED;
  /** The button index (0-based) */
  buttonIndex: number;
}
```

### Dial Events

Events emitted when dials are pressed, released, or rotated:

```typescript
interface DialPressEvent extends DeviceEvent {
  type: DeviceEventType.DIAL_PRESSED | DeviceEventType.DIAL_RELEASED;
  /** The dial index (0-based) */
  dialIndex: number;
}

interface DialRotationEvent extends DeviceEvent {
  type: DeviceEventType.DIAL_ROTATED;
  /** The dial index (0-based) */
  dialIndex: number;
  /** The rotation value (positive for clockwise, negative for counter-clockwise) */
  rotation: number;
}
```

### Device Connection Events

Events emitted when devices are connected or disconnected:

```typescript
interface DeviceConnectedEvent extends StreamDeckInfo {
  type: DeviceEventType.DEVICE_CONNECTED;
}

interface DeviceDisconnectedEvent extends DeviceEvent {
  type: DeviceEventType.DEVICE_DISCONNECTED;
}
```

## Event Handling

### Device Level Events

You can subscribe to events from a specific Stream Deck device:

```typescript
// Get a device from the device manager
const device = deviceManager.getDevice("SERIAL_NUMBER");

// Listen for button press events
device.on(DeviceEventType.BUTTON_PRESSED, (event: ButtonEvent) => {
  console.log(`Button ${event.buttonIndex} pressed on device ${event.deviceSerial}`);
  // Handle the button press
});

// Listen for button release events
device.on(DeviceEventType.BUTTON_RELEASED, (event: ButtonEvent) => {
  console.log(`Button ${event.buttonIndex} released on device ${event.deviceSerial}`);
  // Handle the button release
});

// Listen for all events from this device
device.on("event", (event: DeviceEvent) => {
  console.log(`Event: ${event.type} on device ${event.deviceSerial}`);
  // Handle any event from this device
});
```

### Device Manager Events

You can also subscribe to events at the device manager level, which will provide events from all connected devices:

```typescript
// Listen for device connections
deviceManager.on(DeviceEventType.DEVICE_CONNECTED, (deviceInfo: DeviceConnectedEvent) => {
  console.log(`Device connected: ${deviceInfo.type} (S/N: ${deviceInfo.serialNumber})`);
  // Handle the device connection
});

// Listen for device disconnections
deviceManager.on(DeviceEventType.DEVICE_DISCONNECTED, (event: DeviceDisconnectedEvent) => {
  console.log(`Device disconnected: ${event.deviceSerial}`);
  // Handle the device disconnection
});

// Listen for all device events
deviceManager.on("deviceEvent", (event: DeviceEvent) => {
  console.log(`Device event: ${event.type} on device ${event.deviceSerial}`);
  // Handle any event from any device
});
```

## Example Usage

### Basic Button Feedback

```typescript
// When a button is pressed, fill it with red
device.on(DeviceEventType.BUTTON_PRESSED, (event) => {
  console.log(`Button ${event.buttonIndex} pressed`);
  device.setButtonColor(event.buttonIndex, 255, 0, 0)
    .catch((e) => console.error("Fill failed:", e));
});

// When a button is released, clear it
device.on(DeviceEventType.BUTTON_RELEASED, (event) => {
  console.log(`Button ${event.buttonIndex} released`);
  device.clearButton(event.buttonIndex)
    .catch((e) => console.error("Clear failed:", e));
});
```

### Dial Control Example

```typescript
// When a dial is rotated, adjust volume
device.on(DeviceEventType.DIAL_ROTATED, (event: DialRotationEvent) => {
  const volumeChange = event.rotation * 2; // Scale the rotation value
  console.log(`Adjusting volume by ${volumeChange}`);
  
  // Execute a command to adjust system volume
  Deno.run({
    cmd: ["osascript", "-e", `set volume output volume (output volume of (get volume settings) + ${volumeChange})`]
  });
});

// When a dial is pressed, toggle mute
device.on(DeviceEventType.DIAL_PRESSED, (event: DialPressEvent) => {
  console.log(`Toggling mute state for dial ${event.dialIndex}`);
  
  // Execute a command to toggle mute
  Deno.run({
    cmd: ["osascript", "-e", "set volume output muted to not (output muted of (get volume settings))"]
  });
});
```

### Device Hot-Plugging

```typescript
// Listen for new device connections
deviceManager.on(DeviceEventType.DEVICE_CONNECTED, (deviceInfo) => {
  console.log(`New device connected: ${deviceInfo.type} (S/N: ${deviceInfo.serialNumber})`);
  console.log(`Buttons: ${deviceInfo.buttonCount} (${deviceInfo.layout.columns}x${deviceInfo.layout.rows})`);
  
  // You might want to initialize the device with default button colors or images
  const device = deviceManager.getDevice(deviceInfo.serialNumber);
  if (device) {
    // Initialize the device
    device.clearAllButtons()
      .then(() => console.log("Device initialized"))
      .catch((e) => console.error("Initialization failed:", e));
  }
});

// Handle device disconnections
deviceManager.on(DeviceEventType.DEVICE_DISCONNECTED, (event) => {
  console.log(`Device disconnected: ${event.deviceSerial}`);
  // You might want to update UI or application state
});
```

## Implementation Details

### Event Propagation

1. Raw events from the Stream Deck library are captured in the `StreamDeckDevice` class.
2. These events are transformed into the Decker event format with additional context.
3. Events are emitted on the device instance first.
4. The device manager also re-emits these events with the "deviceEvent" type.

### Error Handling

Event handlers should include error handling, especially when performing asynchronous operations:

```typescript
device.on(DeviceEventType.BUTTON_PRESSED, async (event) => {
  try {
    // Perform some async operation
    await device.setButtonColor(event.buttonIndex, 255, 0, 0);
    console.log("Button color set successfully");
  } catch (error) {
    console.error("Error handling button press:", error);
  }
});
```

## Best Practices

1. **Use Specific Event Types**: Subscribe to specific event types rather than the generic "event" handler when possible.
2. **Include Error Handling**: Always include try/catch blocks in event handlers.
3. **Consider Event Order**: Remember that button press events will be followed by button release events.
4. **Watch for Stale Handlers**: Remove event listeners when you no longer need them to prevent memory leaks.
5. **Device Check**: Always check if a device is still connected before interacting with it in an event handler.
6. **Rotation Sensitivity**: For dial rotation events, consider scaling the rotation value based on your application's needs.