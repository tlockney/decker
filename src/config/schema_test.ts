/**
 * Tests for Configuration Schema
 */

import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  ButtonConfig,
  DeckerConfig,
  isActionType,
  LaunchAppAction,
  PageSwitchAction,
} from "./schema.ts";

Deno.test("Configuration schema types are structurally correct", () => {
  // Create a sample configuration that should match our types
  const config: DeckerConfig = {
    devices: {
      "TEST_DEVICE": {
        name: "Test Device",
        pages: {
          "default": {
            buttons: {
              "0": {
                type: "launch_app",
                path: "/path/to/app",
                text: "App",
              },
              "1": {
                type: "page_switch",
                target_page: "page2",
                text: "Next",
              },
            },
          },
          "page2": {
            buttons: {
              "0": {
                type: "page_switch",
                target_page: "default",
                text: "Back",
              },
            },
          },
        },
      },
    },
  };

  // Test structural properties
  assertEquals(typeof config.devices["TEST_DEVICE"].name, "string");
  assertEquals(
    typeof config.devices["TEST_DEVICE"].pages["default"].buttons["0"].text,
    "string",
  );
});

Deno.test("Action type guards work correctly", () => {
  // Create buttons of different types
  const launchAppButton: ButtonConfig = {
    type: "launch_app",
    path: "/path/to/app",
    text: "App",
  };

  const pageSwitchButton: ButtonConfig = {
    type: "page_switch",
    target_page: "page2",
    text: "Next",
  };

  // Test type guards
  if (isActionType<LaunchAppAction>(launchAppButton, "launch_app")) {
    assertEquals(launchAppButton.path, "/path/to/app");
  } else {
    throw new Error("Type guard failed for LaunchAppAction");
  }

  if (isActionType<PageSwitchAction>(pageSwitchButton, "page_switch")) {
    assertEquals(pageSwitchButton.target_page, "page2");
  } else {
    throw new Error("Type guard failed for PageSwitchAction");
  }

  // Negative test - should not match wrong type
  if (isActionType<LaunchAppAction>(pageSwitchButton, "launch_app")) {
    throw new Error("Type guard incorrectly passed for wrong type");
  }
});

Deno.test("Configuration can be loaded from JSON", async () => {
  try {
    // Load the example configuration file
    const configText = await Deno.readTextFile(
      "./examples/config.json",
    );
    const config = JSON.parse(configText) as DeckerConfig;

    // Basic validation of the loaded configuration
    assertInstanceOf(config.devices, Object);
    assertEquals(
      config.global_settings?.log_level,
      "info",
    );

    // Check a specific button
    const device = Object.values(config.devices)[0];
    const defaultPage = device.pages["default"];
    const button = defaultPage.buttons["0"];

    assertEquals(button.type, "launch_app");

    if (isActionType<LaunchAppAction>(button, "launch_app")) {
      assertEquals(button.path, "/Applications/Calculator.app");
    } else {
      throw new Error("Type guard failed for loaded LaunchAppAction");
    }
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === "NotFound") {
      console.warn("Example config.json not found, skipping test");
      return;
    }
    throw error;
  }
});
