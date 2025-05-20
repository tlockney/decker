/**
 * Tests for the button rendering system
 */

import { assertEquals, assertExists } from "@std/assert";
import { BasicButtonRenderer, ButtonVisualProps, RenderOptions, RGB } from "../mod.ts";
import { Buffer } from "node:buffer";

/**
 * Helper function to create RGB color
 */
function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

Deno.test("BasicButtonRenderer - simple render", async () => {
  const renderer = new BasicButtonRenderer();

  try {
    const props: ButtonVisualProps = {
      backgroundColor: rgb(255, 0, 0), // Red
      text: "Test",
      textColor: rgb(255, 255, 255), // White
    };

    const options: RenderOptions = {
      width: 72,
      height: 72,
      cache: false,
    };

    const result = await renderer.render(props, options);

    // Result should be a buffer
    assertExists(result);
    assertEquals(result instanceof Buffer, true);

    // Should have some data
    assertEquals(result.length > 0, true);
  } finally {
    // Clean up resources
    renderer.dispose();
  }
});

Deno.test("BasicButtonRenderer - caching", async () => {
  const renderer = new BasicButtonRenderer();

  try {
    const props: ButtonVisualProps = {
      backgroundColor: rgb(0, 0, 255), // Blue
      text: "Cache Test",
    };

    const options: RenderOptions = {
      width: 72,
      height: 72,
      cache: true,
    };

    // First render should cache the result
    const result1 = await renderer.render(props, options);

    // Second render with same props should return cached result
    const result2 = await renderer.render(props, options);

    // Both results should be identical buffers
    assertEquals(result1.length, result2.length);

    // Clear cache
    renderer.clearCache();

    // Render again - should generate new buffer
    const result3 = await renderer.render(props, options);

    // Should still have same length
    assertEquals(result1.length, result3.length);
  } finally {
    // Clean up resources
    renderer.dispose();
  }
});

Deno.test("BasicButtonRenderer - different properties", async () => {
  const renderer = new BasicButtonRenderer();

  try {
    const options: RenderOptions = {
      width: 72,
      height: 72,
      cache: false,
    };

    // Render with different properties
    const result1 = await renderer.render(
      { backgroundColor: rgb(255, 0, 0), text: "Red" },
      options,
    );

    const result2 = await renderer.render(
      { backgroundColor: rgb(0, 255, 0), text: "Green" },
      options,
    );

    // Results should be different
    assertEquals(result1.equals(result2), false);
  } finally {
    // Clean up resources
    renderer.dispose();
  }
});

// Add more tests as needed...
