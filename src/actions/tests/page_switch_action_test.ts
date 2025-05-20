/**
 * Page Switch Action Tests
 *
 * Tests for the page switch action functionality.
 */

import { assertEquals, assertExists } from "@std/assert";
import { assertSpyCall, assertSpyCalls, spy } from "jsr:@std/testing@0.220.1/mock";
import { PageSwitchAction, PageSwitchActionFactory } from "../page_switch_action.ts";
import { ActionContext, ActionStatus } from "../types.ts";
import { ButtonState } from "../../state/button_state.ts";
import { StateManager } from "../../state/state_manager.ts";
import { DeckerConfig } from "../../config/schema.ts";

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

  const getActivePageSpy = spy((deviceSerial: string) =>
    deviceSerial === "test-device" ? "main" : undefined
  );

  const hasPageSpy = spy((deviceSerial: string, pageId: string) => {
    return deviceSerial === "test-device" && (pageId === "main" || pageId === "page2");
  });

  const activatePageSpy = spy((_deviceSerial: string, _pageId: string, _options?: unknown) => {
    return Promise.resolve(true);
  });

  // deno-lint-ignore no-explicit-any
  const mockStateManager: any = {
    getActivePage: getActivePageSpy,
    hasPage: hasPageSpy,
    activatePage: activatePageSpy,
    config,
  };

  return mockStateManager as unknown as StateManager;
}

// Create a mock ButtonState
function createMockButtonState(): ButtonState {
  const updateVisualSpy = spy((_visual: Record<string, unknown>) => {});
  const resetSpy = spy(() => {});

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
    updateVisual: updateVisualSpy,
    reset: resetSpy,
  };
  return mock as ButtonState;
}

// Tests
Deno.test.only({
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

Deno.test.only({
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
    assertSpyCalls(stateManager.getActivePage, 1);
    assertSpyCalls(stateManager.hasPage, 1);
    assertSpyCalls(stateManager.activatePage, 1);

    // Verify the right parameters were used for activation
    const activateArgs = assertSpyCall(stateManager.activatePage, 0).args;
    assertEquals(activateArgs[0], "test-device"); // Device serial
    assertEquals(activateArgs[1], "page2"); // Target page

    const options = activateArgs[2] as Record<string, boolean>;
    assertEquals(options.animate, true); // Options: animate
    assertEquals(options.pushToStack, true); // Options: pushToStack

    // Verify visual indicator was shown
    assertSpyCalls(buttonState.updateVisual, 1);
    const updateCall = assertSpyCall(buttonState.updateVisual, 0).args[0] as Record<
      string,
      unknown
    >;
    assertEquals(typeof updateCall.text, "string");
    assertEquals((updateCall.text as string).includes("page2"), true);

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
    assertSpyCalls(stateManager.hasPage, 1);

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
    const activateArgs = assertSpyCall(stateManager.activatePage, 0).args;
    assertEquals(activateArgs[0], "test-device");
  },
});
