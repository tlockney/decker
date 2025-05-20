/**
 * Page Switch Action Tests
 *
 * Tests for the page switch action functionality.
 */

import { assertEquals, assertExists } from "@std/assert";
import { assertSpyCalled, spy } from "@std/testing/mock";
import { PageSwitchAction, PageSwitchActionFactory } from "../page_switch_action.ts";
import { ActionContext, ActionStatus } from "../types.ts";
import { ButtonState } from "../../state/button_state.ts";
import { StateManager } from "../../state/state_manager.ts";
import { DeckerConfig } from "../../config/schema.ts";

// Define SpyCall interface to replace Deno.SpyCall
interface SpyCall {
  calls: Array<unknown[]>;
}

// Create a mock StateManager
function createMockStateManager(): StateManager {
  // Simple mock config with two pages
  const config: DeckerConfig = {
    version: "1.0.0",
    global_settings: {},
    devices: {
      "test-device": {
        name: "Test Device",
        default_page: "main",
        pages: {
          "main": {
            buttons: {
              "0": { type: "page_switch", text: "Page 2", pageId: "page2" },
            },
          },
          "page2": {
            buttons: {
              "0": { type: "page_switch", text: "Main", pageId: "main" },
            },
          },
        },
      },
    },
  };

  // deno-lint-ignore no-explicit-any
  const mockStateManager: any = {
    getActivePage: spy((deviceSerial: string) =>
      deviceSerial === "test-device" ? "main" : undefined
    ),
    hasPage: spy((deviceSerial: string, pageId: string) => {
      return deviceSerial === "test-device" && (pageId === "main" || pageId === "page2");
    }),
    activatePage: spy((_deviceSerial: string, _pageId: string, _options?: unknown) => {
      return Promise.resolve();
    }),
    config,
  };

  return mockStateManager as unknown as StateManager;
}

// Create a mock ButtonState
function createMockButtonState(): ButtonState {
  // deno-lint-ignore no-explicit-any
  const mock: any = {
    deviceSerial: "test-device",
    buttonIndex: 0,
    config: {
      type: "page_switch",
      text: "Next Page",
      pageId: "page2",
    },
    visual: {
      text: "Next Page",
    },
    updateVisual: spy((_visual: Record<string, unknown>) => {}),
    reset: spy(() => {}),
  };
  return mock as ButtonState;
}

// Tests
Deno.test({
  name: "PageSwitchAction - constructor validation",
  fn() {
    const stateManager = createMockStateManager();

    // Should throw if pageId is missing
    try {
      new PageSwitchAction({}, stateManager);
      throw new Error("Should have thrown");
    } catch (e) {
      if (e instanceof Error) {
        assertEquals(e.message, "Page switch action requires a valid page ID");
      } else {
        throw new Error("Expected Error instance");
      }
    }

    // Should not throw with valid config
    const action = new PageSwitchAction({ pageId: "page2" }, stateManager);
    assertExists(action);
    assertEquals(action.getType(), "page_switch");
  },
});

Deno.test({
  name: "PageSwitchAction - factory validation",
  fn() {
    const stateManager = createMockStateManager();
    const factory = new PageSwitchActionFactory(stateManager);
    assertEquals(factory.getType(), "page_switch");

    // Valid config
    assertEquals(factory.validate({ pageId: "page2" }), true);

    // Invalid config
    assertEquals(factory.validate({}), false);
    assertEquals(factory.validate({ pageId: "" }), false);
    assertEquals(factory.validate({ pageId: "page2", animate: "yes" }), false);
  },
});

Deno.test({
  name: "PageSwitchAction - execute switch",
  async fn() {
    const stateManager = createMockStateManager();

    // Create action
    const action = new PageSwitchAction({
      pageId: "page2",
      showIndicator: true,
      animate: true,
      pushToStack: true,
    }, stateManager);

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    const result = await action.execute(context);

    // Verify state manager was called
    assertSpyCalled(stateManager.getActivePage);
    assertSpyCalled(stateManager.hasPage);
    assertSpyCalled(stateManager.activatePage);

    // Verify the right parameters were used for activation
    const activateCall = (stateManager.activatePage as unknown as {
      calls: Array<[string, string, Record<string, boolean>]>;
    }).calls[0];
    assertEquals(activateCall[0], "test-device"); // Device serial
    assertEquals(activateCall[1], "page2"); // Target page
    assertEquals(activateCall[2].animate, true); // Options: animate
    assertEquals(activateCall[2].pushToStack, true); // Options: pushToStack

    // Verify visual indicator was shown
    assertSpyCalled(buttonState.updateVisual);
    const updateCall = (buttonState.updateVisual as unknown as SpyCall)
      .calls[0][0] as Record<string, unknown>;
    assertEquals(typeof updateCall.text, "string");
    assertEquals(typeof updateCall.text === "string" && updateCall.text.includes("page2"), true);

    // Verify result
    assertEquals(result.status, ActionStatus.SUCCESS);
    assertExists(result.data);
    assertEquals((result.data as Record<string, unknown>).fromPage, "main");
    assertEquals((result.data as Record<string, unknown>).toPage, "page2");
  },
});

Deno.test({
  name: "PageSwitchAction - handle invalid page",
  async fn() {
    const stateManager = createMockStateManager();

    // Create action with a non-existent page
    const action = new PageSwitchAction({
      pageId: "non-existent-page",
    }, stateManager);

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    const result = await action.execute(context);

    // Verify state manager checks were called
    assertSpyCalled(stateManager.hasPage);

    // Verify result is failure
    assertEquals(result.status, ActionStatus.FAILURE);

    // Use typeof check since we don't have the exact FailureResult type imported
    if (typeof result === "object" && result !== null && "message" in result) {
      assertEquals(
        (result.message as string).includes("does not exist"),
        true,
      );
    }
  },
});

Deno.test({
  name: "PageSwitchAction - use context device serial",
  async fn() {
    const stateManager = createMockStateManager();

    // Create action without specifying device serial
    const action = new PageSwitchAction({
      pageId: "page2",
    }, stateManager);

    // Create context
    const buttonState = createMockButtonState();
    // We're using a mock, so we don't need to modify deviceSerial since it's already set to "test-device"
    const context: ActionContext = { buttonState };

    // Execute action
    await action.execute(context);

    // Verify the context device serial was used
    const activateCall = (stateManager.activatePage as unknown as {
      calls: Array<[string, string, Record<string, boolean>]>;
    }).calls[0];
    assertEquals(activateCall[0], "test-device");
  },
});
