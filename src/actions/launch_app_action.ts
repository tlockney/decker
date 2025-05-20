/**
 * Launch App Action
 *
 * Action type that launches external applications.
 */

import { BaseAction } from "./base_action.ts";
import { ActionContext, ActionFactory, ActionResult, ActionStatus } from "./types.ts";

/**
 * Launch app action configuration
 */
export interface LaunchAppConfig {
  /** Path to the application or executable */
  path: string;

  /** Optional arguments to pass to the application */
  args?: string[];

  /** Optional environment variables to pass to the application */
  env?: Record<string, string>;

  /** Whether to wait for the application to exit before completing the action */
  wait?: boolean;

  /** Whether to show the application window (platform dependent) */
  show?: boolean;
}

/**
 * Action that launches an external application
 */
export class LaunchAppAction extends BaseAction {
  /** Application configuration */
  private config: LaunchAppConfig;

  /** Process handle for cancellation */
  private process?: Deno.ChildProcess;

  /**
   * Creates a new launch app action
   * @param config Configuration for the action
   */
  constructor(config: Record<string, unknown>) {
    super("launch_app");

    // Validate and extract configuration
    if (typeof config.path !== "string" || config.path.trim() === "") {
      throw new Error("Launch app action requires a valid application path");
    }

    const args = Array.isArray(config.args) ? config.args : [];
    const env = typeof config.env === "object" && config.env !== null ? config.env : {};
    const wait = typeof config.wait === "boolean" ? config.wait : false;
    const show = typeof config.show === "boolean" ? config.show : true;

    this.config = {
      path: config.path as string,
      args: args.map((arg) => String(arg)),
      env: env as Record<string, string>,
      wait,
      show,
    };
  }

  /**
   * Execute the launch app action
   * @param context Action execution context
   * @returns Action result
   */
  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      // Prepare execution environment
      const options: Deno.CommandOptions = {
        args: this.config.args,
        env: { ...Deno.env.toObject(), ...this.config.env },
      };

      // Platform-specific options for showing/hiding the app window
      const isWindows = Deno.build.os === "windows";
      const isMac = Deno.build.os === "darwin";

      if (!this.config.show) {
        if (isWindows) {
          // For Windows, use 'min' to minimize the window
          // Note: Deno Command API might not support hiding windows directly
          // For Windows, we could use 'cmd.exe /c start /min' as a workaround
          console.warn("Window hiding not supported directly in Deno");
        } else if (isMac) {
          // For macOS, can set LSBackgroundOnly=1 in the environment
          options.env = { ...options.env, LSBackgroundOnly: "1" };
        }
      }

      // Launch the process
      const command = new Deno.Command(this.config.path, options);
      const process = command.spawn();
      this.process = process;

      // Check if the process was launched successfully
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (this.isCancelled()) {
        try {
          process.kill("SIGTERM");
        } catch (e) {
          console.error("Error killing process:", e);
        }
        return this.createCancelledResult("Launch cancelled by user");
      }

      // If we're not waiting for completion, return success
      if (!this.config.wait) {
        return this.createSuccessResult(
          {
            path: this.config.path,
            launched: true,
            pid: process.pid,
          },
          context,
        );
      }

      // Wait for process completion
      const status = await process.status;

      // Check cancellation after waiting
      if (this.isCancelled()) {
        return this.createCancelledResult("Launch cancelled during execution");
      }

      // Return result based on exit status
      if (status.success) {
        return this.createSuccessResult(
          {
            path: this.config.path,
            exitCode: status.code,
            signal: status.signal,
          },
          context,
        );
      } else {
        return {
          status: ActionStatus.FAILURE,
          message: `Application exited with code ${status.code}${
            status.signal ? ` (signal: ${status.signal})` : ""
          }`,
          data: {
            path: this.config.path,
            exitCode: status.code,
            signal: status.signal,
          },
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      return this.createFailureResult(
        error instanceof Error ? error : new Error(String(error)),
        context,
      );
    } finally {
      this.process = undefined;
    }
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
      // Try to kill the process
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
 * Factory for creating launch app actions
 */
export class LaunchAppActionFactory implements ActionFactory<LaunchAppAction> {
  /**
   * Create a new launch app action
   * @param config Action configuration
   * @returns New launch app action instance
   */
  create(config: Record<string, unknown>): LaunchAppAction {
    return new LaunchAppAction(config);
  }

  /**
   * Get the type identifier for this action factory
   */
  getType(): string {
    return "launch_app";
  }

  /**
   * Validate launch app action configuration
   * @param config Configuration to validate
   * @returns true if valid, false otherwise
   */
  validate(config: Record<string, unknown>): boolean {
    // Path is required and must be a non-empty string
    if (typeof config.path !== "string" || config.path.trim() === "") {
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

    // Wait must be a boolean if present
    if (config.wait !== undefined && typeof config.wait !== "boolean") {
      return false;
    }

    // Show must be a boolean if present
    if (config.show !== undefined && typeof config.show !== "boolean") {
      return false;
    }

    return true;
  }
}
