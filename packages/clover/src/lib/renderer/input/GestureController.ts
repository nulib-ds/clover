import {
  DOUBLE_TAP_SLOP,
  TAP_MS,
  TAP_SLOP,
  holdTwoFingers,
  isDirect,
  isHovering,
  isInteractive,
  pageMayPan,
  scrollsWithin,
  wheelZooms,
} from "../../pointer";
import { getFullscreenElement } from "../../fullscreen";
import type { Point } from "../math/affine";

/** What gestures drive. Screen coordinates are CSS pixels relative to the Body. */
export interface GestureTarget {
  /** Move the content by `dx, dy` (drag semantics). */
  panBy(dx: number, dy: number, animate: boolean): void;
  /** Zoom by `factor` about `at`, or the viewport center. */
  zoomBy(factor: number, at: Point | undefined, animate: boolean): void;
  home(): void;
  /** The view is zoomed in as far as it goes. */
  atMaxZoom(): boolean;
  rotateBy(degrees: number): void;
  /** A pointer is down (true) or the last one lifted (false). */
  setInteracting(interacting: boolean): void;
  /** A mouse click that is not a zoom (click-to-zoom is off): video toggles playback. */
  tap(at: Point): void;
  /**
   * A tap or click off every control and hotspot: whether it put something away (a
   * picked annotation). If it did, the tap does nothing more: no zoom, no `tap`.
   */
  dismiss(): boolean;
  /** A gesture `cooperative` left to the page: one finger's drag. */
  hint(kind: GestureHintKind): void;
}

/**
 * What a hint says how to do: a finger's alone, on a touch screen. A plain wheel left to
 * the page says nothing (Mat, 2026-11-23: "scroll to zoom overlay should only show on
 * mobile").
 */
export type GestureHintKind = "touch";

export interface GestureOptions {
  /**
   * A mouse click zooms in; with Shift, out. With this or `dblClickToZoom`, a double tap
   * (a finger, or a pen that does not hover) zooms in.
   */
  clickToZoom: boolean;
  /** A double click zooms in. Only consulted when `clickToZoom` is off. */
  dblClickToZoom: boolean;
  pinchToZoom: boolean;
  /**
   * Plain wheel zooms. Off by default, matching Clover's OpenSeadragon setting, so an
   * embedded viewer never swallows page scroll. A trackpad pinch (a wheel event with
   * `ctrlKey`) always zooms the image, since it is never a page scroll.
   */
  scrollToZoom: boolean;
  /**
   * The page keeps its own gestures, as an embedded Google map does, and as the Map and
   * the Scene do: one finger's drag scrolls the page, and a hint says to use two (`hint`).
   * A mouse's drag still pans, and a plain wheel scrolls the page, as it does without.
   * In full screen, with no page to scroll, the wheel and a finger's drag are the view's.
   * `scrollToZoom` still lets a plain wheel zoom. On by default; off, a finger's drag pans.
   */
  cooperative: boolean;
  /**
   * The reader may move the camera at all: drag, pinch, wheel, double-click and keys.
   * Off, the view stays where the host puts it and only taps are reported (a lone video
   * or sound, always fitted to the Body).
   */
  navigable: boolean;
  /**
   * A mouse or pen drag tracks the pointer 1:1 and glides on after a fast release. Off,
   * the drag is eased instead and stops where the pointer does. A finger always tracks 1:1 and flicks.
   */
  flickEnabled: boolean;
  /** Release speed, px/s, below which a drag does not flick. */
  flickMinSpeed: number;
  /** Seconds of release velocity the flick travels. */
  flickMomentum: number;
}

export const DEFAULT_GESTURES: GestureOptions = {
  clickToZoom: true,
  dblClickToZoom: true,
  pinchToZoom: true,
  scrollToZoom: false,
  cooperative: true,
  navigable: true,
  flickEnabled: true,
  flickMinSpeed: 200,
  flickMomentum: 0.25,
};

const CLICK_ZOOM = 2;
const KEY_ZOOM = 1.5;
const KEY_PAN_FRACTION = 0.1;
const VELOCITY_WINDOW_MS = 100;
/** One wheel "line" of zoom: e^(−deltaY × rate). */
const WHEEL_ZOOM_RATE = 0.002;
const PINCH_WHEEL_ZOOM_RATE = 0.01;
/** A wheel delta, px, past which a Ctrl wheel is a mouse's notch, not a trackpad's pinch. */
const PINCH_MOST = 50;

interface Sample {
  x: number;
  y: number;
  t: number;
}

/** Whether a press landed on the picture's text, which is selected, not dragged. */
const onText = (event: Event) =>
  Boolean((event.target as Element).closest("[data-clover-canvas-text]"));

/**
 * Pointer, wheel and keyboard input on the Body, turned into camera intents.
 *
 * Pointer events cover mouse, pen and touch alike. The Body's viewport sets
 * `touch-action: none` so the browser hands pinch and drag over rather than scrolling or
 * zooming the page; cooperative, as it is by default, `pan-x pan-y`, so a finger's drag
 * scrolls the page and two fingers are the view's (`holdTwoFingers`).
 */
export class GestureController {
  private pointers = new Map<number, Point>();
  private samples: Sample[] = [];
  private down: { x: number; y: number; t: number; moved: boolean } | null =
    null;
  private pinch: { distance: number; mid: Point } | null = null;
  private lastTap: Sample | null = null;
  private lastPointerType = "";
  /** A pen has hovered over the Body, so pens here are pointed as a mouse is. */
  private penHovers = false;
  /** Two pointers have been down in this gesture: its last finger is a pinch's, not a scroll. */
  private pinched = false;
  /**
   * Two fingers came down, and have not moved since (nor the one left after the first
   * lifts): lifted soon, they are a tap, which zooms out, as a double tap zooms in.
   */
  private twoTap: {
    t: number;
    mid: Point;
    distance: number;
    left?: Point;
  } | null = null;
  private releaseTwoFingers: () => void;

  constructor(
    private readonly element: HTMLElement,
    private readonly target: GestureTarget,
    private options: GestureOptions = DEFAULT_GESTURES,
  ) {
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("dblclick", this.onDoubleClick);
    element.addEventListener("wheel", this.onWheel, { passive: false });
    element.addEventListener("keydown", this.onKeyDown);
    this.releaseTwoFingers = holdTwoFingers(element, () => this.cooperating());
    this.markCooperative();
  }

  setOptions(options: GestureOptions): void {
    this.options = options;
    this.markCooperative();
  }

  // Lets a finger's drag through to the page (`Canvas.css`).
  private markCooperative() {
    this.element.toggleAttribute(
      "data-cooperative",
      this.options.cooperative && this.options.navigable,
    );
  }

  private fullscreen(): boolean {
    return Boolean(getFullscreenElement()?.contains(this.element));
  }

  /** A drag the page takes: a finger's, or a pen's that does not hover, where cooperative. */
  private leftToPage(pointerType: string): boolean {
    return isDirect(pointerType, this.penHovers) && this.cooperating();
  }

  private cooperating(): boolean {
    if (!this.options.cooperative || !this.options.navigable) return false;
    return !this.fullscreen() && pageMayPan(this.element);
  }

  dispose(): void {
    const el = this.element;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("dblclick", this.onDoubleClick);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("keydown", this.onKeyDown);
    this.releaseTwoFingers();
    el.removeAttribute("data-cooperative");
  }

  private local(event: { clientX: number; clientY: number }): Point {
    const rect = this.element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private onPointerDown = (event: PointerEvent) => {
    this.lastPointerType = event.pointerType;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Controls and overlays inside the Body handle their own clicks.
    if (isInteractive(event.target, this.element)) return;
    /*
     * A mouse or a hovering pen on the picture's text (`Canvas/TextLayer.tsx`) selects it,
     * as in a PDF; a finger still pans over it, as a press and hold selects it there.
     */
    if (!isDirect(event.pointerType, this.penHovers) && onText(event)) return;

    this.element.setPointerCapture?.(event.pointerId);
    const p = this.local(event);
    this.pointers.set(event.pointerId, p);

    if (this.pointers.size === 1) {
      this.down = { x: p.x, y: p.y, t: event.timeStamp, moved: false };
      this.samples = [{ x: p.x, y: p.y, t: event.timeStamp }];
      this.twoTap = null;
      this.target.setInteracting(true);
    } else if (this.pointers.size === 2) {
      this.pinch = this.pinchState();
      // Two fingers, both soon after the first: a tap of two, if they lift as soon.
      this.twoTap =
        !this.pinched &&
        isDirect(event.pointerType, this.penHovers) &&
        this.down &&
        event.timeStamp - this.down.t < TAP_MS
          ? { t: event.timeStamp, ...this.pinch }
          : null;
      this.pinched = true;
      if (this.down) this.down.moved = true;
    } else {
      this.twoTap = null;
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (isHovering(event)) this.penHovers = true;
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const p = this.local(event);
    this.pointers.set(event.pointerId, p);

    if (this.pointers.size === 1) {
      const dx = p.x - previous.x;
      const dy = p.y - previous.y;
      const left = this.twoTap?.left;
      if (left && Math.hypot(p.x - left.x, p.y - left.y) > TAP_SLOP)
        this.twoTap = null;
      if (
        this.down &&
        Math.hypot(p.x - this.down.x, p.y - this.down.y) > TAP_SLOP
      ) {
        this.down.moved = true;
      }
      if (this.down?.moved && this.leftToPage(event.pointerType)) {
        if (!this.pinched) this.target.hint("touch");
      } else if (this.down?.moved && this.options.navigable) {
        this.target.panBy(dx, dy, !this.tracksPointer(event.pointerType));
      }
      this.samples.push({ x: p.x, y: p.y, t: event.timeStamp });
      const cutoff = event.timeStamp - VELOCITY_WINDOW_MS;
      while (this.samples.length > 2 && this.samples[0].t < cutoff) {
        this.samples.shift();
      }
    } else if (
      this.pointers.size === 2 &&
      this.pinch &&
      this.options.navigable
    ) {
      const next = this.pinchState();
      const tap = this.twoTap;
      if (
        tap &&
        (Math.abs(next.distance - tap.distance) > TAP_SLOP ||
          Math.hypot(next.mid.x - tap.mid.x, next.mid.y - tap.mid.y) > TAP_SLOP)
      )
        this.twoTap = null;
      if (this.options.pinchToZoom && this.pinch.distance > 0) {
        this.target.zoomBy(
          next.distance / this.pinch.distance,
          next.mid,
          false,
        );
      }
      this.target.panBy(
        next.mid.x - this.pinch.mid.x,
        next.mid.y - this.pinch.mid.y,
        false,
      );
      this.pinch = next;
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    this.element.releasePointerCapture?.(event.pointerId);

    if (this.pointers.size === 1) {
      // Pinch → drag: carry on panning from the remaining finger, without a jump, unless
      // cooperative leaves one finger to the page.
      this.pinch = null;
      const [remaining] = this.pointers.values();
      this.samples = [{ ...remaining, t: event.timeStamp }];
      if (this.twoTap) this.twoTap.left = remaining;
      return;
    }
    if (this.pointers.size > 0) return;

    const down = this.down;
    const pinched = this.pinched;
    const twoTap = this.twoTap;
    this.down = null;
    this.pinch = null;
    this.pinched = false;
    this.twoTap = null;
    this.target.setInteracting(false);
    if (!down) return;

    /*
     * Two fingers' tap zooms out, about the middle of them, as on a map: a double tap's
     * way back, where its zoom in does (WCAG 2.5.1 keeps a single pointer's: the controls,
     * and a double tap, which goes home from as far in as the view goes).
     */
    if (
      twoTap &&
      event.type === "pointerup" &&
      event.timeStamp - twoTap.t < TAP_MS &&
      this.options.navigable &&
      (this.options.clickToZoom || this.options.dblClickToZoom)
    ) {
      this.lastTap = null;
      this.target.zoomBy(1 / CLICK_ZOOM, twoTap.mid, true);
      return;
    }

    const p = this.local(event);
    const isTap =
      !down.moved &&
      event.type === "pointerup" &&
      event.timeStamp - down.t < TAP_MS;

    if (isTap) {
      // Off a picked annotation, the first tap lets it go and does nothing else.
      if (this.target.dismiss()) {
        this.lastTap = null;
        return;
      }
      if (isDirect(event.pointerType, this.penHovers)) {
        /*
         * A finger, or a pen that does not hover, follows OpenSeadragon's touch defaults:
         * a single tap does nothing here (it shows or hides the controls,
         * `useControlsVisibility`) and a double tap zooms in, unless the host has turned
         * both click zooms off. A pen that hovers clicks as a mouse does.
         */
        const last = this.lastTap;
        if (
          this.options.navigable &&
          (this.options.clickToZoom || this.options.dblClickToZoom) &&
          last &&
          event.timeStamp - last.t < TAP_MS &&
          Math.hypot(p.x - last.x, p.y - last.y) < DOUBLE_TAP_SLOP
        ) {
          this.lastTap = null;
          this.zoomIn(p);
        } else {
          this.lastTap = { x: p.x, y: p.y, t: event.timeStamp };
        }
        return;
      }
      if (this.options.clickToZoom && this.options.navigable) {
        if (event.shiftKey) this.target.zoomBy(1 / CLICK_ZOOM, p, true);
        else this.zoomIn(p);
      } else {
        this.target.tap(p);
      }
      return;
    }

    if (!this.options.navigable || !this.tracksPointer(event.pointerType)) {
      return;
    }
    // A drag the browser took over (to scroll the page) is the page's: no fling after it.
    if (event.type === "pointercancel") {
      if (this.leftToPage(event.pointerType) && !pinched)
        this.target.hint("touch");
      return;
    }
    if (this.leftToPage(event.pointerType)) return;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const span = (last?.t ?? 0) - (first?.t ?? 0);
    if (first && last && span > 0 && event.timeStamp - last.t < 50) {
      const vx = ((last.x - first.x) / span) * 1000;
      const vy = ((last.y - first.y) / span) * 1000;
      const momentum = this.options.flickMomentum;
      if (momentum > 0 && Math.hypot(vx, vy) > this.options.flickMinSpeed)
        this.target.panBy(vx * momentum, vy * momentum, true);
    }
  };

  private onDoubleClick = (event: MouseEvent) => {
    if (!this.options.navigable) return;
    if (this.options.clickToZoom || !this.options.dblClickToZoom) return;
    // Double taps are handled on pointerup; this is the synthesized echo.
    if (isDirect(this.lastPointerType, this.penHovers)) return;
    if (isInteractive(event.target, this.element)) return;
    // A double click on the picture's text selects a word, as a page's does.
    if (onText(event)) return;
    if (event.shiftKey)
      this.target.zoomBy(1 / CLICK_ZOOM, this.local(event), true);
    else this.zoomIn(this.local(event));
  };

  /**
   * A pointer's zoom in: a click, a double click or a double tap. Zoomed in as far as it
   * goes, it goes home instead, so one pointer can always zoom back out, whichever
   * controls the host shows (WCAG 2.5.1).
   */
  private zoomIn(at: Point) {
    if (this.target.atMaxZoom()) this.target.home();
    else this.target.zoomBy(CLICK_ZOOM, at, true);
  }

  private onWheel = (event: WheelEvent) => {
    if (!this.options.navigable) return;
    const delta = normalizeWheel(event);
    /*
     * A trackpad's pinch comes as a wheel with `ctrlKey` and small, fractional deltas; a
     * mouse's wheel held with Ctrl or ⌘ comes in notches, and zooms as a plain wheel does.
     */
    const pinch =
      event.ctrlKey && event.deltaMode === 0 && Math.abs(delta) < PINCH_MOST;
    const held = event.ctrlKey || event.metaKey;
    // As over the Map and the Scene (`wheelZooms`); else the page's.
    if (
      !wheelZooms(event, {
        scrollZoom: this.options.scrollToZoom,
        cooperative: this.options.cooperative,
        fullscreen: this.fullscreen(),
      })
    )
      return;
    // A box in the Body that scrolls that way (a hotspot's long Tip) scrolls, not zooms.
    if (!held && scrollsWithin(event.target, this.element, event.deltaY))
      return;
    event.preventDefault();
    const rate = pinch ? PINCH_WHEEL_ZOOM_RATE : WHEEL_ZOOM_RATE;
    this.target.zoomBy(Math.exp(-delta * rate), this.local(event), !pinch);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== this.element || !this.options.navigable) return;
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const rect = this.element.getBoundingClientRect();
    const stepX = rect.width * KEY_PAN_FRACTION * (event.shiftKey ? 3 : 1);
    const stepY = rect.height * KEY_PAN_FRACTION * (event.shiftKey ? 3 : 1);

    switch (event.key) {
      case "ArrowLeft":
        this.target.panBy(stepX, 0, true);
        break;
      case "ArrowRight":
        this.target.panBy(-stepX, 0, true);
        break;
      case "ArrowUp":
        this.target.panBy(0, stepY, true);
        break;
      case "ArrowDown":
        this.target.panBy(0, -stepY, true);
        break;
      case "+":
      case "=":
        this.target.zoomBy(KEY_ZOOM, undefined, true);
        break;
      case "-":
      case "_":
        this.target.zoomBy(1 / KEY_ZOOM, undefined, true);
        break;
      case "0":
        this.target.home();
        break;
      case "r":
        this.target.rotateBy(90);
        break;
      case "R":
        this.target.rotateBy(-90);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** A drag that follows the pointer exactly, and so may flick on release. */
  private tracksPointer(pointerType: string): boolean {
    return pointerType === "touch" || this.options.flickEnabled;
  }

  private pinchState(): { distance: number; mid: Point } {
    const [a, b] = [...this.pointers.values()];
    return {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }
}

/** Wheel delta in pixels, whatever unit the device reported. */
function normalizeWheel(event: WheelEvent): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * 400;
  return event.deltaY;
}
