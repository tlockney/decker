#!/usr/bin/env -S deno run --allow-all

/**
 * Decker Application Example
 *
 * This example demonstrates using the unified DeckerApp interface
 * to create a Stream Deck application with minimal code.
 */

import { DeckerApp } from "../mod.ts";

/**
 * Creates a simple configuration for the example
 */
function createExampleConfig() {
  return {
    version: "1.0.0",
    global_settings: {
      log_level: "info",
    },
    devices: {
      // Will be populated dynamically when devices connect
    },
  };
}

/**
 * Main function
 */
async function main() {
  console.log("Decker Application Example");
  console.log("--------------------------");

  try {
    // Create a configuration
    const config = createExampleConfig();

    // Create and initialize the Decker application
    const app = new DeckerApp({
      config,
      autoConnect: true,
      logEvents: true,
      devicePollingInterval: 2000,
    });

    // Initialize the application
    await app.initialize();
    
    // Event handler for device connection
    app.onDeviceEvent("device_connected", (deviceInfo) => {
      // deno-lint-ignore no-explicit-any
      const info = deviceInfo as any;
      console.log(`Device connected handler: ${info.type} (${info.serialNumber})`);
      
      // Set up device configuration if not exists
      setupDeviceConfig(app, info.serialNumber);
    });

    // Start the application
    await app.start();

    // Set up already connected devices
    const devices = app.getConnectedDevices();
    
    for (const [serialNumber] of devices) {
      setupDeviceConfig(app, serialNumber);
    }

    console.log("\nDecker application running. Press Ctrl+C to exit.");
    
    // Keep running until user interrupts
    await new Promise(() => {
      // This promise intentionally never resolves
    });
  } catch (error) {
    console.error("Error in Decker application example:", error);
  }
}

/**
 * Setup device configuration for a newly connected device
 */
function setupDeviceConfig(app: DeckerApp, serialNumber: string) {
  // Get the current configuration
  const config = app["config"];
  
  // Skip if device already configured
  if (config.devices[serialNumber]) {
    return;
  }
  
  // Get device info
  const device = app.getDevice(serialNumber);
  if (!device) return;
  
  const deviceInfo = device.getInfo();
  
  // Create button configurations based on the device layout
  const mainButtons: Record<string, unknown> = {};
  const toolsButtons: Record<string, unknown> = {};
  
  // Create buttons for the main page
  for (let i = 0; i < deviceInfo.buttonCount; i++) {
    if (i === 0) {
      // Tools page button
      mainButtons[i.toString()] = {
        type: "page_switch",
        text: "Tools",
        color: "#8800FF",
        text_color: "#FFFFFF",
        pageId: "tools",
      };
    } else if (i === 1) {
      // Counter button using inline code
      mainButtons[i.toString()] = {
        type: "inline_code",
        text: "Count: 0",
        color: "#00AAFF",
        text_color: "#FFFFFF",
        code: `
          // Get current count from button text or initialize to 0
          let count = 0;
          const textMatch = context.buttonState.visual.text?.match(/Count: (\\d+)/);
          if (textMatch) {
            count = parseInt(textMatch[1], 10) || 0;
          }
          
          // Increment counter
          count++;
          
          // Update button text
          context.buttonState.updateVisual({
            text: \`Count: \${count}\`
          });
          
          return count;
        `,
        showResult: false,
      };
    } else if (i === 2) {
      // Current time button using inline code
      mainButtons[i.toString()] = {
        type: "inline_code",
        text: "Time",
        color: "#00AA00",
        text_color: "#FFFFFF",
        code: `
          // Get and format current time
          const now = new Date();
          const time = now.toLocaleTimeString();
          
          // Update button text
          updateButton(time);
          
          return time;
        `,
        showResult: true,
        maxResultLength: 8,
      };
    } else {
      // Generic buttons
      mainButtons[i.toString()] = {
        type: "none",
        text: `Button ${i}`,
        color: "#888888",
        text_color: "#FFFFFF",
      };
    }
  }
  
  // Create buttons for the tools page
  for (let i = 0; i < deviceInfo.buttonCount; i++) {
    if (i === 0) {
      // Back button
      toolsButtons[i.toString()] = {
        type: "page_switch",
        text: "Back",
        color: "#FF0000",
        text_color: "#FFFFFF",
        pageId: "main",
      };
    } else if (i === 1) {
      // HTTP request to get IP
      toolsButtons[i.toString()] = {
        type: "http_request",
        text: "My IP",
        color: "#AA00AA",
        text_color: "#FFFFFF",
        url: "https://api.ipify.org",
        method: "GET",
        showResponse: true,
        maxResponseLength: 15,
      };
    } else if (i === 2) {
      // Execute date command
      toolsButtons[i.toString()] = {
        type: "execute_script",
        text: "Date",
        color: "#FFA500",
        text_color: "#000000",
        command: Deno.build.os === "windows" ? "cmd.exe" : "date",
        args: Deno.build.os === "windows" ? ["/c", "date /t"] : [],
        showOutput: true,
        maxOutputLength: 15,
      };
    } else {
      // Generic buttons
      toolsButtons[i.toString()] = {
        type: "none",
        text: "",
        color: "#444422",
        text_color: "#FFFFFF",
      };
    }
  }
  
  // Update the config
  config.devices[serialNumber] = {
    name: deviceInfo.type,
    default_page: "main",
    pages: {
      "main": {
        buttons: mainButtons,
      },
      "tools": {
        buttons: toolsButtons,
      },
    },
  };
  
  // Update the application config
  app.updateConfig(config);
  
  console.log(`Device ${serialNumber} configured with pages: main, tools`);
}

// Run the main function
if (import.meta.main) {
  await main();
}