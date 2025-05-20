/**
 * HTTP Request Action Tests
 *
 * Tests for the HTTP request action functionality.
 */

import { assertEquals, assertExists } from "@std/assert";
import { assertSpyCalled, spy } from "@std/testing/mock";
import { HttpRequestAction, HttpRequestActionFactory } from "../http_request_action.ts";
import { ActionContext, ActionStatus } from "../types.ts";
import { ButtonState } from "../../state/button_state.ts";

// Define SpyCall interface to replace Deno.SpyCall
interface SpyCall {
  calls: Array<unknown[]>;
}

// Mock ButtonState
function createMockButtonState(): ButtonState {
  // deno-lint-ignore no-explicit-any
  const mock: any = {
    deviceSerial: "test-device",
    buttonIndex: 0,
    config: {
      type: "http_request",
      text: "API Test",
    },
    visual: {
      text: "API Test",
    },
    updateVisual: spy((_visual: Record<string, unknown>) => {}),
    reset: spy(() => {}),
  };
  return mock as ButtonState;
}

// Mock fetch function for testing
const originalFetch = globalThis.fetch;

function setupMockFetch(mockResponse: Response) {
  globalThis.fetch = spy(() => Promise.resolve(mockResponse));
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// Tests
Deno.test({
  name: "HttpRequestAction - constructor validation",
  fn() {
    // Should throw if URL is missing
    try {
      new HttpRequestAction({});
      throw new Error("Should have thrown");
    } catch (e) {
      if (e instanceof Error) {
        assertEquals(e.message, "HTTP request action requires a valid URL");
      } else {
        throw new Error("Expected Error instance");
      }
    }

    // Should not throw with valid config
    const action = new HttpRequestAction({ url: "https://example.com" });
    assertExists(action);
    assertEquals(action.getType(), "http_request");
  },
});

Deno.test({
  name: "HttpRequestAction - factory validation",
  fn() {
    const factory = new HttpRequestActionFactory();
    assertEquals(factory.getType(), "http_request");

    // Valid config
    assertEquals(factory.validate({ url: "https://example.com" }), true);

    // Invalid config
    assertEquals(factory.validate({}), false);
    assertEquals(factory.validate({ url: "" }), false);
    assertEquals(factory.validate({ url: "https://example.com", method: "INVALID" }), false);
    assertEquals(factory.validate({ url: "https://example.com", timeout: "1000" }), false);
  },
});

Deno.test({
  name: "HttpRequestAction - execute GET request",
  async fn() {
    try {
      // Setup mock fetch
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      setupMockFetch(mockResponse);

      // Create action
      const action = new HttpRequestAction({
        url: "https://example.com/api",
        method: "GET",
      });

      // Create context
      const buttonState = createMockButtonState();
      const context: ActionContext = { buttonState };

      // Execute action
      const result = await action.execute(context);

      // Verify fetch was called with correct params
      assertSpyCalled(globalThis.fetch);
      const fetchArgs = (globalThis.fetch as unknown as SpyCall).calls[0];
      assertEquals(fetchArgs[0], "https://example.com/api");
      assertEquals(fetchArgs[1].method, "GET");

      // Verify result
      assertEquals(result.status, ActionStatus.SUCCESS);
      assertExists(result.data);
      assertEquals((result.data as Record<string, unknown>).status, 200);
    } finally {
      restoreFetch();
    }
  },
});

Deno.test({
  name: "HttpRequestAction - execute POST request with body",
  async fn() {
    try {
      // Setup mock fetch
      const mockResponse = new Response(JSON.stringify({ id: 123 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
      setupMockFetch(mockResponse);

      // Create action
      const action = new HttpRequestAction({
        url: "https://example.com/api/create",
        method: "POST",
        body: { name: "Test Item", active: true },
        headers: { "X-Custom-Header": "test-value" },
      });

      // Create context
      const buttonState = createMockButtonState();
      const context: ActionContext = { buttonState };

      // Execute action
      const result = await action.execute(context);

      // Verify fetch was called with correct params
      assertSpyCalled(globalThis.fetch);
      const fetchArgs = (globalThis.fetch as unknown as SpyCall).calls[0];
      assertEquals(fetchArgs[0], "https://example.com/api/create");
      assertEquals(fetchArgs[1].method, "POST");
      assertEquals(fetchArgs[1].headers["Content-Type"], "application/json");
      assertEquals(fetchArgs[1].headers["X-Custom-Header"], "test-value");
      assertEquals(fetchArgs[1].body, JSON.stringify({ name: "Test Item", active: true }));

      // Verify result
      assertEquals(result.status, ActionStatus.SUCCESS);
      assertExists(result.data);
    } finally {
      restoreFetch();
    }
  },
});

Deno.test({
  name: "HttpRequestAction - show response on button",
  async fn() {
    try {
      // Setup mock fetch
      const mockResponse = new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
      });
      setupMockFetch(mockResponse);

      // Create action
      const action = new HttpRequestAction({
        url: "https://example.com/status",
        showResponse: true,
        maxResponseLength: 10,
        extractPath: "status",
      });

      // Create context
      const buttonState = createMockButtonState();
      const context: ActionContext = { buttonState };

      // Execute action
      await action.execute(context);

      // Verify button state was updated
      assertSpyCalled(buttonState.updateVisual);

      // First updateVisual should set "Loading..."
      assertEquals(
        (buttonState.updateVisual as unknown as SpyCall).calls[0][0].text,
        "Loading...",
      );

      // Second updateVisual should set the extracted result
      assertEquals(
        (buttonState.updateVisual as unknown as SpyCall).calls[1][0].text,
        "OK",
      );
    } finally {
      restoreFetch();
    }
  },
});

Deno.test({
  name: "HttpRequestAction - handle error",
  async fn() {
    try {
      // Setup mock fetch to throw
      globalThis.fetch = () => Promise.reject(new Error("Network error"));

      // Create action
      const action = new HttpRequestAction({
        url: "https://example.com/error",
        showResponse: true,
      });

      // Create context
      const buttonState = createMockButtonState();
      const context: ActionContext = { buttonState };

      // Execute action
      const result = await action.execute(context);

      // Verify result is failure
      assertEquals(result.status, ActionStatus.FAILURE);

      // Use typeof check since we don't have the exact FailureResult type imported
      if (typeof result === "object" && result !== null && "error" in result) {
        const error = result.error as Error;
        assertEquals(error.message, "Network error");
      }

      // Verify button state was updated with error
      assertSpyCalled(buttonState.updateVisual);
      const updateCall = (buttonState.updateVisual as unknown as SpyCall).calls[1][0];
      assertEquals(
        typeof updateCall.text === "string" && updateCall.text.startsWith("Error:"),
        true,
      );
    } finally {
      restoreFetch();
    }
  },
});
