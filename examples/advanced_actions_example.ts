#!/usr/bin/env -S deno run --allow-all

/**
 * Advanced Actions Example
 *
 * This example demonstrates using advanced action types like HTTP requests
 * and page switching to create more interactive Stream Deck applications.
 */

import { DeviceManager } from "../src/devices/device_manager.ts";
import { DeviceEventType } from "../src/types/types.ts";
import { RenderingManager, StateRenderer } from "../src/rendering/mod.ts";
import { StateManager } from "../src/state/state_manager.ts";
import { ButtonConfig, DeckerConfig } from "../src/config/schema.ts";
import { ActionRegistry } from "../src/actions/registry.ts";
import {
  ActionExecutionEventData,
  ActionExecutor,
  ActionResultEventData,
  ExecutorEvent,
} from "../src/actions/executor.ts";
import { StateActionIntegration } from "../src/actions/state_integration.ts";
import { LaunchAppActionFactory } from "../src/actions/launch_app_action.ts";
import { ExecuteScriptActionFactory } from "../src/actions/execute_script_action.ts";
import { HttpRequestActionFactory } from "../src/actions/http_request_action.ts";
import { PageSwitchActionFactory } from "../src/actions/page_switch_action.ts";
import { InlineCodeActionFactory } from "../src/actions/inline_code_action.ts";

/**
 * Creates the action registry and registers action factories
 */
function createActionRegistry(stateManager: StateManager): ActionRegistry {
  const registry = new ActionRegistry();

  // Register built-in actions
  registry.register(new LaunchAppActionFactory());
  registry.register(new ExecuteScriptActionFactory());

  // Register HTTP request action
  registry.register(new HttpRequestActionFactory());

  // Register page switch action (requires state manager)
  registry.register(new PageSwitchActionFactory(stateManager));

  // Register inline code execution action
  registry.register(new InlineCodeActionFactory());

  return registry;
}

/**
 * Creates a configuration for the example
 */
function createExampleConfig(): DeckerConfig {
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

    // Create different pages for demonstration
    const mainButtons: Record<string, ButtonConfig> = {};
    const weatherButtons: Record<string, ButtonConfig> = {};
    const toolsButtons: Record<string, ButtonConfig> = {};

    // Populate main page buttons
    for (let i = 0; i < deviceInfo.buttonCount; i++) {
      if (i === 0) {
        // Weather API button
        mainButtons[i.toString()] = {
          type: "page_switch",
          text: "Weather",
          color: "#0088FF",
          text_color: "#FFFFFF",
          pageId: "weather",
        };
      } else if (i === 1) {
        // Tools page button
        mainButtons[i.toString()] = {
          type: "page_switch",
          text: "Tools",
          color: "#8800FF",
          text_color: "#FFFFFF",
          pageId: "tools",
        };
      } else if (i === 2) {
        // Launch app action (opens system calculator)
        mainButtons[i.toString()] = {
          type: "launch_app",
          text: "Calculator",
          color: "#6A0DAD", // Purple
          text_color: "#FFFFFF",
          path: Deno.build.os === "windows"
            ? "calc.exe"
            : Deno.build.os === "darwin"
            ? "open"
            : "gnome-calculator",
          args: Deno.build.os === "darwin" ? ["-a", "Calculator"] : [],
          show: true,
        };
      } else if (i === 3) {
        // HTTP request to GitHub API
        mainButtons[i.toString()] = {
          type: "http_request",
          text: "GitHub API",
          color: "#2DA44E", // GitHub green
          text_color: "#FFFFFF",
          url: "https://api.github.com/zen",
          method: "GET",
          showResponse: true,
          maxResponseLength: 20,
        };
      } else if (i === 4) {
        // Inline code execution to generate a random color
        mainButtons[i.toString()] = {
          type: "inline_code",
          text: "Random Color",
          color: "#8B4513", // Brown
          text_color: "#FFFFFF",
          code: `
            // Generate a random hex color and update the button
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            // Update button color
            context.buttonState.updateVisual({
              color: randomColor,
              text: "Random\\nColor"
            });
            return randomColor;
          `,
          showResult: false,
        };
      } else {
        // Other buttons get generic settings
        mainButtons[i.toString()] = {
          type: "none",
          text: `Button ${i}`,
          color: "#888888",
          text_color: "#FFFFFF",
        };
      }
    }

    // Populate weather page buttons
    for (let i = 0; i < deviceInfo.buttonCount; i++) {
      if (i === 0) {
        // Back button
        weatherButtons[i.toString()] = {
          type: "page_switch",
          text: "Back",
          color: "#FF0000",
          text_color: "#FFFFFF",
          pageId: "main",
        };
      } else if (i === 1) {
        // Current weather for New York City
        weatherButtons[i.toString()] = {
          type: "http_request",
          text: "NYC Weather",
          color: "#00AAFF",
          text_color: "#FFFFFF",
          url: "https://wttr.in/NewYork?format=3",
          method: "GET",
          showResponse: true,
          maxResponseLength: 20,
        };
      } else if (i === 2) {
        // Current weather for London
        weatherButtons[i.toString()] = {
          type: "http_request",
          text: "London",
          color: "#00AAFF",
          text_color: "#FFFFFF",
          url: "https://wttr.in/London?format=3",
          method: "GET",
          showResponse: true,
          maxResponseLength: 20,
        };
      } else if (i === 3) {
        // Current weather for Tokyo
        weatherButtons[i.toString()] = {
          type: "http_request",
          text: "Tokyo",
          color: "#00AAFF",
          text_color: "#FFFFFF",
          url: "https://wttr.in/Tokyo?format=3",
          method: "GET",
          showResponse: true,
          maxResponseLength: 20,
        };
      } else if (i === 4) {
        // Current weather for Sydney
        weatherButtons[i.toString()] = {
          type: "http_request",
          text: "Sydney",
          color: "#00AAFF",
          text_color: "#FFFFFF",
          url: "https://wttr.in/Sydney?format=3",
          method: "GET",
          showResponse: true,
          maxResponseLength: 20,
        };
      } else if (i === 5) {
        // Inline code for local temperature conversion
        weatherButtons[i.toString()] = {
          type: "inline_code",
          text: "°F ↔ °C",
          color: "#5F9EA0", // Cadet Blue
          text_color: "#FFFFFF",
          code: `
            // Create a stateful converter that toggles between F and C
            const state = context.buttonState.getCustomData() || { 
              mode: 'to_c', 
              value: 72,
              display: '72°F'
            };
            
            if (state.mode === 'to_c') {
              // Convert F to C
              const celsius = Math.round((state.value - 32) * 5 / 9);
              state.mode = 'to_f';
              state.value = celsius;
              state.display = \`\${celsius}°C\`;
            } else {
              // Convert C to F
              const fahrenheit = Math.round((state.value * 9 / 5) + 32);
              state.mode = 'to_c';
              state.value = fahrenheit;
              state.display = \`\${fahrenheit}°F\`;
            }
            
            // Store the updated state
            context.buttonState.setCustomData(state);
            
            // Update the button
            context.buttonState.updateVisual({
              text: state.display
            });
            
            return state.display;
          `,
          showResult: true,
          maxResultLength: 20,
        };
      } else {
        // Other buttons get generic settings
        weatherButtons[i.toString()] = {
          type: "none",
          text: "",
          color: "#222244",
          text_color: "#FFFFFF",
        };
      }
    }

    // Populate tools page buttons
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
        // Show date
        toolsButtons[i.toString()] = {
          type: "execute_script",
          text: "Date",
          color: "#FFA500", // Orange
          text_color: "#000000",
          command: Deno.build.os === "windows" ? "cmd.exe" : "date",
          args: Deno.build.os === "windows" ? ["/c", "date /t"] : [],
          showOutput: true,
          maxOutputLength: 15,
        };
      } else if (i === 2) {
        // Show IP address
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
      } else if (i === 3) {
        // Show UUID
        toolsButtons[i.toString()] = {
          type: "execute_script",
          text: "UUID",
          color: "#00AA00",
          text_color: "#FFFFFF",
          command: "deno",
          args: ["eval", "console.log(crypto.randomUUID())"],
          showOutput: true,
          maxOutputLength: 15,
        };
      } else if (i === 4) {
        // Inline code execution to get current time
        toolsButtons[i.toString()] = {
          type: "inline_code",
          text: "Time",
          color: "#0055AA",
          text_color: "#FFFFFF",
          code: `
            // Format the current time as HH:MM:SS
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');
            return \`\${hours}:\${minutes}:\${seconds}\`;
          `,
          showResult: true,
          maxResultLength: 10,
        };
      } else {
        // Other buttons get generic settings
        toolsButtons[i.toString()] = {
          type: "none",
          text: "",
          color: "#444422",
          text_color: "#FFFFFF",
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
        "weather": {
          buttons: weatherButtons,
        },
        "tools": {
          buttons: toolsButtons,
        },
      },
    };

    // Reinitialize the state manager with the updated config
    stateManager.updateConfig(config);
    console.log(`Added device ${deviceSerial} to configuration`);
  }
}

/**
 * Main function for the advanced actions example
 */
async function main(): Promise<void> {
  console.log("Stream Deck Advanced Actions Example");
  console.log("-----------------------------------");

  try {
    // Create the configuration
    const config = createExampleConfig();

    // Create the state manager
    const stateManager = new StateManager(config);

    // Create the action registry and register action factories
    const actionRegistry = createActionRegistry(stateManager);

    // Create the device manager
    const deviceManager = new DeviceManager();

    // Create the rendering manager
    const renderingManager = new RenderingManager();

    // Create the state renderer to connect state and rendering
    const stateRenderer = new StateRenderer(stateManager, renderingManager);

    // Create the action executor
    const actionExecutor = new ActionExecutor();

    // Create the state action integration
    new StateActionIntegration(
      stateManager,
      actionRegistry,
      actionExecutor,
      {
        autoTriggerActions: true,
        updateVisualState: true,
      },
    );

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

    // Action execution event logging
    actionExecutor.on(ExecutorEvent.ACTION_STARTED, (data: ActionExecutionEventData) => {
      console.log(
        `Action started: ${data.action.getType()} on button ${data.context.buttonState.buttonIndex}`,
      );
    });

    actionExecutor.on(ExecutorEvent.ACTION_COMPLETED, (data: ActionResultEventData) => {
      console.log(`Action completed: ${data.action.getType()} with result: ${data.result.message}`);
    });

    actionExecutor.on(ExecutorEvent.ACTION_FAILED, (data: ActionResultEventData) => {
      console.error(`Action failed: ${data.action.getType()} with error: ${data.result.message}`);
    });

    // Instructions
    console.log("\nAdvanced Actions Example");
    console.log("\nMain Page:");
    console.log("- Press 'Weather' button to switch to the Weather page");
    console.log("- Press 'Tools' button to switch to the Tools page");
    console.log("- Press 'Calculator' to launch calculator app");
    console.log("- Press 'GitHub API' to fetch a random quote from GitHub");
    console.log("- Press 'Random Color' to generate and apply a random color");
    console.log("\nWeather Page:");
    console.log("- Press 'Back' to return to the main page");
    console.log("- Press city buttons to fetch current weather for that city");
    console.log("- Press '°F ↔ °C' to toggle between Fahrenheit and Celsius");
    console.log("\nTools Page:");
    console.log("- Press 'Back' to return to the main page");
    console.log("- Press 'Date' to show current date");
    console.log("- Press 'My IP' to fetch your public IP address");
    console.log("- Press 'UUID' to generate a random UUID");
    console.log("- Press 'Time' to display the current time using inline code");
    console.log("\nPress Ctrl+C to exit");

    // Keep the application running
    await new Promise(() => {
      // This promise intentionally never resolves
    });
  } catch (error) {
    console.error("Error in advanced actions example:", error);
  } finally {
    // Clean up resources
    console.log("Cleaning up resources...");
  }
}

// Run the main function
if (import.meta.main) {
  await main();
}
