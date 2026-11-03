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

/**
 * Reach each target in exactly `duration` seconds along `(1 − e^(−s·t)) / (1 − e^(−s))`,
 * `t` the fraction of the duration elapsed and `s` the stiffness. A new target restarts
 * the curve from where the camera is.
 */
export interface CameraSpring {
  duration: number;
  stiffness: number;
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
  private spring: CameraSpring | undefined;
  private start: CameraState;
  private elapsed = 0;

  constructor(
    initial: CameraState,
    timeConstant = DEFAULT_TIME_CONSTANT,
    spring?: CameraSpring,
  ) {
    this.current = { ...initial };
    this.start = { ...initial };
    this.timeConstant = timeConstant;
    this.spring = spring;
  }

  /** The state the camera is heading to (or at, when idle). */
  get destination(): CameraState {
    return this.target ? { ...this.target.state } : { ...this.current };
  }

  /** Jump, canceling any animation. Used by drags that track the pointer 1:1. */
  set(state: CameraState): void {
    this.current = { ...state };
    this.target = null;
  }

  animateTo(
    target: CameraTarget,
    viewport: ViewportSize,
    immediate = false,
  ): void {
    const off = this.spring
      ? this.spring.duration <= 0
      : this.timeConstant === 0;
    if (immediate || off) {
      this.set(target.state);
      return;
    }

    /*
     * An anchor is only honored if it agrees with the target. When the caller clamped
     * the target center (zooming out past the edge of the world), the anchored path
     * would land somewhere other than the target and never settle, so fall back to a
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

    this.start = { ...this.current };
    this.elapsed = 0;
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
    const to = target.state;

    let from: CameraState;
    let k: number;
    if (this.spring) {
      this.elapsed += Math.max(dt, 0);
      const t = this.elapsed / this.spring.duration;
      if (t >= 1) {
        this.current = { ...to };
        this.target = null;
        return false;
      }
      const s = this.spring.stiffness;
      from = this.start;
      k = (1 - Math.exp(-s * t)) / (1 - Math.exp(-s));
    } else {
      from = this.current;
      k = 1 - Math.exp(-Math.max(dt, 0) / this.timeConstant);
    }

    const zoom = Math.exp(
      Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k,
    );
    const rotation = from.rotation + (to.rotation - from.rotation) * k;
    const center = target.anchor
      ? anchoredCenter(
          target.anchor.world,
          target.anchor.screen,
          zoom,
          rotation,
          viewport,
        )
      : {
          x: from.x + (to.x - from.x) * k,
          y: from.y + (to.y - from.y) * k,
        };

    this.current = { x: center.x, y: center.y, zoom, rotation };
    if (this.spring) return true;

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
