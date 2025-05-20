#!/usr/bin/env -S deno run --allow-all

/**
 * Action Framework Example
 *
 * This example demonstrates using the action framework to create
 * interactive buttons with different types of actions.
 */

import { DeviceManager } from "../src/devices/device_manager.ts";
import { DeviceEventType } from "../src/types/types.ts";
import { RenderingManager, StateRenderer } from "../src/rendering/mod.ts";
import { StateManager } from "../src/state/state_manager.ts";
// Import required modules
import { ButtonConfig, DeckerConfig } from "../src/config/schema.ts";
import { Action, ActionContext, ActionResult, ActionStatus } from "../src/actions/types.ts";
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

// Custom action implementations
class CounterAction implements Action {
  private id = crypto.randomUUID();
  private executing = false;
  private count = 0;

  constructor(private config: Record<string, unknown>) {
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    this.executing = true;

    try {
      // Get the step size from config or default to 1
      const step = typeof this.config.step === "number" ? this.config.step : 1;

      // Update the counter
      this.count += step;

      // Update the button text to show the count
      context.buttonState.updateVisual({
        text: `Count: ${this.count}`,
      });

      this.executing = false;
      return {
        status: ActionStatus.SUCCESS,
        message: `Counter incremented to ${this.count}`,
        data: { count: this.count },
        timestamp: Date.now(),
      };
    } catch (error) {
      this.executing = false;
      return {
        status: ActionStatus.FAILURE,
        message: `Failed to update counter: ${
          error instanceof Error ? error.message : String(error)
        }`,
        data: error,
        timestamp: Date.now(),
      };
    }
  }

  isExecuting(): boolean {
    return this.executing;
  }

  isCancellable(): boolean {
    return false;
  }

  getId(): string {
    return this.id;
  }

  getType(): string {
    return "counter";
  }
}

class DelayedAction implements Action {
  private id = crypto.randomUUID();
  private executing = false;
  private cancellationRequested = false;
  private abortController?: AbortController;

  constructor(private config: Record<string, unknown>) {
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    this.executing = true;
    this.cancellationRequested = false;
    this.abortController = new AbortController();

    const signal = this.abortController.signal;
    const duration = typeof this.config.duration === "number" ? this.config.duration : 5000;

    try {
      // Set initial text
      context.buttonState.updateVisual({
        text: `Wait ${duration / 1000}s`,
      });

      let timeLeft = duration;
      const interval = 200; // Update every 200ms

      // Wait for the specified duration, updating the text periodically
      while (timeLeft > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(interval, timeLeft)));

        if (signal.aborted) {
          throw new Error("Action cancelled");
        }

        timeLeft -= interval;
        const seconds = Math.ceil(timeLeft / 1000);

        context.buttonState.updateVisual({
          text: `${seconds}s left`,
        });
      }

      this.executing = false;
      return {
        status: ActionStatus.SUCCESS,
        message: "Delay completed",
        timestamp: Date.now(),
      };
    } catch (error) {
      this.executing = false;

      if (this.cancellationRequested) {
        return {
          status: ActionStatus.CANCELLED,
          message: "Delay cancelled",
          timestamp: Date.now(),
        };
      }

      return {
        status: ActionStatus.FAILURE,
        message: `Delay failed: ${error instanceof Error ? error.message : String(error)}`,
        data: error,
        timestamp: Date.now(),
      };
    }
  }

  async cancel(): Promise<boolean> {
    if (!this.executing || !this.abortController) {
      return false;
    }

    this.cancellationRequested = true;
    this.abortController.abort();
    return true;
  }

  isExecuting(): boolean {
    return this.executing;
  }

  isCancellable(): boolean {
    return true;
  }

  getId(): string {
    return this.id;
  }

  getType(): string {
    return "delay";
  }
}

class ToggleAction implements Action {
  private id = crypto.randomUUID();
  private executing = false;
  constructor(private config: Record<string, unknown>) {
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    this.executing = true;

    try {
      const buttonState = context.buttonState;
      const isActive = buttonState.customState === "active";

      // Use active color from config if available
      const activeColor = this.config.active_color as string || "#FF0000";

      // Toggle the state
      buttonState.customState = isActive ? undefined : "active";

      // Update button color based on state
      buttonState.updateVisual({
        color: buttonState.customState === "active" ? activeColor : buttonState.config.color,
      });

      this.executing = false;
      return {
        status: ActionStatus.SUCCESS,
        message: isActive ? "Toggled off" : "Toggled on",
        data: { state: buttonState.customState },
        timestamp: Date.now(),
      };
    } catch (error) {
      this.executing = false;
      return {
        status: ActionStatus.FAILURE,
        message: `Toggle failed: ${error instanceof Error ? error.message : String(error)}`,
        data: error,
        timestamp: Date.now(),
      };
    }
  }

  isExecuting(): boolean {
    return this.executing;
  }

  isCancellable(): boolean {
    return false;
  }

  getId(): string {
    return this.id;
  }

  getType(): string {
    return "toggle";
  }
}

/**
 * Creates the action registry and registers action factories
 */
function createActionRegistry(): ActionRegistry {
  const registry = new ActionRegistry();

  // Register the counter action
  registry.register({
    create: (config: Record<string, unknown>) => new CounterAction(config),
    getType: () => "counter",
    validate: () => true,
  });

  // Register the delayed action
  registry.register({
    create: (config: Record<string, unknown>) => new DelayedAction(config),
    getType: () => "delay",
    validate: () => true,
  });

  // Register the toggle action
  registry.register({
    create: (config: Record<string, unknown>) => new ToggleAction(config),
    getType: () => "toggle",
    validate: () => true,
  });

  // Register the launch app action
  registry.register(new LaunchAppActionFactory());

  // Register the execute script action
  registry.register(new ExecuteScriptActionFactory());

  return registry;
}

/**
 * Creates a simple configuration for the example
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

    // Create pages based on button count
    const mainButtons: Record<string, ButtonConfig> = {};

    // Populate buttons based on device layout
    for (let i = 0; i < deviceInfo.buttonCount; i++) {
      if (i === 0) {
        // Counter button
        mainButtons[i.toString()] = {
          type: "counter",
          text: "Count: 0",
          color: "#0000FF",
          text_color: "#FFFFFF",
        };
      } else if (i === 1) {
        // Delayed action button
        mainButtons[i.toString()] = {
          type: "delay",
          text: "Delay 5s",
          color: "#00FF00",
          text_color: "#000000",
          duration: 5000, // 5 seconds
        };
      } else if (i === 2) {
        // Toggle action button (stateful)
        mainButtons[i.toString()] = {
          type: "toggle",
          text: "Toggle",
          color: "#888888",
          text_color: "#FFFFFF",
          active_color: "#FF0000",
          stateful: true,
        };
      } else if (i === 3) {
        // Launch app action (opens system calculator)
        mainButtons[i.toString()] = {
          type: "launch_app",
          text: "Calc",
          color: "#6A0DAD", // Purple
          text_color: "#FFFFFF",
          path: Deno.build.os === "windows" ? "calc.exe" : 
                Deno.build.os === "darwin" ? "open" : "gnome-calculator",
          args: Deno.build.os === "darwin" ? ["-a", "Calculator"] : [],
          show: true,
        };
      } else if (i === 4) {
        // Execute script action (date command)
        mainButtons[i.toString()] = {
          type: "execute_script",
          text: "Date",
          color: "#FFA500", // Orange
          text_color: "#000000",
          command: Deno.build.os === "windows" ? "cmd.exe" : "date",
          args: Deno.build.os === "windows" ? ["/c", "date /t"] : [],
          showOutput: true,
          maxOutputLength: 10,
        };
      } else {
        // Other buttons get generic settings
        mainButtons[i.toString()] = {
          type: "example",
          text: `Button ${i}`,
          color: "#888888",
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
      },
    };

    // Reinitialize the state manager with the updated config
    stateManager.updateConfig(config);
    console.log(`Added device ${deviceSerial} to configuration`);
  }
}

/**
 * Main function for the action framework example
 */
async function main(): Promise<void> {
  console.log("Stream Deck Action Framework Example");
  console.log("-----------------------------------");

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

    // Create the action registry and register action factories
    const actionRegistry = createActionRegistry();

    // Create the action executor
    const actionExecutor = new ActionExecutor();

    // Create the state action integration
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

    actionExecutor.on(ExecutorEvent.ACTION_CANCELLED, (data: ActionResultEventData) => {
      console.log(`Action cancelled: ${data.action.getType()}`);
    });

    // Instructions
    console.log("\nInteraction Guide:");
    console.log("- Press the Counter button to increment a counter");
    console.log("- Press the Delay button to start a countdown (cancellable)");
    console.log("- Press the Toggle button to toggle its state");
    console.log("- Press the Calc button to launch calculator app");
    console.log("- Press the Date button to execute a date command");
    console.log("\nPress Ctrl+C to exit");

    // Keep the application running
    await new Promise(() => {
      // This promise intentionally never resolves
    });
  } catch (error) {
    console.error("Error in action framework example:", error);
  } finally {
    // Clean up resources
    console.log("Cleaning up resources...");
  }
}

// Run the main function
if (import.meta.main) {
  await main();
}
