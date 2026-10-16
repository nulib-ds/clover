import type { Point } from "../math/affine";

/** What gestures drive. Screen coordinates are CSS pixels relative to the stage. */
export interface GestureTarget {
  /** Move the content by `dx, dy` (drag semantics). */
  panBy(dx: number, dy: number, animate: boolean): void;
  /** Zoom by `factor` about `at`, or the viewport centre. */
  zoomBy(factor: number, at: Point | undefined, animate: boolean): void;
  /** Continue a released drag at `vx, vy` px/s. */
  flick(vx: number, vy: number): void;
  home(): void;
  /** The view is zoomed in as far as it goes. */
  atMaxZoom?(): boolean;
  rotateBy(degrees: number): void;
  /** A pointer is down. The camera tracks it 1:1, so any animation is cancelled. */
  setInteracting(interacting: boolean): void;
  /** A mouse click that is not a zoom (click-to-zoom is off): video toggles playback. */
  tap?(at: Point): void;
}

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
   * The reader may move the camera at all: drag, pinch, wheel, double-click and keys.
   * Off, the view stays where the host puts it and only taps are reported (a lone video
   * or sound, always fitted to the stage).
   */
  navigable: boolean;
}

export const DEFAULT_GESTURES: GestureOptions = {
  clickToZoom: true,
  dblClickToZoom: true,
  pinchToZoom: true,
  scrollToZoom: false,
  navigable: true,
};

/** How far a press may move, in CSS pixels, and still be a tap. */
export const TAP_SLOP = 5;
/** How long a tap may take, and the most time between the two of a double tap. */
export const TAP_MS = 300;
/** How far apart the two taps of a double tap may land. */
export const DOUBLE_TAP_SLOP = TAP_SLOP * 4;
const CLICK_ZOOM = 2;
const KEY_ZOOM = 1.5;
const KEY_PAN_FRACTION = 0.1;
const VELOCITY_WINDOW_MS = 100;
const MIN_FLICK_SPEED = 200;
/** One wheel "line" of zoom: e^(−deltaY × rate). */
const WHEEL_ZOOM_RATE = 0.002;
const PINCH_WHEEL_ZOOM_RATE = 0.01;

interface Sample {
  x: number;
  y: number;
  t: number;
}

/**
 * Pointer, wheel and keyboard input on the stage, turned into camera intents.
 *
 * Pointer events cover mouse, pen and touch alike. The stage sets `touch-action: none`
 * so the browser hands pinch and drag over rather than scrolling or zooming the page.
 */
export class GestureController {
  private pointers = new Map<number, Point>();
  private samples: Sample[] = [];
  private down: { x: number; y: number; t: number; moved: boolean } | null =
    null;
  private pinch: { distance: number; mid: Point } | null = null;
  private lastTap: Sample | null = null;
  private lastPointerType = "";
  /** A pen has hovered over the stage, so pens here are pointed as a mouse is. */
  private penHovers = false;

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
  }

  setOptions(options: GestureOptions): void {
    this.options = options;
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
  }

  private local(event: { clientX: number; clientY: number }): Point {
    const rect = this.element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private onPointerDown = (event: PointerEvent) => {
    this.lastPointerType = event.pointerType;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Controls and overlays inside the stage handle their own clicks.
    if (isInteractive(event.target, this.element)) return;

    this.element.setPointerCapture?.(event.pointerId);
    const p = this.local(event);
    this.pointers.set(event.pointerId, p);

    if (this.pointers.size === 1) {
      this.down = { x: p.x, y: p.y, t: event.timeStamp, moved: false };
      this.samples = [{ x: p.x, y: p.y, t: event.timeStamp }];
      this.target.setInteracting(true);
    } else if (this.pointers.size === 2) {
      this.pinch = this.pinchState();
      if (this.down) this.down.moved = true;
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
      if (
        this.down &&
        Math.hypot(p.x - this.down.x, p.y - this.down.y) > TAP_SLOP
      ) {
        this.down.moved = true;
      }
      if (this.down?.moved && this.options.navigable) {
        this.target.panBy(dx, dy, false);
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
      // Pinch → drag: carry on panning from the remaining finger, without a jump.
      this.pinch = null;
      const [remaining] = this.pointers.values();
      this.samples = [{ ...remaining, t: event.timeStamp }];
      return;
    }
    if (this.pointers.size > 0) return;

    const down = this.down;
    this.down = null;
    this.pinch = null;
    this.target.setInteracting(false);
    if (!down) return;

    const p = this.local(event);
    const isTap =
      !down.moved &&
      event.type === "pointerup" &&
      event.timeStamp - down.t < TAP_MS;

    if (isTap) {
      if (isDirect(event.pointerType, this.penHovers)) {
        /*
         * A finger, or a pen that does not hover, follows OpenSeadragon's touch defaults:
         * a single tap does nothing here (it shows or hides the chrome,
         * `useChromeVisibility`) and a double tap zooms in, unless the host has turned
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
        this.target.tap?.(p);
      }
      return;
    }

    if (!this.options.navigable) return;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const span = (last?.t ?? 0) - (first?.t ?? 0);
    if (first && last && span > 0 && event.timeStamp - last.t < 50) {
      const vx = ((last.x - first.x) / span) * 1000;
      const vy = ((last.y - first.y) / span) * 1000;
      if (Math.hypot(vx, vy) > MIN_FLICK_SPEED) this.target.flick(vx, vy);
    }
  };

  private onDoubleClick = (event: MouseEvent) => {
    if (!this.options.navigable) return;
    if (this.options.clickToZoom || !this.options.dblClickToZoom) return;
    // Double taps are handled on pointerup; this is the synthesized echo.
    if (isDirect(this.lastPointerType, this.penHovers)) return;
    if (isInteractive(event.target, this.element)) return;
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
    if (this.target.atMaxZoom?.()) this.target.home();
    else this.target.zoomBy(CLICK_ZOOM, at, true);
  }

  private onWheel = (event: WheelEvent) => {
    const pinch = event.ctrlKey;
    if (!this.options.navigable) return;
    if (!pinch && !this.options.scrollToZoom) return;
    // A box in the stage that scrolls that way (a long hotspot note) scrolls, not zooms.
    if (!pinch && scrollsWithin(event.target, this.element, event.deltaY))
      return;
    event.preventDefault();
    const delta = normalizeWheel(event);
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

/**
 * A finger, or a pen: pointers pressed on the screen itself, with no hover to rely on. A
 * pen that has been seen to hover (`hovers`, from `isHovering`) is pointed as a mouse is.
 */
export function isDirect(
  pointerType: string | undefined,
  hovers = false,
): boolean {
  return pointerType === "touch" || (pointerType === "pen" && !hovers);
}

/** A pen moving over the screen without touching it, as a desktop tablet's does. */
export function isHovering(event: PointerEvent): boolean {
  return event.pointerType === "pen" && event.buttons === 0;
}

/** Whether a box between `target` and `stage` can scroll further down (or up). */
export function scrollsWithin(
  target: EventTarget | null,
  stage: HTMLElement,
  deltaY: number,
): boolean {
  for (
    let node = target as HTMLElement | null;
    node && node !== stage;
    node = node.parentElement
  ) {
    // Room that way: below for a wheel down, above for one up.
    const room =
      deltaY > 0
        ? node.scrollHeight - node.clientHeight - node.scrollTop
        : node.scrollTop;
    if (room >= 1 && /auto|scroll/.test(getComputedStyle(node).overflowY))
      return true;
  }
  return false;
}

/** A control, link or overlay within `stage` that handles its own presses. */
export function isInteractive(
  target: EventTarget | null,
  stage: HTMLElement,
): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== stage) {
    if (
      node instanceof HTMLButtonElement ||
      node instanceof HTMLAnchorElement ||
      node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement ||
      node.dataset?.cloverCanvasInteractive !== undefined
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}
