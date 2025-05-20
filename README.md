# Decker

A lightweight, code-configurable Stream Deck management application built with
Deno and TypeScript.

## Overview

Decker provides a JSON-based configuration system for controlling Elgato Stream
Deck devices without using the default Elgato software. It supports multiple
connected devices, custom actions, and a modular approach to Stream Deck
management.

## Features

- Support for multiple connected Stream Deck devices
- JSON configuration for buttons, dials, and LCD displays
- Actions include launching apps, running scripts, HTTP/MQTT integration
- Page/view switching for different button layouts
- Simple state management
- Customizable button images, colors, and text

## Core Components

### Device Management

Decker provides a robust device management system for handling Stream Deck devices:

- **Device Detection**: Automatically detects connected Stream Deck devices
- **Hot-Plugging**: Monitors for device connections and disconnections
- **Multi-Device Support**: Manages multiple Stream Deck devices simultaneously
- **Device Information**: Retrieves detailed device information (type, serial number, layout)
- **Feature Detection**: Automatically detects device capabilities (dials, LCD screens)

### Button Management

Control Stream Deck buttons with these key functions:

- **Color Control**: Set button colors using RGB values with `setButtonColor(buttonIndex, r, g, b)`
- **Image Display**: Display images on buttons with `setButtonImage(buttonIndex, buffer)`
- **Button Clearing**: Clear specific buttons or all buttons with `clearButton(buttonIndex)` and `clearAllButtons()`
- **Event Handling**: Listen for button press and release events

### Configuration System

Decker uses a structured configuration system:

- **JSON Configuration**: Define device layouts and actions using JSON
- **Schema Validation**: Configuration validation with TypeScript interfaces
- **Multiple Devices**: Configure different layouts for different devices
- **Pages**: Organize buttons into multiple pages per device
- **Action Types**: Support for various action types:
  - Launch applications
  - Execute scripts
  - Send HTTP requests
  - Switch pages
  - Execute inline code

### CLI Tools

Decker includes several command-line tools:

- **Main Application**: `deno task start` - Launch the main Decker application
- **Device Identification**: `deno task identify` - Visual identification of connected devices
  - `deno task identify:list` - List all connected devices
  - `deno task identify:test` - Test mode (light up all buttons)
  - `deno task identify:sequence` - Sequence mode (light up buttons one by one)
  - `deno task identify:fade` - Fade mode (fade all buttons through colors)
- **Configuration Management**: `deno task config` - Create, validate, and inspect configuration files
  - `deno task config:init` - Create a new configuration file
  - `deno task config:validate` - Validate an existing configuration
  - `deno task config:info` - Show information about a configuration
  - `deno task config:schema` - Generate JSON Schema

## Event System

Decker implements a comprehensive event system:

- **Button Events**: Press and release events for buttons
- **Dial Events**: Press, release, and rotation events for dials (on supported devices)
- **Device Events**: Connect and disconnect events for Stream Deck devices
- **EventEmitter Interface**: Subscribe to events using standard Node.js EventEmitter patterns

## Usage Examples

### Basic Device Interaction

```typescript
// Initialize the device manager
const deviceManager = new DeviceManager();
await deviceManager.initialize();

// Get connected devices
const devices = deviceManager.getConnectedDevices();

// Set up event handlers
for (const [_, device] of devices) {
  // When a button is pressed, fill it with red
  device.on(DeviceEventType.BUTTON_PRESSED, (event) => {
    device.setButtonColor(event.buttonIndex, 255, 0, 0);
  });

  // When a button is released, clear it
  device.on(DeviceEventType.BUTTON_RELEASED, (event) => {
    device.clearButton(event.buttonIndex);
  });
}
```

### Device Identification

Run the identify tool to help identify which Stream Deck is which:

```bash
deno task identify
```

Use different identification modes with task shortcuts:

```bash
# List all connected devices
deno task identify:list

# Test mode - light up all buttons
deno task identify:test

# Sequence mode - lights up buttons one by one
deno task identify:sequence

# Fade mode - fades all buttons through colors
deno task identify:fade
```

Or use flags for more control:

```bash
# Specify a device by serial number
deno task identify -- -d ABC123456

# Run 5 cycles with 200ms delay
deno task identify -- -c 5 -D 200
```

### Configuration Management

Use task shortcuts for configuration management:

```bash
# Create a new configuration file
deno task config:init

# Validate an existing configuration
deno task config:validate

# Show information about a configuration
deno task config:info

# Generate JSON Schema
deno task config:schema
```

Or use more specific commands:

```bash
# Create configuration in a specific location
deno task config -- init my-config.json

# Validate a specific section of configuration
deno task config -- validate --path devices.ABC123.pages.main

# Save schema to a file
deno task config -- schema schema.json
```

## Development

This project is built using Deno. To run the development version:

```
deno task dev
```

### Git Hooks

The project uses Git hooks to ensure code quality. Install the hooks with:

```bash
deno task install-hooks
```

These hooks will automatically run before each commit to verify:

- Code formatting (`deno fmt --check`)
- Linting (`deno lint`)
- Type checking (`deno check`)
- Tests (`deno test`)

If any check fails, the commit will be aborted with an error message.

See the [spec.md](spec.md) file for detailed specifications and roadmap.

## Documentation

For more detailed documentation, see the [Documentation Index](docs/index.md) or the specific guides:

- [Button API](docs/button-api.md) - Detailed guide to button manipulation
- [Configuration System](docs/configuration.md) - Guide to the JSON configuration system
- [Event System](docs/events.md) - Documentation on the event handling system

## Project Structure

```
decker/
├── main.ts                 # Main application entry point
├── deno.json               # Deno configuration and tasks
├── src/
│   ├── cli/                # CLI tools
│   │   ├── identify.ts     # Device identification tool
│   │   └── config.ts       # Configuration management tool
│   ├── config/             # Configuration system
│   │   ├── loader.ts       # Configuration file loading
│   │   ├── schema.ts       # Configuration schema definitions
│   │   └── validator.ts    # Configuration validation
│   ├── devices/            # Device management
│   │   ├── device_manager.ts  # Stream Deck device manager
│   │   └── stream_deck_device.ts  # Stream Deck device wrapper
│   ├── types/              # Type definitions
│   │   └── types.ts        # Core application types
│   └── version.ts          # Application version information
└── types/                  # External type declarations
    └── stream-deck.d.ts    # Stream Deck library type definitions
```

## Requirements

- Deno runtime
- One or more Elgato Stream Deck devices
- macOS (Linux support planned for future)

## License

[MIT](LICENSE)
