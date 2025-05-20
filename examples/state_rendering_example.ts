#!/usr/bin/env -S deno run --allow-all

/**
 * State-Based Rendering Example
 *
 * This example demonstrates integrating the button state management system
 * with the rendering system.
 */

import { DeviceManager } from "../src/devices/device_manager.ts";
import { DeviceEventType } from "../src/types/types.ts";
import { RenderingManager, StateRenderer } from "../src/rendering/mod.ts";
import { StateManager } from "../src/state/state_manager.ts";
// ButtonState is used as a type in the code
import { ButtonStateEvent } from "../src/state/button_state.ts";
// @ts-ignore - ButtonState type is used in method signatures
import type { ButtonState } from "../src/state/button_state.ts";
import { ButtonConfig, DeckerConfig } from "../src/config/schema.ts";

/**
 * Creates a simple configuration for the example
 */
function createExampleConfig(): DeckerConfig {
  // Example button configurations - not directly used but help document the structure
  // @ts-ignore - intentionally unused, serves as documentation
  const exampleMainButtons: Record<string, ButtonConfig> = {
    "0": {
      type: "example",
      text: "Home",
      color: "#0000FF",
      text_color: "#FFFFFF",
    },
    "1": {
      type: "example",
      text: "Page 2",
      color: "#00FF00",
      text_color: "#000000",
    },
    "2": {
      type: "stateful",
      text: "Toggle",
      color: "#FF0000",
      text_color: "#FFFFFF",
      stateful: true,
      state_images: {
        "active": "../examples/assets/active.png",
      },
    },
  };

  // Example second page button configurations - not directly used but help document the structure
  // @ts-ignore - intentionally unused, serves as documentation
  const examplePage2Buttons: Record<string, ButtonConfig> = {
    "0": {
      type: "example",
      text: "Back",
      color: "#FF00FF",
      text_color: "#FFFFFF",
    },
    "1": {
      type: "example",
      text: "Button 1",
      color: "#FFFF00",
      text_color: "#000000",
    },
    "2": {
      type: "example",
      text: "Button 2",
      color: "#00FFFF",
      text_color: "#000000",
    },
  };

  // Create the configuration object
  return {
    devices: {}, // Will be populated dynamically when devices connect
    global_settings: {
      log_level: "info",
    },
    version: "0.1.0",
  };
}

/**
 * Handles setting up a device in the state manager
 */
function setupDeviceInStateManager(
  deviceManager: DeviceManager,
  stateManager: StateManager,
  deviceSerial: string,
): void {
  const device = deviceManager.getDevice(deviceSerial);
  if (!device) return;

  const deviceInfo = device.getInfo();
  console.log(`Setting up device ${deviceInfo.type} (${deviceSerial}) in state manager`);

  // Create device configuration if not exists
  if (!stateManager.getActivePage(deviceSerial)) {
    // Need to update the config to include this device
    const config = stateManager["config"] as DeckerConfig; // Accessing private field

    // Create pages based on button count
    const mainButtons: Record<string, ButtonConfig> = {};
    const page2Buttons: Record<string, ButtonConfig> = {};

    // Populate buttons based on device layout
    for (let i = 0; i < deviceInfo.buttonCount; i++) {
      if (i < 3) {
        // First row gets our special buttons
        mainButtons[i.toString()] = {
          type: i === 2 ? "stateful" : "example",
          text: i === 0 ? "Home" : i === 1 ? "Page 2" : "Toggle",
          color: i === 0 ? "#0000FF" : i === 1 ? "#00FF00" : "#FF0000",
          text_color: i === 1 ? "#000000" : "#FFFFFF",
          stateful: i === 2,
        };

        page2Buttons[i.toString()] = {
          type: "example",
          text: i === 0 ? "Back" : `Button ${i}`,
          color: i === 0 ? "#FF00FF" : i === 1 ? "#FFFF00" : "#00FFFF",
          text_color: i === 0 ? "#FFFFFF" : "#000000",
        };
      } else {
        // Other buttons get generic settings
        mainButtons[i.toString()] = {
          type: "example",
          text: `Button ${i}`,
          color: "#888888",
          text_color: "#FFFFFF",
        };

        page2Buttons[i.toString()] = {
          type: "example",
          text: `Button ${i}`,
          color: "#AAAAAA",
          text_color: "#000000",
        };
      }
    }

    // Update the config
    config.devices[deviceSerial] = {
      name: deviceInfo.type,
      default_page: "main",
      pages: {
        "main": {
          buttons: mainButtons,
        },
        "page2": {
          buttons: page2Buttons,
        },
      },
    };

    // Reinitialize the state manager with the updated config
    stateManager.updateConfig(config);
    console.log(`Added device ${deviceSerial} to configuration`);
  }
}

/**
 * Sets up event handlers for button states
 */
function setupButtonActions(
  deviceManager: DeviceManager,
  stateManager: StateManager,
): void {
  // Get all devices
  const devices = deviceManager.getConnectedDevices();

  // Set up handlers for each device
  for (const [deviceSerial] of devices) {
    // Get all buttons for the active page
    const activePage = stateManager.getActivePage(deviceSerial);
    if (!activePage) continue;

    const buttons = stateManager.getPageButtons(deviceSerial, activePage);

    for (const button of buttons) {
      if (button.buttonIndex === 1 && activePage === "main") {
        // Set up "Page 2" button to switch pages
        button.on(ButtonStateEvent.PRESSED, () => {
          console.log("Switching to page2");
          stateManager.setActivePage(deviceSerial, "page2");
        });
      } else if (button.buttonIndex === 0 && activePage === "page2") {
        // Set up "Back" button to return to main page
        button.on(ButtonStateEvent.PRESSED, () => {
          console.log("Switching to main page");
          stateManager.setActivePage(deviceSerial, "main");
        });
      }
    }
  }
}

/**
 * Main function for the state-based rendering example
 */
async function main(): Promise<void> {
  console.log("Stream Deck State Rendering Example");
  console.log("----------------------------------");

  try {
    // Create the configuration
    const config = createExampleConfig();

    // Create the state manager
    const stateManager = new StateManager(config);

    // Create the device manager
    const deviceManager = new DeviceManager();

    // Create the rendering manager
    const renderingManager = new RenderingManager();

    // Create the state renderer to connect state and rendering
    const stateRenderer = new StateRenderer(stateManager, renderingManager);

    // Set up device connection event handling
    deviceManager.on(DeviceEventType.DEVICE_CONNECTED, (deviceInfo) => {
      console.log(`Device connected: ${deviceInfo.type} (S/N: ${deviceInfo.serialNumber})`);

      // Get the device
      const device = deviceManager.getDevice(deviceInfo.serialNumber);
      if (device) {
        // Set up the device in the state manager
        setupDeviceInStateManager(deviceManager, stateManager, deviceInfo.serialNumber);

        // Register the device with the state renderer
        stateRenderer.registerDevice(device);

        // Set up button actions
        setupButtonActions(deviceManager, stateManager);
      }
    });

    deviceManager.on(DeviceEventType.DEVICE_DISCONNECTED, (event) => {
      console.log(`Device disconnected: ${event.deviceSerial}`);
      stateRenderer.unregisterDevice(event.deviceSerial);
    });

    // Initialize the device manager
    await deviceManager.initialize();

    // Set up already connected devices
    const devices = deviceManager.getConnectedDevices();

    console.log(`Found ${devices.size} Stream Deck device(s):`);

    // Set up each device
    for (const [deviceSerial, device] of devices) {
      const info = device.getInfo();
      console.log(`  ${info.type} (S/N: ${deviceSerial})`);

      // Set up the device in the state manager
      setupDeviceInStateManager(deviceManager, stateManager, deviceSerial);

      // Register the device with the state renderer
      stateRenderer.registerDevice(device);
    }

    // Set up button actions
    setupButtonActions(deviceManager, stateManager);

    // Instructions
    console.log("\nInteraction Guide:");
    console.log("- Press 'Page 2' button to switch to page 2");
    console.log("- Press 'Back' button on page 2 to return to main page");
    console.log("- Press 'Toggle' button to toggle its state");
    console.log("- Press other buttons to see their pressed state");
    console.log("\nPress Ctrl+C to exit");

    // Keep the application running
    await new Promise(() => {
      // This promise intentionally never resolves
    });
  } catch (error) {
    console.error("Error in state rendering example:", error);
  }
}

// Run the main function
if (import.meta.main) {
  await main();
}
