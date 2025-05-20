/**
 * Basic Button Renderer Implementation
 *
 * Implements rendering for Stream Deck buttons with text and solid colors.
 */

import { Buffer } from "node:buffer";
import { BaseButtonRenderer } from "./base_renderer.ts";
import { ButtonVisualProps, RenderOptions, RGB } from "./renderer.ts";
import { CanvasContext, createCanvas, SimpleCanvas } from "./canvas_renderer.ts";

/**
 * Canvas wrapper with methods for common rendering operations
 * using our custom SimpleCanvas implementation
 */
class CanvasWrapper {
  /** Canvas instance */
  private canvas: SimpleCanvas;
  /** Canvas rendering context */
  private ctx: CanvasContext;
  /** Canvas width */
  private width: number;
  /** Canvas height */
  private height: number;

  /**
   * Creates a new canvas wrapper
   * @param width Canvas width in pixels
   * @param height Canvas height in pixels
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext();
  }

  /**
   * Fills the entire canvas with a solid color
   * @param color RGB color values
   */
  fillSolid(color: RGB): void {
    this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Renders text on the canvas
   * @param text Text to render
   * @param color Text color
   * @param fontSize Font size (in pixels)
   * @param align Horizontal alignment
   * @param vAlign Vertical alignment
   * @param fontFamily Font family to use
   */
  renderText(
    text: string,
    color: RGB,
    fontSize: number = 14,
    align: "left" | "center" | "right" = "center",
    vAlign: "top" | "middle" | "bottom" = "middle",
    fontFamily: string = "sans-serif",
  ): void {
    if (!text) return;

    // Configure text properties
    this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = vAlign;

    // Calculate position based on alignment
    // For x, textAlign handles the alignment
    let x: number;
    switch (align) {
      case "left":
        x = 10; // Left padding
        break;
      case "right":
        x = this.width - 10; // Right padding
        break;
      case "center":
      default:
        x = this.width / 2;
    }

    // For y, we need to calculate based on textBaseline
    let y: number;
    switch (vAlign) {
      case "top":
        y = 10; // Top padding
        break;
      case "bottom":
        y = this.height - 10; // Bottom padding
        break;
      case "middle":
      default:
        y = this.height / 2;
    }

    // Handle text wrapping if it would overflow
    const textWidth = this.ctx.measureText(text).width;
    if (textWidth > this.width - 20) { // Allow for 10px padding on each side
      // Multi-line rendering - simplified approach for our basic canvas
      const words = text.split(" ");
      const maxWordsPerLine = Math.floor((this.width - 20) / (fontSize * 0.6));
      const lines: string[] = [];

      // Break text into lines with roughly equal words per line
      for (let i = 0; i < words.length; i += maxWordsPerLine) {
        lines.push(words.slice(i, i + maxWordsPerLine).join(" "));
      }

      // Calculate starting Y position for multiple lines
      const lineHeight = fontSize * 1.2; // Add some line spacing
      let startY = y;

      if (vAlign === "middle") {
        startY = y - ((lines.length - 1) * lineHeight) / 2;
      } else if (vAlign === "bottom") {
        startY = y - (lines.length - 1) * lineHeight;
      }

      // Render each line
      lines.forEach((line, index) => {
        this.ctx.fillText(line, x, startY + index * lineHeight);
      });
    } else {
      // Single line rendering
      this.ctx.fillText(text, x, y);
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
    this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    this.ctx.fillRect(x, y, width, height);
  }

  /**
   * Converts the canvas to a JPEG buffer
   * @param quality JPEG quality (1-100)
   * @returns Promise containing JPEG data Buffer
   */
  toJpegBuffer(quality: number = 90): Promise<Buffer> {
    return this.canvas.toJpegBuffer(quality);
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
    // Create a canvas for rendering
    const canvas = new CanvasWrapper(options.width, options.height);

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
