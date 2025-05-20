/**
 * Utility Functions
 *
 * This module provides general utility functions used throughout the application.
 */

/**
 * Checks if a value is a plain object (not an array, null, etc.)
 * @param value The value to check
 * @returns True if the value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Performs a deep merge of multiple objects
 * @param target The target object to merge into
 * @param sources The source objects to merge from
 * @returns The merged object
 */
export function deepMerge<T>(target: T, ...sources: unknown[]): T {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Creates a deep clone of an object
 * @param obj The object to clone
 * @returns A deep clone of the object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as unknown as T;
  }

  const clone = {} as Record<string, unknown>;

  for (const key in obj as Record<string, unknown>) {
    clone[key] = deepClone((obj as Record<string, unknown>)[key]);
  }

  return clone as T;
}

/**
 * Gets a nested property from an object using a dot-notation path
 * @param obj The object to get the property from
 * @param path The path to the property (e.g., "foo.bar.baz")
 * @param defaultValue The default value to return if the property doesn't exist
 * @returns The property value or the default value
 */
export function getNestedProperty<T>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue?: T,
): T | undefined {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return defaultValue;
    }

    if (typeof current !== "object") {
      return defaultValue;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current === undefined ? defaultValue : current as T;
}

/**
 * Debounces a function to limit how often it can be called
 * @param func The function to debounce
 * @param wait The time to wait in milliseconds
 * @returns The debounced function
 */
// deno-lint-ignore no-explicit-any
export function debounce<T extends (...args: any[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;

  return function (...args: Parameters<T>): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Returns a promise that resolves after the specified time
 * @param ms Time to wait in milliseconds
 * @returns A promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
