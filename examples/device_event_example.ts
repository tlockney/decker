/**
 * Device Event Action Example
 *
 * This example demonstrates how to set up device event listeners using the
 * device event action system.
 */

import { DeviceManager } from "../src/devices/device_manager.ts";
import { DeviceEventType } from "../src/types/types.ts";
import { ActionRegistry, DeviceEventActionFactory } from "../src/actions/mod.ts";
import { RenderingManager } from "../src/rendering/rendering_manager.ts";

// Create the main system components
const deviceManager = new DeviceManager();
const renderingManager = new RenderingManager();

// Create an action registry and register the device event action
const actionRegistry = new ActionRegistry();
actionRegistry.register(new DeviceEventActionFactory(deviceManager));

// Initialize the device manager and wait for devices
await deviceManager.initialize(true, 2000);

// Give devices some time to connect
await new Promise((resolve) => setTimeout(resolve, 1000));

// Get connected devices
const devices = deviceManager.getConnectedDevices();
if (devices.size === 0) {
  console.log("No devices connected. Please connect a Stream Deck device.");
  Deno.exit(1);
}

console.log(`Connected devices: ${devices.size}`);

// Get the first device
const [serialNumber, device] = [...devices.entries()][0];
console.log(`Using device: ${device.getInfo().type} (${serialNumber})`);

// Set up a demonstration for each event type
console.log("\nDevice Event Action Example");
console.log("=========================");
console.log("This example demonstrates how to use device event actions to respond to events.");
console.log("Try the following interactions:");

// Clear all buttons
await device.clearAllButtons();

// Set up device connection/disconnection event examples
console.log("\n1. Device Connection Events:");
console.log("   - Disconnect and reconnect your Stream Deck to see the connection events");

// Set up button press/release event examples
const buttonIndex = 0;
await renderingManager.setButtonText(
  device,
  buttonIndex,
  "Press Me",
  { r: 34, g: 34, b: 102 }, // Dark blue
  { r: 255, g: 255, b: 255 }, // White
);

console.log(`\n2. Button Events (Button ${buttonIndex}):`);
console.log(`   - Press and release button ${buttonIndex} to trigger events`);

// Set up dial events if the device has dials
if (device.getInfo().hasDials) {
  const dialIndex = 0;
  console.log(`\n3. Dial Events (Dial ${dialIndex}):`);
  console.log(`   - Press, release, and rotate dial ${dialIndex} to trigger events`);
}

// Set up event listeners for demonstration
deviceManager.on("deviceEvent", (event) => {
  console.log(`Event received: ${event.type}`, event);

  // For button press/release events, update the button visual
  if (
    event.type === DeviceEventType.BUTTON_PRESSED &&
    "buttonIndex" in event &&
    event.buttonIndex === buttonIndex
  ) {
    renderingManager.setButtonText(
      device,
      buttonIndex,
      "Pressed!",
      { r: 153, g: 0, b: 0 }, // Red
      { r: 255, g: 255, b: 255 }, // White
    );
  } else if (
    event.type === DeviceEventType.BUTTON_RELEASED &&
    "buttonIndex" in event &&
    event.buttonIndex === buttonIndex
  ) {
    renderingManager.setButtonText(
      device,
      buttonIndex,
      "Press Me",
      { r: 34, g: 34, b: 102 }, // Dark blue
      { r: 255, g: 255, b: 255 }, // White
    );
  }
});

// Example of how to use this configuration in action registry
console.log(`
To use a device event action, you would create a configuration like:
{
  type: "device_event",
  eventType: "${DeviceEventType.BUTTON_PRESSED}",
  deviceSerial: "${serialNumber}",
  buttonIndex: ${buttonIndex},
  showIndicator: true,
  timeout: 60000, // 1 minute timeout
  executeOnce: true
}
and register it with a button in your configuration.`);

console.log("\nWaiting for events. Press Ctrl+C to exit.");

// Keep the program running
await new Promise(() => {
  // This promise never resolves, keeping the program running
});
