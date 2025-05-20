/**
 * Action Executor
 *
 * Manages action execution and history.
 */

import { EventBus } from "../state/events.ts";
import { Action, ActionContext, ActionOptions, ActionResult, ActionStatus } from "./types.ts";

/**
 * Events emitted by the executor
 */
export enum ExecutorEvent {
  /** Action execution started */
  ACTION_STARTED = "action_started",

  /** Action execution completed */
  ACTION_COMPLETED = "action_completed",

  /** Action execution failed */
  ACTION_FAILED = "action_failed",

  /** Action execution cancelled */
  ACTION_CANCELLED = "action_cancelled",

  /** Execution queue cleared */
  QUEUE_CLEARED = "queue_cleared",
}

/**
 * Base event data for executor events
 */
export interface ExecutorEventData {
  /** Timestamp when the event occurred */
  timestamp: number;
}

/**
 * Event data for action execution events
 */
export interface ActionExecutionEventData extends ExecutorEventData {
  /** The action that was executed */
  action: Action;

  /** The context for the execution */
  context: ActionContext;

  /** The action execution ID */
  executionId: string;
}

/**
 * Event data for action result events
 */
export interface ActionResultEventData extends ActionExecutionEventData {
  /** The result of the action execution */
  result: ActionResult;
}

/**
 * Event data for queue cleared event
 */
export interface QueueClearedEventData extends ExecutorEventData {
  /** Number of actions cleared from the queue */
  count: number;
}

/**
 * Options for the action executor
 */
export interface ActionExecutorOptions {
  /** Maximum number of concurrent actions */
  maxConcurrent?: number;

  /** Whether to keep execution history */
  keepHistory?: boolean;

  /** Maximum size of execution history */
  maxHistorySize?: number;

  /** Default options for action execution */
  defaultActionOptions?: ActionOptions;
}

/**
 * Execution record for tracking action executions
 */
interface ExecutionRecord {
  /** Unique ID for this execution */
  id: string;

  /** The action that was executed */
  action: Action;

  /** The context for the execution */
  context: ActionContext;

  /** The options used for execution */
  options: ActionOptions;

  /** The result of the execution */
  result?: ActionResult;

  /** Timestamp when the execution started */
  startTime: number;

  /** Timestamp when the execution completed */
  endTime?: number;

  /** Whether the execution was cancelled */
  cancelled: boolean;
}

/**
 * Manages action execution and history
 */
export class ActionExecutor {
  /** Event bus for emitting events */
  private events = new EventBus();

  /** Map of active executions by ID */
  private activeExecutions = new Map<string, ExecutionRecord>();

  /** Array of execution history records */
  private history: ExecutionRecord[] = [];

  /** Configuration options */
  private options: Required<ActionExecutorOptions>;

  /** Default options */
  private static readonly DEFAULT_OPTIONS: Required<ActionExecutorOptions> = {
    maxConcurrent: 10,
    keepHistory: true,
    maxHistorySize: 100,
    defaultActionOptions: {
      timeout: 30000,
      retry: false,
      maxRetries: 3,
      retryDelay: 1000,
    },
  };

  /**
   * Create a new action executor
   * @param options Configuration options
   */
  constructor(options?: ActionExecutorOptions) {
    this.options = {
      ...ActionExecutor.DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Execute an action
   * @param action The action to execute
   * @param context The execution context
   * @param options Options for execution
   * @returns Execution ID and result promise
   */
  async execute(
    action: Action,
    context: ActionContext,
    options?: ActionOptions,
  ): Promise<{ executionId: string; result: ActionResult }> {
    // Check if we're at max concurrent executions
    if (
      this.options.maxConcurrent > 0 &&
      this.activeExecutions.size >= this.options.maxConcurrent
    ) {
      throw new Error(`Max concurrent executions (${this.options.maxConcurrent}) reached`);
    }

    // Generate a unique ID for this execution
    const executionId = crypto.randomUUID();

    // Create the execution record
    const record: ExecutionRecord = {
      id: executionId,
      action,
      context,
      options: {
        ...this.options.defaultActionOptions,
        ...options,
      },
      startTime: Date.now(),
      cancelled: false,
    };

    // Add to active executions
    this.activeExecutions.set(executionId, record);

    // Emit started event
    this.emitEvent(ExecutorEvent.ACTION_STARTED, {
      action,
      context,
      executionId,
      timestamp: record.startTime,
    });

    try {
      // Execute the action
      const result = await action.execute(context, record.options);

      // Update the record
      record.result = result;
      record.endTime = Date.now();

      // Remove from active executions
      this.activeExecutions.delete(executionId);

      // Add to history if enabled
      if (this.options.keepHistory) {
        this.addToHistory(record);
      }

      // Emit completion event based on result
      if (result.status === ActionStatus.SUCCESS) {
        this.emitEvent(ExecutorEvent.ACTION_COMPLETED, {
          action,
          context,
          executionId,
          result,
          timestamp: record.endTime,
        });
      } else if (result.status === ActionStatus.FAILURE) {
        this.emitEvent(ExecutorEvent.ACTION_FAILED, {
          action,
          context,
          executionId,
          result,
          timestamp: record.endTime,
        });
      } else if (result.status === ActionStatus.CANCELLED) {
        this.emitEvent(ExecutorEvent.ACTION_CANCELLED, {
          action,
          context,
          executionId,
          result,
          timestamp: record.endTime,
        });
      }

      return { executionId, result };
    } catch (error) {
      // Create failure result
      const result: ActionResult = {
        status: ActionStatus.FAILURE,
        message: error instanceof Error ? error.message : String(error),
        data: error,
        timestamp: Date.now(),
      };

      // Update the record
      record.result = result;
      record.endTime = Date.now();

      // Remove from active executions
      this.activeExecutions.delete(executionId);

      // Add to history if enabled
      if (this.options.keepHistory) {
        this.addToHistory(record);
      }

      // Emit failed event
      this.emitEvent(ExecutorEvent.ACTION_FAILED, {
        action,
        context,
        executionId,
        result,
        timestamp: record.endTime,
      });

      return { executionId, result };
    }
  }

  /**
   * Cancel an action execution
   * @param executionId The execution ID to cancel
   * @returns true if cancelled, false if not found or not cancellable
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const record = this.activeExecutions.get(executionId);

    if (!record) {
      return false;
    }

    if (!record.action.isCancellable()) {
      return false;
    }

    record.cancelled = true;

    if (record.action.cancel) {
      return await record.action.cancel();
    }

    return false;
  }

  /**
   * Cancel all active executions
   * @returns Number of executions cancelled
   */
  async cancelAll(): Promise<number> {
    let cancelledCount = 0;

    for (const executionId of this.activeExecutions.keys()) {
      if (await this.cancelExecution(executionId)) {
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Get execution record by ID
   * @param executionId The execution ID
   * @returns The execution record or undefined if not found
   */
  getExecution(executionId: string): Omit<ExecutionRecord, "options"> | undefined {
    const record = this.activeExecutions.get(executionId) ||
      this.history.find((r) => r.id === executionId);

    if (!record) {
      return undefined;
    }

    // Omit options for privacy/security
    const { options: _options, ...rest } = record;
    return rest;
  }

  /**
   * Get all active executions
   * @returns Array of active execution records
   */
  getActiveExecutions(): Array<Omit<ExecutionRecord, "options">> {
    return Array.from(this.activeExecutions.values()).map(({ options: _options, ...rest }) => rest);
  }

  /**
   * Get execution history
   * @param limit Maximum number of records to return (latest first)
   * @returns Array of execution history records
   */
  getHistory(limit?: number): Array<Omit<ExecutionRecord, "options">> {
    const historyLimit = limit || this.history.length;

    return this.history
      .slice(-historyLimit)
      .map(({ options: _options, ...rest }) => rest)
      .reverse();
  }

  /**
   * Clear the execution history
   * @returns Number of records cleared
   */
  clearHistory(): number {
    const count = this.history.length;
    this.history = [];
    return count;
  }

  /**
   * Subscribe to executor events
   * @param event The event to subscribe to
   * @param handler The handler function
   * @returns An unsubscribe function
   */
  on<T extends ExecutorEventData>(
    event: ExecutorEvent.ACTION_STARTED,
    handler: (data: ActionExecutionEventData) => void,
  ): () => void;
  on<T extends ExecutorEventData>(
    event:
      | ExecutorEvent.ACTION_COMPLETED
      | ExecutorEvent.ACTION_FAILED
      | ExecutorEvent.ACTION_CANCELLED,
    handler: (data: ActionResultEventData) => void,
  ): () => void;
  on<T extends ExecutorEventData>(
    event: ExecutorEvent.QUEUE_CLEARED,
    handler: (data: QueueClearedEventData) => void,
  ): () => void;
  on<T extends ExecutorEventData>(
    event: ExecutorEvent,
    handler: (data: T) => void,
  ): () => void {
    return this.events.on(event, handler as (data: ExecutorEventData) => void);
  }

  /**
   * Unsubscribe from executor events
   * @param event The event to unsubscribe from
   * @param handler The handler function
   */
  off<T extends ExecutorEventData>(
    event: ExecutorEvent.ACTION_STARTED,
    handler: (data: ActionExecutionEventData) => void,
  ): void;
  off<T extends ExecutorEventData>(
    event:
      | ExecutorEvent.ACTION_COMPLETED
      | ExecutorEvent.ACTION_FAILED
      | ExecutorEvent.ACTION_CANCELLED,
    handler: (data: ActionResultEventData) => void,
  ): void;
  off<T extends ExecutorEventData>(
    event: ExecutorEvent.QUEUE_CLEARED,
    handler: (data: QueueClearedEventData) => void,
  ): void;
  off<T extends ExecutorEventData>(
    event: ExecutorEvent,
    handler: (data: T) => void,
  ): void {
    this.events.off(event, handler as (data: ExecutorEventData) => void);
  }

  /**
   * Add a record to the execution history
   * @param record The record to add
   */
  private addToHistory(record: ExecutionRecord): void {
    this.history.push(record);

    // Trim history if needed
    if (this.history.length > this.options.maxHistorySize) {
      this.history = this.history.slice(-this.options.maxHistorySize);
    }
  }

  /**
   * Emit an executor event
   * @param event The event to emit
   * @param data The event data
   */
  private emitEvent<T extends ExecutorEventData>(event: ExecutorEvent, data: T): void {
    this.events.emit(event, data);
  }
}
