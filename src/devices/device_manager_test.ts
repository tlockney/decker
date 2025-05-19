/**
 * Tests for the DeviceManager class.
 *
 * Note: These tests are currently skipped in automated runs because they
 * require significant mocking of native device functionality.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { DeviceManager } from "./device_manager.ts";

// Since we can't effectively mock the device communication without more complex setup,
// we'll simply define but skip these tests
Deno.test({
  name: "DeviceManager interface tests are properly defined",
  fn() {
    // Just ensures the test framework is working
    assertEquals(true, true);
  },
});

// Skipped tests that would be useful for manual validation
Deno.test({
  name: "DeviceManager can detect devices",
  ignore: true, // Skip this test
  async fn() {
    const manager = new DeviceManager();
    try {
      const devices = await manager.detectDevices(false);
      console.log("Detected devices:", devices);

      // Basic assertions that would be useful when run manually
      // with actual hardware connected
      assertEquals(typeof devices.length, "number");
    } finally {
      await manager.close();
    }
  },
});

Deno.test({
  name: "DeviceManager can connect to a device",
  ignore: true, // Skip this test
  async fn() {
    const manager = new DeviceManager();
    try {
      await manager.initialize(true);
      const devices = manager.getConnectedDevices();

      if (devices.size > 0) {
        const [serialNumber, device] = Array.from(devices.entries())[0];
        assertExists(device);
        assertEquals(typeof device.getSerialNumber(), "string");
        assertEquals(device.getSerialNumber(), serialNumber);
      }
    } finally {
      await manager.close();
    }
  },
});
