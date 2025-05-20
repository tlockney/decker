# Decker Configuration System

This document explains the configuration system used by Decker to manage Stream Deck devices, layouts, and actions.

## Overview

Decker uses a JSON-based configuration system that allows you to:

- Configure multiple Stream Deck devices
- Create multiple pages of buttons per device
- Define different actions for buttons
- Customize button appearance (colors, images, text)
- Configure dial behavior (on supported devices)

## Configuration Structure

The configuration file follows this basic structure:

```json
{
  "devices": {
    "<device-serial-number>": {
      "name": "Device Name",
      "default_page": "main",
      "pages": {
        "main": {
          "buttons": {
            "0": { /* button configuration */ },
            "1": { /* button configuration */ }
            // ...
          },
          "dials": {
            "0": { /* dial configuration */ }
            // ...
          }
        },
        "page2": {
          // Another page configuration
        }
      }
    }
  },
  "global_settings": {
    "log_level": "info"
  },
  "version": "0.1.0"
}
```

## Configuration Components

### Top-Level Structure

- `devices`: Map of device configurations keyed by serial number
- `global_settings`: Application-wide settings
- `version`: Configuration version

### Device Configuration

Each device is configured with:

```json
"<device-serial-number>": {
  "name": "Optional device name",
  "default_page": "main",
  "pages": {
    // Page configurations
  }
}
```

### Page Configuration

Each page contains button and dial layouts:

```json
"main": {
  "buttons": {
    // Button configurations
  },
  "dials": {
    // Dial configurations (on supported devices)
  }
}
```

### Button Configuration

Buttons are configured with:

```json
"0": {
  "type": "launch_app",
  "image": "path/to/image.png",
  "text": "Button Text",
  "color": "#FF0000",
  "text_color": "#FFFFFF",
  "font_size": 14,
  "stateful": false,
  // Additional type-specific parameters
}
```

Common properties:

- `type`: The action type for this button (required)
- `image`: Path to the button image (optional)
- `text`: Text to display on the button (optional)
- `color`: Background color in hex format (optional)
- `text_color`: Text color in hex format (optional)
- `font_size`: Font size for text (optional)
- `stateful`: Whether the button maintains state (optional)
- `state_images`: Map of state names to image paths (optional)

### Dial Configuration

Dials are configured with:

```json
"0": {
  "type": "volume",
  "text": "Volume",
  // Additional type-specific parameters
}
```

## Action Types

### Launch App Action

Launches an application:

```json
{
  "type": "launch_app",
  "path": "/Applications/Safari.app"
}
```

### Execute Script Action

Executes a script:

```json
{
  "type": "script",
  "script": "/path/to/script.sh",
  "args": ["arg1", "arg2"]
}
```

### Page Switch Action

Switches to another page on the device:

```json
{
  "type": "page_switch",
  "target_page": "page2"
}
```

### HTTP Request Action

Sends an HTTP request:

```json
{
  "type": "http",
  "method": "POST",
  "url": "https://api.example.com/endpoint",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "key": "value"
  }
}
```

### Inline Code Action

Executes JavaScript code:

```json
{
  "type": "inline_code",
  "language": "javascript",
  "code": "console.log('Button pressed');"
}
```

## Configuration Management

Decker provides tools for managing configuration:

### Creating a Configuration

Create a new configuration file:

```bash
deno task config init [path]
```

This creates a default configuration template that you can customize.

### Validating a Configuration

Validate an existing configuration:

```bash
deno task config validate [path]
```

Validate a specific part of the configuration:

```bash
deno task config validate --path devices.ABC123.pages.main
```

### Inspecting a Configuration

View information about a configuration:

```bash
deno task config info [path]
```

### Generating a Schema

Generate a JSON Schema for the configuration:

```bash
deno task config schema [output_path]
```

## Example Configuration

Here's a complete example of a configuration for a device:

```json
{
  "devices": {
    "AC123456789": {
      "name": "My Stream Deck",
      "default_page": "main",
      "pages": {
        "main": {
          "buttons": {
            "0": {
              "type": "launch_app",
              "path": "/Applications/Visual Studio Code.app",
              "text": "VS Code",
              "color": "#007ACC"
            },
            "1": {
              "type": "http",
              "method": "POST",
              "url": "http://localhost:8000/api/toggle-light",
              "text": "Toggle Light",
              "color": "#FFA500"
            },
            "2": {
              "type": "page_switch",
              "target_page": "media",
              "text": "Media Controls",
              "color": "#800080"
            }
          }
        },
        "media": {
          "buttons": {
            "0": {
              "type": "script",
              "script": "/path/to/scripts/play-pause.sh",
              "text": "Play/Pause",
              "color": "#228B22"
            },
            "1": {
              "type": "script",
              "script": "/path/to/scripts/next-track.sh",
              "text": "Next Track",
              "color": "#228B22"
            },
            "2": {
              "type": "page_switch",
              "target_page": "main",
              "text": "Back",
              "color": "#800080"
            }
          }
        }
      }
    }
  },
  "global_settings": {
    "log_level": "info"
  },
  "version": "0.1.0"
}
```

## Best Practices

1. **Use Serial Numbers**: Always use the correct serial number for each device.
2. **Plan Pages**: Organize related buttons onto the same page.
3. **Provide Navigation**: Include a way to navigate between pages.
4. **Use Visual Indicators**: Use consistent colors to indicate button types.
5. **Validate First**: Always validate configuration changes before applying them.
6. **Backup Configs**: Keep backups of working configurations.
7. **Use Comments**: Use the configuration manager to add comments to your configuration file.
