/**
 * Action Framework Types
 *
 * Defines the core interfaces and types for the action system.
 */

import { ButtonState } from "../state/button_state.ts";

/**
 * Status of an action execution
 */
export enum ActionStatus {
  /** Action completed successfully */
  SUCCESS = "success",

  /** Action failed to complete */
  FAILURE = "failure",

  /** Action is still in progress */
  PENDING = "pending",

  /** Action was cancelled */
  CANCELLED = "cancelled",
}

/**
 * Base interface for action results
 */
export interface ActionResult {
  /** Status of the action execution */
  status: ActionStatus;

  /** Message describing the result */
  message?: string;

  /** Optional detailed data about the result */
  data?: unknown;

  /** Timestamp when the action completed */
  timestamp: number;
}

/**
 * Success action result
 */
export interface SuccessResult extends ActionResult {
  status: ActionStatus.SUCCESS;
  data?: unknown;
}

/**
 * Failure action result
 */
export interface FailureResult extends ActionResult {
  status: ActionStatus.FAILURE;

  /** Error that caused the failure */
  error?: Error;
}

/**
 * Pending action result
 */
export interface PendingResult extends ActionResult {
  status: ActionStatus.PENDING;

  /** Estimated percentage completion (0-100) */
  progress?: number;
}

/**
 * Cancelled action result
 */
export interface CancelledResult extends ActionResult {
  status: ActionStatus.CANCELLED;

  /** Reason for cancellation */
  reason?: string;
}

/**
 * Context for action execution
 */
export interface ActionContext {
  /** The button state that triggered the action */
  buttonState: ButtonState;

  /** Additional context data */
  data?: Record<string, unknown>;
}

/**
 * Options for action execution
 */
export interface ActionOptions {
  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to retry on failure */
  retry?: boolean;

  /** Maximum number of retries */
  maxRetries?: number;

  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Core interface for all actions
 */
export interface Action {
  /**
   * Execute the action
   * @param context Context for execution
   * @param options Options for execution
   * @returns Result of the action execution
   */
  execute(context: ActionContext, options?: ActionOptions): Promise<ActionResult>;

  /**
   * Cancel an in-progress action (if supported)
   * @returns true if cancelled, false if not cancellable or already completed
   */
  cancel?(): Promise<boolean>;

  /**
   * Check if the action is currently executing
   */
  isExecuting(): boolean;

  /**
   * Check if the action is cancellable
   */
  isCancellable(): boolean;

  /**
   * Get a unique identifier for this action instance
   */
  getId(): string;

  /**
   * Get the type identifier for this action
   */
  getType(): string;
}

/**
 * Factory for creating action instances
 */
export interface ActionFactory<T extends Action = Action> {
  /**
   * Create a new action instance from configuration
   * @param config The action configuration
   * @returns A new action instance
   */
  create(config: Record<string, unknown>): T;

  /**
   * Get the type identifier for actions created by this factory
   */
  getType(): string;

  /**
   * Validate action configuration
   * @param config The action configuration to validate
   * @returns true if valid, false otherwise
   */
  validate(config: Record<string, unknown>): boolean;
}

/**
 * Events emitted by actions
 */
export enum ActionEvent {
  /** Action execution started */
  STARTED = "started",

  /** Action execution completed */
  COMPLETED = "completed",

  /** Action execution progress updated */
  PROGRESS = "progress",

  /** Action execution failed */
  FAILED = "failed",

  /** Action execution cancelled */
  CANCELLED = "cancelled",
}

/**
 * Base event data for action events
 */
export interface ActionEventData {
  /** The action that emitted the event */
  action: Action;

  /** Timestamp when the event occurred */
  timestamp: number;

  /** Context of the action execution */
  context: ActionContext;
}

/**
 * Event data for action started event
 */
export interface ActionStartedEventData extends ActionEventData {
  /** Options used for execution */
  options?: ActionOptions;
}

/**
 * Event data for action completed event
 */
export interface ActionCompletedEventData extends ActionEventData {
  /** Result of the action execution */
  result: SuccessResult;
}

/**
 * Event data for action progress event
 */
export interface ActionProgressEventData extends ActionEventData {
  /** Progress information */
  progress: {
    /** Percentage completion (0-100) */
    percentage: number;

    /** Optional status message */
    message?: string;

    /** Optional detailed data */
    data?: unknown;
  };
}

/**
 * Event data for action failed event
 */
export interface ActionFailedEventData extends ActionEventData {
  /** Failure information */
  error: Error;

  /** Whether the action will be retried */
  willRetry: boolean;

  /** Attempt number */
  attempt: number;

  /** Maximum attempts */
  maxAttempts: number;
}

/**
 * Event data for action cancelled event
 */
export interface ActionCancelledEventData extends ActionEventData {
  /** Reason for cancellation */
  reason?: string;
}

/**
 * Type for action event handlers
 */
export type ActionEventHandler<T extends ActionEventData = ActionEventData> = (data: T) => void;
