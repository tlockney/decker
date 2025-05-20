/**
 * Image Button Renderer Implementation
 *
 * Implements rendering for Stream Deck buttons with image support.
 */

import { Buffer } from "node:buffer";
import { BaseButtonRenderer } from "./base_renderer.ts";
import { ButtonVisualProps, RenderOptions } from "./renderer.ts";
import { decode as decodeJpeg, encode as encodeJpeg } from "@julusian/jpeg-turbo";
import { BasicButtonRenderer } from "./basic_renderer.ts";

/**
 * Renderer with support for image loading and compositing
 */
export class ImageButtonRenderer extends BaseButtonRenderer {
  /** Basic renderer for fallback */
  private basicRenderer = new BasicButtonRenderer();
  /** Cache of loaded images */
  private imageCache: Map<string, { buffer: Buffer; timestamp: number }> = new Map();
  /** Maximum age of cached images (10 minutes) */
  private imageCacheMaxAge = 10 * 60 * 1000;

  /**
   * Renders a button with specified properties
   * @param props Visual properties for the button
   * @param options Rendering options
   * @returns Buffer containing the rendered image
   */
  protected async renderInternal(
    props: ButtonVisualProps,
    options: RenderOptions,
  ): Promise<Buffer> {
    // If we have an image path or buffer, process it
    if (props.imagePath || props.imageBuffer) {
      try {
        // Load or use the provided image
        let imageBuffer: Buffer;

        if (props.imageBuffer) {
          // Use the provided buffer directly
          imageBuffer = props.imageBuffer;
        } else if (props.imagePath) {
          // Load from file and cache
          imageBuffer = await this.loadImage(props.imagePath);
        } else {
          // Shouldn't happen due to the if condition, but TypeScript doesn't know that
          throw new Error("No image source specified");
        }

        // Process the image (resize, add text if needed)
        return this.processImage(imageBuffer, props, options);
      } catch (error) {
        console.error("Error rendering image:", error);
        // Fall back to basic rendering if image processing fails
        return this.basicRenderer.render(props, options);
      }
    }

    // If no image, fall back to basic rendering
    return this.basicRenderer.render(props, options);
  }

  /**
   * Loads an image from a file path
   * @param imagePath Path to the image file
   * @returns Buffer containing the image data
   */
  private async loadImage(imagePath: string): Promise<Buffer> {
    // Check cache first
    const cached = this.imageCache.get(imagePath);
    if (cached && (Date.now() - cached.timestamp) < this.imageCacheMaxAge) {
      return cached.buffer;
    }

    // Load the image file
    try {
      const imageData = await Deno.readFile(imagePath);

      // Cache the loaded image
      this.imageCache.set(imagePath, {
        buffer: imageData,
        timestamp: Date.now(),
      });

      return imageData;
    } catch (error) {
      console.error(`Error loading image from ${imagePath}:`, error);
      throw error;
    }
  }

  /**
   * Processes an image for display on a Stream Deck button
   * @param imageBuffer The source image buffer
   * @param props Visual properties
   * @param options Rendering options
   * @returns Processed image buffer
   */
  private processImage(
    imageBuffer: Buffer,
    props: ButtonVisualProps,
    options: RenderOptions,
  ): Promise<Buffer> {
    // For now, we'll implement a simple image resize using @julusian/jpeg-turbo
    // In a real implementation, we'd also overlay text and handle other visual effects

    try {
      // Try to decode the image
      // This assumes JPEG format - a real implementation would handle multiple formats
      const decoded = decodeJpeg(imageBuffer);

      // If image is already the right size, just use it
      if (decoded.width === options.width && decoded.height === options.height) {
        // Encode as JPEG for Stream Deck
        return encodeJpeg(decoded.data, {
          width: decoded.width,
          height: decoded.height,
          quality: 90,
          subsampling: 1,
        });
      }

      // Simple resize logic (center crop to maintain aspect ratio)
      // This is a very simplified implementation

      // Create a new buffer for the resized image
      const resized = new Uint8Array(options.width * options.height * 3);

      // Calculate scaling and offsets for centering
      const sourceAspect = decoded.width / decoded.height;
      const targetAspect = options.width / options.height;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = decoded.width;
      let sourceHeight = decoded.height;

      if (sourceAspect > targetAspect) {
        // Source is wider - crop width
        sourceWidth = Math.round(decoded.height * targetAspect);
        sourceX = Math.floor((decoded.width - sourceWidth) / 2);
      } else {
        // Source is taller - crop height
        sourceHeight = Math.round(decoded.width / targetAspect);
        sourceY = Math.floor((decoded.height - sourceHeight) / 2);
      }

      // Perform a simple nearest-neighbor resize
      // Note: A real implementation would use better resampling
      for (let y = 0; y < options.height; y++) {
        for (let x = 0; x < options.width; x++) {
          const targetIdx = (y * options.width + x) * 3;

          // Map to source coordinates
          const srcX = sourceX + Math.floor(x * sourceWidth / options.width);
          const srcY = sourceY + Math.floor(y * sourceHeight / options.height);
          const srcIdx = (srcY * decoded.width + srcX) * 3;

          // Copy pixels if within bounds
          if (
            srcX >= 0 && srcX < decoded.width &&
            srcY >= 0 && srcY < decoded.height
          ) {
            resized[targetIdx] = decoded.data[srcIdx];
            resized[targetIdx + 1] = decoded.data[srcIdx + 1];
            resized[targetIdx + 2] = decoded.data[srcIdx + 2];
          }
        }
      }

      // If text is specified, we would overlay it here
      // For now, we'll skip text overlay in this implementation

      // Encode as JPEG for Stream Deck
      return encodeJpeg(resized, {
        width: options.width,
        height: options.height,
        quality: 90,
        subsampling: 1,
      });
    } catch (error) {
      console.error("Error processing image:", error);

      // If image processing fails, fall back to basic rendering
      return this.basicRenderer.render(props, options);
    }
  }

  /**
   * Clears the renderer caches
   */
  clearCache(): void {
    super.clearCache();
    this.imageCache.clear();
    this.basicRenderer.clearCache();
  }
}

/**
 * Factory for creating image renderers
 */
export class ImageRendererFactory {
  /**
   * Creates an image renderer for any device type
   * @returns An ImageButtonRenderer instance
   */
  createRenderer(): ImageButtonRenderer {
    return new ImageButtonRenderer();
  }
}
