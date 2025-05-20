/**
 * Font Rendering Example
 * 
 * Demonstrates the enhanced font rendering capabilities of the BasicButtonRenderer
 * using the canvas library.
 */

import { DeviceManager } from "../src/devices/device_manager.ts";
import { RenderingManager } from "../src/rendering/rendering_manager.ts";
import { RGB } from "../src/rendering/renderer.ts";

// Create the device manager
const deviceManager = new DeviceManager();

// Create the rendering manager
const renderingManager = new RenderingManager();

// Initialize the device manager and look for devices
await deviceManager.initialize(true, 2000);

// Find the first connected device
const devices = deviceManager.getConnectedDevices();

if (devices.size === 0) {
  console.error("No Stream Deck devices found. Please connect a device and try again.");
  Deno.exit(1);
}

// Get the first device
const [serialNumber, device] = [...devices.entries()][0];
console.log(`Using device: ${device.getInfo().type} (${serialNumber})`);

// Clear all buttons first
await device.clearAllButtons();

// Examples of different text styles and alignments
const examples = [
  {
    text: "Left Top",
    bgColor: { r: 30, g: 30, b: 90 } as RGB,
    textColor: { r: 255, g: 255, b: 255 } as RGB,
    fontSize: 16,
    textAlign: "left" as const,
    textVerticalAlign: "top" as const,
    buttonIndex: 0,
  },
  {
    text: "Center Middle",
    bgColor: { r: 90, g: 30, b: 30 } as RGB,
    textColor: { r: 255, g: 255, b: 255 } as RGB,
    fontSize: 16,
    textAlign: "center" as const,
    textVerticalAlign: "middle" as const,
    buttonIndex: 1,
  },
  {
    text: "Right Bottom",
    bgColor: { r: 30, g: 90, b: 30 } as RGB,
    textColor: { r: 255, g: 255, b: 255 } as RGB,
    fontSize: 16,
    textAlign: "right" as const,
    textVerticalAlign: "bottom" as const,
    buttonIndex: 2,
  },
  {
    text: "Large Text",
    bgColor: { r: 60, g: 60, b: 0 } as RGB,
    textColor: { r: 255, g: 255, b: 255 } as RGB,
    fontSize: 24,
    buttonIndex: 3,
  },
  {
    text: "Small Text",
    bgColor: { r: 0, g: 60, b: 60 } as RGB,
    textColor: { r: 255, g: 255, b: 255 } as RGB,
    fontSize: 10,
    buttonIndex: 4,
  },
  {
    text: "Long text that should wrap automatically when it's too long",
    bgColor: { r: 60, g: 0, b: 60 } as RGB,
    textColor: { r: 255, g: 255, b: 255 } as RGB,
    fontSize: 14,
    buttonIndex: 5,
  },
  {
    text: "Yellow on Red",
    bgColor: { r: 150, g: 0, b: 0 } as RGB,
    textColor: { r: 255, g: 255, b: 0 } as RGB,
    fontSize: 14,
    buttonIndex: 6,
  },
  {
    text: "1234567890",
    bgColor: { r: 0, g: 0, b: 0 } as RGB,
    textColor: { r: 0, g: 255, b: 0 } as RGB,
    fontSize: 14,
    buttonIndex: 7,
  },
];

// Apply each example to its button
for (const example of examples) {
  console.log(`Setting button ${example.buttonIndex} with text: ${example.text}`);
  
  await renderingManager.updateButton(device, example.buttonIndex, {
    text: example.text,
    backgroundColor: example.bgColor,
    textColor: example.textColor,
    fontSize: example.fontSize,
    textAlign: example.textAlign,
    textVerticalAlign: example.textVerticalAlign,
  });
}

console.log("\nFont rendering examples applied to buttons.");
console.log("Press Ctrl+C to exit.");

// Keep the program running
await new Promise(() => {
  // This promise never resolves, keeping the program running
});