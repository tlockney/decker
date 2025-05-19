#!/usr/bin/env -S deno run --allow-all

/**
 * Decker - A Stream Deck Management Application
 *
 * This is the entry point for the command-line application.
 */

import { DeviceManager } from "./src/devices/device_manager.ts";
import { NAME, VERSION } from "./src/version.ts";
import { DeviceEventType } from "./src/types/types.ts";

// Banner display function
function displayBanner(): void {
  console.log(`
  ${NAME} v${VERSION}
  A Stream Deck Management Application
  -------------------------------------
  `);
}

// Main function
async function main(): Promise<void> {
  displayBanner();

  try {
    // Create and initialize the device manager
    console.log("Initializing device manager...");
    const deviceManager = new DeviceManager();

    // Register event handlers
    deviceManager.on(DeviceEventType.DEVICE_CONNECTED, (deviceInfo) => {
      console.log(
        `Device connected: ${deviceInfo.type} (S/N: ${deviceInfo.serialNumber})`,
      );
    });

    deviceManager.on(DeviceEventType.DEVICE_DISCONNECTED, (event) => {
      console.log(`Device disconnected: ${event.deviceSerial}`);
    });

    deviceManager.on("deviceEvent", (event) => {
      console.log(
        `Device event: ${event.type} on device ${event.deviceSerial}`,
      );

      if (event.type === DeviceEventType.BUTTON_PRESSED) {
        console.log(`Button ${event.buttonIndex} pressed`);
      } else if (event.type === DeviceEventType.BUTTON_RELEASED) {
        console.log(`Button ${event.buttonIndex} released`);
      }
    });

    // Initialize and detect devices
    await deviceManager.initialize();

    // Display connected devices
    const devices = deviceManager.getConnectedDevices();
    console.log(`\nFound ${devices.size} Stream Deck device(s):`);

    let index = 1;
    for (const [_, device] of devices) {
      const info = device.getInfo();
      console.log(`  ${index++}. ${info.type} (S/N: ${info.serialNumber})`);
      console.log(
        `     Buttons: ${info.buttonCount} (${info.layout.columns}x${info.layout.rows})`,
      );

      // When a button is pressed, fill it with red
      device.on(DeviceEventType.BUTTON_PRESSED, (event) => {
        console.log(`Filling button #${event.buttonIndex} with red`);
        device.setButtonColor(event.buttonIndex, 255, 0, 0)
          .catch((e) => console.error("Fill failed:", e));
      });

      // When a button is released, clear it
      device.on(DeviceEventType.BUTTON_RELEASED, (event) => {
        console.log(`Clearing button #${event.buttonIndex}`);
        device.clearButton(event.buttonIndex)
          .catch((e) => console.error("Clear failed:", e));
      });
    }

    console.log("\nDecker is ready. Use Ctrl+C to exit.");

    // Handle exit
    Deno.addSignalListener("SIGINT", async () => {
      console.log("\nShutting down...");
      await deviceManager.close();
      Deno.exit(0);
    });
  } catch (error) {
    console.error("Error initializing Decker:", error);
  }
}

// Run the main function if this is the main module
if (import.meta.main) {
  await main();
}
