/**
 * HTTP Request Action Tests
 *
 * Tests for the HTTP request action functionality.
 */

import { assertEquals, assertExists } from "@std/assert";
import { assertSpyCall, assertSpyCalls, spy } from "jsr:@std/testing@0.220.1/mock";
import { HttpRequestAction, HttpRequestActionFactory } from "../http_request_action.ts";
import { ActionContext, ActionStatus } from "../types.ts";
import { ButtonState } from "../../state/button_state.ts";

// Define SpyCall interface for our test helpers
interface SpyCallArg {
  [key: string]: unknown;
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
let fetchSpy: ReturnType<typeof spy>;

function setupMockFetch(mockResponse: Response) {
  fetchSpy = spy(() => Promise.resolve(mockResponse));
  globalThis.fetch = fetchSpy;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// Helper function to safely access properties in spy call arguments
function getSpyCallArg(
  spyObj: ReturnType<typeof spy>,
  callIndex: number,
  argIndex: number,
): SpyCallArg {
  return assertSpyCall(spyObj, callIndex).args[argIndex] as SpyCallArg;
}

// Tests
Deno.test.only({
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

Deno.test.only({
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
      assertSpyCalls(fetchSpy, 1);

      const url = assertSpyCall(fetchSpy, 0).args[0];
      assertEquals(url, "https://example.com/api");

      const options = getSpyCallArg(fetchSpy, 0, 1);
      assertEquals(options.method, "GET");

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
      assertSpyCalls(fetchSpy, 1);

      const url = assertSpyCall(fetchSpy, 0).args[0];
      assertEquals(url, "https://example.com/api/create");

      const options = getSpyCallArg(fetchSpy, 0, 1);
      assertEquals(options.method, "POST");

      const headers = options.headers as Record<string, string>;
      assertEquals(headers["Content-Type"], "application/json");
      assertEquals(headers["X-Custom-Header"], "test-value");

      assertEquals(options.body, JSON.stringify({ name: "Test Item", active: true }));

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
      assertSpyCalls(buttonState.updateVisual, 2);

      // First updateVisual should set "Loading..."
      const firstUpdate = getSpyCallArg(buttonState.updateVisual, 0, 0);
      assertEquals(firstUpdate.text, "Loading...");

      // Second updateVisual should set the extracted result
      const secondUpdate = getSpyCallArg(buttonState.updateVisual, 1, 0);
      assertEquals(secondUpdate.text, "OK");
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
      assertSpyCalls(buttonState.updateVisual, 2);

      const updateCall = getSpyCallArg(buttonState.updateVisual, 1, 0);
      const text = updateCall.text as string;
      assertEquals(text.startsWith("Error:"), true);
    } finally {
      restoreFetch();
    }
  },
});
