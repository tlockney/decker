/**
 * Base Button Renderer Implementation
 *
 * Provides the foundation for rendering content to Stream Deck buttons.
 */

import { Buffer } from "node:buffer";
import { ButtonRenderer, ButtonVisualProps, RenderOptions, RGB } from "./renderer.ts";

/**
 * Cache entry for rendered button images
 */
interface CacheEntry {
  /** The rendered image buffer */
  buffer: Buffer;
  /** Timestamp when this entry was cached */
  timestamp: number;
  /** Hash of the properties used to render this image */
  hash: string;
}

/**
 * Abstract base class for button renderers
 */
export abstract class BaseButtonRenderer implements ButtonRenderer {
  /** Cache of rendered button images */
  protected cache: Map<string, CacheEntry> = new Map();
  /** Maximum cache size (number of entries) */
  protected maxCacheSize = 100;
  /** Cache expiration time in milliseconds (default: 5 minutes) */
  protected cacheExpirationMs = 5 * 60 * 1000;
  /** Default font size */
  protected defaultFontSize = 14;
  /** Default text color */
  protected defaultTextColor: RGB = { r: 255, g: 255, b: 255 };
  /** Default background color */
  protected defaultBackgroundColor: RGB = { r: 0, g: 0, b: 0 };

  /** Interval ID for cache cleanup */
  private cleanupIntervalId?: number;

  /**
   * Creates a new BaseButtonRenderer
   */
  constructor() {
    // Schedule periodic cache cleanup
    this.cleanupIntervalId = setInterval(() => this.cleanupCache(), this.cacheExpirationMs);
  }

  /**
   * Dispose of resources used by the renderer
   */
  dispose(): void {
    // Clear the cleanup interval
    if (this.cleanupIntervalId !== undefined) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
  }

  /**
   * Renders a button with the given properties
   * @param props The visual properties to render
   * @param options Rendering options
   * @returns A Buffer containing the rendered image data
   */
  async render(props: ButtonVisualProps, options: RenderOptions): Promise<Buffer> {
    // Use caching if enabled
    if (options.cache !== false) {
      const hash = this.computePropsHash(props, options);
      const cached = this.cache.get(hash);

      if (cached && (Date.now() - cached.timestamp) < this.cacheExpirationMs) {
        return cached.buffer;
      }

      const rendered = await this.renderInternal(props, options);

      // Store in cache
      this.cache.set(hash, {
        buffer: rendered,
        timestamp: Date.now(),
        hash,
      });

      // Ensure cache doesn't grow too large
      if (this.cache.size > this.maxCacheSize) {
        this.cleanupCache();
      }

      return rendered;
    }

    // Render without caching
    return this.renderInternal(props, options);
  }

  /**
   * Clears the renderer cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Internal render method that must be implemented by subclasses
   * @param props The visual properties to render
   * @param options Rendering options
   * @returns A Buffer containing the rendered image data
   */
  protected abstract renderInternal(
    props: ButtonVisualProps,
    options: RenderOptions,
  ): Promise<Buffer>;

  /**
   * Computes a hash string for the given properties and options
   * @param props The visual properties
   * @param options The rendering options
   * @returns A string hash representation
   */
  protected computePropsHash(props: ButtonVisualProps, options: RenderOptions): string {
    // Simple JSON-based hashing - this could be optimized in the future
    const hashObj = {
      text: props.text || "",
      imagePath: props.imagePath || "",
      imageBufferHash: props.imageBuffer ? this.hashBuffer(props.imageBuffer) : "",
      backgroundColor: props.backgroundColor || this.defaultBackgroundColor,
      textColor: props.textColor || this.defaultTextColor,
      fontSize: props.fontSize || this.defaultFontSize,
      textAlign: props.textAlign || "center",
      textVerticalAlign: props.textVerticalAlign || "middle",
      textPadding: props.textPadding || 0,
      width: options.width,
      height: options.height,
    };

    return JSON.stringify(hashObj);
  }

  /**
   * Creates a simple hash of a buffer
   * @param buffer The buffer to hash
   * @returns A string hash
   */
  protected hashBuffer(buffer: Buffer): string {
    // Simple hash function for buffers
    // For production, consider using a proper hashing algorithm
    let hash = 0;
    const step = Math.max(1, Math.floor(buffer.length / 100)); // Sample at most 100 bytes

    for (let i = 0; i < buffer.length; i += step) {
      hash = ((hash << 5) - hash) + buffer[i];
      hash |= 0; // Convert to 32-bit integer
    }

    return hash.toString(16);
  }

  /**
   * Removes expired and least recently used entries from the cache
   */
  protected cleanupCache(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheExpirationMs) {
        this.cache.delete(hash);
      }
    }

    // If still too many entries, remove oldest
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest entries until we're under the limit
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
      for (const [hash] of toRemove) {
        this.cache.delete(hash);
      }
    }
  }
}
