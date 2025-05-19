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

## Requirements

- Deno runtime
- One or more Elgato Stream Deck devices
- macOS (Linux support planned for future)

## License

[MIT](LICENSE)
