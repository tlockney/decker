/**
 * Execute Script Action
 *
 * Action type that executes scripts or shell commands.
 */

import { BaseAction } from "./base_action.ts";
import { ActionContext, ActionFactory, ActionResult, ActionStatus } from "./types.ts";

/**
 * Execute script action configuration
 */
export interface ExecuteScriptConfig {
  /** The command to execute */
  command: string;

  /** Optional arguments to pass to the command */
  args?: string[];

  /** Optional environment variables for the command */
  env?: Record<string, string>;

  /** Working directory for command execution */
  cwd?: string;

  /** Timeout in milliseconds after which the command is terminated */
  timeout?: number;

  /** Whether to show the command window (platform dependent) */
  show?: boolean;

  /** Whether to update the button with command output */
  showOutput?: boolean;

  /** Maximum output length to display */
  maxOutputLength?: number;
}

/**
 * Action that executes shell commands or scripts
 */
export class ExecuteScriptAction extends BaseAction {
  /** Script execution configuration */
  private config: ExecuteScriptConfig;

  /** Process handle for cancellation */
  private process?: Deno.ChildProcess;

  /** Current command output */
  private output = "";

  /**
   * Get the current output of the command
   * @returns Current command output
   */
  getOutput(): string {
    return this.output;
  }

  /** Abort controller for timing out */
  private abortController = new AbortController();

  /**
   * Creates a new execute script action
   * @param config Configuration for the action
   */
  constructor(config: Record<string, unknown>) {
    super("execute_script");

    // Validate and extract configuration
    if (typeof config.command !== "string" || config.command.trim() === "") {
      throw new Error("Execute script action requires a valid command");
    }

    const args = Array.isArray(config.args) ? config.args : [];
    const env = typeof config.env === "object" && config.env !== null ? config.env : {};
    const cwd = typeof config.cwd === "string" ? config.cwd : Deno.cwd();
    const timeout = typeof config.timeout === "number" ? config.timeout : 30000;
    const show = typeof config.show === "boolean" ? config.show : true;
    const showOutput = typeof config.showOutput === "boolean" ? config.showOutput : false;
    const maxOutputLength = typeof config.maxOutputLength === "number"
      ? config.maxOutputLength
      : 100;

    this.config = {
      command: config.command as string,
      args: args.map((arg) => String(arg)),
      env: env as Record<string, string>,
      cwd,
      timeout,
      show,
      showOutput,
      maxOutputLength,
    };
  }

  /**
   * Execute the script action
   * @param context Action execution context
   * @returns Action result
   */
  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      // Reset abort controller
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      // Prepare execution environment
      const options: Deno.CommandOptions = {
        args: this.config.args,
        env: { ...Deno.env.toObject(), ...this.config.env },
        cwd: this.config.cwd,
        stdout: "piped",
        stderr: "piped",
        signal,
      };

      // Platform-specific options for showing/hiding the command window
      if (!this.config.show && Deno.build.os === "windows") {
        // Note: Deno Command API might not support hiding windows directly
        // For Windows, we could use 'cmd.exe /c start /min' as a workaround
        console.warn("Window hiding not supported directly in Deno");
      }

      // Update button state to show we're running
      if (this.config.showOutput) {
        this.updateButtonStatus(context, "Running...");
      }

      // Execute the command
      const command = new Deno.Command(this.config.command, options);
      const process = command.spawn();
      this.process = process;

      // Set up timeout if configured
      let timeoutId: number | undefined;
      if (this.config.timeout !== undefined && this.config.timeout > 0) {
        timeoutId = setTimeout(() => {
          this.abortController.abort();
        }, this.config.timeout);
      }

      // Collect output if needed
      let output = "";
      if (this.config.showOutput) {
        const textDecoder = new TextDecoder();

        // Read stdout
        (async () => {
          try {
            const reader = process.stdout.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = textDecoder.decode(value);
              output += text;

              // Truncate if too long
              if (output.length > this.config.maxOutputLength!) {
                output = output.substring(0, this.config.maxOutputLength!) + "...";
              }

              this.updateButtonStatus(context, output);
            }
          } catch (e) {
            // Ignore read errors during cancellation
            if (!signal.aborted) {
              console.error("Error reading stdout:", e);
            }
          }
        })();

        // Read stderr
        (async () => {
          try {
            const reader = process.stderr.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = textDecoder.decode(value);
              output += text;

              // Truncate if too long
              if (output.length > this.config.maxOutputLength!) {
                output = output.substring(0, this.config.maxOutputLength!) + "...";
              }

              this.updateButtonStatus(context, output);
            }
          } catch (e) {
            // Ignore read errors during cancellation
            if (!signal.aborted) {
              console.error("Error reading stderr:", e);
            }
          }
        })();
      }

      // Wait for process completion
      const status = await process.status;

      // Clear timeout if set
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // Check cancellation
      if (this.isCancelled()) {
        return this.createCancelledResult("Script execution cancelled by user");
      }

      // Return result based on exit status
      if (status.success) {
        // Update button with success message
        if (this.config.showOutput) {
          this.updateButtonStatus(context, `Success (${status.code})`);

          // Reset after a short delay
          setTimeout(() => {
            context.buttonState.reset();
          }, 2000);
        }

        return this.createSuccessResult(
          {
            command: this.config.command,
            exitCode: status.code,
            signal: status.signal,
            output: output || undefined,
          },
          context,
        );
      } else {
        // Update button with failure message
        if (this.config.showOutput) {
          this.updateButtonStatus(context, `Failed (${status.code})`);

          // Reset after a delay
          setTimeout(() => {
            context.buttonState.reset();
          }, 2000);
        }

        return {
          status: ActionStatus.FAILURE,
          message: `Script exited with code ${status.code}${
            status.signal ? ` (signal: ${status.signal})` : ""
          }`,
          data: {
            command: this.config.command,
            exitCode: status.code,
            signal: status.signal,
            output: output || undefined,
          },
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      // Update button with error message
      if (this.config.showOutput) {
        this.updateButtonStatus(
          context,
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Reset after a delay
        setTimeout(() => {
          context.buttonState.reset();
        }, 2000);
      }

      return this.createFailureResult(
        error instanceof Error ? error : new Error(String(error)),
        context,
      );
    } finally {
      this.process = undefined;
      this.output = "";
    }
  }

  /**
   * Update the button visual with current status
   * @param context Action context
   * @param message Status message
   */
  private updateButtonStatus(context: ActionContext, message: string): void {
    if (!this.config.showOutput) return;

    this.output = message;
    const truncatedMessage = message.length > this.config.maxOutputLength!
      ? message.substring(0, this.config.maxOutputLength!) + "..."
      : message;

    context.buttonState.updateVisual({
      text: truncatedMessage,
    });
  }

  /**
   * Cancel the action if it's in progress
   */
  override cancel(): Promise<boolean> {
    if (!this.isExecuting() || !this.process) {
      return Promise.resolve(false);
    }

    super.cancel();

    try {
      // Signal abort and try to kill the process
      this.abortController.abort();
      this.process.kill("SIGTERM");
      return Promise.resolve(true);
    } catch (e) {
      console.error("Error killing process:", e);
      return Promise.resolve(false);
    }
  }

  /**
   * Check if the action is cancellable
   */
  override isCancellable(): boolean {
    return this.isExecuting() && this.process !== undefined;
  }
}

/**
 * Factory for creating execute script actions
 */
export class ExecuteScriptActionFactory implements ActionFactory<ExecuteScriptAction> {
  /**
   * Create a new execute script action
   * @param config Action configuration
   * @returns New execute script action instance
   */
  create(config: Record<string, unknown>): ExecuteScriptAction {
    return new ExecuteScriptAction(config);
  }

  /**
   * Get the type identifier for this action factory
   */
  getType(): string {
    return "execute_script";
  }

  /**
   * Validate execute script action configuration
   * @param config Configuration to validate
   * @returns true if valid, false otherwise
   */
  validate(config: Record<string, unknown>): boolean {
    // Command is required and must be a non-empty string
    if (typeof config.command !== "string" || config.command.trim() === "") {
      return false;
    }

    // Args must be an array if present
    if (config.args !== undefined && !Array.isArray(config.args)) {
      return false;
    }

    // Env must be an object if present
    if (config.env !== undefined && (typeof config.env !== "object" || config.env === null)) {
      return false;
    }

    // Cwd must be a string if present
    if (config.cwd !== undefined && typeof config.cwd !== "string") {
      return false;
    }

    // Timeout must be a number if present
    if (config.timeout !== undefined && typeof config.timeout !== "number") {
      return false;
    }

    // Show must be a boolean if present
    if (config.show !== undefined && typeof config.show !== "boolean") {
      return false;
    }

    // ShowOutput must be a boolean if present
    if (config.showOutput !== undefined && typeof config.showOutput !== "boolean") {
      return false;
    }

    // MaxOutputLength must be a number if present
    if (config.maxOutputLength !== undefined && typeof config.maxOutputLength !== "number") {
      return false;
    }

    return true;
  }
}
