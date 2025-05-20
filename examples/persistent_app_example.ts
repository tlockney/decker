#!/usr/bin/env -S deno run --allow-all

/**
 * Persistent Application Example
 *
 * This example demonstrates using the state persistence capabilities
 * to save and restore application state between sessions.
 */

import { DeckerApp } from "../mod.ts";
import { join } from "@std/path";

/**
 * Creates a simple configuration for the example
 */
function createExampleConfig() {
  return {
    version: "1.0.0",
    global_settings: {
      log_level: "info" as "debug" | "info" | "warn" | "error",
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
  console.log("Decker Persistent Application Example");
  console.log("-------------------------------------");

  try {
    // Create a configuration
    const config = createExampleConfig();

    // Create and initialize the Decker application with persistence enabled
    const app = new DeckerApp({
      config,
      autoConnect: true,
      logEvents: true,
      devicePollingInterval: 2000,
      // Enable persistence with custom options
      enablePersistence: true,
      persistenceOptions: {
        stateDir: "./data",
        stateFile: "persistent_app.json",
        prettyPrint: true,
        autoSaveInterval: 5000 // Save every 5 seconds
      },
      loadPersistedState: true
    });

    // Initialize the application
    await app.initialize();
    
    // Check if we have saved state
    const hasState = await app.hasState();
    console.log(`Persisted state exists: ${hasState}`);
    
    // Event handler for device connection
    app.onDeviceEvent("device_connected", (deviceInfo) => {
      // deno-lint-ignore no-explicit-any
      const info = deviceInfo as any;
      console.log(`Device connected handler: ${info.type} (${info.serialNumber})`);
      
      // Set up device configuration if not exists
      setupDeviceConfig(app, info.serialNumber);
    });
    
    // Register event handlers for state changes
    app.onStateEvent("navigation_updated", (data) => {
      // deno-lint-ignore no-explicit-any
      const navData = data as any;
      console.log(`Navigation updated for device ${navData.deviceSerial}: ${JSON.stringify(navData.history)}`);
    });
    
    app.onStateEvent("state_saved", (data) => {
      // deno-lint-ignore no-explicit-any
      const saveData = data as any;
      console.log(`State saved to ${saveData.path} at ${new Date(saveData.timestamp).toISOString()}`);
    });
    
    app.onStateEvent("state_loaded", (data) => {
      // deno-lint-ignore no-explicit-any
      const loadData = data as any;
      console.log(`State loaded from ${loadData.path} at ${new Date(loadData.timestamp).toISOString()}`);
    });

    // Start the application
    await app.start();

    // Set up already connected devices
    const devices = app.getConnectedDevices();
    
    for (const [serialNumber] of devices) {
      setupDeviceConfig(app, serialNumber);
    }

    console.log("\nPersistent application running:");
    console.log("- State will be auto-saved every 5 seconds");
    console.log("- State will be saved when the app stops");
    console.log("- State will be loaded when the app starts next time");
    console.log("- Try using the counter button and then restart the app");
    console.log("\nPress Ctrl+C to exit");
    
    // Create data directory if needed
    await Deno.mkdir("./data", { recursive: true });
    
    // Keep running until user interrupts
    await new Promise<void>((resolve) => {
      // Handle Ctrl+C
      Deno.addSignalListener("SIGINT", async () => {
        console.log("\nSaving state and shutting down...");
        await app.stop();
        resolve();
      });
    });
  } catch (error) {
    console.error("Error in persistent application example:", error);
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
  const settingsButtons: Record<string, unknown> = {};
  
  // Create buttons for the main page
  for (let i = 0; i < deviceInfo.buttonCount; i++) {
    if (i === 0) {
      // Counter button - stateful to demonstrate persistence
      mainButtons[i.toString()] = {
        type: "inline_code",
        text: "Count: 0",
        color: "#0066FF",
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
          
          // Make the button stateful (for persistence)
          context.buttonState.customState = { count };
          
          return count;
        `,
        showResult: false,
        stateful: true, // Important for persistence
      };
    } else if (i === 1) {
      // Navigation button
      mainButtons[i.toString()] = {
        type: "page_switch",
        text: "Settings",
        color: "#AA00AA",
        text_color: "#FFFFFF",
        pageId: "settings",
        pushToStack: true, // Enable back navigation
      };
    } else if (i === 2) {
      // Toggle button - also persisted
      mainButtons[i.toString()] = {
        type: "inline_code",
        text: "Toggle",
        color: "#888888",
        text_color: "#FFFFFF",
        code: `
          // Toggle between active/inactive state
          const isActive = context.buttonState.customState === "active";
          
          // Update state
          context.buttonState.customState = isActive ? undefined : "active";
          
          // Update visual
          context.buttonState.updateVisual({
            color: isActive ? "#888888" : "#FF0000",
            text: isActive ? "Toggle" : "ON"
          });
          
          return isActive ? "off" : "on";
        `,
        stateful: true, // Important for persistence
      };
    } else if (i === 3) {
      // Date/time - updated each press
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
          context.buttonState.updateVisual({
            text: time
          });
          
          return time;
        `,
        showResult: true,
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
  
  // Create buttons for the settings page
  for (let i = 0; i < deviceInfo.buttonCount; i++) {
    if (i === 0) {
      // Back button (using navigation history)
      settingsButtons[i.toString()] = {
        type: "inline_code",
        text: "Back",
        color: "#FF0000",
        text_color: "#FFFFFF",
        code: `
          // Find the state manager (should be available in context)
          const stateManager = context.data?.stateManager;
          if (!stateManager) {
            throw new Error("State manager not found in context");
          }
          
          // Navigate back
          const success = await stateManager.navigateBack(context.buttonState.deviceSerial);
          return success ? "Back OK" : "No history";
        `,
        args: {
          stateManager: app["stateManager"]
        }
      };
    } else if (i === 1) {
      // Save state button
      settingsButtons[i.toString()] = {
        type: "inline_code",
        text: "Save State",
        color: "#00AACC",
        text_color: "#FFFFFF",
        code: `
          // Find the app in the context
          const stateManager = context.data?.stateManager;
          if (!stateManager) {
            throw new Error("State manager not found in context");
          }
          
          // Save state
          await stateManager.saveState();
          
          // Update button text to show success
          context.buttonState.updateVisual({
            text: "Saved!"
          });
          
          // Reset after 1 second
          setTimeout(() => {
            context.buttonState.updateVisual({
              text: "Save State"
            });
          }, 1000);
          
          return "State saved";
        `,
        args: {
          stateManager: app["stateManager"]
        }
      };
    } else if (i === 2) {
      // Reset counter button
      settingsButtons[i.toString()] = {
        type: "inline_code",
        text: "Reset Count",
        color: "#FF8800",
        text_color: "#000000",
        code: `
          // Find the button state for the counter
          const stateManager = context.data?.stateManager;
          const deviceSerial = context.buttonState.deviceSerial;
          
          if (!stateManager) {
            throw new Error("State manager not found in context");
          }
          
          // Get counter button (main page, index 0)
          const counterButton = stateManager.getButton(deviceSerial, "main", 0);
          if (!counterButton) {
            throw new Error("Counter button not found");
          }
          
          // Reset counter
          counterButton.customState = { count: 0 };
          counterButton.updateVisual({
            text: "Count: 0" 
          });
          
          // Update this button text to show success
          context.buttonState.updateVisual({
            text: "Reset Done"
          });
          
          // Reset after 1 second
          setTimeout(() => {
            context.buttonState.updateVisual({
              text: "Reset Count"
            });
          }, 1000);
          
          return "Counter reset";
        `,
        args: {
          stateManager: app["stateManager"]
        }
      };
    } else {
      // Generic buttons
      settingsButtons[i.toString()] = {
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
      "settings": {
        buttons: settingsButtons,
      },
    },
  };
  
  // Update the application config
  app.updateConfig(config);
  
  console.log(`Device ${serialNumber} configured with pages: main, settings`);
}

// Run the main function
if (import.meta.main) {
  await main();
}