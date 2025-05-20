/**
 * Base Action Implementation
 *
 * Provides a foundation for implementing actions.
 */

import { EventBus } from "../state/events.ts";
import {
  Action,
  ActionContext,
  ActionEvent,
  ActionEventData,
  ActionOptions,
  ActionResult,
  ActionStatus,
  CancelledResult,
  FailureResult,
  PendingResult,
  SuccessResult,
} from "./types.ts";

/**
 * Abstract base class for actions
 */
export abstract class BaseAction implements Action {
  /** Unique identifier for this action instance */
  protected readonly id: string;

  /** Type identifier for this action */
  protected readonly type: string;

  /** Event bus for emitting events */
  protected events: EventBus = new EventBus();

  /** Whether the action is currently executing */
  protected executing = false;

  /** Whether the action has been cancelled */
  protected cancelled = false;

  /**
   * Creates a new base action
   * @param type The action type identifier
   * @param id Optional unique identifier (generated if not provided)
   */
  constructor(type: string, id?: string) {
    this.type = type;
    this.id = id || crypto.randomUUID();
  }

  /**
   * Execute the action
   * @param context Context for execution
   * @param options Options for execution
   */
  async execute(context: ActionContext, options?: ActionOptions): Promise<ActionResult> {
    if (this.executing) {
      return this.createFailureResult(new Error("Action is already executing"));
    }

    this.executing = true;
    this.cancelled = false;

    // Set up options with defaults
    const execOptions = {
      timeout: 30000,
      retry: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };

    // Emit started event
    this.emitEvent(ActionEvent.STARTED, {
      action: this,
      timestamp: Date.now(),
      context,
      options: execOptions,
    });

    try {
      // Set up timeout if needed
      let timeoutId: number | undefined;
      let timeoutPromise: Promise<FailureResult> | undefined;

      if (execOptions.timeout && execOptions.timeout > 0) {
        timeoutPromise = new Promise<FailureResult>((resolve) => {
          timeoutId = setTimeout(() => {
            resolve(this.createFailureResult(
              new Error(`Action execution timed out after ${execOptions.timeout}ms`),
              context,
            ));
          }, execOptions.timeout);
        });
      }

      // Set up retry logic
      let result: ActionResult | undefined;
      let attempts = 0;
      let lastError: Error | undefined;

      while (attempts <= (execOptions.retry ? execOptions.maxRetries : 0)) {
        attempts++;

        try {
          // Execute with timeout if configured
          if (timeoutPromise) {
            result = await Promise.race([
              this.executeAction(context),
              timeoutPromise,
            ]);
          } else {
            result = await this.executeAction(context);
          }

          // If successful or cancelled, break retry loop
          if (
            result.status === ActionStatus.SUCCESS ||
            result.status === ActionStatus.CANCELLED
          ) {
            break;
          }

          // If not retrying, break
          if (!execOptions.retry) {
            break;
          }

          // Save error for retry info
          if (
            result.status === ActionStatus.FAILURE &&
            (result as FailureResult).error
          ) {
            lastError = (result as FailureResult).error;
          }

          // Wait before retrying
          if (attempts <= execOptions.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, execOptions.retryDelay));
          }
        } catch (error) {
          // Handle unexpected errors
          lastError = error instanceof Error ? error : new Error(String(error));

          // If not retrying or out of retries, create failure result
          if (!execOptions.retry || attempts > execOptions.maxRetries) {
            result = this.createFailureResult(lastError, context);
            break;
          }

          // Emit failed event with retry information
          this.emitEvent(ActionEvent.FAILED, {
            action: this,
            timestamp: Date.now(),
            context,
            error: lastError,
            willRetry: attempts <= execOptions.maxRetries,
            attempt: attempts,
            maxAttempts: execOptions.maxRetries + 1,
          });

          // Wait before retrying
          if (attempts <= execOptions.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, execOptions.retryDelay));
          }
        }
      }

      // Clear timeout if set
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // Handle the case where we ran out of retries
      if (!result) {
        result = this.createFailureResult(
          lastError || new Error("Action failed after retries"),
          context,
        );
      }

      // Reset state
      this.executing = false;

      // Emit completion event based on result
      if (result.status === ActionStatus.SUCCESS) {
        this.emitEvent(ActionEvent.COMPLETED, {
          action: this,
          timestamp: Date.now(),
          context,
          result: result as SuccessResult,
        });
      } else if (result.status === ActionStatus.FAILURE) {
        this.emitEvent(ActionEvent.FAILED, {
          action: this,
          timestamp: Date.now(),
          context,
          error: (result as FailureResult).error || new Error(result.message || "Unknown error"),
          willRetry: false,
          attempt: attempts,
          maxAttempts: execOptions.maxRetries + 1,
        });
      } else if (result.status === ActionStatus.CANCELLED) {
        this.emitEvent(ActionEvent.CANCELLED, {
          action: this,
          timestamp: Date.now(),
          context,
          reason: (result as CancelledResult).reason,
        });
      }

      return result;
    } catch (error) {
      // Handle any unexpected errors in the execution flow
      this.executing = false;

      const failureResult = this.createFailureResult(
        error instanceof Error ? error : new Error(String(error)),
        context,
      );

      this.emitEvent(ActionEvent.FAILED, {
        action: this,
        timestamp: Date.now(),
        context,
        error: failureResult.error || new Error(failureResult.message || "Unknown error"),
        willRetry: false,
        attempt: 1,
        maxAttempts: 1,
      });

      return failureResult;
    }
  }

  /**
   * Cancel the action if supported
   * @returns true if cancelled, false if not cancellable or already completed
   */
  cancel(): Promise<boolean> {
    if (!this.executing || this.cancelled || !this.isCancellable()) {
      return Promise.resolve(false);
    }

    this.cancelled = true;
    return Promise.resolve(true);
  }

  /**
   * Check if the action is currently executing
   */
  isExecuting(): boolean {
    return this.executing;
  }

  /**
   * Check if the action is cancellable
   * Override in subclasses if the action supports cancellation
   */
  isCancellable(): boolean {
    return false;
  }

  /**
   * Get the unique identifier for this action instance
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get the type identifier for this action
   */
  getType(): string {
    return this.type;
  }

  /**
   * Subscribe to action events
   * @param event The event to subscribe to
   * @param handler The handler function
   * @returns An unsubscribe function
   */
  on<T extends ActionEventData>(event: ActionEvent, handler: (data: T) => void): () => void {
    return this.events.on(event, handler);
  }

  /**
   * Unsubscribe from action events
   * @param event The event to unsubscribe from
   * @param handler The handler function
   */
  off<T extends ActionEventData>(event: ActionEvent, handler: (data: T) => void): void {
    this.events.off(event, handler);
  }

  /**
   * The actual action implementation
   * Must be implemented by subclasses
   * @param context The execution context
   */
  protected abstract executeAction(context: ActionContext): Promise<ActionResult>;

  /**
   * Creates a success result
   * @param data Optional result data
   * @param context Optional execution context for message generation
   * @returns A success result
   */
  protected createSuccessResult(data?: unknown, _context?: ActionContext): SuccessResult {
    return {
      status: ActionStatus.SUCCESS,
      message: "Action completed successfully",
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * Creates a failure result
   * @param error The error that caused the failure
   * @param context Optional execution context for error handling
   * @returns A failure result
   */
  protected createFailureResult(error: Error, _context?: ActionContext): FailureResult {
    return {
      status: ActionStatus.FAILURE,
      message: error.message,
      error,
      timestamp: Date.now(),
    };
  }

  /**
   * Creates a pending result
   * @param progress Optional progress percentage (0-100)
   * @param message Optional status message
   * @returns A pending result
   */
  protected createPendingResult(progress?: number, message?: string): PendingResult {
    return {
      status: ActionStatus.PENDING,
      message: message || "Action is in progress",
      progress,
      timestamp: Date.now(),
    };
  }

  /**
   * Creates a cancelled result
   * @param reason Optional reason for cancellation
   * @returns A cancelled result
   */
  protected createCancelledResult(reason?: string): CancelledResult {
    return {
      status: ActionStatus.CANCELLED,
      message: "Action was cancelled",
      reason,
      timestamp: Date.now(),
    };
  }

  /**
   * Emit an action event
   * @param event The event to emit
   * @param data The event data
   */
  protected emitEvent<T extends ActionEventData>(event: ActionEvent, data: T): void {
    this.events.emit(event, data);
  }

  /**
   * Check if the action has been cancelled
   * @returns true if cancelled, false otherwise
   */
  protected isCancelled(): boolean {
    return this.cancelled;
  }
}
