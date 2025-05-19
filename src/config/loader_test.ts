/**
 * Tests for Configuration Loader
 */

import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { ConfigLoader, ConfigurationError, DEFAULT_CONFIG_FILENAME } from "./loader.ts";

// Get the directory of the current test file
const TEST_DIR = dirname(fromFileUrl(import.meta.url));
const EXAMPLES_DIR = join(dirname(dirname(TEST_DIR)), "examples");
const EXAMPLE_CONFIG_PATH = join(EXAMPLES_DIR, "config.json");

Deno.test("ConfigLoader can load configuration from a specific path", async () => {
  const loader = new ConfigLoader();

  // Load the example configuration
  const result = await loader.loadFromPath(EXAMPLE_CONFIG_PATH);

  // Verify the configuration is loaded correctly
  assertEquals(result.configPath, EXAMPLE_CONFIG_PATH);
  assertEquals(typeof result.config, "object");
  assertEquals(result.config.global_settings?.log_level, "info");
  assertNotEquals(Object.keys(result.config.devices).length, 0);
});

Deno.test("ConfigLoader throws appropriate errors for invalid paths", async () => {
  const loader = new ConfigLoader();
  const nonExistentPath = join(EXAMPLES_DIR, "non_existent.json");

  // Test loading from a non-existent path
  await assertRejects(
    () => loader.loadFromPath(nonExistentPath),
    ConfigurationError,
    "not found",
  );
});

Deno.test("ConfigLoader can find configuration files in standard locations", async () => {
  // Create a temporary config file in the current directory
  const tempConfigPath = join(Deno.cwd(), DEFAULT_CONFIG_FILENAME);
  const tempConfig = {
    devices: {},
    global_settings: { log_level: "debug" },
    version: "1.0.0-test",
  };

  try {
    // Write temporary config
    await Deno.writeTextFile(
      tempConfigPath,
      JSON.stringify(tempConfig),
    );

    const loader = new ConfigLoader();
    const foundPath = await loader.findConfigFile();

    // The file should be found
    assertNotEquals(foundPath, null);

    // Check that the found file path ends with the expected filename
    // Instead of checking the entire path which can vary by environment
    const foundFilename = foundPath!.split("/").pop();
    assertEquals(foundFilename, DEFAULT_CONFIG_FILENAME);
  } finally {
    // Clean up - remove the temporary file
    try {
      await Deno.remove(tempConfigPath);
    } catch (error) {
      console.warn(`Error cleaning up temp config file: ${error}`);
    }
  }
});

Deno.test("ConfigLoader can merge multiple configurations", () => {
  const loader = new ConfigLoader();

  const baseConfig = {
    devices: {
      "DEVICE1": {
        name: "Device 1",
        pages: {
          "default": {
            buttons: {
              "0": {
                type: "text",
                text: "Base",
              },
            },
          },
        },
      },
    },
    global_settings: {
      log_level: "info" as const,
    },
    version: "1.0.0",
  };

  const overrideConfig = {
    devices: {
      "DEVICE1": {
        pages: {
          "default": {
            buttons: {
              "0": {
                type: "text", // Added required type property
                text: "Override",
              },
              "1": {
                type: "text",
                text: "New",
              },
            },
          },
        },
      },
      "DEVICE2": {
        name: "Device 2",
        pages: {
          "default": {
            buttons: {},
          },
        },
      },
    },
    global_settings: {
      log_level: "debug" as const,
    },
  };

  // Merge the configurations
  const mergedConfig = loader.mergeConfigs(baseConfig, overrideConfig);

  // Verify the merged configuration
  assertEquals(mergedConfig.global_settings?.log_level, "debug"); // Override
  assertEquals(Object.keys(mergedConfig.devices).length, 2); // Both devices
  assertEquals(mergedConfig.devices["DEVICE1"].name, "Device 1"); // Preserved
  assertEquals(mergedConfig.devices["DEVICE1"].pages["default"].buttons["0"].text, "Override"); // Overridden
  assertEquals(mergedConfig.devices["DEVICE1"].pages["default"].buttons["1"].text, "New"); // Added
  assertEquals(mergedConfig.devices["DEVICE2"].name, "Device 2"); // Added
  assertEquals(mergedConfig.version, "1.0.0"); // Preserved
});

Deno.test("ConfigLoader can resolve paths relative to the configuration file", () => {
  const loader = new ConfigLoader();
  const configPath = "/path/to/config/decker.json";
  const relativePath = "images/button.png";

  const absolutePath = loader.resolveConfigPath(configPath, relativePath);

  assertEquals(absolutePath, "/path/to/config/images/button.png");
});
