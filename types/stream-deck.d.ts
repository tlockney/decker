/**
 * Custom type definitions for the Stream Deck library
 * to supplement/override the built-in types.
 */

// Import Buffer type
import { Buffer } from "node:buffer";

// Define types missing from @elgato-stream-deck/node
export interface StreamDeckDeviceInfo {
  path: string;
  serialNumber: string;
  model: string;
  columns: number;
  rows: number;
  keys: number;
}

export interface KeyDownEvent {
  type: string;
  index: number;
}

export interface KeyUpEvent {
  type: string;
  index: number;
}

export interface DialDownEvent {
  index: number;
}

export interface DialUpEvent {
  index: number;
}

export interface DialRotateEvent {
  index: number;
  ticks: number;
}

export interface DeviceDisconnectEvent {
  deviceSerial: string;
  type: string;
  timestamp: number;
}

export interface StreamDeckEvents {
  down: (event: KeyDownEvent) => void;
  up: (event: KeyUpEvent) => void;
  dialDown: (event: DialDownEvent) => void;
  dialUp: (event: DialUpEvent) => void;
  dialRotate: (event: DialRotateEvent) => void;
  error: (err: unknown) => void;
}

export interface StreamDeck {
  columns: number;
  rows: number;
  keys: number;
  model: string;

  on<K extends keyof StreamDeckEvents>(event: K, listener: StreamDeckEvents[K]): this;
  on(event: string, listener: (...args: any[]) => void): this;

  fillKeyColor(keyIndex: number, r: number, g: number, b: number): Promise<void>;
  fillKeyBuffer(keyIndex: number, buffer: Buffer): Promise<void>;
  clearKey(keyIndex: number): Promise<void>;
  clearPanel(): Promise<void>;
  removeAllListeners(): void;
}