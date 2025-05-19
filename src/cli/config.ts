#!/usr/bin/env -S deno run --allow-all

/**
 * Configuration CLI Tool
 *
 * This tool provides command-line utilities for working with Decker
 * configuration files, including validation, initialization, and inspection.
 */

import { ConfigLoader, DEFAULT_CONFIG_FILENAME } from "../config/loader.ts";
import { DeckerConfig } from "../config/schema.ts";
import { ConfigValidator } from "../config/validator.ts";
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
    init [path]                    Create a new configuration file
    validate [path] [--path <key>] Validate an existing configuration file
    info [path]                    Show information about a configuration file
    schema [output_path]           Generate JSON Schema for configuration validation
    
  Options:
    --help, -h                     Show this help message
    --path <key>                   Validate a specific path within the configuration
    
  Examples:
    config.ts init                        # Create a new configuration in the current directory
    config.ts init my-config.json         # Create a new configuration at the specified path
    config.ts validate                    # Validate the entire configuration
    config.ts validate --path devices     # Validate only the devices section
    config.ts validate --path devices.ABC123.pages.main  # Validate a specific page
    config.ts info                        # Show information about the loaded configuration
    config.ts schema                      # Print schema to console
    config.ts schema schema.json          # Save schema to file
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

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

// Validate a configuration file
async function validateConfig(configPath?: string, path?: string): Promise<void> {
  const loader = new ConfigLoader();
  const validator = new ConfigValidator();
  let errorCount = 0;

  try {
    // Load the configuration
    const result = await loader.loadConfig(configPath);
    console.log(`Validating configuration from: ${colors.cyan}${result.configPath}${colors.reset}`);

    if (path) {
      // Validate a specific path within the configuration
      console.log(`\nValidating path: ${colors.blue}${path}${colors.reset}`);

      try {
        // Check if the path exists before validating
        const parts = path.split(".");
        let currentValue: unknown = result.config;

        for (const part of parts) {
          if (currentValue == null || typeof currentValue !== "object") {
            console.log(
              `${colors.red}Error:${colors.reset} Path ${colors.blue}${path}${colors.reset} not found in configuration`,
            );
            Deno.exit(1);
          }
          currentValue = (currentValue as Record<string, unknown>)[part];
        }

        const pathResults = validator.validatePaths(result.config, [path]);
        const pathResult = pathResults[path];

        if (pathResult.valid) {
          console.log(
            `\n${colors.green}✓ Success:${colors.reset} Configuration path '${colors.blue}${path}${colors.reset}' is valid.`,
          );
        } else {
          console.log(
            `\n${colors.red}✗ Error:${colors.reset} Configuration path '${colors.blue}${path}${colors.reset}' is invalid:`,
          );
          pathResult.errors.forEach((error, index) => {
            console.log(`  ${colors.bold}${index + 1}.${colors.reset} ${error}`);
            errorCount++;
          });
        }
      } catch (error) {
        console.log(
          `${colors.red}Error:${colors.reset} Unable to validate path ${colors.blue}${path}${colors.reset}`,
        );
        if (error instanceof Error) {
          console.log(`  ${colors.red}→${colors.reset} ${error.message}`);
        }
        errorCount++;
      }
    } else {
      // Validate the entire configuration
      console.log(`\nValidating full configuration...`);
      const validationResult = validator.validateWithDetails(result.config);

      if (validationResult.valid) {
        console.log(`\n${colors.green}✓ Success:${colors.reset} Configuration is valid.`);
      } else {
        console.log(`\n${colors.red}✗ Error:${colors.reset} Configuration has validation errors:`);
        validationResult.errors.forEach((error, index) => {
          console.log(`  ${colors.bold}${index + 1}.${colors.reset} ${error}`);
          errorCount++;
        });
      }
    }

    // Summary
    console.log("\nValidation Summary:");
    if (errorCount > 0) {
      console.log(`${colors.red}Found ${errorCount} errors${colors.reset}`);
      Deno.exit(1);
    } else {
      console.log(`${colors.green}No errors found${colors.reset}`);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`\n${colors.red}Error validating configuration:${colors.reset} ${error.message}`);
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

// Generate and export the JSON schema for configuration
async function generateSchema(outputPath?: string): Promise<void> {
  const validator = new ConfigValidator();

  try {
    // Generate the schema
    const schema = validator.generateJsonSchema();
    const schemaJson = JSON.stringify(schema, null, 2);

    if (outputPath) {
      // Save to file
      await Deno.writeTextFile(outputPath, schemaJson);
      console.log(
        `${colors.green}✓ Success:${colors.reset} Schema exported to ${colors.cyan}${outputPath}${colors.reset}`,
      );
    } else {
      // Print to console
      console.log(`${colors.cyan}Schema:${colors.reset}`);
      console.log(schemaJson);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`${colors.red}Error generating schema:${colors.reset} ${error.message}`);
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

    case "validate": {
      let pathToValidate: string | undefined = undefined;

      // Check for --path parameter
      const pathIndex = args.indexOf("--path");
      if (pathIndex !== -1 && args.length > pathIndex + 1) {
        pathToValidate = args[pathIndex + 1];
      }

      await validateConfig(configPath, pathToValidate);
      break;
    }

    case "info":
      await showConfigInfo(configPath);
      break;

    case "schema":
      await generateSchema(configPath);
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
