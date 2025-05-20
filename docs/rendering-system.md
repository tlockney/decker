# Button Rendering System

This document describes the button rendering system used in Decker for displaying text, images, and colors on Stream Deck buttons.

## Overview

The button rendering system provides a flexible, extensible framework for rendering content to Stream Deck buttons. It supports:

- Solid colors
- Text rendering with customizable appearance
- Image loading and display
- Caching for performance optimization
- Device-specific rendering

## Core Components

### Interfaces

- **ButtonRenderer**: Base interface for all button renderers
- **ButtonVisualProps**: Visual properties for buttons (text, color, images)
- **RenderOptions**: Options for the rendering process
- **RGB**: Simple RGB color representation
- **RendererFactory**: Factory for creating renderers for different device types

### Base Implementations

- **BaseButtonRenderer**: Abstract base class with caching and common functionality
- **BasicButtonRenderer**: Simple renderer with text and color support
- **ImageButtonRenderer**: Advanced renderer with image loading and resizing

### Rendering Manager

- **RenderingManager**: Coordinates rendering across multiple devices

## Usage Examples

### Basic Rendering

```typescript
import { RenderingManager } from "decker/src/rendering/mod.ts";

// Create the rendering manager
const renderingManager = new RenderingManager();

// Register a device
renderingManager.registerDevice(deviceInfo);

// Set button color
await renderingManager.setButtonColor(
  device,
  0,  // Button index
  { r: 255, g: 0, b: 0 }  // Red
);

// Set button text
await renderingManager.setButtonText(
  device,
  1,  // Button index
  "Hello World",
  { r: 0, g: 0, b: 0 },  // Black background
  { r: 255, g: 255, b: 255 }  // White text
);
```

### Advanced Rendering

```typescript
// Render with multiple properties
await renderingManager.updateButton(
  device,
  2,  // Button index
  {
    text: "Button 2",
    backgroundColor: { r: 0, g: 0, b: 255 },  // Blue
    textColor: { r: 255, g: 255, b: 0 },      // Yellow
    fontSize: 18,
    textAlign: "center",
    textVerticalAlign: "middle"
  }
);

// Render with an image
await renderingManager.updateButton(
  device,
  3,  // Button index
  {
    imagePath: "/path/to/image.jpg",
    text: "Label",  // Optional overlay text
    textColor: { r: 255, g: 255, b: 255 }
  }
);
```

## Button Visual Properties

Buttons can be customized with these properties:

| Property | Type | Description |
|----------|------|-------------|
| `text` | string | Text to display on the button |
| `imagePath` | string | Path to an image file |
| `imageBuffer` | Buffer | Raw image data |
| `backgroundColor` | RGB | Background color |
| `textColor` | RGB | Text color |
| `fontSize` | number | Font size in points |
| `textAlign` | string | Horizontal text alignment ('left', 'center', 'right') |
| `textVerticalAlign` | string | Vertical text alignment ('top', 'middle', 'bottom') |
| `textPadding` | number | Padding around text in pixels |

## Rendering Process

1. **Device Registration**: Each device is registered with the rendering manager, which creates an appropriate renderer
2. **Property Collection**: Visual properties are gathered for the button to be rendered
3. **Caching Check**: The system checks if an identical render is already cached
4. **Rendering**: If not cached, the button is rendered with the specified properties
5. **Optimization**: For solid colors, the system uses the device's native color setting
6. **Image Processing**: Images are loaded and resized to fit the button
7. **Button Update**: The rendered image is sent to the device

## Performance Considerations

- **Caching**: The rendering system uses multi-level caching to avoid redundant rendering
- **Image Loading**: Images are cached after loading to reduce file I/O
- **Direct Color Setting**: Solid colors bypass image rendering for better performance
- **Cache Cleanup**: Automatic cache cleanup prevents memory leaks

## Extending the Rendering System

### Custom Renderers

You can create custom renderers by implementing the `ButtonRenderer` interface:

```typescript
export class CustomRenderer implements ButtonRenderer {
  async render(props: ButtonVisualProps, options: RenderOptions): Promise<Buffer> {
    // Custom rendering logic
    return buffer;
  }
  
  clearCache(): void {
    // Cache clearing logic
  }
}
```

### Custom Renderer Factories

Create a factory to provide your custom renderer:

```typescript
export class CustomRendererFactory implements RendererFactory {
  createRenderer(deviceType: string): ButtonRenderer {
    return new CustomRenderer();
  }
}

// Register with rendering manager
renderingManager.registerRendererFactory("Stream Deck XL", new CustomRendererFactory());
```

## Implementation Details

- **Image Processing**: Uses `@julusian/jpeg-turbo` for efficient JPEG encoding/decoding
- **Color Management**: Direct RGB color manipulation
- **Text Rendering**: Simple text rendering in the basic implementation
- **Caching**: Multi-level caching system with automatic cleanup
- **Error Handling**: Fallback rendering if advanced features fail
