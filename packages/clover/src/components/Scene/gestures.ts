import { getFullscreenElement } from "../../lib/fullscreen";
import {
  DOUBLE_TAP_SLOP,
  TAP_MS,
  TAP_SLOP,
  holdTwoFingers,
  isDirect,
  isHovering,
  isInteractive,
  pageMayPan,
  wheelZooms,
} from "../../lib/pointer";
import type { GestureHintKind } from "../../lib/renderer/input/GestureController";

/** What the Scene's gestures move: the camera, around the models. */
export interface OrbitInput {
  /** Turn by these radians: about the up axis, then from it. */
  turn(dTheta: number, dPhi: number): void;
  /** Come nearer by `factor` (over 1), or go back (under 1). */
  zoom(factor: number): void;
  /**
   * A double tap or double click comes a step nearer (`out` false), or home from as near
   * as it comes, so a single pointer can always go back out; two fingers' tap, or a double
   * click with Shift, a step back (`out`). Without it, neither does anything.
   */
  step?(out: boolean): void;
  /** A gesture the page kept (`cooperative`): one finger's drag. */
  hint?(kind: GestureHintKind): void;
}

export interface OrbitGestureOptions {
  /** The height a drag is measured against: the element's own unless given. */
  span?: () => number;
  /**
   * As a Canvas's `gestures.cooperative` and a Map's `cooperative`: one finger's drag is
   * the page's, and says to use two (`hint`), out of full screen, where a plain wheel
   * zooms too. A mouse's drag still turns. Off unless given (the rotate pad's disc).
   */
  cooperative?: boolean;
  /** A plain wheel zooms too, as a Canvas's `gestures.scrollToZoom`. */
  scrollToZoom?: boolean;
}

/** A drag the height of the Body turns the models around once, as three.js's orbit does. */
const TURN_PER_HEIGHT = 2 * Math.PI;
/** How far a trackpad's pinch (a wheel with Ctrl) zooms, per pixel of its delta. */
const WHEEL_ZOOM = 0.01;
/** A mouse's notch, held with Ctrl or ⌘, as a Canvas's: gentler than a pinch's pixels. */
const NOTCH_ZOOM = 0.002;
/** A wheel delta, px, past which a Ctrl wheel is a mouse's notch, not a trackpad's pinch. */
const PINCH_MOST = 50;

/** Wheel delta in pixels, whatever unit the device reported. */
const wheelPixels = (event: WheelEvent) =>
  event.deltaMode === 1
    ? event.deltaY * 16
    : event.deltaMode === 2
      ? event.deltaY * 400
      : event.deltaY;

type Point = { x: number; y: number };

/**
 * The Scene's pointer gestures, as a Canvas's and a Map's are (Mat, 2026-11-23: "gesture
 * parity across all cases"): one pointer's drag turns the models (dragged right, their
 * front turns right; down, their top comes forward); two fingers turn them by their
 * middle and pinch to zoom; a double tap or double click comes nearer, and two fingers'
 * tap goes back; a trackpad's pinch, or a wheel with Ctrl or ⌘, zooms (`wheelUse`).
 * Cooperative, one finger's drag and a plain wheel are the page's. Every one has a
 * control and a key that does the same without dragging (WCAG 2.5.1, 2.5.7). Returns the
 * way to stop.
 */
export function attachOrbitGestures(
  element: HTMLElement,
  input: OrbitInput,
  options: OrbitGestureOptions = {},
): () => void {
  const span = options.span ?? (() => element.clientHeight);
  const cooperative = Boolean(options.cooperative);
  const pointers = new Map<number, Point>();
  let spread = 0;
  let middle: Point = { x: 0, y: 0 };
  /** Whether the pointer has moved past a tap's slop, so the press is a drag. */
  let dragging = false;
  let start: Point = { x: 0, y: 0 };
  let downAt = 0;
  /** Two fingers have been down in this gesture: its last finger is a pinch's. */
  let pinched = false;
  /** Two fingers down at once, unmoved: lifted soon, a tap of two. */
  let twoTap: { t: number; spread: number; middle: Point } | null = null;
  let lastTap: (Point & { t: number }) | null = null;
  let lastPointerType = "";
  /** A pen has hovered here, so pens are pointed as a mouse is. */
  let penHovers = false;

  const fullscreen = () => Boolean(getFullscreenElement()?.contains(element));
  /** Cooperative, where the page may take a finger's drag (`pageMayPan`). */
  const cooperating = () => cooperative && !fullscreen() && pageMayPan(element);
  /** A drag the page takes: a finger's, or a pen's that does not hover. */
  const leftToPage = (pointerType: string) =>
    isDirect(pointerType, penHovers) && cooperating();

  const two = () => [...pointers.values()];
  const apart = () => {
    const [a, b] = two();
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const between = (): Point => {
    const [a, b] = two();
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : middle;
  };
  const turnBy = (dx: number, dy: number) => {
    const height = span() || 1;
    input.turn(
      (-dx / height) * TURN_PER_HEIGHT,
      (-dy / height) * TURN_PER_HEIGHT,
    );
  };

  const down = (event: PointerEvent) => {
    lastPointerType = event.pointerType;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isInteractive(event.target, element)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer cannot be captured; the drag still reads its moves.
    }
    if (pointers.size === 1) {
      dragging = false;
      pinched = false;
      twoTap = null;
      start = { x: event.clientX, y: event.clientY };
      downAt = event.timeStamp;
    } else if (pointers.size === 2) {
      spread = apart();
      middle = between();
      twoTap =
        !pinched &&
        isDirect(event.pointerType, penHovers) &&
        event.timeStamp - downAt < TAP_MS
          ? { t: event.timeStamp, spread, middle }
          : null;
      pinched = true;
    } else {
      twoTap = null;
    }
  };

  const move = (event: PointerEvent) => {
    if (isHovering(event)) penHovers = true;
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const now = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, now);
    if (pointers.size === 2) {
      const next = apart();
      const nextMiddle = between();
      if (
        twoTap &&
        (Math.abs(next - twoTap.spread) > TAP_SLOP ||
          Math.hypot(
            nextMiddle.x - twoTap.middle.x,
            nextMiddle.y - twoTap.middle.y,
          ) > TAP_SLOP)
      )
        twoTap = null;
      if (spread > 0 && next > 0) input.zoom(next / spread);
      turnBy(nextMiddle.x - middle.x, nextMiddle.y - middle.y);
      spread = next;
      middle = nextMiddle;
      return;
    }
    if (pointers.size > 2) return;
    if (!dragging) {
      if (Math.hypot(now.x - start.x, now.y - start.y) < TAP_SLOP) return;
      dragging = true;
      twoTap = null;
    }
    // Cooperative, the page scrolls under a finger: said, unless it is a pinch's last.
    if (leftToPage(event.pointerType)) {
      if (!pinched) input.hint?.("touch");
      return;
    }
    turnBy(now.x - last.x, now.y - last.y);
  };

  const up = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      // Two to one: the one left moves on from where it is, past a tap's slop.
      const [left] = two();
      start = left;
      dragging = false;
      spread = 0;
      return;
    }
    if (pointers.size > 0) return;
    const tap = twoTap;
    const wasPinch = pinched;
    const dragged = dragging;
    twoTap = null;
    pinched = false;
    dragging = false;
    spread = 0;
    if (event.type === "pointercancel") {
      // The browser took a finger's drag to scroll the page.
      if (leftToPage(event.pointerType) && !wasPinch) input.hint?.("touch");
      return;
    }
    if (tap && event.timeStamp - tap.t < TAP_MS) {
      lastTap = null;
      input.step?.(true);
      return;
    }
    // A finger's double tap; a mouse's double click is its own event (`dblclick`).
    if (
      dragged ||
      wasPinch ||
      !isDirect(event.pointerType, penHovers) ||
      event.timeStamp - downAt >= TAP_MS
    )
      return;
    const at = { x: event.clientX, y: event.clientY };
    if (
      lastTap &&
      event.timeStamp - lastTap.t < TAP_MS &&
      Math.hypot(at.x - lastTap.x, at.y - lastTap.y) < DOUBLE_TAP_SLOP
    ) {
      lastTap = null;
      input.step?.(false);
    } else lastTap = { ...at, t: event.timeStamp };
  };

  const doubleClick = (event: MouseEvent) => {
    // A double tap's echo, handled as the taps lifted.
    if (isDirect(lastPointerType, penHovers)) return;
    if (isInteractive(event.target, element)) return;
    input.step?.(event.shiftKey);
  };

  const wheel = (event: WheelEvent) => {
    const zooms = wheelZooms(event, {
      scrollZoom: Boolean(options.scrollToZoom),
      cooperative,
      fullscreen: fullscreen(),
    });
    if (!zooms) return;
    event.preventDefault();
    const pixels = wheelPixels(event);
    const pinch =
      event.ctrlKey && event.deltaMode === 0 && Math.abs(pixels) < PINCH_MOST;
    input.zoom(Math.exp(-pixels * (pinch ? WHEEL_ZOOM : NOTCH_ZOOM)));
  };

  // One finger's drag the page's (`Canvas.css`), two kept from it.
  element.toggleAttribute("data-cooperative", cooperative);
  const releaseTwoFingers = holdTwoFingers(element, cooperating);
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", up);
  element.addEventListener("dblclick", doubleClick);
  element.addEventListener("wheel", wheel, { passive: false });
  return () => {
    releaseTwoFingers();
    element.removeAttribute("data-cooperative");
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointercancel", up);
    element.removeEventListener("dblclick", doubleClick);
    element.removeEventListener("wheel", wheel);
  };
}
