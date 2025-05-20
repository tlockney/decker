/**
 * Event System for State Management
 *
 * Provides a simple observable pattern implementation for state changes.
 */

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (data: T) => void;

/**
 * Event emitter interface for publishing and subscribing to events
 */
export interface EventEmitter {
  /**
   * Subscribe to an event
   *
   * @param eventName The name of the event to subscribe to
   * @param handler The function to call when the event is emitted
   * @returns An unsubscribe function
   */
  on<T = unknown>(eventName: string, handler: EventHandler<T>): () => void;

  /**
   * Subscribe to an event once
   *
   * @param eventName The name of the event to subscribe to
   * @param handler The function to call when the event is emitted
   * @returns An unsubscribe function
   */
  once<T = unknown>(eventName: string, handler: EventHandler<T>): () => void;

  /**
   * Unsubscribe from an event
   *
   * @param eventName The name of the event to unsubscribe from
   * @param handler The handler to remove
   */
  off<T = unknown>(eventName: string, handler: EventHandler<T>): void;

  /**
   * Emit an event
   *
   * @param eventName The name of the event to emit
   * @param data The data to pass to the event handlers
   */
  emit<T = unknown>(eventName: string, data: T): void;
}

/**
 * Implementation of the EventEmitter interface
 */
export class EventBus implements EventEmitter {
  private readonly events = new Map<string, Set<EventHandler<unknown>>>();
  private readonly onceEvents = new Map<string, Set<EventHandler<unknown>>>();

  /**
   * Subscribe to an event
   *
   * @param eventName The name of the event to subscribe to
   * @param handler The function to call when the event is emitted
   * @returns An unsubscribe function
   */
  public on<T = unknown>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }

    this.events.get(eventName)!.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe to an event once
   *
   * @param eventName The name of the event to subscribe to
   * @param handler The function to call when the event is emitted
   * @returns An unsubscribe function
   */
  public once<T = unknown>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.onceEvents.has(eventName)) {
      this.onceEvents.set(eventName, new Set());
    }

    this.onceEvents.get(eventName)!.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => {
      if (this.onceEvents.has(eventName)) {
        this.onceEvents.get(eventName)!.delete(handler as EventHandler<unknown>);
      }
    };
  }

  /**
   * Unsubscribe from an event
   *
   * @param eventName The name of the event to unsubscribe from
   * @param handler The handler to remove
   */
  public off<T = unknown>(eventName: string, handler: EventHandler<T>): void {
    if (this.events.has(eventName)) {
      this.events.get(eventName)!.delete(handler as EventHandler<unknown>);

      // Clean up empty event sets
      if (this.events.get(eventName)!.size === 0) {
        this.events.delete(eventName);
      }
    }

    // Also check once events
    if (this.onceEvents.has(eventName)) {
      this.onceEvents.get(eventName)!.delete(handler as EventHandler<unknown>);

      // Clean up empty event sets
      if (this.onceEvents.get(eventName)!.size === 0) {
        this.onceEvents.delete(eventName);
      }
    }
  }

  /**
   * Emit an event
   *
   * @param eventName The name of the event to emit
   * @param data The data to pass to the event handlers
   */
  public emit<T = unknown>(eventName: string, data: T): void {
    // Regular event handlers
    if (this.events.has(eventName)) {
      for (const handler of this.events.get(eventName)!) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      }
    }

    // Once event handlers
    if (this.onceEvents.has(eventName)) {
      const handlers = [...this.onceEvents.get(eventName)!];
      this.onceEvents.delete(eventName);

      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in once event handler for ${eventName}:`, error);
        }
      }
    }
  }

  /**
   * Check if an event has subscribers
   *
   * @param eventName The name of the event to check
   * @returns True if the event has subscribers
   */
  public hasListeners(eventName: string): boolean {
    return (
      (this.events.has(eventName) && this.events.get(eventName)!.size > 0) ||
      (this.onceEvents.has(eventName) && this.onceEvents.get(eventName)!.size > 0)
    );
  }

  /**
   * Clear all event listeners
   */
  public clearAllListeners(): void {
    this.events.clear();
    this.onceEvents.clear();
  }
}
