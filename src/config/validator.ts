/**
 * Configuration Validator
 *
 * This module provides validation for configuration objects
 * using Zod for schema-based validation.
 */

import { z } from "zod";
import {
  ButtonConfig,
  DeckerConfig,
  DeviceConfig,
  DialConfig,
  GlobalSettings,
  PageConfig,
} from "./schema.ts";

/**
 * Error thrown when configuration validation fails
 */
export class ValidationError extends Error {
  constructor(message: string, public override cause?: unknown) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Zod schema for global settings
 */
export const globalSettingsSchema = z.object({
  log_file: z.string().optional(),
  log_level: z.enum(["debug", "info", "warn", "error"]).optional(),
}).strict();

/**
 * Zod schema for button visual properties
 */
export const buttonVisualSchema = z.object({
  image: z.string().optional(),
  text: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  font_size: z.number().positive().optional(),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

/**
 * Zod schema for basic button configuration
 */
export const baseButtonSchema = buttonVisualSchema.extend({
  type: z.string(),
  state_images: z.record(z.string(), z.string()).optional(),
  stateful: z.boolean().optional(),
}).passthrough(); // Allow additional properties for different action types

/**
 * Zod schema for launch app action
 */
export const launchAppSchema = baseButtonSchema.extend({
  type: z.literal("launch_app"),
  path: z.string(),
});

/**
 * Zod schema for script execution action
 */
export const scriptSchema = baseButtonSchema.extend({
  type: z.literal("script"),
  script: z.string(),
  args: z.array(z.string()).optional(),
});

/**
 * Zod schema for page switch action
 */
export const pageSwitchSchema = baseButtonSchema.extend({
  type: z.literal("page_switch"),
  target_page: z.string(),
});

/**
 * Zod schema for HTTP request action
 */
export const httpRequestSchema = baseButtonSchema.extend({
  type: z.literal("http"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
});

/**
 * Zod schema for inline code execution action
 */
export const inlineCodeSchema = baseButtonSchema.extend({
  type: z.literal("inline_code"),
  language: z.enum(["javascript"]),
  code: z.string(),
});

/**
 * Union of all button action schemas
 * Using a regular union instead of discriminated union to avoid validation issues
 */
export const buttonSchema = z.union([
  launchAppSchema,
  scriptSchema,
  pageSwitchSchema,
  httpRequestSchema,
  inlineCodeSchema,
  // Fallback for custom button types
  baseButtonSchema,
]);

/**
 * Zod schema for dial configuration
 */
export const dialSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
}).passthrough(); // Allow additional properties for different dial types

/**
 * Zod schema for page configuration
 */
export const pageSchema = z.object({
  buttons: z.record(z.string(), buttonSchema),
  dials: z.record(z.string(), dialSchema).optional(),
}).strict();

/**
 * Zod schema for device configuration
 */
export const deviceSchema = z.object({
  name: z.string().optional(),
  pages: z.record(z.string(), pageSchema),
  default_page: z.string().optional(),
}).strict();

/**
 * Zod schema for the entire configuration
 */
export const configSchema = z.object({
  devices: z.record(z.string(), deviceSchema),
  global_settings: globalSettingsSchema.optional(),
  version: z.string().optional(),
}).strict();

/**
 * Validates a global settings object
 *
 * @param settings The global settings to validate
 * @returns The validated settings
 * @throws ValidationError if validation fails
 */
export function validateGlobalSettings(settings: unknown): GlobalSettings {
  try {
    return globalSettingsSchema.parse(settings);
  } catch (error) {
    // Ensure all errors are wrapped as ValidationError
    if (error instanceof z.ZodError || error instanceof Error) {
      const message = error instanceof z.ZodError
        ? `Invalid global settings: ${error.message}`
        : error.message;
      throw new ValidationError(message, error);
    }
    throw new ValidationError(String(error));
  }
}

/**
 * Validates a button configuration
 *
 * @param button The button configuration to validate
 * @returns The validated button configuration
 * @throws ValidationError if validation fails
 */
export function validateButton(button: unknown): ButtonConfig {
  try {
    return buttonSchema.parse(button);
  } catch (error) {
    // Ensure all errors are wrapped as ValidationError
    if (error instanceof z.ZodError || error instanceof Error) {
      const message = error instanceof z.ZodError
        ? `Invalid button configuration: ${error.message}`
        : error.message;
      throw new ValidationError(message, error);
    }
    throw new ValidationError(String(error));
  }
}

/**
 * Validates a dial configuration
 *
 * @param dial The dial configuration to validate
 * @returns The validated dial configuration
 * @throws ValidationError if validation fails
 */
export function validateDial(dial: unknown): DialConfig {
  try {
    return dialSchema.parse(dial);
  } catch (error) {
    // Ensure all errors are wrapped as ValidationError
    if (error instanceof z.ZodError || error instanceof Error) {
      const message = error instanceof z.ZodError
        ? `Invalid dial configuration: ${error.message}`
        : error.message;
      throw new ValidationError(message, error);
    }
    throw new ValidationError(String(error));
  }
}

/**
 * Validates a page configuration
 *
 * @param page The page configuration to validate
 * @returns The validated page configuration
 * @throws ValidationError if validation fails
 */
export function validatePage(page: unknown): PageConfig {
  try {
    return pageSchema.parse(page);
  } catch (error) {
    // Ensure all errors are wrapped as ValidationError
    if (error instanceof z.ZodError || error instanceof Error) {
      const message = error instanceof z.ZodError
        ? `Invalid page configuration: ${error.message}`
        : error.message;
      throw new ValidationError(message, error);
    }
    throw new ValidationError(String(error));
  }
}

/**
 * Validates a device configuration
 *
 * @param device The device configuration to validate
 * @returns The validated device configuration
 * @throws ValidationError if validation fails
 */
export function validateDevice(device: unknown): DeviceConfig {
  try {
    const parsedDevice = deviceSchema.parse(device);

    // Additional validation: if default_page is set, ensure it exists in pages
    if (parsedDevice.default_page && !parsedDevice.pages[parsedDevice.default_page]) {
      throw new ValidationError(
        `Default page "${parsedDevice.default_page}" not found in device pages`,
      );
    }

    return parsedDevice;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error; // Re-throw our own error type
    }
    // Ensure all errors are wrapped as ValidationError
    if (error instanceof z.ZodError || error instanceof Error) {
      const message = error instanceof z.ZodError
        ? `Invalid device configuration: ${error.message}`
        : error.message;
      throw new ValidationError(message, error);
    }
    throw new ValidationError(String(error));
  }
}

/**
 * Validates an entire configuration
 *
 * @param config The configuration to validate
 * @returns The validated configuration
 * @throws ValidationError if validation fails
 */
export function validateConfig(config: unknown): DeckerConfig {
  try {
    return configSchema.parse(config);
  } catch (error) {
    // Ensure all errors are wrapped as ValidationError
    if (error instanceof z.ZodError || error instanceof Error) {
      const message = error instanceof z.ZodError
        ? `Invalid configuration: ${error.message}`
        : error.message;
      throw new ValidationError(message, error);
    }
    throw new ValidationError(String(error));
  }
}

/**
 * Configuration validator class that provides methods to validate configuration objects.
 */
export class ConfigValidator {
  /**
   * Validates a configuration object
   *
   * @param config The configuration to validate
   * @returns The validated configuration
   * @throws ValidationError if validation fails
   */
  public validate(config: unknown): DeckerConfig {
    return validateConfig(config);
  }

  /**
   * Validates a configuration and returns a detailed report of any validation issues
   *
   * @param config The configuration to validate
   * @returns An object with validation results and any errors found
   */
  public validateWithDetails(
    config: unknown,
  ): { valid: boolean; errors: string[]; config?: DeckerConfig } {
    try {
      const validatedConfig = this.validate(config);
      return { valid: true, errors: [], config: validatedConfig };
    } catch (error) {
      const errors: string[] = [];

      if (error instanceof ValidationError) {
        errors.push(error.message);

        // If the cause is a ZodError, extract the detailed errors
        if (error.cause instanceof z.ZodError) {
          error.cause.errors.forEach((zodError) => {
            errors.push(`${zodError.path.join(".")}: ${zodError.message}`);
          });
        }
      } else if (error instanceof Error) {
        errors.push(error.message);
      } else {
        errors.push(String(error));
      }

      return { valid: false, errors };
    }
  }

  /**
   * Checks only certain parts of a configuration for validity
   *
   * @param config The configuration object
   * @param paths The paths to validate (e.g., "devices.ABC123")
   * @returns An object with validation results for each path
   */
  public validatePaths(
    config: unknown,
    paths: string[],
  ): Record<string, { valid: boolean; errors: string[] }> {
    const results: Record<string, { valid: boolean; errors: string[] }> = {};

    for (const path of paths) {
      try {
        const parts = path.split(".");
        let currentValue: unknown = config;
        let currentPath = "";

        // Navigate to the value at the specified path
        for (const part of parts) {
          if (currentValue == null || typeof currentValue !== "object") {
            throw new ValidationError(`Path ${currentPath}${part} not found`);
          }

          currentValue = (currentValue as Record<string, unknown>)[part];
          currentPath = currentPath ? `${currentPath}.${part}` : part;
        }

        // Validate the value based on its path
        if (path === "global_settings") {
          validateGlobalSettings(currentValue);
        } else if (path.startsWith("devices.") && path.split(".").length === 2) {
          validateDevice(currentValue);
        } else if (path.match(/^devices\.[^.]+\.pages\.[^.]+$/)) {
          validatePage(currentValue);
        } else if (path.match(/^devices\.[^.]+\.pages\.[^.]+\.buttons\.[^.]+$/)) {
          validateButton(currentValue);
        } else if (path.match(/^devices\.[^.]+\.pages\.[^.]+\.dials\.[^.]+$/)) {
          validateDial(currentValue);
        } else {
          throw new ValidationError(`Unsupported validation path: ${path}`);
        }

        results[path] = { valid: true, errors: [] };
      } catch (error) {
        const errors: string[] = [];

        if (error instanceof ValidationError) {
          errors.push(error.message);

          if (error.cause instanceof z.ZodError) {
            error.cause.errors.forEach((zodError) => {
              errors.push(`${zodError.path.join(".")}: ${zodError.message}`);
            });
          }
        } else if (error instanceof Error) {
          errors.push(error.message);
        } else {
          errors.push(String(error));
        }

        results[path] = { valid: false, errors };
      }
    }

    return results;
  }

  /**
   * Generates a JSON Schema representation of the configuration schema
   *
   * @returns A JSON Schema object that describes the configuration structure
   */
  public generateJsonSchema(): Record<string, unknown> {
    // Generate JSON Schema for each component
    const schemaObject = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Decker Configuration Schema",
      description: "Schema for Stream Deck configuration files",
      type: "object",
      properties: {
        devices: {
          type: "object",
          description: "Device configurations indexed by serial number",
          additionalProperties: this.generateDeviceSchema(),
        },
        global_settings: this.generateGlobalSettingsSchema(),
        version: {
          type: "string",
          description: "Application version that created this configuration",
        },
      },
      required: ["devices"],
    };

    return schemaObject;
  }

  /**
   * Generates a JSON Schema for the global settings
   *
   * @returns A JSON Schema object for global settings
   */
  private generateGlobalSettingsSchema(): Record<string, unknown> {
    return {
      type: "object",
      description: "Global application settings",
      properties: {
        log_file: {
          type: "string",
          description: "Path to the log file",
        },
        log_level: {
          type: "string",
          enum: ["debug", "info", "warn", "error"],
          description: "Log level",
        },
      },
      additionalProperties: false,
    };
  }

  /**
   * Generates a JSON Schema for device configuration
   *
   * @returns A JSON Schema object for a device
   */
  private generateDeviceSchema(): Record<string, unknown> {
    return {
      type: "object",
      description: "Configuration for a Stream Deck device",
      properties: {
        name: {
          type: "string",
          description: "Friendly name for the device",
        },
        pages: {
          type: "object",
          description: "Pages available on this device",
          additionalProperties: this.generatePageSchema(),
        },
        default_page: {
          type: "string",
          description: "The default page to show on startup",
        },
      },
      required: ["pages"],
      additionalProperties: false,
    };
  }

  /**
   * Generates a JSON Schema for page configuration
   *
   * @returns A JSON Schema object for a page
   */
  private generatePageSchema(): Record<string, unknown> {
    return {
      type: "object",
      description: "Layout of buttons and dials for a specific page",
      properties: {
        buttons: {
          type: "object",
          description: "Button configurations indexed by position",
          additionalProperties: this.generateButtonSchema(),
        },
        dials: {
          type: "object",
          description: "Dial configurations indexed by position",
          additionalProperties: this.generateDialSchema(),
        },
      },
      required: ["buttons"],
      additionalProperties: false,
    };
  }

  /**
   * Generates a JSON Schema for button configuration
   *
   * @returns A JSON Schema object for a button
   */
  private generateButtonSchema(): Record<string, unknown> {
    // Common button properties
    const commonProperties = {
      type: {
        type: "string",
        description: "The type of action this button performs",
      },
      image: {
        type: "string",
        description: "Path to the button image file",
      },
      text: {
        type: "string",
        description: "Text to display on the button",
      },
      color: {
        type: "string",
        pattern: "^#[0-9A-Fa-f]{6}$",
        description: "Background color in hex format (#RRGGBB)",
      },
      font_size: {
        type: "number",
        minimum: 1,
        description: "Font size for text",
      },
      text_color: {
        type: "string",
        pattern: "^#[0-9A-Fa-f]{6}$",
        description: "Text color in hex format (#RRGGBB)",
      },
      state_images: {
        type: "object",
        description: "Additional state-specific images",
        additionalProperties: { type: "string" },
      },
      stateful: {
        type: "boolean",
        description: "Whether the button maintains state",
      },
    };

    // Create schema for different action types
    const actionSchemas = [
      {
        type: "object",
        properties: {
          ...commonProperties,
          type: { enum: ["launch_app"] },
          path: {
            type: "string",
            description: "Path to the application",
          },
        },
        required: ["type", "path"],
      },
      {
        type: "object",
        properties: {
          ...commonProperties,
          type: { enum: ["script"] },
          script: {
            type: "string",
            description: "Path to the script",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Optional arguments to pass to the script",
          },
        },
        required: ["type", "script"],
      },
      {
        type: "object",
        properties: {
          ...commonProperties,
          type: { enum: ["page_switch"] },
          target_page: {
            type: "string",
            description: "Target page to switch to",
          },
        },
        required: ["type", "target_page"],
      },
      {
        type: "object",
        properties: {
          ...commonProperties,
          type: { enum: ["http"] },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            description: "HTTP method",
          },
          url: {
            type: "string",
            format: "uri",
            description: "URL to send the request to",
          },
          headers: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Optional request headers",
          },
          body: {
            description: "Optional request body",
          },
        },
        required: ["type", "method", "url"],
      },
      {
        type: "object",
        properties: {
          ...commonProperties,
          type: { enum: ["inline_code"] },
          language: {
            type: "string",
            enum: ["javascript"],
            description: "Programming language for the code",
          },
          code: {
            type: "string",
            description: "Code to execute",
          },
        },
        required: ["type", "language", "code"],
      },
    ];

    // Combine schemas using oneOf
    return {
      oneOf: actionSchemas,
    };
  }

  /**
   * Generates a JSON Schema for dial configuration
   *
   * @returns A JSON Schema object for a dial
   */
  private generateDialSchema(): Record<string, unknown> {
    return {
      type: "object",
      description: "Configuration for dial controls",
      properties: {
        type: {
          type: "string",
          description: "The type of control this dial represents",
        },
        text: {
          type: "string",
          description: "Text to display for this dial",
        },
      },
      required: ["type"],
      additionalProperties: true,
    };
  }
}
