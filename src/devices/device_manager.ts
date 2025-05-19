/**
 * Device Manager for Stream Deck devices.
 *
 * Handles detection, connection, and management of Stream Deck devices.
 */

import { listStreamDecks, openStreamDeck } from "@elgato-stream-deck/node";
import { EventEmitter } from "node:events";
import { StreamDeckDevice } from "./stream_deck_device.ts";
import { StreamDeck, StreamDeckDeviceInfo } from "../../types/stream-deck.d.ts";
import { DeviceConnectedEvent, DeviceEventType, StreamDeckInfo } from "../types/types.ts";

/**
 * Manager for Stream Deck devices.
 * Handles detecting, connecting to, and managing Stream Deck devices.
 */
export class DeviceManager extends EventEmitter {
  private devices: Map<string, StreamDeckDevice> = new Map();
  private pollingInterval?: number;
  private isPolling = false;

  /**
   * Creates a new DeviceManager instance.
   */
  constructor() {
    super();
  }

  /**
   * Initializes the device manager and starts detection.
   * @param autoConnect Whether to automatically connect to detected devices.
   * @param pollingInterval Milliseconds between device detection polls, or 0 to disable polling.
   */
  async initialize(autoConnect = true, pollingInterval = 2000): Promise<void> {
    // Perform initial device detection
    await this.detectDevices(autoConnect);

    // Set up polling for device changes if interval is provided
    if (pollingInterval > 0) {
      this.startPolling(pollingInterval);
    }
  }

  /**
   * Starts polling for device changes.
   * @param interval Polling interval in milliseconds.
   */
  startPolling(interval: number): void {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.pollingInterval = setInterval(() => {
      this.detectDevices(true).catch((error) => {
        console.error("Error detecting devices:", error);
      });
    }, interval) as unknown as number;
  }

  /**
   * Stops polling for device changes.
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    this.isPolling = false;
  }

  /**
   * Detects connected Stream Deck devices.
   * @param autoConnect Whether to automatically connect to newly detected devices.
   * @returns Array of Stream Deck info objects.
   */
  async detectDevices(autoConnect = true): Promise<StreamDeckInfo[]> {
    try {
      // Get currently connected devices
      const connectedDevices = await listStreamDecks();
      const currentSerials = new Set(this.devices.keys());
      const connectedSerials = new Set(
        connectedDevices.map((dev) => dev.serialNumber || ""),
      );

      // Find disconnected devices
      for (const serial of currentSerials) {
        if (!connectedSerials.has(serial)) {
          await this.handleDeviceDisconnected(serial);
        }
      }

      // Find new devices
      const newDevices: StreamDeckInfo[] = [];
      for (const deviceInfo of connectedDevices) {
        const serialNumber = deviceInfo.serialNumber || "";
        if (serialNumber && !currentSerials.has(serialNumber)) {
          // Convert the deviceInfo to our custom type format
          const customDeviceInfo: StreamDeckDeviceInfo = {
            path: deviceInfo.path,
            serialNumber: deviceInfo.serialNumber || "",
            model: "Stream Deck", // Will get more accurate info when we open
            columns: 0, // Will be set properly when we open the device
            rows: 0, // Will be set properly when we open the device
            keys: 0, // Will be set properly when we open the device
          };
          const info = this.convertDeviceInfo(customDeviceInfo);
          newDevices.push(info);

          if (autoConnect) {
            await this.connectToDevice(
              serialNumber,
              deviceInfo.path,
            );
          }
        }
      }

      return newDevices;
    } catch (error) {
      console.error("Error detecting devices:", error);
      return [];
    }
  }

  /**
   * Gets all currently connected devices.
   * @returns Map of serial numbers to device objects.
   */
  getConnectedDevices(): Map<string, StreamDeckDevice> {
    return new Map(this.devices);
  }

  /**
   * Gets a device by its serial number.
   * @param serialNumber The serial number of the device.
   * @returns The device or undefined if not found.
   */
  getDevice(serialNumber: string): StreamDeckDevice | undefined {
    return this.devices.get(serialNumber);
  }

  /**
   * Connects to a Stream Deck device.
   * @param serialNumber The serial number of the device.
   * @param path Optional device path. If not provided, it will be looked up.
   * @returns The connected device.
   */
  async connectToDevice(
    serialNumber: string,
    path?: string,
  ): Promise<StreamDeckDevice> {
    // Check if already connected
    if (this.devices.has(serialNumber)) {
      return this.devices.get(serialNumber)!;
    }

    // Find the device path if not provided
    if (!path) {
      const devices = await listStreamDecks();
      const deviceInfo = devices.find((dev) => dev.serialNumber === serialNumber);
      if (!deviceInfo) {
        throw new Error(`Device with serial number ${serialNumber} not found`);
      }
      path = deviceInfo.path;
    }

    // Open the device
    try {
      const rawStreamDeck = await openStreamDeck(path);

      // Extract model, columns, rows, and keys from the raw device
      // The @elgato-stream-deck/node library uses different property names
      // than what our types expect, so we need to extract them
      // deno-lint-ignore no-explicit-any
      const rawDeck = rawStreamDeck as any;
      const model = rawDeck.MODEL || "Stream Deck";
      const columns = rawDeck.NUM_COLUMNS || 5;
      const rows = rawDeck.NUM_ROWS || 3;
      const keys = rawDeck.NUM_KEYS || 15;

      // Map the raw device to our interface
      const streamDeck = rawStreamDeck as unknown as StreamDeck;

      // Create our device info object
      const deviceInfo = this.convertDeviceInfo({
        path,
        serialNumber,
        model,
        columns,
        rows,
        keys,
      });

      // Create device wrapper
      const device = new StreamDeckDevice(streamDeck, deviceInfo);
      this.devices.set(serialNumber, device);

      // Forward device events
      device.on("event", (event) => {
        this.emit("deviceEvent", event);
      });

      // Emit connected event
      const connectedEvent: DeviceConnectedEvent = {
        ...deviceInfo,
        type: DeviceEventType.DEVICE_CONNECTED,
      };
      this.emit(DeviceEventType.DEVICE_CONNECTED, connectedEvent);

      return device;
    } catch (error) {
      console.error(`Error connecting to device ${serialNumber}:`, error);
      throw error;
    }
  }

  /**
   * Disconnects from a Stream Deck device.
   * @param serialNumber The serial number of the device to disconnect.
   */
  async disconnectDevice(serialNumber: string): Promise<void> {
    const device = this.devices.get(serialNumber);
    if (device) {
      await device.close();
      this.devices.delete(serialNumber);
      this.emit(DeviceEventType.DEVICE_DISCONNECTED, {
        deviceSerial: serialNumber,
        timestamp: Date.now(),
        type: DeviceEventType.DEVICE_DISCONNECTED,
      });
    }
  }

  /**
   * Disconnects all devices and cleans up.
   */
  async close(): Promise<void> {
    this.stopPolling();

    // Disconnect all devices
    const disconnectPromises = Array.from(this.devices.values()).map(
      (device) => device.close(),
    );
    await Promise.all(disconnectPromises);

    this.devices.clear();
    this.removeAllListeners();
  }

  /**
   * Handles a device disconnection event.
   * @param serialNumber The serial number of the disconnected device.
   */
  private async handleDeviceDisconnected(serialNumber: string): Promise<void> {
    const device = this.devices.get(serialNumber);
    if (device) {
      await device.close();
      this.devices.delete(serialNumber);
      this.emit(DeviceEventType.DEVICE_DISCONNECTED, {
        deviceSerial: serialNumber,
        timestamp: Date.now(),
        type: DeviceEventType.DEVICE_DISCONNECTED,
      });
    }
  }

  /**
   * Converts StreamDeckDeviceInfo to our StreamDeckInfo type.
   * @param info The Stream Deck device info.
   * @returns Our StreamDeckInfo format.
   */
  private convertDeviceInfo(info: StreamDeckDeviceInfo): StreamDeckInfo {
    return {
      serialNumber: info.serialNumber || "",
      type: info.model || "",
      buttonCount: info.keys || 0,
      layout: {
        columns: info.columns || 0,
        rows: info.rows || 0,
      },
      // Determine features based on device type
      hasDials: (info.model || "").includes("Stream Deck+"),
      hasLCD: (info.model || "").includes("Stream Deck+") ||
        (info.model || "").includes("Stream Deck Touch"),
    };
  }
}
