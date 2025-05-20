/**
 * Tests for Device Event Action
 */

import { assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { DeviceEventAction, DeviceEventActionFactory } from "../device_event_action.ts";
import { ButtonEvent, DeviceEventType } from "../../types/types.ts";
import { DeviceManager } from "../../devices/device_manager.ts";
import { ButtonState } from "../../state/button_state.ts";
import { EventBus } from "../../state/events.ts";
import { ActionStatus } from "../types.ts";
import { delay } from "../../utils/utils.ts";

// Create a mock device manager for testing
class MockDeviceManager extends EventBus {
  constructor() {
    super();
  }

  // Method to simulate device events for testing
  simulateDeviceEvent(event: ButtonEvent): void {
    this.emit("deviceEvent", event);
  }
}

Deno.test("DeviceEventAction - Initialization with required config", () => {
  const deviceManager = new MockDeviceManager();
  const config = {
    eventType: DeviceEventType.BUTTON_PRESSED,
  };

  const action = new DeviceEventAction(config, deviceManager as unknown as DeviceManager);
  assertEquals(action.getType(), "device_event");
});

Deno.test("DeviceEventAction - Throws error with invalid config", () => {
  const deviceManager = new MockDeviceManager();
  const config = {
    // Missing required eventType
  };

  assertThrows(
    () => new DeviceEventAction(config, deviceManager as unknown as DeviceManager),
    Error,
    "Device event action requires a valid event type",
  );
});

Deno.test("DeviceEventAction - Successful event handling", async () => {
  const deviceManager = new MockDeviceManager();
  const config = {
    eventType: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 1,
  };

  const action = new DeviceEventAction(config, deviceManager as unknown as DeviceManager);
  const buttonState = new ButtonState({
    deviceSerial: "test-device",
    buttonIndex: 1,
    pageId: "test-page",
    config: { type: "none" },
    visual: {},
  });

  // Execute action (which starts listening for events)
  const executePromise = action.execute({ buttonState });

  // Small delay to ensure listener is set up
  await delay(20);

  // Simulate a matching event
  const event: ButtonEvent = {
    type: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 1,
    timestamp: Date.now(),
  };
  deviceManager.simulateDeviceEvent(event);

  // Action should complete with success
  const result = await executePromise;
  assertEquals(result.status, ActionStatus.SUCCESS);
  assertEquals((result.data as Record<string, unknown>)?.eventType, DeviceEventType.BUTTON_PRESSED);
  assertEquals((result.data as Record<string, unknown>)?.deviceSerial, "test-device");
  assertEquals((result.data as Record<string, unknown>)?.eventData, event);
});

Deno.test("DeviceEventAction - Ignores non-matching events", async () => {
  const deviceManager = new MockDeviceManager();
  const config = {
    eventType: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 1,
  };

  const action = new DeviceEventAction(config, deviceManager as unknown as DeviceManager);
  const buttonState = new ButtonState({
    deviceSerial: "test-device",
    buttonIndex: 1,
    pageId: "test-page",
    config: { type: "none" },
    visual: {},
  });

  // Execute action (which starts listening for events)
  const executePromise = action.execute({ buttonState });

  // Small delay to ensure listener is set up
  await delay(20);

  // Simulate a non-matching event (different device)
  deviceManager.simulateDeviceEvent({
    type: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "different-device",
    buttonIndex: 1,
    timestamp: Date.now(),
  });

  // Simulate a non-matching event (different button)
  deviceManager.simulateDeviceEvent({
    type: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 2,
    timestamp: Date.now(),
  });

  // Simulate a non-matching event (different event type)
  deviceManager.simulateDeviceEvent({
    type: DeviceEventType.BUTTON_RELEASED,
    deviceSerial: "test-device",
    buttonIndex: 1,
    timestamp: Date.now(),
  });

  // Check that action is still executing (waiting for matching event)
  assertEquals(action.isExecuting(), true);

  // Simulate a matching event
  const matchingEvent: ButtonEvent = {
    type: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 1,
    timestamp: Date.now(),
  };
  deviceManager.simulateDeviceEvent(matchingEvent);

  // Action should complete with success
  const result = await executePromise;
  assertEquals(result.status, ActionStatus.SUCCESS);
});

Deno.test("DeviceEventAction - Times out when no matching event", async () => {
  const deviceManager = new MockDeviceManager();
  const config = {
    eventType: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 1,
    timeout: 100, // Short timeout for testing
  };

  const action = new DeviceEventAction(config, deviceManager as unknown as DeviceManager);
  const buttonState = new ButtonState({
    deviceSerial: "test-device",
    buttonIndex: 1,
    pageId: "test-page",
    config: { type: "none" },
    visual: {},
  });

  // Execute action (which starts listening for events)
  const result = await action.execute({ buttonState });

  // Should fail with timeout
  assertEquals(result.status, ActionStatus.FAILURE);
  assertEquals(
    result.message?.includes("Timed out waiting for"),
    true,
    `Expected timeout message, got: ${result.message}`,
  );
});

Deno.test("DeviceEventAction - Can be cancelled", async () => {
  const deviceManager = new MockDeviceManager();
  const config = {
    eventType: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 1,
  };

  const action = new DeviceEventAction(config, deviceManager as unknown as DeviceManager);
  const buttonState = new ButtonState({
    deviceSerial: "test-device",
    buttonIndex: 1,
    pageId: "test-page",
    config: { type: "none" },
    visual: {},
  });

  // Execute action (which starts listening for events)
  const executePromise = action.execute({ buttonState });

  // Small delay to ensure listener is set up
  await delay(20);

  // Action should be cancellable while executing
  assertEquals(action.isCancellable(), true);

  // Cancel the action
  const cancelled = await action.cancel();
  assertEquals(cancelled, true);

  // Action should complete with cancelled status
  const result = await executePromise;
  assertEquals(result.status, ActionStatus.CANCELLED);
});

Deno.test("DeviceEventActionFactory - Creates and validates actions", () => {
  const deviceManager = new MockDeviceManager();
  const factory = new DeviceEventActionFactory(deviceManager as unknown as DeviceManager);

  // Valid config
  const validConfig = {
    eventType: DeviceEventType.BUTTON_PRESSED,
    deviceSerial: "test-device",
    buttonIndex: 1,
  };

  // Factory should validate correctly
  assertEquals(factory.validate(validConfig), true);
  assertEquals(factory.getType(), "device_event");

  // Factory should create an action
  const action = factory.create(validConfig);
  assertNotEquals(action, undefined);
  assertEquals(action.getType(), "device_event");

  // Invalid configs
  const missingEventType = {
    deviceSerial: "test-device",
  };
  assertEquals(factory.validate(missingEventType), false);

  const invalidButtonIndex = {
    eventType: DeviceEventType.BUTTON_PRESSED,
    buttonIndex: "not-a-number",
  };
  assertEquals(factory.validate(invalidButtonIndex), false);
});

// Run tests
