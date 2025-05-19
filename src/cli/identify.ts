#!/usr/bin/env -S deno run --allow-all

/**
 * Stream Deck Device Identifier
 *
 * A tool to help identify and test Stream Deck devices by lighting up
 * buttons in sequence, allowing users to visually identify which device
 * is which when multiple devices are connected.
 */

import { DeviceManager } from "../devices/device_manager.ts";
import { StreamDeckDevice } from "../devices/stream_deck_device.ts";
import { NAME, VERSION } from "../version.ts";
import { DeviceEventType } from "../types/types.ts";

// Banner display function
function displayBanner(): void {
  console.log(`
  ${NAME} v${VERSION} - Device Identifier
  -------------------------------------
  This tool helps you identify Stream Deck devices by 
  lighting up buttons in sequence.
  `);
}

// Display help message
function displayHelp(): void {
  console.log(`
  Usage: identify.ts [options]
  
  Options:
    --help, -h      Show this help message
    --list, -l      List connected devices and exit
    --test, -t      Test mode (light up all buttons at once)
    --device, -d    Specify device serial number
    --delay, -D     Delay between button light-up in ms (default: 100)
    --cycles, -c    Number of identification cycles (default: 3)
    --mode, -m      Identification mode: 'sequence' or 'fade' (default: 'sequence')
  
  Examples:
    identify.ts -l                   # List connected devices
    identify.ts -d ABC123            # Identify device with serial ABC123
    identify.ts -c 5 -D 200          # Run 5 cycles with 200ms delay
    identify.ts -m fade              # Use fade effect for identification
  `);
}

// List connected devices
function listDevices(devices: Map<string, StreamDeckDevice>): void {
  console.log(`\nFound ${devices.size} Stream Deck device(s):\n`);

  if (devices.size === 0) {
    console.log("No Stream Deck devices found. Please connect a device and try again.");
    return;
  }

  let index = 1;
  for (const [serial, device] of devices) {
    const info = device.getInfo();
    console.log(`Device ${index++}:`);
    console.log(`  Model: ${info.type}`);
    console.log(`  Serial: ${serial}`);
    console.log(`  Buttons: ${info.buttonCount} (${info.layout.columns}x${info.layout.rows})`);
    console.log(`  Features: ${info.hasDials ? "Dials, " : ""}${info.hasLCD ? "LCD Screen" : ""}`);
    console.log();
  }
}

// Run identification sequence on a device
async function identifyDevice(
  device: StreamDeckDevice,
  cycles: number = 3,
  delay: number = 100,
  mode: "sequence" | "fade" = "sequence",
): Promise<void> {
  const info = device.getInfo();
  console.log(`Identifying device: ${info.type} (S/N: ${info.serialNumber})`);

  // Clear all buttons before starting
  await device.clearAllButtons();

  // Create color arrays for sequence and fade modes
  const colors = [
    { r: 255, g: 0, b: 0 }, // Red
    { r: 0, g: 255, b: 0 }, // Green
    { r: 0, g: 0, b: 255 }, // Blue
    { r: 255, g: 255, b: 0 }, // Yellow
    { r: 255, g: 0, b: 255 }, // Magenta
    { r: 0, g: 255, b: 255 }, // Cyan
  ];

  // Progress tracker
  let currentCycle = 1;

  // Run the identification cycles
  try {
    while (currentCycle <= cycles) {
      console.log(`Cycle ${currentCycle}/${cycles}`);

      if (mode === "sequence") {
        // Light up buttons in sequence
        for (let i = 0; i < info.buttonCount; i++) {
          const colorIndex = i % colors.length;
          const { r, g, b } = colors[colorIndex];

          await device.setButtonColor(i, r, g, b);
          await new Promise((resolve) => setTimeout(resolve, delay));
          await device.clearButton(i);
        }
      } else if (mode === "fade") {
        // Fade all buttons through colors
        for (const color of colors) {
          for (let i = 0; i < info.buttonCount; i++) {
            await device.setButtonColor(i, color.r, color.g, color.b);
          }
          await new Promise((resolve) => setTimeout(resolve, delay * 5));
        }
        await device.clearAllButtons();
      }

      // Short pause between cycles
      await new Promise((resolve) => setTimeout(resolve, delay * 3));
      currentCycle++;
    }

    console.log("Identification complete!");
  } catch (error) {
    console.error("Error during identification:", error);
  } finally {
    // Make sure to clear all buttons when done
    await device.clearAllButtons();
  }
}

// Test a device by lighting up all buttons
async function testDevice(device: StreamDeckDevice): Promise<void> {
  const info = device.getInfo();
  console.log(`Testing device: ${info.type} (S/N: ${info.serialNumber})`);

  try {
    // Light up all buttons with different colors
    for (let i = 0; i < info.buttonCount; i++) {
      const r = Math.floor(Math.random() * 255);
      const g = Math.floor(Math.random() * 255);
      const b = Math.floor(Math.random() * 255);
      await device.setButtonColor(i, r, g, b);
    }

    console.log("All buttons lit. Press any button on the device to exit.");

    // Wait for a button press to exit
    return new Promise((resolve) => {
      const listener = () => {
        device.clearAllButtons()
          .then(() => {
            console.log("Test complete!");
            device.removeAllListeners(DeviceEventType.BUTTON_PRESSED);
            resolve();
          })
          .catch(console.error);
      };

      device.on(DeviceEventType.BUTTON_PRESSED, listener);
    });
  } catch (error) {
    console.error("Error during testing:", error);
    await device.clearAllButtons();
  }
}

// Parse command line arguments
function parseArgs(): {
  help: boolean;
  list: boolean;
  test: boolean;
  deviceSerial?: string;
  delay: number;
  cycles: number;
  mode: "sequence" | "fade";
} {
  const args = Deno.args;
  const options = {
    help: false,
    list: false,
    test: false,
    deviceSerial: undefined as string | undefined,
    delay: 100,
    cycles: 3,
    mode: "sequence" as "sequence" | "fade",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--list":
      case "-l":
        options.list = true;
        break;
      case "--test":
      case "-t":
        options.test = true;
        break;
      case "--device":
      case "-d":
        if (nextArg && !nextArg.startsWith("-")) {
          options.deviceSerial = nextArg;
          i++;
        }
        break;
      case "--delay":
      case "-D":
        if (nextArg && !nextArg.startsWith("-")) {
          options.delay = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--cycles":
      case "-c":
        if (nextArg && !nextArg.startsWith("-")) {
          options.cycles = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--mode":
      case "-m":
        if (nextArg && (nextArg === "sequence" || nextArg === "fade")) {
          options.mode = nextArg;
          i++;
        }
        break;
    }
  }

  return options;
}

// Main function
async function main(): Promise<void> {
  displayBanner();

  const options = parseArgs();

  if (options.help) {
    displayHelp();
    return;
  }

  try {
    // Initialize the device manager
    const deviceManager = new DeviceManager();
    await deviceManager.initialize();
    const devices = deviceManager.getConnectedDevices();

    if (devices.size === 0) {
      console.log("No Stream Deck devices found. Please connect a device and try again.");
      await deviceManager.close();
      return;
    }

    if (options.list) {
      listDevices(devices);
      await deviceManager.close();
      return;
    }

    let targetDevice: StreamDeckDevice | undefined;

    if (options.deviceSerial) {
      // Use specific device
      targetDevice = deviceManager.getDevice(options.deviceSerial);
      if (!targetDevice) {
        console.error(`Device with serial ${options.deviceSerial} not found.`);
        listDevices(devices);
        await deviceManager.close();
        return;
      }
    } else if (devices.size === 1) {
      // If only one device is connected, use that
      targetDevice = devices.values().next().value;
    } else {
      // Multiple devices, ask user to choose
      console.log("Multiple devices found. Please specify a device with --device/-d option.");
      listDevices(devices);
      console.log("Example: identify.ts -d <SERIAL_NUMBER>");
      await deviceManager.close();
      return;
    }

    if (targetDevice) {
      if (options.test) {
        await testDevice(targetDevice);
      } else {
        await identifyDevice(targetDevice, options.cycles, options.delay, options.mode);
      }
    } else {
      console.error("No target device found.");
    }

    // Clean up
    await deviceManager.close();
    console.log("Done. Exiting...");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the main function if this is the main module
if (import.meta.main) {
  await main();
}
