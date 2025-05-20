/**
 * Inline Code Action Tests
 *
 * Tests for the inline code action functionality.
 */

import { assertEquals, assertExists } from "@std/assert";
import { assertSpyCall, assertSpyCalls, spy } from "jsr:@std/testing@0.220.1/mock";
import { InlineCodeAction, InlineCodeActionFactory } from "../inline_code_action.ts";
import { ActionContext, ActionStatus } from "../types.ts";
import { ButtonState } from "../../state/button_state.ts";

// Mock ButtonState
function createMockButtonState(): ButtonState {
  const updateVisualSpy = spy((_visual: Record<string, unknown>) => {});
  const resetSpy = spy(() => {});

  // deno-lint-ignore no-explicit-any
  const mock: any = {
    deviceSerial: "test-device",
    buttonIndex: 0,
    config: {
      type: "inline_code",
      text: "Code",
    },
    visual: {
      text: "Code",
    },
    updateVisual: updateVisualSpy,
    reset: resetSpy,
  };
  return mock as ButtonState;
}

// Tests
Deno.test.only({
  name: "InlineCodeAction - constructor validation",
  fn() {
    // Should throw if code is missing
    try {
      new InlineCodeAction({});
      throw new Error("Should have thrown");
    } catch (e) {
      if (e instanceof Error) {
        assertEquals(e.message, "Inline code action requires valid code to execute");
      } else {
        throw new Error("Expected Error instance");
      }
    }

    // Should not throw with valid config
    const action = new InlineCodeAction({ code: "return 42;" });
    assertExists(action);
    assertEquals(action.getType(), "inline_code");
  },
});

Deno.test.only({
  name: "InlineCodeAction - factory validation",
  fn() {
    const factory = new InlineCodeActionFactory();
    assertEquals(factory.getType(), "inline_code");

    // Valid config
    assertEquals(factory.validate({ code: "return 42;" }), true);

    // Invalid config
    assertEquals(factory.validate({}), false);
    assertEquals(factory.validate({ code: "" }), false);
    assertEquals(factory.validate({ code: "return 42;", strict: "yes" }), false);
    assertEquals(factory.validate({ code: "return 42;", timeout: "1000" }), false);
  },
});

Deno.test({
  name: "InlineCodeAction - execute simple code",
  async fn() {
    // Create action with simple arithmetic
    const action = new InlineCodeAction({
      code: "return 2 + 2;",
    });

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    const result = await action.execute(context);

    // Verify result
    assertEquals(result.status, ActionStatus.SUCCESS);
    assertExists(result.data);
    assertEquals((result.data as Record<string, unknown>).result, 4);
  },
});

Deno.test({
  name: "InlineCodeAction - execute with arguments",
  async fn() {
    // Create action with code that uses arguments
    const action = new InlineCodeAction({
      code: "return args.a + args.b;",
      args: { a: 5, b: 7 },
    });

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    const result = await action.execute(context);

    // Verify result
    assertEquals(result.status, ActionStatus.SUCCESS);
    assertExists(result.data);
    assertEquals((result.data as Record<string, unknown>).result, 12);
  },
});

Deno.test({
  name: "InlineCodeAction - execute with button interaction",
  async fn() {
    // Create action that interacts with button state
    const action = new InlineCodeAction({
      code: `
        context.buttonState.customState = "active";
        return "Activated";
      `,
      showResult: true,
    });

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    const result = await action.execute(context);

    // Verify button state was updated
    assertSpyCalls(buttonState.updateVisual, 2);

    // First updateVisual should set "Executing..."
    const firstUpdate = assertSpyCall(buttonState.updateVisual, 0).args[0] as Record<
      string,
      unknown
    >;
    assertEquals(firstUpdate.text, "Executing...");

    // Second updateVisual should set the result
    const secondUpdate = assertSpyCall(buttonState.updateVisual, 1).args[0] as Record<
      string,
      unknown
    >;
    assertEquals(secondUpdate.text, "Activated");

    // Verify result
    assertEquals(result.status, ActionStatus.SUCCESS);
    assertEquals((result.data as Record<string, unknown>).result, "Activated");
  },
});

Deno.test({
  name: "InlineCodeAction - handle syntax error",
  async fn() {
    // Create action with invalid code
    const action = new InlineCodeAction({
      code: "this is not valid javascript",
      showResult: true,
    });

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    const result = await action.execute(context);

    // Verify result is failure
    assertEquals(result.status, ActionStatus.FAILURE);

    // Use typeof check since we don't have the exact FailureResult type imported
    if (typeof result === "object" && result !== null && "message" in result) {
      assertEquals(
        (result.message as string).includes("failed"),
        true,
      );
    }

    // Verify error was shown on button
    assertSpyCalls(buttonState.updateVisual, 2);
    const updateCall = assertSpyCall(buttonState.updateVisual, 1).args[0] as Record<
      string,
      unknown
    >;
    assertEquals(
      typeof updateCall.text === "string" && (updateCall.text as string).startsWith("Error:"),
      true,
    );
  },
});

Deno.test({
  name: "InlineCodeAction - handle runtime error",
  async fn() {
    // Create action with code that throws at runtime
    const action = new InlineCodeAction({
      code: "throw new Error('Test error');",
      showResult: true,
    });

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    const result = await action.execute(context);

    // Verify result is failure
    assertEquals(result.status, ActionStatus.FAILURE);

    // Use typeof check since we don't have the exact FailureResult type imported
    if (typeof result === "object" && result !== null && "message" in result) {
      assertEquals(
        (result.message as string).includes("Test error"),
        true,
      );
    }
  },
});

Deno.test({
  name: "InlineCodeAction - result truncation",
  async fn() {
    // Create action with code that returns long result
    const action = new InlineCodeAction({
      code: "return 'This is a very long result that should be truncated';",
      showResult: true,
      maxResultLength: 10,
    });

    // Create context
    const buttonState = createMockButtonState();
    const context: ActionContext = { buttonState };

    // Execute action
    await action.execute(context);

    // Verify button text was truncated
    assertSpyCalls(buttonState.updateVisual, 2);
    const updateCall = assertSpyCall(buttonState.updateVisual, 1).args[0] as Record<
      string,
      unknown
    >;
    assertEquals(updateCall.text, "This is a ...");
  },
});

Deno.test.only({
  name: "InlineCodeAction - cancellation",
  fn() {
    // Create action
    const action = new InlineCodeAction({
      code: "return 42;",
    });

    // Check initial state
    assertEquals(action.isExecuting(), false);
    assertEquals(action.isCancellable(), false);
  },
});
