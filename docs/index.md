# Decker Documentation

This directory contains comprehensive documentation for the Decker application, a Stream Deck management tool built with Deno.

## Core Documentation

- [Button API](button-api.md) - Detailed guide to button manipulation
- [Configuration System](configuration.md) - Guide to the JSON configuration system
- [Event System](events.md) - Documentation on the event handling system
- [Rendering System](rendering-system.md) - Documentation on button rendering capabilities

## Additional Resources

- [Project README](../README.md) - Overview of the project and its features
- [CLAUDE.md](../CLAUDE.md) - Guide for AI assistance with the codebase

## API Reference

### Button Management

The button API allows you to manipulate Stream Deck buttons:

```typescript
// Set button color
device.setButtonColor(buttonIndex, r, g, b);

// Set button image
device.setButtonImage(buttonIndex, buffer);

// Clear button
device.clearButton(buttonIndex);

// Clear all buttons
device.clearAllButtons();
```

### Event Handling

Subscribe to device events:

```typescript
// Button events
device.on(DeviceEventType.BUTTON_PRESSED, (event) => { /* ... */ });
device.on(DeviceEventType.BUTTON_RELEASED, (event) => { /* ... */ });

// Dial events (on supported devices)
device.on(DeviceEventType.DIAL_ROTATED, (event) => { /* ... */ });
device.on(DeviceEventType.DIAL_PRESSED, (event) => { /* ... */ });
device.on(DeviceEventType.DIAL_RELEASED, (event) => { /* ... */ });

// Device events
deviceManager.on(DeviceEventType.DEVICE_CONNECTED, (event) => { /* ... */ });
deviceManager.on(DeviceEventType.DEVICE_DISCONNECTED, (event) => { /* ... */ });
```

### Device Management

Manage Stream Deck devices:

```typescript
// Initialize the device manager
const deviceManager = new DeviceManager();
await deviceManager.initialize();

// Get connected devices
const devices = deviceManager.getConnectedDevices();

// Get a specific device
const device = deviceManager.getDevice(serialNumber);

// Connect to a device
const device = await deviceManager.connectToDevice(serialNumber);

// Disconnect a device
await deviceManager.disconnectDevice(serialNumber);

// Close all devices
await deviceManager.close();
```

## CLI Tools

Decker includes command-line tools for device identification and configuration management:

### Device Identification

```bash
# Basic usage
deno task identify

# List all connected devices
deno task identify:list

# Test mode - light up all buttons
deno task identify:test

# Sequence mode - light up buttons one by one
deno task identify:sequence

# Fade mode - fade all buttons through colors
deno task identify:fade
```

### Configuration Management

```bash
# Create a new configuration
deno task config:init

# Validate a configuration
deno task config:validate

# Show configuration info
deno task config:info

# Generate schema
deno task config:schema
```

## Project Structure

The project is organized as follows:

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

## Further Development

For information about the development roadmap and more detailed specifications, see the [spec.md](../spec.md) file.