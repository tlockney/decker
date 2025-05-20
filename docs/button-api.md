# Stream Deck Button API

This document provides a comprehensive guide to the button manipulation API provided by the Decker application for interacting with Stream Deck device keys/buttons.

## Overview

The Stream Deck button API allows you to:
- Set solid colors on buttons
- Display images on buttons
- Clear buttons (individual or all)
- Respond to button press and release events

## Key Methods

The `StreamDeckDevice` class provides the following methods for button manipulation:

### Setting Button Colors

```typescript
async setButtonColor(
  buttonIndex: number,
  r: number,
  g: number,
  b: number
): Promise<void>
```

Sets a solid color on a button using RGB values (0-255).

**Parameters:**
- `buttonIndex`: The button index (0-based)
- `r`: Red component (0-255)
- `g`: Green component (0-255)
- `b`: Blue component (0-255)

**Example:**
```typescript
// Set button 0 to red
await device.setButtonColor(0, 255, 0, 0);

// Set button 1 to green
await device.setButtonColor(1, 0, 255, 0);

// Set button 2 to blue
await device.setButtonColor(2, 0, 0, 255);

// Set button 3 to yellow
await device.setButtonColor(3, 255, 255, 0);
```

### Setting Button Images

```typescript
async setButtonImage(
  buttonIndex: number,
  buffer: Buffer
): Promise<void>
```

Sets an image on a button using a Buffer containing image data.

**Parameters:**
- `buttonIndex`: The button index (0-based)
- `buffer`: The image buffer (Node.js Buffer)

**Example:**
```typescript
// Read an image file
const imageBuffer = await Deno.readFile('path/to/image.png');

// Set the image on button 0
await device.setButtonImage(0, imageBuffer);
```

### Clearing Buttons

```typescript
async clearButton(
  buttonIndex: number
): Promise<void>
```

Clears (turns off) a specific button.

**Parameters:**
- `buttonIndex`: The button index (0-based)

**Example:**
```typescript
// Clear button 0
await device.clearButton(0);
```

```typescript
async clearAllButtons(): Promise<void>
```

Clears all buttons on the device.

**Example:**
```typescript
// Clear all buttons
await device.clearAllButtons();
```

## Button Events

The device emits events when buttons are pressed or released.

### Button Pressed

```typescript
device.on(DeviceEventType.BUTTON_PRESSED, (event: ButtonEvent) => {
  // Handle button press
});
```

**Event Object:**
```typescript
interface ButtonEvent {
  type: DeviceEventType.BUTTON_PRESSED | DeviceEventType.BUTTON_RELEASED;
  deviceSerial: string;
  buttonIndex: number;
  timestamp: number;
}
```

### Button Released

```typescript
device.on(DeviceEventType.BUTTON_RELEASED, (event: ButtonEvent) => {
  // Handle button release
});
```

## Advanced Examples

### Button Press Feedback

```typescript
// When a button is pressed, fill it with a color
device.on(DeviceEventType.BUTTON_PRESSED, (event) => {
  device.setButtonColor(event.buttonIndex, 255, 0, 0)
    .catch((e) => console.error("Fill failed:", e));
});

// When a button is released, clear it
device.on(DeviceEventType.BUTTON_RELEASED, (event) => {
  device.clearButton(event.buttonIndex)
    .catch((e) => console.error("Clear failed:", e));
});
```

### Button Cycling Colors

```typescript
// Colors to cycle through
const colors = [
  { r: 255, g: 0, b: 0 },   // Red
  { r: 0, g: 255, b: 0 },   // Green
  { r: 0, g: 0, b: 255 },   // Blue
  { r: 255, g: 255, b: 0 }, // Yellow
];

let colorIndex = 0;

// When a button is pressed, cycle through colors
device.on(DeviceEventType.BUTTON_PRESSED, (event) => {
  const { r, g, b } = colors[colorIndex];
  device.setButtonColor(event.buttonIndex, r, g, b)
    .catch((e) => console.error("Fill failed:", e));
  
  // Move to next color in cycle
  colorIndex = (colorIndex + 1) % colors.length;
});
```

### Button Animation Sequence

```typescript
async function runAnimationSequence(device: StreamDeckDevice) {
  const buttonCount = device.getButtonCount();
  
  // Light up buttons in sequence
  for (let i = 0; i < buttonCount; i++) {
    await device.setButtonColor(i, 255, 0, 0);
    await new Promise(resolve => setTimeout(resolve, 100));
    await device.clearButton(i);
  }
}
```

## Implementation Details

Under the hood, the button API calls the following methods from the Stream Deck library:

- `setButtonColor` → `streamDeck.fillKeyColor(buttonIndex, r, g, b)`
- `setButtonImage` → `streamDeck.fillKeyBuffer(buttonIndex, buffer)`
- `clearButton` → `streamDeck.clearKey(buttonIndex)`
- `clearAllButtons` → `streamDeck.clearPanel()`

## Notes

- Button indexes are 0-based
- The button layout depends on the device model (varies in rows and columns)
- All methods are asynchronous and return Promises
- Error handling is important as hardware operations can fail
- The device must be connected for these methods to work