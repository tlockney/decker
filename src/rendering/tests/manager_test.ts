/**
 * Tests for the rendering manager
 */

import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { RenderingManager } from "../rendering_manager.ts";
import { StreamDeckInfo } from "../../types/types.ts";
import { Buffer } from "node:buffer";
// import { mock } from "@std/mock";

// Mock StreamDeckDevice for testing
class MockStreamDeckDevice {
  private info: StreamDeckInfo;
  private buttonImages: Map<number, Buffer> = new Map();
  private buttonColors: Map<number, { r: number; g: number; b: number }> = new Map();

  constructor(info: StreamDeckInfo) {
    this.info = info;
  }

  getInfo(): StreamDeckInfo {
    return { ...this.info };
  }

  setButtonImage(buttonIndex: number, buffer: Buffer): Promise<void> {
    this.buttonImages.set(buttonIndex, buffer);
    return Promise.resolve();
  }

  setButtonColor(buttonIndex: number, r: number, g: number, b: number): Promise<void> {
    this.buttonColors.set(buttonIndex, { r, g, b });
    return Promise.resolve();
  }

  clearButton(buttonIndex: number): Promise<void> {
    this.buttonImages.delete(buttonIndex);
    this.buttonColors.delete(buttonIndex);
    return Promise.resolve();
  }

  getButtonImage(buttonIndex: number): Buffer | undefined {
    return this.buttonImages.get(buttonIndex);
  }

  getButtonColor(buttonIndex: number): { r: number; g: number; b: number } | undefined {
    return this.buttonColors.get(buttonIndex);
  }
}

// Create test device info
function createTestDeviceInfo(serialNumber: string, type: string): StreamDeckInfo {
  return {
    serialNumber,
    type,
    buttonCount: 15,
    layout: {
      columns: 5,
      rows: 3,
    },
    hasDials: false,
    hasLCD: false,
  };
}

Deno.test("RenderingManager - registerDevice", () => {
  const manager = new RenderingManager();
  const deviceInfo = createTestDeviceInfo("TEST001", "Stream Deck MK.2");

  const renderer = manager.registerDevice(deviceInfo);

  assertExists(renderer);
});

Deno.test("RenderingManager - renderButton", async () => {
  const manager = new RenderingManager();
  const deviceInfo = createTestDeviceInfo("TEST002", "Stream Deck MK.2");

  manager.registerDevice(deviceInfo);

  const buffer = await manager.renderButton("TEST002", {
    text: "Test Button",
    backgroundColor: { r: 255, g: 0, b: 0 },
  });

  assertExists(buffer);
  assertEquals(buffer instanceof Buffer, true);
  assertEquals(buffer.length > 0, true);
});

Deno.test("RenderingManager - renderButton unregistered device", async () => {
  const manager = new RenderingManager();

  await assertThrows(
    () => manager.renderButton("UNKNOWN", { text: "Test" }),
    Error,
    "not registered",
  );
});

Deno.test("RenderingManager - updateButton", async () => {
  const manager = new RenderingManager();
  const deviceInfo = createTestDeviceInfo("TEST003", "Stream Deck MK.2");

  manager.registerDevice(deviceInfo);

  // Create mock device
  const mockDevice = new MockStreamDeckDevice(deviceInfo);

  // Update a button with text
  await manager.updateButton(
    mockDevice as unknown as StreamDeckDevice,
    0,
    { text: "Button 0", backgroundColor: { r: 0, g: 0, b: 255 } },
  );

  // Check that image was set
  const buttonImage = mockDevice.getButtonImage(0);
  assertExists(buttonImage);

  // Update a button with just color
  await manager.updateButton(
    mockDevice as unknown as StreamDeckDevice,
    1,
    { backgroundColor: { r: 255, g: 0, b: 0 } },
  );

  // Check that color was set directly
  const buttonColor = mockDevice.getButtonColor(1);
  assertExists(buttonColor);
  assertEquals(buttonColor.r, 255);
  assertEquals(buttonColor.g, 0);
  assertEquals(buttonColor.b, 0);
});

Deno.test("RenderingManager - unregisterDevice", () => {
  const manager = new RenderingManager();
  const deviceInfo = createTestDeviceInfo("TEST004", "Stream Deck MK.2");

  manager.registerDevice(deviceInfo);
  manager.unregisterDevice("TEST004");

  // Now rendering should fail
  assertThrows(
    () => manager.renderButton("TEST004", { text: "Test" }),
    Error,
    "not registered",
  );
});

// Add more tests as needed...
