# State Rendering Integration

This document explains how the button state management system is integrated with the rendering system in Decker.

## Overview

The state rendering integration connects the button state management system (which tracks the logical state of buttons) with the rendering system (which displays content on physical Stream Deck buttons). This integration enables:

- Automatic rendering of button visuals when their state changes
- Page switching with appropriate visual updates
- Stateful buttons that maintain their appearance across interactions
- Consistent visual feedback for button presses

## Components

### StateRenderer

The `StateRenderer` class is the core component that connects the state and rendering systems:

```typescript
export class StateRenderer {
  constructor(
    stateManager: StateManager,
    renderingManager: RenderingManager,
    options: StateRendererOptions = {},
  ) {
    // ...
  }
  
  // Methods for registering devices and handling state changes
  // ...
}
```

### State to Visual Mapping

The state renderer maps button states to visual properties:

- Text content from state `text` property
- Background color from state `color` property (hex colors are converted to RGB)
- Text color from state `text_color` property
- Font size from state `font_size` property
- Images from state `image` property

### Event Flow

1. **Button State Changes**: When a button's state changes (e.g., through `updateVisual()` or `setPressed()`), it emits events like `VISUAL_CHANGED` or `PRESSED`
2. **StateRenderer Listens**: The state renderer listens for these events
3. **Visual Mapping**: The state renderer maps state properties to visual properties
4. **Rendering**: The rendering manager updates the physical button display

## Usage Example

```typescript
// Create the state manager with a configuration
const stateManager = new StateManager(config);

// Create the rendering manager
const renderingManager = new RenderingManager();

// Connect state and rendering with the state renderer
const stateRenderer = new StateRenderer(stateManager, renderingManager);

// Register devices
for (const [_, device] of deviceManager.getConnectedDevices()) {
  stateRenderer.registerDevice(device);
}

// Now button state changes will automatically update the Stream Deck
```

## State Renderer Options

The state renderer can be configured with these options:

```typescript
export interface StateRendererOptions {
  /** Whether to automatically render visual changes */
  autoRenderVisualChanges?: boolean;
  /** Whether to automatically render button press state */
  autoRenderPressState?: boolean;
  /** Whether to use optimized rendering where possible */
  useOptimizedRendering?: boolean;
}
```

## Page Switching

The state renderer automatically handles page switching:

1. When `stateManager.setActivePage()` is called, it emits a `PAGE_ACTIVATED` event
2. The state renderer listens for this event and updates the visual state of all buttons on the new page
3. Buttons from the previous page are removed from the state manager and no longer rendered

Example:

```typescript
// Switch to a different page
stateManager.setActivePage(deviceSerial, "page2");
// StateRenderer automatically updates the device display
```

## Stateful Buttons

Buttons can maintain state across interactions:

```typescript
// In configuration
const buttonConfig = {
  type: "toggle",
  text: "WiFi",
  stateful: true,
  state_images: {
    "active": "wifi_on.png",
    "inactive": "wifi_off.png"
  }
};

// When pressed and released, stateful buttons toggle their state
// The state renderer automatically updates their appearance
```

## Device Events

The state renderer also handles physical device events:

1. Button Press/Release: When a physical button is pressed, the device emits events
2. State Update: The state renderer updates the logical button state
3. Visual Update: The state is mapped to visual properties and rendered

This creates a bidirectional flow where physical interactions affect logical state, and logical state changes affect physical appearance.

## Custom Rendering

You can also trigger rendering manually:

```typescript
// Render a specific button
stateRenderer.renderButton(deviceSerial, buttonIndex);

// Render all buttons for a device
stateRenderer.renderDeviceState(deviceSerial);
```

## Implementation Details

- **Event-Based Architecture**: Uses the event system to decouple state changes from rendering
- **Optimized Rendering**: Uses direct color setting for simple colors to improve performance
- **Multiple Device Support**: Can manage rendering across multiple Stream Deck devices
- **Device-Specific Rendering**: Adapts to different device capabilities and layouts

## Extending the System

To extend the system with custom visual effects:

1. Subclass `StateRenderer` to implement custom mapping logic
2. Create custom button state properties
3. Map those properties to visual representation in your custom renderer

```typescript
class CustomStateRenderer extends StateRenderer {
  protected renderButtonVisual(buttonState: ButtonState): void {
    // Custom rendering logic
    // ...
    super.renderButtonVisual(buttonState);
  }
}
```
