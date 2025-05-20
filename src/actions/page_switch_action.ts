/**
 * Page Switch Action
 *
 * Action type that switches between pages on a Stream Deck device.
 */

import { BaseAction } from "./base_action.ts";
import { StateManager } from "../state/state_manager.ts";
import {
  ActionContext,
  ActionFactory,
  ActionResult,
  ActionStatus,
  FailureResult,
} from "./types.ts";

/**
 * Page switch action configuration
 */
export interface PageSwitchConfig {
  /** The page ID to switch to */
  pageId: string;

  /** Optional device serial to switch (defaults to the button's device) */
  deviceSerial?: string;

  /** Whether to show a visual indicator during switch */
  showIndicator?: boolean;

  /** Whether to use animation effect during switch */
  animate?: boolean;

  /** Whether to push to navigation stack for back button support */
  pushToStack?: boolean;
}

/**
 * Action that switches between pages on a Stream Deck
 */
export class PageSwitchAction extends BaseAction {
  /** Page switch configuration */
  private config: PageSwitchConfig;

  /** State manager instance */
  private stateManager: StateManager;

  /**
   * Creates a new page switch action
   * @param config Configuration for the action
   * @param stateManager Reference to the state manager
   */
  constructor(config: Record<string, unknown>, stateManager: StateManager) {
    super("page_switch");
    this.stateManager = stateManager;

    // Validate and extract configuration
    if (typeof config.pageId !== "string" || config.pageId.trim() === "") {
      throw new Error("Page switch action requires a valid page ID");
    }

    const deviceSerial = typeof config.deviceSerial === "string" ? config.deviceSerial : undefined;
    const showIndicator = typeof config.showIndicator === "boolean" ? config.showIndicator : true;
    const animate = typeof config.animate === "boolean" ? config.animate : true;
    const pushToStack = typeof config.pushToStack === "boolean" ? config.pushToStack : true;

    this.config = {
      pageId: config.pageId as string,
      deviceSerial,
      showIndicator,
      animate,
      pushToStack,
    };
  }

  /**
   * Execute the page switch action
   * @param context Action execution context
   * @returns Action result
   */
  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      // Use the button's device if not specified
      const deviceSerial = this.config.deviceSerial || context.buttonState.deviceSerial;

      // Show indicator if enabled
      if (this.config.showIndicator) {
        this.showSwitchIndicator(context);
      }

      // Get current page ID for the result
      const currentPage = this.stateManager.getActivePage(deviceSerial);

      // Check that the target page exists
      if (!this.stateManager.hasPage(deviceSerial, this.config.pageId)) {
        throw new Error(`Page "${this.config.pageId}" does not exist for device ${deviceSerial}`);
      }

      // Activate the target page
      await this.stateManager.activatePage(
        deviceSerial,
        this.config.pageId,
        {
          animate: this.config.animate,
          pushToStack: this.config.pushToStack,
        },
      );

      return this.createSuccessResult(
        {
          deviceSerial,
          fromPage: currentPage,
          toPage: this.config.pageId,
        },
        context,
      );
    } catch (error) {
      const failureResult: FailureResult = {
        status: ActionStatus.FAILURE,
        message: `Failed to switch page: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
      };
      return failureResult;
    }
  }

  /**
   * Show a visual indicator for page switch
   * @param context Action context
   */
  private showSwitchIndicator(context: ActionContext): void {
    // Store original button state
    const originalVisual = { ...context.buttonState.visual };

    // Show the target page on the button
    context.buttonState.updateVisual({
      text: `→ ${this.config.pageId}`,
    });

    // Reset after a short delay (animation will take over)
    setTimeout(() => {
      // Only reset if the action is still executing
      if (this.isExecuting()) {
        context.buttonState.updateVisual(originalVisual);
      }
    }, 200);
  }

  /**
   * Check if the action is cancellable (page switches are not cancellable)
   */
  override isCancellable(): boolean {
    return false;
  }
}

/**
 * Factory for creating page switch actions
 */
export class PageSwitchActionFactory implements ActionFactory<PageSwitchAction> {
  /** Reference to the state manager */
  private stateManager: StateManager;

  /**
   * Create a new page switch action factory
   * @param stateManager Reference to the state manager
   */
  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Create a new page switch action
   * @param config Action configuration
   * @returns New page switch action instance
   */
  create(config: Record<string, unknown>): PageSwitchAction {
    return new PageSwitchAction(config, this.stateManager);
  }

  /**
   * Get the type identifier for this action factory
   */
  getType(): string {
    return "page_switch";
  }

  /**
   * Validate page switch action configuration
   * @param config Configuration to validate
   * @returns true if valid, false otherwise
   */
  validate(config: Record<string, unknown>): boolean {
    // PageId is required and must be a non-empty string
    if (typeof config.pageId !== "string" || config.pageId.trim() === "") {
      return false;
    }

    // DeviceSerial must be a string if present
    if (config.deviceSerial !== undefined && typeof config.deviceSerial !== "string") {
      return false;
    }

    // ShowIndicator must be a boolean if present
    if (config.showIndicator !== undefined && typeof config.showIndicator !== "boolean") {
      return false;
    }

    // Animate must be a boolean if present
    if (config.animate !== undefined && typeof config.animate !== "boolean") {
      return false;
    }

    // PushToStack must be a boolean if present
    if (config.pushToStack !== undefined && typeof config.pushToStack !== "boolean") {
      return false;
    }

    return true;
  }
}
