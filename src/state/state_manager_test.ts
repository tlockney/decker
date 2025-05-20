/**
 * Tests for State Manager
 */

import { assertEquals, assertExists } from "@std/assert";
import { PageActivatedEvent, StateManager, StateManagerEvent } from "./state_manager.ts";
import { DeckerConfig } from "../config/schema.ts";

// Test setup - sample configuration
const sampleConfig: DeckerConfig = {
  devices: {
    "DEVICE123": {
      name: "Test Device",
      pages: {
        "main": {
          buttons: {
            "0": {
              type: "launch_app",
              path: "/Applications/Calculator.app",
              text: "Calculator",
              color: "#FF0000",
            },
            "1": {
              type: "page_switch",
              target_page: "secondary",
              text: "Next Page",
              color: "#00FF00",
            },
          },
        },
        "secondary": {
          buttons: {
            "0": {
              type: "page_switch",
              target_page: "main",
              text: "Back",
              color: "#0000FF",
            },
          },
        },
      },
      default_page: "main",
    },
  },
  global_settings: {
    log_level: "info",
  },
  version: "1.0.0",
};

Deno.test("StateManager initializes correctly", () => {
  const stateManager = new StateManager(sampleConfig);

  // Should have initialized with the default page
  assertEquals(stateManager.getActivePage("DEVICE123"), "main");

  // Should have created button states for the main page
  const mainButtons = stateManager.getPageButtons("DEVICE123", "main");
  assertEquals(mainButtons.length, 2);

  // First button should be the calculator button
  const button0 = stateManager.getButtonState("DEVICE123", 0);
  assertExists(button0);
  assertEquals(button0.config.type, "launch_app");
  assertEquals(button0.config.text, "Calculator");

  // Second button should be the page switch button
  const button1 = stateManager.getButtonState("DEVICE123", 1);
  assertExists(button1);
  assertEquals(button1.config.type, "page_switch");
  assertEquals(button1.config.text, "Next Page");
});

Deno.test("StateManager handles page switching", () => {
  const stateManager = new StateManager(sampleConfig);
  let pageActivatedFired = false;

  // Listen for page activation events
  stateManager.on<PageActivatedEvent>(StateManagerEvent.PAGE_ACTIVATED, (data) => {
    pageActivatedFired = true;
    assertEquals(data.deviceSerial, "DEVICE123");
    assertEquals(data.pageId, "secondary");
    assertEquals(data.previousPageId, "main");
  });

  // Switch to secondary page
  const result = stateManager.setActivePage("DEVICE123", "secondary");
  assertEquals(result, true);
  assertEquals(pageActivatedFired, true);

  // The active page should now be secondary
  assertEquals(stateManager.getActivePage("DEVICE123"), "secondary");

  // Should have removed the main page buttons
  const mainButtons = stateManager.getPageButtons("DEVICE123", "main");
  assertEquals(mainButtons.length, 0);

  // Should have created button states for the secondary page
  const secondaryButtons = stateManager.getPageButtons("DEVICE123", "secondary");
  assertEquals(secondaryButtons.length, 1);

  // The button should be the back button
  const button0 = stateManager.getButtonState("DEVICE123", 0);
  assertExists(button0);
  assertEquals(button0.config.type, "page_switch");
  assertEquals(button0.config.text, "Back");
});

Deno.test("StateManager handles invalid page switching", () => {
  const stateManager = new StateManager(sampleConfig);

  // Try to switch to a non-existent page
  const result = stateManager.setActivePage("DEVICE123", "nonexistent");
  assertEquals(result, false);

  // The active page should still be main
  assertEquals(stateManager.getActivePage("DEVICE123"), "main");
});

Deno.test("StateManager handles configuration updates", () => {
  const stateManager = new StateManager(sampleConfig);
  let configChangedFired = false;

  // Listen for configuration change events
  stateManager.on(StateManagerEvent.CONFIGURATION_CHANGED, () => {
    configChangedFired = true;
  });

  // Create a new configuration with modified button text
  const newConfig = structuredClone(sampleConfig);
  newConfig.devices["DEVICE123"].pages["main"].buttons["0"].text = "Modified Calculator";

  // Update the configuration
  stateManager.updateConfig(newConfig);
  assertEquals(configChangedFired, true);

  // The button text should be updated
  const button = stateManager.getButtonState("DEVICE123", 0);
  assertExists(button);
  assertEquals(button.config.text, "Modified Calculator");
});

Deno.test("StateManager handles reset", () => {
  const stateManager = new StateManager(sampleConfig);
  let resetFired = false;

  // Listen for reset events
  stateManager.on(StateManagerEvent.STATE_RESET, () => {
    resetFired = true;
  });

  // Reset the state manager
  stateManager.reset();
  assertEquals(resetFired, true);

  // There should be no button states
  const deviceButtons = stateManager.getDeviceButtons("DEVICE123");
  assertEquals(deviceButtons, undefined);

  // There should be no active pages
  const activePage = stateManager.getActivePage("DEVICE123");
  assertEquals(activePage, undefined);
});
