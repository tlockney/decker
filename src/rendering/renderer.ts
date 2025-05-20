/**
 * Button Renderer System
 *
 * Defines interfaces and classes for rendering content to Stream Deck buttons.
 */

import { Buffer } from "node:buffer";

/**
 * Represents a color in RGB format
 */
export interface RGB {
  /** Red component (0-255) */
  r: number;
  /** Green component (0-255) */
  g: number;
  /** Blue component (0-255) */
  b: number;
}

/**
 * Visual properties for rendering a button
 */
export interface ButtonVisualProps {
  /** Optional text to display on the button */
  text?: string;
  /** Optional image path to display on the button */
  imagePath?: string;
  /** Optional image buffer to display on the button */
  imageBuffer?: Buffer;
  /** Optional background color */
  backgroundColor?: RGB;
  /** Optional text color */
  textColor?: RGB;
  /** Optional font size */
  fontSize?: number;
  /** Optional text alignment */
  textAlign?: "left" | "center" | "right";
  /** Optional vertical text alignment */
  textVerticalAlign?: "top" | "middle" | "bottom";
  /** Optional text padding (in pixels) */
  textPadding?: number;
}

/**
 * Options for the rendering process
 */
export interface RenderOptions {
  /** Width of the button in pixels */
  width: number;
  /** Height of the button in pixels */
  height: number;
  /** Whether to cache the rendered result */
  cache?: boolean;
}

/**
 * Base interface for all button renderers
 */
export interface ButtonRenderer {
  /**
   * Renders a button with the given properties
   * @param props The visual properties to render
   * @param options Rendering options
   * @returns A Buffer containing the rendered image data
   */
  render(props: ButtonVisualProps, options: RenderOptions): Promise<Buffer>;

  /**
   * Clears any cached renders for efficiency
   */
  clearCache(): void;

  /**
   * Properly dispose of any resources used by the renderer
   */
  dispose(): void;
}

/**
 * Factory function interface for creating renderers
 */
export interface RendererFactory {
  /**
   * Creates a renderer for a specific device type
   * @param deviceType Type of Stream Deck device
   * @returns A ButtonRenderer instance
   */
  createRenderer(deviceType: string): ButtonRenderer;
}
