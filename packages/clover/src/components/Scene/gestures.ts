import { TAP_SLOP, isInteractive } from "../../lib/pointer";

/** What the Scene's gestures move: the camera, around the models. */
export interface OrbitInput {
  /** Turn by these radians: about the up axis, then from it. */
  turn(dTheta: number, dPhi: number): void;
  /** Come nearer by `factor` (over 1), or go back (under 1). */
  zoom(factor: number): void;
}

/** A drag the height of the Body turns the models around once, as three.js's orbit does. */
const TURN_PER_HEIGHT = 2 * Math.PI;
/** How far a trackpad's pinch (a wheel with Ctrl) zooms, per pixel of its delta. */
const WHEEL_ZOOM = 0.01;

/** Wheel delta in pixels, whatever unit the device reported. */
const wheelPixels = (event: WheelEvent) =>
  event.deltaMode === 1
    ? event.deltaY * 16
    : event.deltaMode === 2
      ? event.deltaY * 400
      : event.deltaY;

/**
 * The Scene's pointer gestures on its viewport: one pointer's drag turns the models
 * (dragged right, their front turns right; down, their top comes forward), two fingers'
 * pinch zooms, and so does a trackpad's pinch (a wheel with Ctrl). A plain wheel is the
 * page's, as on a Canvas: it scrolls past. Every one has a control and a key that does
 * the same without dragging (WCAG 2.5.1, 2.5.7). Returns the way to stop.
 *
 * `span` is the height a drag is measured against, the element's own unless given: the
 * rotate pad's disc takes the Scene's, so a drag on it turns the models as one on the
 * Scene does.
 */
export function attachOrbitGestures(
  element: HTMLElement,
  input: OrbitInput,
  span: () => number = () => element.clientHeight,
): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let spread = 0;
  /** Whether the pointer has moved past a tap's slop, so the press is a drag. */
  let dragging = false;
  let start = { x: 0, y: 0 };

  const apart = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const down = (event: PointerEvent) => {
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
      start = { x: event.clientX, y: event.clientY };
    }
    if (pointers.size === 2) spread = apart();
  };

  const move = (event: PointerEvent) => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const now = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, now);
    if (pointers.size === 2) {
      const next = apart();
      if (spread > 0 && next > 0) input.zoom(next / spread);
      spread = next;
      return;
    }
    if (!dragging) {
      if (Math.hypot(now.x - start.x, now.y - start.y) < TAP_SLOP) return;
      dragging = true;
    }
    const height = span() || 1;
    input.turn(
      (-(now.x - last.x) / height) * TURN_PER_HEIGHT,
      (-(now.y - last.y) / height) * TURN_PER_HEIGHT,
    );
  };

  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    spread = pointers.size === 2 ? apart() : 0;
  };

  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    input.zoom(Math.exp(-wheelPixels(event) * WHEEL_ZOOM));
  };

  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", up);
  element.addEventListener("wheel", wheel, { passive: false });
  return () => {
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointercancel", up);
    element.removeEventListener("wheel", wheel);
  };
}
