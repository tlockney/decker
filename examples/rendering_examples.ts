#!/usr/bin/env -S deno run --allow-all

/**
 * Rendering System Examples
 *
 * This file provides examples of using the Decker rendering system.
 */

import { DeviceManager } from "../src/devices/device_manager.ts";
import { DeviceEventType } from "../src/types/types.ts";
import { RenderingManager } from "../src/rendering/mod.ts";
import { Buffer } from "node:buffer";

/**
 * Demonstrates various rendering capabilities
 */
async function renderingDemo() {
  console.log("Decker Rendering System Demo");
  console.log("----------------------------");

  try {
    // Initialize the device manager
    const deviceManager = new DeviceManager();
    await deviceManager.initialize();

    // Get connected devices
    const devices = deviceManager.getConnectedDevices();

    if (devices.size === 0) {
      console.log("No Stream Deck devices found. Please connect a device and try again.");
      return;
    }

    console.log(`Found ${devices.size} Stream Deck device(s).`);

    // Create the rendering manager
    const renderingManager = new RenderingManager();

    // Register each device with the rendering manager
    for (const [serialNumber, device] of devices) {
      const info = device.getInfo();
      console.log(`Registering device: ${info.type} (S/N: ${serialNumber})`);
      renderingManager.registerDevice(info);
    }

    console.log("\nPress buttons to cycle through rendering examples...");

    // Get the first device for examples
    const [_firstDeviceSerial, firstDevice] = [...devices.entries()][0];

    // Track which example we're showing for each button
    const buttonStates = new Map<number, number>();

    // Set up button press handler
    firstDevice.on(DeviceEventType.BUTTON_PRESSED, async (event) => {
      const buttonIndex = event.buttonIndex;

      // Get or initialize the state for this button
      let state = buttonStates.get(buttonIndex) || 0;

      // Cycle to the next state
      state = (state + 1) % 5;
      buttonStates.set(buttonIndex, state);

      console.log(`Button ${buttonIndex} - Example ${state + 1}`);

      // Perform different rendering based on state
      switch (state) {
        case 0:
          // Example 1: Simple solid color
          await renderingManager.setButtonColor(
            firstDevice,
            buttonIndex,
            { r: 255, g: 0, b: 0 }, // Red
          );
          break;

        case 1:
          // Example 2: Simple text
          await renderingManager.setButtonText(
            firstDevice,
            buttonIndex,
            "Hello",
            { r: 0, g: 0, b: 0 }, // Black background
            { r: 255, g: 255, b: 255 }, // White text
          );
          break;

        case 2:
          // Example 3: Colored text
          await renderingManager.updateButton(
            firstDevice,
            buttonIndex,
            {
              text: "Button " + buttonIndex,
              backgroundColor: { r: 0, g: 0, b: 128 }, // Dark blue
              textColor: { r: 255, g: 255, b: 0 }, // Yellow
              fontSize: 16,
            },
          );
          break;

        case 3:
          // Example 4: Attempt to load an image
          // Note: This is a placeholder path and likely won't work without a real image
          await renderingManager.updateButton(
            firstDevice,
            buttonIndex,
            {
              imagePath: "./examples/image.jpg",
              text: "Image",
              textColor: { r: 255, g: 255, b: 255 }, // White
            },
          );
          break;

        case 4:
          // Example 5: Create a simple pattern
          // In a real application, you might generate an image here
          const width = 72;
          const height = 72;
          const rgbData = new Uint8Array(width * height * 3);

          // Create a gradient pattern
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 3;
              rgbData[idx] = Math.floor(x * 255 / width); // R increases with x
              rgbData[idx + 1] = Math.floor(y * 255 / height); // G increases with y
              rgbData[idx + 2] = 128; // B constant
            }
          }

          await renderingManager.updateButton(
            firstDevice,
            buttonIndex,
            {
              imageBuffer: Buffer.from(rgbData),
              text: "Pattern",
            },
          );
          break;
      }
    });

    // Set up button release handler
    firstDevice.on(DeviceEventType.BUTTON_RELEASED, async (_event) => {
      // No action on release for this demo
    });

    // Initialize all buttons to the first example
    const info = firstDevice.getInfo();
    console.log(`\nInitializing all ${info.buttonCount} buttons to Example 1...`);

    for (let i = 0; i < info.buttonCount; i++) {
      await renderingManager.setButtonColor(
        firstDevice,
        i,
        { r: 255, g: 0, b: 0 }, // Red
      );
      buttonStates.set(i, 0);
    }

    console.log("\nReady! Press Ctrl+C to exit.");

    // Keep the application running
    await new Promise(() => {
      // This promise intentionally never resolves
    });
  } catch (error) {
    console.error("Error in rendering demo:", error);
  }
}

// Run the demo if this is the main module
if (import.meta.main) {
  await renderingDemo();
}
