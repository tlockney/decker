# Stream Deck Manager Specification

## Overview
A lightweight, code-configurable Stream Deck management application that replaces the default Elgato software. The application will use a JSON-based configuration system to control multiple connected Stream Deck devices.

## Core Requirements

### Device Management
- Support for multiple connected Stream Deck devices
- Identification of devices via serial number
- Tool to enumerate connected devices and help identify them physically

### Configuration System
- Single JSON configuration file for all devices (initially)
- Direct JSON editing (no GUI required)
- Eventually hot-reloadable configuration (not required for initial version)

### Button/Dial Functions
- Support for launching applications
- Running scripts/executables via file paths
- Media control capabilities
- HTTP and MQTT API integration
- Inline code execution within JSON
- Future extension via loadable external modules

### Visual Elements
- State-aware button images (update based on state)
- Button colors and background customization
- Dynamic text on buttons
- Simple text/image display for LCD screens

### State Management
- Each button maintains individual state
- Access to global application state
- Access to state of other Stream Deck devices
- Support for "views" or "pages" to swap interfaces

### Feedback and Error Handling
- Action-determined feedback
- JSON-formatted return values from scripts
- Error logging to file

### Platform Support
- Primary: macOS
- Future: Linux (for Raspberry Pi deployment)

### Architecture
- Standalone application (vs client-server)
- Manual activation via Stream Deck
- External activation through HTTP/MQTT endpoints

## Technical Implementation

### Tech Stack
- **Language**: TypeScript
- **Runtime**: Deno
- **Libraries**:
  - `@elgato-stream-deck/node`: Core library for Stream Deck interaction
  - `@julusian/jpeg-turbo`: Image processing for Stream Deck displays
  - Deno Standard Library modules from JSR (@std)
  - Additional libraries as needed for HTTP/MQTT functionality

### Development Practices
- Test-Driven Development (TDD) approach
- All code must pass linting and formatting checks
- Version control with Git
- Hosted on GitHub
- Clear documentation and examples

### Code Organization
- Modular architecture with clear separation of concerns
- Core subsystems:
  - Device management
  - Configuration parsing and validation
  - Action execution engine
  - State management
  - Page/view management
  - API integrations

### Testing Strategy
- Unit tests for core functionality
- Integration tests for device interactions
- Mock devices for testing without hardware
- Test coverage requirements for all new features

## Detailed Specifications

### Configuration Structure
```json
{
  "devices": {
    "SERIAL_NUMBER_1": {
      "name": "Optional friendly name",
      "pages": {
        "default": {
          "buttons": {
            "0": {
              "type": "action",
              "action": "launch_app",
              "path": "/Applications/SomeApp.app",
              "image": "/path/to/image.png",
              "text": "App Name",
              "state_images": {
                "running": "/path/to/running.png",
                "stopped": "/path/to/stopped.png"
              }
            },
            "1": {
              "type": "script",
              "script": "/path/to/script.sh",
              "args": ["arg1", "arg2"],
              "text": "Run Script",
              "color": "#FF0000"
            },
            "2": {
              "type": "page_switch",
              "target_page": "secondary_page",
              "text": "Page 2",
              "image": "/path/to/page2.png"
            },
            "3": {
              "type": "inline_code",
              "language": "javascript",
              "code": "console.log('Hello world'); return {success: true, newText: 'Pressed'};",
              "text": "Run Code"
            },
            "4": {
              "type": "http",
              "method": "POST",
              "url": "https://api.example.com/endpoint",
              "headers": {"Content-Type": "application/json"},
              "body": {"key": "value"},
              "text": "API Call"
            }
          },
          "dials": {
            "0": {
              "type": "volume",
              "device": "system",
              "text": "Volume"
            }
          }
        },
        "secondary_page": {
          "buttons": {
            "0": {
              "type": "page_switch",
              "target_page": "default",
              "text": "Main Page",
              "image": "/path/to/home.png"
            }
            // Additional buttons...
          }
        }
      }
    }
    // Additional devices...
  },
  
  "global_settings": {
    "log_file": "/path/to/logfile.log",
    "log_level": "info"
  }
}
```

### Action Response Format
Actions can return JSON-formatted responses to provide feedback:

```json
{
  "success": true|false,
  "newState": "state_name",
  "newText": "Updated text",
  "newImage": "/path/to/new_image.png",
  "transient": true|false,
  "transientDuration": 2000
}
```

### HTTP/MQTT Integration
The application will support sending/receiving via:
- HTTP requests with customizable headers, methods, and body
- MQTT publish/subscribe with topic configuration

### Device Detection Tool
A utility for identifying physical devices:
```
> decker list
Found 2 devices:
1. Serial: ABC123 (Stream Deck XL)
2. Serial: DEF456 (Stream Deck Mini)

> decker identify ABC123
Flashing buttons on device ABC123 for identification
```

## Development Phases

### Phase 1 - Core Functionality
- Basic device connection and identification
- JSON configuration parsing
- Button image and text display
- Simple actions (app launch, script execution)
- Basic page switching

### Phase 2 - Enhanced Features
- HTTP/MQTT integration
- Inline code execution
- State-based button appearance
- Dial support
- Error logging

### Phase 3 - Advanced Features
- Hot-reloading configuration
- External module support
- Linux/Raspberry Pi support
- Configuration validation and error recovery