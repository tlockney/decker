/**
 * Canvas Renderer Implementation
 *
 * Provides a Deno-compatible implementation of canvas-like rendering
 * without requiring native Node.js modules.
 */

import { Buffer } from "node:buffer";
import { RGB } from "./renderer.ts";
import { encode as encodeJpeg } from "./jpeg_mock.ts";

/**
 * Font measurement details
 */
export interface TextMetrics {
  width: number;
  height: number;
}

/**
 * Options for text rendering
 */
export interface TextOptions {
  fontSize?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  textBaseline?: "top" | "middle" | "bottom";
}

/**
 * Canvas rendering context with basic 2D operations
 */
export class CanvasContext {
  /** Canvas width */
  private width: number;
  /** Canvas height */
  private height: number;
  /** Image data (RGBA) */
  private imageData: Uint8ClampedArray;
  /** Current fill color */
  private _fillStyle: RGB = { r: 0, g: 0, b: 0 };
  /** Current font size */
  private _fontSize: number = 14;
  /** Current text alignment */
  private _textAlign: "left" | "center" | "right" = "left";
  /** Current text baseline */
  private _textBaseline: "top" | "middle" | "bottom" = "top";
  /** Font family (not fully implemented in this version) */
  private _fontFamily: string = "sans-serif";

  /**
   * Create a new canvas context
   * @param width Canvas width
   * @param height Canvas height
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.imageData = new Uint8ClampedArray(width * height * 4);
    this.clear();
  }

  /**
   * Set fill style color
   */
  set fillStyle(color: string | RGB) {
    if (typeof color === "string") {
      // Handle CSS color strings
      if (color.startsWith("rgb(")) {
        const values = color.substring(4, color.length - 1).split(",").map((v) =>
          parseInt(v.trim())
        );
        this._fillStyle = { r: values[0], g: values[1], b: values[2] };
      } else if (color.startsWith("#")) {
        // Handle hex colors
        const hex = color.substring(1);
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        this._fillStyle = { r, g, b };
      }
    } else {
      this._fillStyle = color;
    }
  }

  /**
   * Get current fill style
   */
  get fillStyle(): RGB {
    return this._fillStyle;
  }

  /**
   * Set current font
   */
  set font(fontStr: string) {
    // Simple font parsing (e.g., "14px Arial")
    const parts = fontStr.split(" ");
    if (parts.length >= 2) {
      // Parse font size
      const sizeStr = parts[0];
      if (sizeStr.endsWith("px")) {
        this._fontSize = parseInt(sizeStr.substring(0, sizeStr.length - 2));
      }
      // Save font family
      this._fontFamily = parts.slice(1).join(" ");
    }
  }

  /**
   * Get current font
   */
  get font(): string {
    return `${this._fontSize}px ${this._fontFamily}`;
  }

  /**
   * Set text alignment
   */
  set textAlign(align: "left" | "center" | "right") {
    this._textAlign = align;
  }

  /**
   * Get text alignment
   */
  get textAlign(): "left" | "center" | "right" {
    return this._textAlign;
  }

  /**
   * Set text baseline
   */
  set textBaseline(baseline: "top" | "middle" | "bottom") {
    this._textBaseline = baseline;
  }

  /**
   * Get text baseline
   */
  get textBaseline(): "top" | "middle" | "bottom" {
    return this._textBaseline;
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.imageData.fill(0);
  }

  /**
   * Fill a rectangle with the current fill style
   * @param x X coordinate
   * @param y Y coordinate
   * @param width Rectangle width
   * @param height Rectangle height
   */
  fillRect(x: number, y: number, width: number, height: number): void {
    const startX = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
    const startY = Math.max(0, Math.min(this.height - 1, Math.floor(y)));
    const endX = Math.max(0, Math.min(this.width, Math.floor(x + width)));
    const endY = Math.max(0, Math.min(this.height, Math.floor(y + height)));

    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const idx = (py * this.width + px) * 4;
        this.imageData[idx] = this._fillStyle.r; // R
        this.imageData[idx + 1] = this._fillStyle.g; // G
        this.imageData[idx + 2] = this._fillStyle.b; // B
        this.imageData[idx + 3] = 255; // A (fully opaque)
      }
    }
  }

  /**
   * Draw text with the current fill style and font
   * @param text Text to draw
   * @param x X coordinate
   * @param y Y coordinate
   * @param maxWidth Optional maximum width
   */
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    if (!text) return;

    // Calculate actual position based on alignment
    const metrics = this.measureText(text);
    let actualX = x;
    let actualY = y;

    // Adjust for text alignment
    if (this._textAlign === "center") {
      actualX = x - metrics.width / 2;
    } else if (this._textAlign === "right") {
      actualX = x - metrics.width;
    }

    // Adjust for baseline
    if (this._textBaseline === "middle") {
      actualY = y - metrics.height / 2;
    } else if (this._textBaseline === "bottom") {
      actualY = y - metrics.height;
    }

    // If text is too wide and maxWidth is specified, truncate or scale
    if (maxWidth !== undefined && metrics.width > maxWidth) {
      // Simple scaling approach - just scale the width of each character
      this._drawSimpleText(text, actualX, actualY, maxWidth / metrics.width);
    } else {
      this._drawSimpleText(text, actualX, actualY);
    }
  }

  /**
   * Measure text dimensions
   * @param text Text to measure
   * @returns Text metrics
   */
  measureText(text: string): TextMetrics {
    // Simplified font metrics estimation
    // In a real implementation, this would use actual font metrics
    const charWidth = this._fontSize * 0.6; // Approximate character width
    const width = text.length * charWidth;
    const height = this._fontSize;

    return { width, height };
  }

  /**
   * Get the image data from the canvas
   * @returns ImageData object with RGBA values
   */
  getImageData(): { data: Uint8ClampedArray; width: number; height: number } {
    return {
      data: this.imageData,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Simple text rendering implementation
   * @param text Text to render
   * @param x Starting X position
   * @param y Starting Y position
   * @param scale Optional scale factor
   */
  private _drawSimpleText(text: string, x: number, y: number, scale: number = 1): void {
    const charWidth = this._fontSize * 0.6 * scale; // Approximate character width
    const charHeight = this._fontSize;

    // Draw each character as a rectangle (very simplified)
    for (let i = 0; i < text.length; i++) {
      const charX = x + i * charWidth;
      // Skip characters that would be outside the canvas
      if (charX < 0 || charX >= this.width) continue;

      this._drawCharacter(text[i], charX, y, charWidth, charHeight);
    }
  }

  /**
   * Draw a character (very simplified version)
   * @param char Character to draw
   * @param x X position
   * @param y Y position
   * @param width Character width
   * @param height Character height
   */
  private _drawCharacter(char: string, x: number, y: number, width: number, height: number): void {
    // In a real implementation, this would render actual font glyphs
    // For this simplified version, we'll draw a filled rectangle with varied
    // height based on the character to give some visual differentiation

    // Make a variable height based on character code to add visual variety
    const charCode = char.charCodeAt(0);
    const heightVariation = (charCode % 4) - 2; // Range from -2 to +1
    const adjustedHeight = height * 0.7 + heightVariation;

    // Character top position (align to baseline)
    const charY = y + (height - adjustedHeight);

    // Draw the character shape
    this.fillRect(x, charY, width * 0.8, adjustedHeight);
  }
}

/**
 * Simple canvas implementation for Deno
 */
export class SimpleCanvas {
  /** Canvas width */
  public width: number;
  /** Canvas height */
  public height: number;
  /** Canvas context */
  private ctx: CanvasContext;

  /**
   * Create a new canvas
   * @param width Canvas width
   * @param height Canvas height
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = new CanvasContext(width, height);
  }

  /**
   * Get the canvas context
   * @returns Canvas rendering context
   */
  getContext(): CanvasContext {
    return this.ctx;
  }

  /**
   * Convert the canvas to a JPEG buffer
   * @param quality JPEG quality (1-100)
   * @returns JPEG buffer
   */
  toJpegBuffer(quality: number = 90): Promise<Buffer> {
    const imageData = this.ctx.getImageData();

    // Convert RGBA to RGB for JPEG encoding
    const rgbData = new Uint8Array(this.width * this.height * 3);

    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += 3) {
      rgbData[j] = imageData.data[i]; // R
      rgbData[j + 1] = imageData.data[i + 1]; // G
      rgbData[j + 2] = imageData.data[i + 2]; // B
    }

    // Encode as JPEG using @julusian/jpeg-turbo
    const result = encodeJpeg(rgbData, {
      width: this.width,
      height: this.height,
      quality: quality,
      subsampling: 1, // 4:4:4 for better quality
    });

    return Promise.resolve(result);
  }
}

/**
 * Create a new canvas with specified dimensions
 * @param width Canvas width
 * @param height Canvas height
 * @returns Canvas object
 */
export function createCanvas(width: number, height: number): SimpleCanvas {
  return new SimpleCanvas(width, height);
}
