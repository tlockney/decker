/**
 * Configuration Loader
 *
 * This module provides functionality for loading configuration files
 * from various locations and parsing them into typed configuration objects.
 */

import { dirname, fromFileUrl, join } from "@std/path";
import { DeckerConfig } from "./schema.ts";
import { deepMerge } from "../utils/utils.ts";

/**
 * Default configuration filename
 */
export const DEFAULT_CONFIG_FILENAME = "decker.json";

/**
 * Error thrown when configuration loading fails
 */
export class ConfigurationError extends Error {
  constructor(message: string, public override cause?: unknown) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Result of a configuration loading operation
 */
export interface ConfigLoadResult {
  /** The loaded configuration */
  config: DeckerConfig;
  /** The path to the loaded configuration file */
  configPath: string;
}

/**
 * Configuration loader class that handles finding, loading, and parsing
 * configuration files.
 */
export class ConfigLoader {
  /**
   * Standard locations to look for configuration files
   */
  private static readonly STANDARD_LOCATIONS = [
    ".", // Current working directory
    join(Deno.env.get("HOME") || "~", ".config", "decker"), // User config directory
  ];

  /**
   * Default configuration template
   */
  private static readonly DEFAULT_CONFIG: DeckerConfig = {
    devices: {},
    global_settings: {
      log_level: "info",
    },
    version: "1.0.0",
  };

  /**
   * Attempts to load a configuration file from a specific path
   *
   * @param configPath The path to the configuration file
   * @returns The loaded configuration and its path
   * @throws ConfigurationError if loading fails
   */
  public async loadFromPath(configPath: string): Promise<ConfigLoadResult> {
    try {
      // Normalize the path
      const normalizedPath = configPath.startsWith("file://")
        ? fromFileUrl(configPath)
        : configPath;

      // Read the file
      const configText = await Deno.readTextFile(normalizedPath);

      // Parse the JSON
      const config = JSON.parse(configText) as DeckerConfig;

      return {
        config,
        configPath: normalizedPath,
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new ConfigurationError(`Configuration file not found: ${configPath}`, error);
      } else if (error instanceof SyntaxError) {
        throw new ConfigurationError(`Invalid JSON in configuration file: ${configPath}`, error);
      } else {
        throw new ConfigurationError(`Error loading configuration from ${configPath}`, error);
      }
    }
  }

  /**
   * Searches for a configuration file in standard locations
   *
   * @param filename The configuration filename to look for (default: decker.json)
   * @returns The path to the found configuration file, or null if not found
   */
  public async findConfigFile(filename = DEFAULT_CONFIG_FILENAME): Promise<string | null> {
    // Check each standard location
    for (const location of ConfigLoader.STANDARD_LOCATIONS) {
      const configPath = join(location, filename);
      try {
        const stat = await Deno.stat(configPath);
        if (stat.isFile) {
          return configPath;
        }
      } catch (error) {
        // File doesn't exist or can't be accessed, continue to next location
        if (!(error instanceof Deno.errors.NotFound)) {
          console.warn(`Error checking config path ${configPath}:`, error);
        }
      }
    }

    return null;
  }

  /**
   * Loads configuration from standard locations, with optional custom path
   *
   * @param customPath Optional path to a specific configuration file
   * @returns The loaded configuration and its path
   * @throws ConfigurationError if no configuration can be loaded
   */
  public async loadConfig(customPath?: string): Promise<ConfigLoadResult> {
    // If a custom path is provided, try to load from there first
    if (customPath) {
      try {
        return await this.loadFromPath(customPath);
      } catch (error) {
        if (error instanceof ConfigurationError) {
          throw error; // Re-throw configuration errors
        } else {
          throw new ConfigurationError(`Failed to load configuration from ${customPath}`, error);
        }
      }
    }

    // Try to find a configuration file in standard locations
    const configPath = await this.findConfigFile();
    if (configPath) {
      try {
        return await this.loadFromPath(configPath);
      } catch (error) {
        throw new ConfigurationError(`Error loading config from ${configPath}`, error);
      }
    }

    // If no configuration is found, return a default configuration
    // Since this is a default config with no file, we'll use the current directory
    // as the config path
    return {
      config: structuredClone(ConfigLoader.DEFAULT_CONFIG),
      configPath: join(Deno.cwd(), DEFAULT_CONFIG_FILENAME),
    };
  }

  /**
   * Gets the directory containing the configuration file
   *
   * @param configPath The path to the configuration file
   * @returns The directory containing the configuration file
   */
  public getConfigDirectory(configPath: string): string {
    return dirname(configPath);
  }

  /**
   * Resolves a path relative to the configuration file
   *
   * @param configPath The path to the configuration file
   * @param relativePath The path to resolve
   * @returns The absolute path
   */
  public resolveConfigPath(configPath: string, relativePath: string): string {
    // If the path is already absolute, return it as-is
    if (relativePath.startsWith("/")) {
      return relativePath;
    }

    // Otherwise, resolve it relative to the config directory
    const configDir = this.getConfigDirectory(configPath);
    return join(configDir, relativePath);
  }

  /**
   * Combines multiple configuration objects into a single configuration
   *
   * @param configs The configuration objects to merge
   * @returns The merged configuration
   */
  public mergeConfigs(...configs: DeckerConfig[]): DeckerConfig {
    // Start with an empty configuration
    const baseConfig: DeckerConfig = structuredClone(ConfigLoader.DEFAULT_CONFIG);

    // Apply each configuration in order
    return configs.reduce((result, config) => {
      return deepMerge(result, config);
    }, baseConfig);
  }

  /**
   * Saves the configuration to a file
   *
   * @param config The configuration to save
   * @param configPath The path to save the configuration to
   * @throws ConfigurationError if saving fails
   */
  public async saveConfig(
    config: DeckerConfig,
    configPath: string,
  ): Promise<void> {
    try {
      // Format the JSON with indentation for better readability
      const configText = JSON.stringify(config, null, 2);

      // Write the file
      await Deno.writeTextFile(configPath, configText);
    } catch (error) {
      throw new ConfigurationError(`Error saving configuration to ${configPath}`, error);
    }
  }
}
