/**
 * Inline Code Action
 *
 * Action type that executes JavaScript/TypeScript code snippets directly.
 */

import { BaseAction } from "./base_action.ts";
import {
  ActionContext,
  ActionFactory,
  ActionResult,
  ActionStatus,
  FailureResult,
} from "./types.ts";

/**
 * Inline code action configuration
 */
export interface InlineCodeConfig {
  /** The code to execute */
  code: string;

  /** Arguments to pass to the code */
  args?: Record<string, unknown>;

  /** Whether to execute in strict mode */
  strict?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to show the result on the button */
  showResult?: boolean;

  /** Maximum result length to display */
  maxResultLength?: number;

  /** Whether to allow imports */
  allowImports?: boolean;
}

/**
 * Action that executes JavaScript/TypeScript code inline
 */
export class InlineCodeAction extends BaseAction {
  /** Inline code configuration */
  private config: InlineCodeConfig;

  /** Current abort controller for cancellation */
  private abortController?: AbortController;

  /**
   * Creates a new inline code action
   * @param config Configuration for the action
   */
  constructor(config: Record<string, unknown>) {
    super("inline_code");

    // Validate and extract configuration
    if (typeof config.code !== "string" || config.code.trim() === "") {
      throw new Error("Inline code action requires valid code to execute");
    }

    const code = config.code as string;
    const args = typeof config.args === "object" && config.args !== null
      ? config.args as Record<string, unknown>
      : {};
    const strict = typeof config.strict === "boolean" ? config.strict : true;
    const timeout = typeof config.timeout === "number" ? config.timeout : 5000;
    const showResult = typeof config.showResult === "boolean" ? config.showResult : false;
    const maxResultLength = typeof config.maxResultLength === "number"
      ? config.maxResultLength
      : 20;
    const allowImports = typeof config.allowImports === "boolean" ? config.allowImports : false;

    this.config = {
      code,
      args,
      strict,
      timeout,
      showResult,
      maxResultLength,
      allowImports,
    };
  }

  /**
   * Execute the inline code action
   * @param context Action execution context
   * @returns Action result
   */
  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      // Set up abort controller for timeout
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      // Update button state to show we're running
      if (this.config.showResult) {
        this.updateButtonStatus(context, "Executing...");
      }

      // Prepare the code to execute
      let codeToExecute = this.config.code;

      // Add strict mode if requested
      if (this.config.strict) {
        codeToExecute = `"use strict";\n${codeToExecute}`;
      }

      // Create a function from the code
      // The function will take context, args, and signal as parameters
      const functionBody = `
        return (async function executeInlineCode(context, args, signal) {
          // Helper function to check if execution was cancelled
          const checkSignal = () => {
            if (signal.aborted) throw new Error("Execution cancelled");
          };
          
          // Make the abort signal available to check
          const isCancelled = () => signal.aborted;
          
          // Utility to show progress on the button
          const updateButton = (text) => {
            if (${this.config.showResult}) {
              context.buttonState.updateVisual({ text });
            }
          };
          
          // Add periodic signal checks for infinite loops
          const originalSetTimeout = setTimeout;
          const originalSetInterval = setInterval;
          
          // Wrap setTimeout to check signal when timer fires
          globalThis.setTimeout = (fn, delay, ...args) => {
            return originalSetTimeout(() => {
              checkSignal();
              fn(...args);
            }, delay);
          };
          
          // Wrap setInterval to check signal on each interval
          globalThis.setInterval = (fn, delay, ...args) => {
            return originalSetInterval(() => {
              checkSignal();
              fn(...args);
            }, delay);
          };
          
          try {
            checkSignal();
            
            // Imports are only allowed if explicitly enabled
            const dynamicImport = ${this.config.allowImports} ? 
              (m) => import(m) : 
              () => { throw new Error("Imports are not allowed"); };
            
            // Execute the provided code
            ${codeToExecute}
          } catch (error) {
            throw error;
          } finally {
            // Restore original timers
            globalThis.setTimeout = originalSetTimeout;
            globalThis.setInterval = originalSetInterval;
          }
        })(context, args, signal);
      `;

      // Create the function
      // deno-lint-ignore no-explicit-any
      let executeFunction: any;
      try {
        // We use Function constructor for dynamic code execution
        // This has inherent security risks and should only be used with trusted code
        // eslint-disable-next-line no-new-func
        executeFunction = new Function("context", "args", "signal", functionBody);
      } catch (error) {
        throw new Error(
          `Error compiling code: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Execution timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });

      // Execute the function with timeout
      const resultPromise = executeFunction(context, this.config.args, signal);
      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Check if cancelled
      if (signal.aborted) {
        return this.createCancelledResult("Code execution cancelled by user");
      }

      // Format the result for display
      const resultStr = this.formatResult(result);

      // Update button with result
      if (this.config.showResult) {
        this.updateButtonStatus(context, resultStr);

        // Reset after a delay (unless the button is stateful)
        if (!context.buttonState.config.stateful) {
          setTimeout(() => {
            context.buttonState.reset();
          }, 3000);
        }
      }

      return this.createSuccessResult(
        {
          result,
          displayValue: resultStr,
        },
        context,
      );
    } catch (error) {
      // Handle execution errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update button with error info
      if (this.config.showResult) {
        const shortError = errorMessage.length > this.config.maxResultLength!
          ? errorMessage.substring(0, this.config.maxResultLength!) + "..."
          : errorMessage;

        this.updateButtonStatus(context, `Error: ${shortError}`);

        // Reset after a delay
        setTimeout(() => {
          context.buttonState.reset();
        }, 3000);
      }

      const failureResult: FailureResult = {
        status: ActionStatus.FAILURE,
        message: `Code execution failed: ${errorMessage}`,
        error: error instanceof Error ? error : new Error(errorMessage),
        timestamp: Date.now(),
      };
      return failureResult;
    } finally {
      this.abortController = undefined;
    }
  }

  /**
   * Format the result for display on button
   * @param result The raw execution result
   * @returns Formatted string result
   */
  private formatResult(result: unknown): string {
    let resultStr: string;

    // Format the result based on type
    if (result === undefined) {
      resultStr = "undefined";
    } else if (result === null) {
      resultStr = "null";
    } else if (typeof result === "object") {
      try {
        resultStr = JSON.stringify(result);
      } catch {
        resultStr = String(result);
      }
    } else {
      resultStr = String(result);
    }

    // Truncate if too long
    if (this.config.maxResultLength && resultStr.length > this.config.maxResultLength) {
      resultStr = resultStr.substring(0, this.config.maxResultLength) + "...";
    }

    return resultStr;
  }

  /**
   * Update the button visual with current status
   * @param context Action context
   * @param message Status message
   */
  private updateButtonStatus(context: ActionContext, message: string): void {
    if (!this.config.showResult) return;

    context.buttonState.updateVisual({
      text: message,
    });
  }

  /**
   * Cancel the action if it's in progress
   */
  override cancel(): Promise<boolean> {
    if (!this.isExecuting() || !this.abortController) {
      return Promise.resolve(false);
    }

    super.cancel();

    try {
      this.abortController.abort();
      return Promise.resolve(true);
    } catch (e) {
      console.error("Error cancelling code execution:", e);
      return Promise.resolve(false);
    }
  }

  /**
   * Check if the action is cancellable
   */
  override isCancellable(): boolean {
    return this.isExecuting() && this.abortController !== undefined;
  }
}

/**
 * Factory for creating inline code actions
 */
export class InlineCodeActionFactory implements ActionFactory<InlineCodeAction> {
  /**
   * Create a new inline code action
   * @param config Action configuration
   * @returns New inline code action instance
   */
  create(config: Record<string, unknown>): InlineCodeAction {
    return new InlineCodeAction(config);
  }

  /**
   * Get the type identifier for this action factory
   */
  getType(): string {
    return "inline_code";
  }

  /**
   * Validate inline code action configuration
   * @param config Configuration to validate
   * @returns true if valid, false otherwise
   */
  validate(config: Record<string, unknown>): boolean {
    // Code is required and must be a non-empty string
    if (typeof config.code !== "string" || config.code.trim() === "") {
      return false;
    }

    // Args must be an object if present
    if (config.args !== undefined && (typeof config.args !== "object" || config.args === null)) {
      return false;
    }

    // Strict must be a boolean if present
    if (config.strict !== undefined && typeof config.strict !== "boolean") {
      return false;
    }

    // Timeout must be a number if present
    if (config.timeout !== undefined && typeof config.timeout !== "number") {
      return false;
    }

    // ShowResult must be a boolean if present
    if (config.showResult !== undefined && typeof config.showResult !== "boolean") {
      return false;
    }

    // MaxResultLength must be a number if present
    if (config.maxResultLength !== undefined && typeof config.maxResultLength !== "number") {
      return false;
    }

    // AllowImports must be a boolean if present
    if (config.allowImports !== undefined && typeof config.allowImports !== "boolean") {
      return false;
    }

    return true;
  }
}
