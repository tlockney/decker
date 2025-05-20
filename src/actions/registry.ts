/**
 * Action Registry
 *
 * Manages action types and factories.
 */

import { ActionFactory } from "./types.ts";

/**
 * Registry for action factories
 */
export class ActionRegistry {
  /** Map of action factories by type */
  private factories: Map<string, ActionFactory> = new Map();

  /**
   * Create a new action registry
   * @param factories Optional array of factories to register
   */
  constructor(factories: ActionFactory[] = []) {
    for (const factory of factories) {
      this.register(factory);
    }
  }

  /**
   * Register an action factory
   * @param factory The action factory to register
   * @returns This registry for chaining
   * @throws Error if a factory for the same type is already registered
   */
  register(factory: ActionFactory): ActionRegistry {
    const type = factory.getType();

    if (this.factories.has(type)) {
      throw new Error(`Factory for action type "${type}" is already registered`);
    }

    this.factories.set(type, factory);
    return this;
  }

  /**
   * Unregister an action factory
   * @param type The action type to unregister
   * @returns true if unregistered, false if not found
   */
  unregister(type: string): boolean {
    return this.factories.delete(type);
  }

  /**
   * Get an action factory by type
   * @param type The action type
   * @returns The action factory or undefined if not found
   */
  getFactory(type: string): ActionFactory | undefined {
    return this.factories.get(type);
  }

  /**
   * Check if an action type is registered
   * @param type The action type
   * @returns true if registered, false otherwise
   */
  hasFactory(type: string): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered action types
   * @returns Array of registered action types
   */
  getTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get all registered action factories
   * @returns Array of registered action factories
   */
  getFactories(): ActionFactory[] {
    return Array.from(this.factories.values());
  }

  /**
   * Create an action from configuration
   * @param type The action type
   * @param config The action configuration
   * @returns The created action
   * @throws Error if the type is not registered or configuration is invalid
   */
  createAction(type: string, config: Record<string, unknown>) {
    const factory = this.factories.get(type);

    if (!factory) {
      throw new Error(`No factory registered for action type "${type}"`);
    }

    if (!factory.validate(config)) {
      throw new Error(`Invalid configuration for action type "${type}"`);
    }

    return factory.create({ type, ...config });
  }

  /**
   * Validate action configuration
   * @param type The action type
   * @param config The action configuration
   * @returns true if valid, false otherwise
   * @throws Error if the type is not registered
   */
  validateConfig(type: string, config: Record<string, unknown>): boolean {
    const factory = this.factories.get(type);

    if (!factory) {
      throw new Error(`No factory registered for action type "${type}"`);
    }

    return factory.validate(config);
  }
}
