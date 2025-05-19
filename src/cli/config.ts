#!/usr/bin/env -S deno run --allow-all

/**
 * Configuration CLI Tool
 *
 * This tool provides command-line utilities for working with Decker
 * configuration files, including validation, initialization, and inspection.
 */

import { ConfigLoader, DEFAULT_CONFIG_FILENAME } from "../config/loader.ts";
import { DeckerConfig } from "../config/schema.ts";
import { NAME, VERSION } from "../version.ts";
import { join } from "@std/path";

// Display banner
function displayBanner(): void {
  console.log(`
  ${NAME} v${VERSION} - Configuration Manager
  ------------------------------------------
  `);
}

// Display help
function displayHelp(): void {
  console.log(`
  Usage: config.ts [options] <command>
  
  Commands:
    init [path]      Create a new configuration file
    validate [path]  Validate an existing configuration file
    info [path]      Show information about a configuration file
    
  Options:
    --help, -h       Show this help message
    
  Examples:
    config.ts init                # Create a new configuration in the current directory
    config.ts init my-config.json # Create a new configuration at the specified path
    config.ts validate            # Validate the configuration in standard locations
    config.ts info                # Show information about the loaded configuration
  `);
}

// Create a new default configuration
async function initializeConfig(configPath?: string): Promise<void> {
  const loader = new ConfigLoader();

  // Determine the path for the new configuration
  const targetPath = configPath || join(Deno.cwd(), DEFAULT_CONFIG_FILENAME);

  try {
    // Check if the file already exists
    try {
      await Deno.stat(targetPath);
      console.error(`Error: Configuration file already exists at ${targetPath}`);
      console.log("Use --force to overwrite the existing file (not yet implemented)");
      return;
    } catch (err: unknown) {
      // File doesn't exist, which is what we want
      if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
      }
    }

    // Create a default configuration
    const defaultConfig: DeckerConfig = {
      devices: {},
      global_settings: {
        log_level: "info",
      },
      version: VERSION,
    };

    // Save the configuration
    await loader.saveConfig(defaultConfig, targetPath);

    console.log(`Configuration file created at: ${targetPath}`);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Error creating configuration file: ${error.message}`);
  }
}

// Validate a configuration file
async function validateConfig(configPath?: string): Promise<void> {
  const loader = new ConfigLoader();

  try {
    // Load the configuration
    const result = await loader.loadConfig(configPath);

    // Basic structural validation
    if (!result.config.devices) {
      console.error("Error: Invalid configuration - missing 'devices' property");
      Deno.exit(1);
    }

    // More detailed validation will be implemented in the validator module

    console.log(`Configuration file at ${result.configPath} is valid.`);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Error validating configuration: ${error.message}`);
    Deno.exit(1);
  }
}

// Show information about a configuration
async function showConfigInfo(configPath?: string): Promise<void> {
  const loader = new ConfigLoader();

  try {
    // Load the configuration
    const result = await loader.loadConfig(configPath);
    const { config, configPath: loadedPath } = result;

    console.log(`\nConfiguration file: ${loadedPath}`);
    console.log(`Version: ${config.version || "unspecified"}`);
    console.log(`Log level: ${config.global_settings?.log_level || "unspecified"}`);

    // Device information
    const deviceCount = Object.keys(config.devices).length;
    console.log(`\nDevices: ${deviceCount}`);

    if (deviceCount > 0) {
      for (const [serial, device] of Object.entries(config.devices)) {
        console.log(`\n  Device: ${device.name || "Unnamed"} (${serial})`);

        // Page information
        const pageCount = Object.keys(device.pages).length;
        console.log(`  Pages: ${pageCount}`);

        for (const [pageName, page] of Object.entries(device.pages)) {
          const buttonCount = Object.keys(page.buttons).length;
          const dialCount = page.dials ? Object.keys(page.dials).length : 0;

          console.log(`    - ${pageName}: ${buttonCount} buttons, ${dialCount} dials`);
        }
      }
    } else {
      console.log("  No devices configured.");
    }

    console.log("");
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Error loading configuration: ${error.message}`);
    Deno.exit(1);
  }
}

// Main function
async function main(): Promise<void> {
  displayBanner();

  const args = Deno.args;

  // No arguments, show help
  if (args.length === 0) {
    displayHelp();
    return;
  }

  // Parse command
  const command = args[0];
  let configPath: string | undefined = undefined;

  // Check for config path argument
  if (args.length > 1 && !args[1].startsWith("-")) {
    configPath = args[1];
  }

  // Process command
  switch (command) {
    case "init":
      await initializeConfig(configPath);
      break;

    case "validate":
      await validateConfig(configPath);
      break;

    case "info":
      await showConfigInfo(configPath);
      break;

    case "--help":
    case "-h":
      displayHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      displayHelp();
      Deno.exit(1);
  }
}

// Run the main function if this is the main module
if (import.meta.main) {
  await main();
}
