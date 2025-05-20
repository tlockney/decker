/**
 * Tests for Button State
 */

import { assertEquals } from "@std/assert";
import {
  ButtonState,
  ButtonStateEvent,
  StateChangedEvent,
  VisualChangedEvent,
} from "./button_state.ts";

// Test setup - sample button config
const sampleButtonConfig = {
  type: "launch_app",
  path: "/Applications/Calculator.app",
  text: "Calculator",
  color: "#FF0000",
  state_images: {
    "active": "/path/to/active.png",
  },
  stateful: true,
};

Deno.test("ButtonState initializes correctly", () => {
  const buttonState = new ButtonState({
    deviceSerial: "TEST123",
    buttonIndex: 0,
    pageId: "main",
    config: sampleButtonConfig,
    visual: {
      text: sampleButtonConfig.text,
      color: sampleButtonConfig.color,
    },
  });

  assertEquals(buttonState.deviceSerial, "TEST123");
  assertEquals(buttonState.buttonIndex, 0);
  assertEquals(buttonState.pageId, "main");
  assertEquals(buttonState.isPressed, false);
  assertEquals(buttonState.customState, undefined);
  assertEquals(buttonState.config, sampleButtonConfig);
  assertEquals(buttonState.visual.text, "Calculator");
  assertEquals(buttonState.visual.color, "#FF0000");
});

Deno.test("ButtonState handles press/release events", () => {
  const buttonState = new ButtonState({
    deviceSerial: "TEST123",
    buttonIndex: 0,
    pageId: "main",
    config: sampleButtonConfig,
    visual: {
      text: "Calculator",
      color: "#FF0000",
    },
  });

  let pressEventFired = false;
  let releaseEventFired = false;

  buttonState.on(ButtonStateEvent.PRESSED, () => {
    pressEventFired = true;
  });

  buttonState.on(ButtonStateEvent.RELEASED, () => {
    releaseEventFired = true;
  });

  // Press the button
  buttonState.setPressed(true);
  assertEquals(buttonState.isPressed, true);
  assertEquals(pressEventFired, true);
  assertEquals(releaseEventFired, false);

  // Release the button
  buttonState.setPressed(false);
  assertEquals(buttonState.isPressed, false);
  assertEquals(releaseEventFired, true);

  // Since this is a stateful button, the state should have changed
  assertEquals(buttonState.customState, "active");
});

Deno.test("ButtonState handles visual changes", () => {
  const buttonState = new ButtonState({
    deviceSerial: "TEST123",
    buttonIndex: 0,
    pageId: "main",
    config: sampleButtonConfig,
    visual: {
      text: "Calculator",
      color: "#FF0000",
    },
  });

  let visualChangedFired = false;

  buttonState.on<VisualChangedEvent>(ButtonStateEvent.VISUAL_CHANGED, (data) => {
    visualChangedFired = true;
    assertEquals(data.oldVisual.text, "Calculator");
    assertEquals(data.newVisual.text, "New Text");
  });

  // Update visual properties
  buttonState.updateVisual({ text: "New Text" });

  assertEquals(visualChangedFired, true);
  assertEquals(buttonState.visual.text, "New Text");
  assertEquals(buttonState.visual.color, "#FF0000"); // Should preserve existing properties
});

Deno.test("ButtonState handles state changes", () => {
  const buttonState = new ButtonState({
    deviceSerial: "TEST123",
    buttonIndex: 0,
    pageId: "main",
    config: sampleButtonConfig,
    visual: {
      text: "Calculator",
      color: "#FF0000",
    },
  });

  let stateChangedFired = false;
  let visualChangedFired = false;

  buttonState.on<StateChangedEvent>(ButtonStateEvent.STATE_CHANGED, (data) => {
    stateChangedFired = true;
    assertEquals(data.oldState, undefined);
    assertEquals(data.newState, "active");
  });

  buttonState.on(ButtonStateEvent.VISUAL_CHANGED, () => {
    visualChangedFired = true;
  });

  // Change the state
  buttonState.customState = "active";

  assertEquals(stateChangedFired, true);
  assertEquals(buttonState.customState, "active");

  // State change should update the image based on state_images
  assertEquals(visualChangedFired, true);
  assertEquals(buttonState.visual.image, "/path/to/active.png");
});

Deno.test("ButtonState reset works correctly", () => {
  const buttonState = new ButtonState({
    deviceSerial: "TEST123",
    buttonIndex: 0,
    pageId: "main",
    config: sampleButtonConfig,
    visual: {
      text: "Calculator",
      color: "#FF0000",
    },
  });

  // Change state
  buttonState.setPressed(true);
  buttonState.customState = "active";
  buttonState.updateVisual({ text: "New Text" });

  // Reset the button
  buttonState.reset();

  assertEquals(buttonState.isPressed, false);
  assertEquals(buttonState.customState, undefined);
  assertEquals(buttonState.visual.text, "Calculator");
  assertEquals(buttonState.visual.color, "#FF0000");
});
