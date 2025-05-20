/**
 * HTTP Request Action
 *
 * Action type that makes HTTP requests to external services.
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
 * HTTP method types
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/**
 * HTTP request action configuration
 */
export interface HttpRequestConfig {
  /** The URL to make the request to */
  url: string;

  /** The HTTP method to use */
  method?: HttpMethod;

  /** Optional request headers */
  headers?: Record<string, string>;

  /** Optional request body (for POST, PUT, PATCH) */
  body?: string | Record<string, unknown>;

  /** Optional timeout in milliseconds */
  timeout?: number;

  /** Whether to show the response on the button */
  showResponse?: boolean;

  /** Maximum response length to display on button */
  maxResponseLength?: number;

  /** Whether to follow redirects */
  followRedirects?: boolean;

  /** Expected status code for success */
  expectStatus?: number;

  /** Pattern to match in response for success */
  expectPattern?: string;

  /** JSON path to extract from response for display */
  extractPath?: string;
}

/**
 * Action that makes HTTP requests
 */
export class HttpRequestAction extends BaseAction {
  /** HTTP request configuration */
  private config: HttpRequestConfig;

  /** Current abort controller for cancellation */
  private abortController?: AbortController;

  /**
   * Creates a new HTTP request action
   * @param config Configuration for the action
   */
  constructor(config: Record<string, unknown>) {
    super("http_request");

    // Validate and extract configuration
    if (typeof config.url !== "string" || config.url.trim() === "") {
      throw new Error("HTTP request action requires a valid URL");
    }

    const method = typeof config.method === "string"
      ? config.method.toUpperCase() as HttpMethod
      : "GET";

    const headers = typeof config.headers === "object" && config.headers !== null
      ? config.headers as Record<string, string>
      : {};

    // Process body based on type
    let body: string | Record<string, unknown> | undefined;
    if (config.body !== undefined) {
      if (typeof config.body === "string") {
        body = config.body;
      } else if (typeof config.body === "object" && config.body !== null) {
        body = config.body as Record<string, unknown>;
      }
    }

    const timeout = typeof config.timeout === "number" ? config.timeout : 30000;
    const showResponse = typeof config.showResponse === "boolean" ? config.showResponse : false;
    const maxResponseLength = typeof config.maxResponseLength === "number"
      ? config.maxResponseLength
      : 10;
    const followRedirects = typeof config.followRedirects === "boolean"
      ? config.followRedirects
      : true;
    const expectStatus = typeof config.expectStatus === "number" ? config.expectStatus : 200;
    const expectPattern = typeof config.expectPattern === "string" ? config.expectPattern : "";
    const extractPath = typeof config.extractPath === "string" ? config.extractPath : "";

    this.config = {
      url: config.url as string,
      method,
      headers,
      body,
      timeout,
      showResponse,
      maxResponseLength,
      followRedirects,
      expectStatus,
      expectPattern,
      extractPath,
    };
  }

  /**
   * Execute the HTTP request action
   * @param context Action execution context
   * @returns Action result
   */
  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    // Reset abort controller
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Update button state to show we're running
    if (this.config.showResponse) {
      this.updateButtonStatus(context, "Loading...");
    }

    try {
      // Prepare fetch options
      const options: RequestInit = {
        method: this.config.method,
        headers: this.config.headers,
        signal,
        redirect: this.config.followRedirects ? "follow" : "manual",
      };

      // Add body for methods that support it
      if (["POST", "PUT", "PATCH"].includes(this.config.method || "") && this.config.body) {
        if (typeof this.config.body === "string") {
          options.body = this.config.body;
        } else {
          options.body = JSON.stringify(this.config.body);
          // Set content-type header if not already set
          if (!options.headers || !("Content-Type" in options.headers)) {
            options.headers = {
              ...options.headers,
              "Content-Type": "application/json",
            };
          }
        }
      }

      // Set up timeout promise
      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });

      // Execute the fetch with timeout
      const response = await Promise.race([
        fetch(this.config.url, options),
        timeoutPromise,
      ]);

      // Check for cancellation
      if (signal.aborted) {
        return this.createCancelledResult("HTTP request cancelled by user");
      }

      // Check status code
      if (this.config.expectStatus && response.status !== this.config.expectStatus) {
        const errorText = await response.text();
        throw new Error(
          `Expected status ${this.config.expectStatus} but got ${response.status}: ${errorText}`,
        );
      }

      // Get response text
      const responseText = await response.text();

      // Check for expected pattern
      if (this.config.expectPattern && !responseText.includes(this.config.expectPattern)) {
        throw new Error(
          `Expected pattern "${this.config.expectPattern}" not found in response`,
        );
      }

      // Extract JSON path if specified
      let displayText = responseText;
      if (this.config.extractPath && responseText) {
        try {
          const jsonResponse = JSON.parse(responseText);
          const path = this.config.extractPath.split(".");
          let value = jsonResponse;

          for (const key of path) {
            if (value === undefined || value === null) break;
            value = value[key];
          }

          if (value !== undefined && value !== null) {
            displayText = typeof value === "object" ? JSON.stringify(value) : String(value);
          }
        } catch (e) {
          console.warn("Failed to extract JSON path:", e);
        }
      }

      // Truncate response for display if needed
      if (
        this.config.showResponse && displayText &&
        this.config.maxResponseLength &&
        displayText.length > this.config.maxResponseLength
      ) {
        displayText = displayText.substring(0, this.config.maxResponseLength) + "...";
      }

      // Update button with response
      if (this.config.showResponse) {
        this.updateButtonStatus(context, displayText || "Success");

        // Reset after a delay
        setTimeout(() => {
          context.buttonState.reset();
        }, 5000);
      }

      return this.createSuccessResult(
        {
          url: this.config.url,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          responseText: responseText,
          displayText: displayText,
        },
        context,
      );
    } catch (error) {
      // Update button with error info
      if (this.config.showResponse) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const shortError = errorMsg.length > this.config.maxResponseLength!
          ? errorMsg.substring(0, this.config.maxResponseLength!) + "..."
          : errorMsg;

        this.updateButtonStatus(context, `Error: ${shortError}`);

        // Reset after a delay
        setTimeout(() => {
          context.buttonState.reset();
        }, 3000);
      }

      const failureResult: FailureResult = {
        status: ActionStatus.FAILURE,
        message: `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
      };
      return failureResult;
    } finally {
      this.abortController = undefined;
    }
  }

  /**
   * Update the button visual with current status
   * @param context Action context
   * @param message Status message
   */
  private updateButtonStatus(context: ActionContext, message: string): void {
    if (!this.config.showResponse) return;

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
      console.error("Error cancelling HTTP request:", e);
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
 * Factory for creating HTTP request actions
 */
export class HttpRequestActionFactory implements ActionFactory<HttpRequestAction> {
  /**
   * Create a new HTTP request action
   * @param config Action configuration
   * @returns New HTTP request action instance
   */
  create(config: Record<string, unknown>): HttpRequestAction {
    return new HttpRequestAction(config);
  }

  /**
   * Get the type identifier for this action factory
   */
  getType(): string {
    return "http_request";
  }

  /**
   * Validate HTTP request action configuration
   * @param config Configuration to validate
   * @returns true if valid, false otherwise
   */
  validate(config: Record<string, unknown>): boolean {
    // URL is required and must be a non-empty string
    if (typeof config.url !== "string" || config.url.trim() === "") {
      return false;
    }

    // Method must be a valid HTTP method if specified
    if (
      config.method !== undefined &&
      (typeof config.method !== "string" ||
        !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
          (config.method as string).toUpperCase(),
        ))
    ) {
      return false;
    }

    // Headers must be an object if present
    if (
      config.headers !== undefined &&
      (typeof config.headers !== "object" || config.headers === null)
    ) {
      return false;
    }

    // Body must be a string or object if present
    if (
      config.body !== undefined &&
      (typeof config.body !== "string" && (typeof config.body !== "object" || config.body === null))
    ) {
      return false;
    }

    // Timeout must be a number if present
    if (config.timeout !== undefined && typeof config.timeout !== "number") {
      return false;
    }

    // ShowResponse must be a boolean if present
    if (config.showResponse !== undefined && typeof config.showResponse !== "boolean") {
      return false;
    }

    // MaxResponseLength must be a number if present
    if (config.maxResponseLength !== undefined && typeof config.maxResponseLength !== "number") {
      return false;
    }

    // FollowRedirects must be a boolean if present
    if (config.followRedirects !== undefined && typeof config.followRedirects !== "boolean") {
      return false;
    }

    // ExpectStatus must be a number if present
    if (config.expectStatus !== undefined && typeof config.expectStatus !== "number") {
      return false;
    }

    // ExpectPattern must be a string if present
    if (config.expectPattern !== undefined && typeof config.expectPattern !== "string") {
      return false;
    }

    // ExtractPath must be a string if present
    if (config.extractPath !== undefined && typeof config.extractPath !== "string") {
      return false;
    }

    return true;
  }
}
