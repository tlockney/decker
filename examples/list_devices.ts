#!/usr/bin/env -S deno run --allow-all

/**
 * Example application that lists all connected Stream Deck devices
 * and shows their properties.
 */

import { DeviceManager } from "../src/devices/device_manager.ts";
import { NAME, VERSION } from "../src/version.ts";

// Display a banner
console.log(`
${NAME} v${VERSION} - Device Listing Example
-----------------------------------------
`);

// Create a device manager
const deviceManager = new DeviceManager();

// Handle device events
deviceManager.on("deviceConnected", (deviceInfo) => {
  console.log(
    `Device connected: ${deviceInfo.type} (S/N: ${deviceInfo.serialNumber})`,
  );
});

deviceManager.on("deviceDisconnected", (event) => {
  console.log(`Device disconnected: ${event.deviceSerial}`);
});

// Function to display device information
function displayDeviceInfo(devices: Map<string, unknown>) {
  console.log(`\nFound ${devices.size} Stream Deck device(s):\n`);

  if (devices.size === 0) {
    console.log(
      "No Stream Deck devices found. Please connect a device and try again.",
    );
    return;
  }

  let index = 1;
  for (const [serial, device] of devices) {
    // deno-lint-ignore no-explicit-any
    const info = (device as any).getInfo();
    console.log(`Device ${index++}:`);
    console.log(`  Model: ${info.type}`);
    console.log(`  Serial: ${serial}`);
    console.log(
      `  Buttons: ${info.buttonCount} (${info.layout.columns}x${info.layout.rows})`,
    );
    console.log(
      `  Features: ${info.hasDials ? "Dials, " : ""}${
        info.hasLCD ? "LCD Screen" : ""
      }`,
    );
    console.log();
  }
}

// Main function
async function main() {
  try {
    // Initialize the device manager
    await deviceManager.initialize(true, 2000);

    // Get all connected devices
    const devices = deviceManager.getConnectedDevices();
    displayDeviceInfo(devices);

    console.log("Monitoring for device changes. Press Ctrl+C to exit.");

    // Set up interval to periodically display connected devices
    setInterval(() => {
      const devices = deviceManager.getConnectedDevices();
      displayDeviceInfo(devices);
    }, 5000);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the main function
if (import.meta.main) {
  await main();
}
