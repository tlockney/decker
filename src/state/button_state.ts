/**
 * Button State Model
 *
 * Represents the current state of a button on a Stream Deck device.
 */

import { ButtonConfig, ButtonVisual } from "../config/schema.ts";
import { EventBus, EventEmitter } from "./events.ts";

/**
 * Events emitted by ButtonState
 */
export enum ButtonStateEvent {
  VISUAL_CHANGED = "visual_changed",
  PRESSED = "pressed",
  RELEASED = "released",
  STATE_CHANGED = "state_changed",
}

/**
 * Interface for the visual changed event data
 */
export interface VisualChangedEvent {
  oldVisual: ButtonVisual;
  newVisual: ButtonVisual;
  button: ButtonState;
}

/**
 * Interface for the button pressed event data
 */
export interface ButtonPressedEvent {
  button: ButtonState;
}

/**
 * Interface for the button released event data
 */
export interface ButtonReleasedEvent {
  button: ButtonState;
}

/**
 * Interface for the state changed event data
 */
export interface StateChangedEvent {
  oldState: string | undefined;
  newState: string | undefined;
  button: ButtonState;
}

/**
 * Interface representing the state of a button
 */
export interface ButtonStateData {
  /** Device serial number */
  deviceSerial: string;

  /** Button index/position on the device */
  buttonIndex: number;

  /** Page identifier that this button belongs to */
  pageId: string;

  /** Visual properties of the button */
  visual: ButtonVisual;

  /** Custom state of the button (for stateful buttons) */
  customState?: string;

  /** Whether the button is currently pressed */
  isPressed: boolean;

  /** The configuration for this button */
  config: ButtonConfig;
}

/**
 * Class representing a button's state
 */
export class ButtonState implements ButtonStateData {
  /** Event emitter for state changes */
  private events: EventEmitter;

  /** Device serial number */
  public readonly deviceSerial: string;

  /** Button index/position on the device */
  public readonly buttonIndex: number;

  /** Page identifier that this button belongs to */
  public readonly pageId: string;

  /** Visual properties of the button */
  public visual: ButtonVisual;

  /** Custom state of the button (for stateful buttons) */
  private _customState?: string;

  /** Whether the button is currently pressed */
  private _isPressed = false;

  /** The configuration for this button */
  public config: ButtonConfig;

  /**
   * Create a new ButtonState
   *
   * @param data The initial state data
   */
  constructor(data: Omit<ButtonStateData, "isPressed" | "customState"> & { customState?: string }) {
    this.deviceSerial = data.deviceSerial;
    this.buttonIndex = data.buttonIndex;
    this.pageId = data.pageId;
    this.config = data.config;
    this.visual = { ...data.visual };
    this._customState = data.customState;
    this.events = new EventBus();
  }

  /**
   * Get whether the button is currently pressed
   */
  public get isPressed(): boolean {
    return this._isPressed;
  }

  /**
   * Get the custom state of the button
   */
  public get customState(): string | undefined {
    return this._customState;
  }

  /**
   * Set the custom state of the button
   */
  public set customState(state: string | undefined) {
    if (this._customState !== state) {
      const oldState = this._customState;
      this._customState = state;

      this.events.emit(ButtonStateEvent.STATE_CHANGED, {
        oldState,
        newState: state,
        button: this,
      });

      // If the button has state-specific images, update the visual
      if (state && this.config.state_images && this.config.state_images[state]) {
        this.updateVisual({ image: this.config.state_images[state] });
      }
    }
  }

  /**
   * Update the visual properties of the button
   *
   * @param visual The new visual properties
   */
  public updateVisual(visual: Partial<ButtonVisual>): void {
    const oldVisual = { ...this.visual };
    this.visual = { ...this.visual, ...visual };

    this.events.emit(ButtonStateEvent.VISUAL_CHANGED, {
      oldVisual,
      newVisual: this.visual,
      button: this,
    });
  }

  /**
   * Set whether the button is pressed
   *
   * @param pressed Whether the button is pressed
   */
  public setPressed(pressed: boolean): void {
    if (this._isPressed !== pressed) {
      this._isPressed = pressed;

      if (pressed) {
        this.events.emit(ButtonStateEvent.PRESSED, { button: this });
      } else {
        this.events.emit(ButtonStateEvent.RELEASED, { button: this });
      }

      // If the button is stateful, toggle the state on release
      if (!pressed && this.config.stateful === true) {
        const nextState = this._customState === "active" ? undefined : "active";
        this.customState = nextState;
      }
    }
  }

  /**
   * Subscribe to button events
   *
   * @param event The event to subscribe to
   * @param handler The handler function
   * @returns An unsubscribe function
   */
  public on<T = unknown>(event: ButtonStateEvent, handler: (data: T) => void): () => void {
    return this.events.on(event, handler);
  }

  /**
   * Subscribe to button events once
   *
   * @param event The event to subscribe to
   * @param handler The handler function
   * @returns An unsubscribe function
   */
  public once<T = unknown>(event: ButtonStateEvent, handler: (data: T) => void): () => void {
    return this.events.once(event, handler);
  }

  /**
   * Unsubscribe from button events
   *
   * @param event The event to unsubscribe from
   * @param handler The handler function
   */
  public off<T = unknown>(event: ButtonStateEvent, handler: (data: T) => void): void {
    this.events.off(event, handler);
  }

  /**
   * Reset the button to its initial state
   */
  public reset(): void {
    this._isPressed = false;
    this._customState = undefined;
    this.visual = {
      image: this.config.image,
      text: this.config.text,
      color: this.config.color,
      font_size: this.config.font_size,
      text_color: this.config.text_color,
    };

    this.events.emit(ButtonStateEvent.VISUAL_CHANGED, {
      oldVisual: null,
      newVisual: this.visual,
      button: this,
    });
  }

  /**
   * Dispose of the button state
   */
  public dispose(): void {
    (this.events as EventBus).clearAllListeners();
  }
}
