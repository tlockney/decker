/**
 * JPEG Processing Mock
 *
 * This file provides mock implementations of JPEG encoding/decoding functions
 * to resolve TypeScript errors related to the @julusian/jpeg-turbo library.
 */

import { Buffer } from "node:buffer";

/**
 * JPEG encoding options
 */
export interface EncodeOptions {
  width: number;
  height: number;
  quality?: number;
  subsampling?: number;
}

/**
 * JPEG decoding result
 */
export interface DecodeResult {
  width: number;
  height: number;
  data: Uint8Array;
  subsampling: number;
}

/**
 * Mock JPEG encoder
 * @param data Image data to encode
 * @param _options Encoding options (unused in mock)
 * @returns Buffer with encoded JPEG data
 */
export function encode(data: Uint8Array, _options: EncodeOptions): Buffer {
  // In a real implementation, this would convert RGB data to JPEG
  // For now, we just return a Buffer with the same data
  return Buffer.from(data);
}

/**
 * Mock JPEG decoder
 * @param _buffer JPEG data to decode (unused in mock)
 * @returns Decoded image data and information
 */
export function decode(_buffer: Buffer): DecodeResult {
  // In a real implementation, this would convert JPEG data to RGB
  // For now, we just assume it's a 100x100 RGB image
  return {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 3),
    subsampling: 1,
  };
}
