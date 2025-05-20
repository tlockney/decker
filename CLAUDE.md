# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Repository Purpose

This is a Deno-based project for interacting with Elgato Stream Deck devices,
using the `@elgato-stream-deck/node` library. The project allows for detection,
connection, and control of Stream Deck hardware.

## Commands

- **Development**: `deno task dev` - Runs the main application with watch mode
  for automatic reloading
- **Run directly**: `deno run --allow-all main.ts` - Runs the application with
  all permissions
- **Identify**: `deno task identify` - Runs the device identification tool
- **Config**: `deno task config` - Runs the configuration management tool

## Project Structure

- **main.ts**: Entry point for the application, lists connected Stream Deck devices
- **deno.json**: Configuration for Deno environment and dependencies
- **src/devices/**: Core device management functionality
  - **device_manager.ts**: Handles device detection and management
  - **stream_deck_device.ts**: Wrapper for Stream Deck devices
- **src/types/**: Type definitions
- **src/config/**: Configuration system
- **src/cli/**: Command-line tools
- **docs/**: Comprehensive documentation
  - **button-api.md**: Button manipulation API
  - **configuration.md**: Configuration system
  - **events.md**: Event system

## Dependencies

- **@elgato-stream-deck/node**: Main library for Stream Deck interaction
- **@julusian/jpeg-turbo**: Used for image processing related to Stream Deck button displays
- **zod**: Schema validation for configuration
- **@std/assert**, **@std/log**, **@std/fs**, **@std/path**: Deno standard library modules

## Code Style

- Follow TypeScript best practices
- Use Deno's standard library and features when possible
- Maintain type safety throughout the codebase
- Use async/await for asynchronous operations
- Include proper error handling in all methods that interact with devices
- Run all pre-commit checks and fix any errors found before attempting to make any commits
- MAKE SURE all TypeScript type checks, tests, linting, and formatting are passing before committing any code.
- DO NOT include references to Claude co-authoring the commits.
- DO NOT EVER use `--no-verify` when making commits.

## Key APIs

### Button Control

- `device.setButtonColor(buttonIndex, r, g, b)` - Sets solid color
- `device.setButtonImage(buttonIndex, buffer)` - Sets image
- `device.clearButton(buttonIndex)` - Clears a button
- `device.clearAllButtons()` - Clears all buttons

### Rendering System

- `renderingManager.setButtonColor(device, buttonIndex, color)` - Sets button color
- `renderingManager.setButtonText(device, buttonIndex, text, bgColor, textColor)` - Sets text on button
- `renderingManager.updateButton(device, buttonIndex, visualProps)` - Updates with full visual properties

### Event Handling

- Button events: `BUTTON_PRESSED`, `BUTTON_RELEASED`
- Dial events: `DIAL_PRESSED`, `DIAL_RELEASED`, `DIAL_ROTATED`
- Device events: `DEVICE_CONNECTED`, `DEVICE_DISCONNECTED`

### Configuration

- JSON-based configuration with schema validation
- Supports multiple devices, pages, and action types
- Validation and management through config CLI tool

## Documentation

The project includes comprehensive documentation in the `/docs` directory:

- **button-api.md**: Detailed guide to button manipulation
- **configuration.md**: Guide to the JSON configuration system
- **events.md**: Documentation on the event handling system

See the README.md file for an overview of all functionality.
