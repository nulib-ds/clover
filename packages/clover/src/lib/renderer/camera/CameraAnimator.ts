import { type CameraState, type ViewportSize, anchoredCenter } from "./Camera";
import type { Point } from "../math/affine";

/**
 * Eases the camera toward a target, frame by frame.
 *
 * Exponential approach rather than a fixed-duration tween: a new target mid-flight
 * (another wheel notch, another key press) simply re-aims, with no restart and no
 * discontinuity in velocity. Zoom interpolates in log space so each frame is the same
 * *ratio* of change, which is how a zoom reads to the eye.
 *
 * An anchored target ("zoom about this point") recomputes the center every frame so the
 * anchor holds still on screen throughout, not just once the animation lands.
 */
export interface CameraTarget {
  state: CameraState;
  /** World point to pin under `anchor.screen` while zoom changes. */
  anchor?: { world: Point; screen: Point };
}

/** Seconds for the remaining distance to shrink by a factor of e. */
const DEFAULT_TIME_CONSTANT = 0.09;
const ZOOM_EPSILON = 1e-4;
const PIXEL_EPSILON = 0.05;
const ROTATION_EPSILON = 1e-4;

export class CameraAnimator {
  current: CameraState;
  private target: CameraTarget | null = null;
  private timeConstant: number;

  constructor(initial: CameraState, timeConstant = DEFAULT_TIME_CONSTANT) {
    this.current = { ...initial };
    this.timeConstant = timeConstant;
  }

  /** The state the camera is heading to (or at, when idle). */
  get destination(): CameraState {
    return this.target ? { ...this.target.state } : { ...this.current };
  }

  /** Jump, canceling any animation. Used by drags, which must track the pointer 1:1. */
  set(state: CameraState): void {
    this.current = { ...state };
    this.target = null;
  }

  animateTo(
    target: CameraTarget,
    viewport: ViewportSize,
    immediate = false,
  ): void {
    if (immediate || this.timeConstant === 0) {
      this.set(target.state);
      return;
    }

    /*
     * An anchor is only honored if it agrees with the target. When the caller clamped
     * the target center (zooming out past the edge of the world), the anchored path
     * would land somewhere other than the target and never settle — so fall back to a
     * plain center interpolation instead.
     */
    let anchor = target.anchor;
    if (anchor) {
      const landing = anchoredCenter(
        anchor.world,
        anchor.screen,
        target.state.zoom,
        target.state.rotation,
        viewport,
      );
      const miss =
        Math.hypot(landing.x - target.state.x, landing.y - target.state.y) *
        target.state.zoom;
      if (miss > PIXEL_EPSILON) anchor = undefined;
    }

    this.target = { state: { ...target.state }, anchor };
  }

  stop(): void {
    this.target = null;
  }

  /**
   * Advance by `dt` seconds. Returns true while still moving, so the frame loop knows to
   * keep ticking.
   */
  step(dt: number, viewport: ViewportSize): boolean {
    const target = this.target;
    if (!target) return false;

    const k = 1 - Math.exp(-Math.max(dt, 0) / this.timeConstant);
    const from = this.current;
    const to = target.state;

    const zoom = Math.exp(
      Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k,
    );
    const rotation = from.rotation + (to.rotation - from.rotation) * k;

    let center: Point;
    if (target.anchor) {
      center = anchoredCenter(
        target.anchor.world,
        target.anchor.screen,
        zoom,
        rotation,
        viewport,
      );
    } else {
      center = {
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
      };
    }

    this.current = { x: center.x, y: center.y, zoom, rotation };

    const settled =
      Math.abs(Math.log(to.zoom / zoom)) < ZOOM_EPSILON &&
      Math.abs(to.rotation - rotation) < ROTATION_EPSILON &&
      Math.hypot(to.x - center.x, to.y - center.y) * zoom < PIXEL_EPSILON;

    if (settled) {
      this.current = { ...to };
      this.target = null;
      return false;
    }
    return true;
  }
}
