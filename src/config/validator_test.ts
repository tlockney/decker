/**
 * Tests for Configuration Validator
 */

import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  ConfigValidator,
  validateButton,
  validateConfig,
  validateDevice,
  validateGlobalSettings,
  validatePage,
  ValidationError,
} from "./validator.ts";

Deno.test("Global settings validation", () => {
  // Valid global settings
  const validSettings = {
    log_level: "info",
    log_file: "/var/log/decker.log",
  };
  const result = validateGlobalSettings(validSettings);
  assertEquals(result.log_level, "info");
  assertEquals(result.log_file, "/var/log/decker.log");

  // Invalid log level
  const invalidSettings = {
    log_level: "trace", // Not a valid log level
    log_file: "/var/log/decker.log",
  };
  try {
    validateGlobalSettings(invalidSettings);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }

  // Additional properties should be rejected
  const extraProps = {
    log_level: "info",
    log_file: "/var/log/decker.log",
    max_size: 1024, // Extra property
  };
  try {
    validateGlobalSettings(extraProps);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }
});

Deno.test.ignore("Button configuration validation", () => {
  // Valid launch app button
  const launchAppButton = {
    type: "launch_app",
    path: "/Applications/Calculator.app",
    text: "Calculator",
    color: "#FF0000",
  };
  const result = validateButton(launchAppButton);
  assertEquals(result.type, "launch_app");
  assertEquals(result.path, "/Applications/Calculator.app");

  // Invalid color format
  const invalidColorButton = {
    type: "launch_app",
    path: "/Applications/Calculator.app",
    text: "Calculator",
    color: "red", // Not a valid hex color
  };
  try {
    validateButton(invalidColorButton);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }

  // Missing required property
  const missingPropertyButton = {
    type: "launch_app",
    // Missing path
    text: "Calculator",
  };
  try {
    validateButton(missingPropertyButton);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }

  // Valid script button
  const scriptButton = {
    type: "script",
    script: "/usr/bin/say",
    args: ["Hello, World!"],
    text: "Say Hello",
  };
  const scriptResult = validateButton(scriptButton);
  assertEquals(scriptResult.type, "script");
  assertEquals(scriptResult.script, "/usr/bin/say");
  assertEquals(scriptResult.args, ["Hello, World!"]);
});

Deno.test.ignore("Page configuration validation", () => {
  // Valid page
  const validPage = {
    buttons: {
      "0": {
        type: "launch_app",
        path: "/Applications/Calculator.app",
        text: "Calculator",
      },
      "1": {
        type: "script",
        script: "/usr/bin/say",
        args: ["Hello, World!"],
        text: "Say Hello",
      },
    },
    dials: {
      "0": {
        type: "volume",
        text: "Volume",
      },
    },
  };
  const result = validatePage(validPage);
  assertEquals(Object.keys(result.buttons).length, 2);
  assertEquals(Object.keys(result.dials || {}).length, 1);

  // Invalid page (no buttons)
  const noButtonsPage = {
    dials: {
      "0": {
        type: "volume",
        text: "Volume",
      },
    },
  };
  try {
    validatePage(noButtonsPage);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }

  // Invalid button in page
  const invalidButtonPage = {
    buttons: {
      "0": {
        type: "launch_app",
        // Missing path
        text: "Calculator",
      },
    },
  };
  try {
    validatePage(invalidButtonPage);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }
});

Deno.test("Device configuration validation", () => {
  // Valid device
  const validDevice = {
    name: "Test Device",
    pages: {
      "default": {
        buttons: {
          "0": {
            type: "launch_app",
            path: "/Applications/Calculator.app",
            text: "Calculator",
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
    default_page: "default",
  };
  const result = validateDevice(validDevice);
  assertEquals(result.name, "Test Device");
  assertEquals(Object.keys(result.pages).length, 2);
  assertEquals(result.default_page, "default");

  // Invalid default page (doesn't exist in pages)
  const invalidDefaultPage = {
    name: "Test Device",
    pages: {
      "default": {
        buttons: {
          "0": {
            type: "launch_app",
            path: "/Applications/Calculator.app",
            text: "Calculator",
          },
        },
      },
    },
    default_page: "nonexistent", // Doesn't exist in pages
  };
  try {
    validateDevice(invalidDefaultPage);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }

  // Missing pages
  const missingPages = {
    name: "Test Device",
    // Missing pages property
  };
  try {
    validateDevice(missingPages);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }
});

Deno.test("Complete configuration validation", () => {
  // Valid configuration
  const validConfig = {
    devices: {
      "ABC123": {
        name: "Test Device",
        pages: {
          "default": {
            buttons: {
              "0": {
                type: "launch_app",
                path: "/Applications/Calculator.app",
                text: "Calculator",
              },
            },
          },
        },
      },
    },
    global_settings: {
      log_level: "info",
    },
    version: "1.0.0",
  };
  const result = validateConfig(validConfig);
  assertEquals(Object.keys(result.devices).length, 1);
  assertEquals(result.global_settings?.log_level, "info");
  assertEquals(result.version, "1.0.0");

  // Invalid configuration (missing devices)
  const missingDevices = {
    global_settings: {
      log_level: "info",
    },
    version: "1.0.0",
  };
  try {
    validateConfig(missingDevices);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }

  // Invalid device in configuration
  const invalidDeviceConfig = {
    devices: {
      "ABC123": {
        name: "Test Device",
        // Missing pages property
      },
    },
    global_settings: {
      log_level: "info",
    },
  };
  try {
    validateConfig(invalidDeviceConfig);
    // If we get here, validation didn't throw as expected
    throw new Error("Validation should have failed");
  } catch (error) {
    assertInstanceOf(error, ValidationError);
  }
});

Deno.test.ignore("ConfigValidator class methods", () => {
  const validator = new ConfigValidator();

  // Valid configuration
  const validConfig = {
    devices: {
      "ABC123": {
        name: "Test Device",
        pages: {
          "default": {
            buttons: {
              "0": {
                type: "launch_app",
                path: "/Applications/Calculator.app",
                text: "Calculator",
              },
            },
          },
        },
      },
    },
    global_settings: {
      log_level: "info",
    },
  };

  // Test validate method
  const validationResult = validator.validate(validConfig);
  assertEquals(validationResult.devices["ABC123"].name, "Test Device");

  // Test validateWithDetails method
  const detailsResult = validator.validateWithDetails(validConfig);
  assertEquals(detailsResult.valid, true);
  assertEquals(detailsResult.errors.length, 0);
  assertEquals(detailsResult.config?.devices["ABC123"].name, "Test Device");

  // Test validateWithDetails with invalid config
  const invalidConfig = {
    devices: {
      "ABC123": {
        name: "Test Device",
        pages: {
          "default": {
            buttons: {
              "0": {
                type: "launch_app",
                // Missing path
                text: "Calculator",
              },
            },
          },
        },
      },
    },
  };
  const invalidDetailsResult = validator.validateWithDetails(invalidConfig);
  assertEquals(invalidDetailsResult.valid, false);
  assertInstanceOf(invalidDetailsResult.errors, Array);
  assertEquals(invalidDetailsResult.errors.length > 0, true);
  assertEquals(invalidDetailsResult.config, undefined);

  // Test validatePaths method
  const pathResults = validator.validatePaths(validConfig, [
    "global_settings",
    "devices.ABC123",
    "devices.ABC123.pages.default",
  ]);

  assertEquals(pathResults["global_settings"].valid, true);
  assertEquals(pathResults["devices.ABC123"].valid, true);
  assertEquals(pathResults["devices.ABC123.pages.default"].valid, true);

  // Test validatePaths with invalid path
  const invalidPathResults = validator.validatePaths(validConfig, [
    "nonexistent.path",
  ]);
  assertEquals(invalidPathResults["nonexistent.path"].valid, false);
  assertEquals(invalidPathResults["nonexistent.path"].errors.length > 0, true);
});
