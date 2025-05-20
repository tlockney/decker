/**
 * Basic Button Renderer Implementation
 *
 * Implements rendering for Stream Deck buttons with text and solid colors.
 */

import { Buffer } from "node:buffer";
import { BaseButtonRenderer } from "./base_renderer.ts";
import { ButtonVisualProps, RenderOptions, RGB } from "./renderer.ts";
import { encode as encodeJpeg } from "./jpeg_mock.ts";

/**
 * Utility class for creating in-memory canvas for rendering
 *
 * This is a simplified alternative to using Canvas APIs which may
 * require native dependencies. It directly manipulates pixel data.
 */
class BitmapCanvas {
  /** Width of the canvas in pixels */
  private width: number;
  /** Height of the canvas in pixels */
  private height: number;
  /** Raw pixel data (RGBA format, 8 bits per channel) */
  private data: Uint8Array;

  /**
   * Creates a new bitmap canvas
   * @param width Width in pixels
   * @param height Height in pixels
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);

    // Initialize with transparent black
    this.data.fill(0);
  }

  /**
   * Fills the entire canvas with a solid color
   * @param color RGB color values
   */
  fillSolid(color: RGB): void {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = color.r; // R
      this.data[i + 1] = color.g; // G
      this.data[i + 2] = color.b; // B
      this.data[i + 3] = 255; // A (fully opaque)
    }
  }

  /**
   * Renders simple text on the canvas (center-aligned only in this version)
   * @param text Text to render
   * @param color Text color
   * @param fontSize Approximate font size (used for scaling)
   * @param align Horizontal alignment
   * @param vAlign Vertical alignment
   */
  renderText(
    text: string,
    color: RGB,
    fontSize: number = 14,
    align: "left" | "center" | "right" = "center",
    vAlign: "top" | "middle" | "bottom" = "middle",
  ): void {
    if (!text) return;

    // This is a very simplified text renderer for demonstration
    // A real implementation would use proper font rendering

    // Scale the font size to determine how many characters fit
    const scaleFactor = Math.max(1, Math.floor(fontSize / 10));
    const charWidth = 6 * scaleFactor;
    const charHeight = 8 * scaleFactor;

    // Calculate starting position based on alignment
    let startX: number;
    switch (align) {
      case "left":
        startX = 5;
        break;
      case "right":
        startX = this.width - (text.length * charWidth) - 5;
        break;
      case "center":
      default:
        startX = (this.width - (text.length * charWidth)) / 2;
    }

    let startY: number;
    switch (vAlign) {
      case "top":
        startY = 5;
        break;
      case "bottom":
        startY = this.height - charHeight - 5;
        break;
      case "middle":
      default:
        startY = (this.height - charHeight) / 2;
    }

    // For simplicity, we're just going to draw colored blocks for each character
    // In a real implementation, this would use actual font rendering
    for (let i = 0; i < text.length; i++) {
      const x = startX + (i * charWidth);
      const y = startY;

      // Draw a simple colored block representing each character
      this.drawRect(
        x,
        y,
        charWidth - 1,
        charHeight,
        color,
      );
    }
  }

  /**
   * Draws a solid rectangle on the canvas
   * @param x X coordinate of top-left corner
   * @param y Y coordinate of top-left corner
   * @param width Width of rectangle
   * @param height Height of rectangle
   * @param color Fill color
   */
  drawRect(x: number, y: number, width: number, height: number, color: RGB): void {
    const startX = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
    const startY = Math.max(0, Math.min(this.height - 1, Math.floor(y)));
    const endX = Math.max(0, Math.min(this.width, Math.floor(x + width)));
    const endY = Math.max(0, Math.min(this.height, Math.floor(y + height)));

    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const idx = (py * this.width + px) * 4;
        this.data[idx] = color.r; // R
        this.data[idx + 1] = color.g; // G
        this.data[idx + 2] = color.b; // B
        this.data[idx + 3] = 255; // A
      }
    }
  }

  /**
   * Converts the canvas to a JPEG buffer
   * @param quality JPEG quality (1-100)
   * @returns Promise containing JPEG data Buffer
   */
  toJpegBuffer(quality: number = 90): Promise<Buffer> {
    // Convert RGBA to RGB for JPEG encoding
    const rgbData = new Uint8Array(this.width * this.height * 3);

    for (let i = 0, j = 0; i < this.data.length; i += 4, j += 3) {
      rgbData[j] = this.data[i]; // R
      rgbData[j + 1] = this.data[i + 1]; // G
      rgbData[j + 2] = this.data[i + 2]; // B
    }

    // Encode as JPEG using @julusian/jpeg-turbo
    const result = encodeJpeg(rgbData, {
      width: this.width,
      height: this.height,
      quality: quality,
      subsampling: 1, // 4:4:4 for better quality
    });

    // Return as a Promise
    return Promise.resolve(result);
  }
}

/**
 * Basic renderer for Stream Deck buttons
 */
export class BasicButtonRenderer extends BaseButtonRenderer {
  /**
   * Renders a button with specified properties
   * @param props Visual properties for the button
   * @param options Rendering options
   * @returns Buffer containing the rendered image
   */
  protected renderInternal(
    props: ButtonVisualProps,
    options: RenderOptions,
  ): Promise<Buffer> {
    // Create a bitmap canvas for rendering
    const canvas = new BitmapCanvas(options.width, options.height);

    // Fill background
    const bgColor = props.backgroundColor || this.defaultBackgroundColor;
    canvas.fillSolid(bgColor);

    // If there's an image, we would render it here
    // For now, we'll just handle text rendering

    // Render text if present
    if (props.text) {
      const textColor = props.textColor || this.defaultTextColor;
      const fontSize = props.fontSize || this.defaultFontSize;

      canvas.renderText(
        props.text,
        textColor,
        fontSize,
        props.textAlign || "center",
        props.textVerticalAlign || "middle",
      );
    }

    // Convert to JPEG format for Stream Deck
    return canvas.toJpegBuffer();
  }
}

/**
 * Factory for creating basic renderers
 */
export class BasicRendererFactory {
  /**
   * Creates a basic renderer for any device type
   * @returns A BasicButtonRenderer instance
   */
  createRenderer(): BasicButtonRenderer {
    return new BasicButtonRenderer();
  }
}
