import type React from "react";

import type { DragToCloseOptions } from "./useDragToClose";

/** How far, as a share of its width, a pane must be dragged to close when let go. */
const CLOSE_SHARE = 1 / 3;
/** A flick this fast toward the edge closes it however short, in pixels a millisecond. */
const FLICK = 0.5;
/** Movement before a press is read as a drag one way or the other, in pixels. */
const SLOP = 8;
const SPRING = "translate 240ms cubic-bezier(0.16, 1, 0.3, 1)";

type Latest = React.RefObject<
  Required<Omit<DragToCloseOptions, "scrim" | "alongside">> &
    Pick<DragToCloseOptions, "scrim" | "alongside">
>;

/**
 * The drag itself (`useDragToClose`), its own chunk: loaded the first time a pane floats
 * over the page, so a layout wide enough for its panes beside the page never loads it.
 * Attached while the pane can be dragged; returns what detaches it.
 */
export function attach(element: HTMLElement, latest: Latest): () => void {
  let id: number | null = null;
  let state: "idle" | "pending" | "drag" | "scroll" = "idle";
  let startX = 0;
  let startY = 0;
  let offset = 0;
  let width = 1;
  let toward = 1;
  let samples: Array<[number, number]> = [];
  /** The pane, and what moves with it. */
  const moving = () => [element, latest.current.alongside?.current];

  const onDown = (event: PointerEvent) => {
    if (
      event.pointerType === "mouse" ||
      !event.isPrimary ||
      !latest.current.enabled
    )
      return;
    id = event.pointerId;
    state = "pending";
    startX = event.clientX;
    startY = event.clientY;
    offset = 0;
    width = element.getBoundingClientRect().width || 1;
    const rtl = getComputedStyle(element).direction === "rtl";
    // The way it closes: toward its own edge, mirrored in a right-to-left page.
    toward = (latest.current.side === "end") !== rtl ? 1 : -1;
    samples = [[event.timeStamp, 0]];
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== id || state === "idle" || state === "scroll")
      return;
    const dx = (event.clientX - startX) * toward;
    const dy = event.clientY - startY;
    if (state === "pending") {
      if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) {
        state = "scroll";
        return;
      }
      if (dx < SLOP) return;
      state = "drag";
      // Kept on the pane past its edge where it can be; a pointer already gone cannot be.
      try {
        element.setPointerCapture?.(event.pointerId);
      } catch {
        // The drag goes on without it.
      }
      move(moving(), undefined, "none");
    }
    offset = Math.max(0, dx);
    move(moving(), `${offset * toward}px 0`);
    const wash = latest.current.scrim?.current;
    if (wash) {
      wash.style.transition = "none";
      wash.style.opacity = String(1 - offset / width);
    }
    samples.push([event.timeStamp, offset]);
    if (samples.length > 5) samples.shift();
    event.preventDefault();
  };

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== id) return;
    const dragged = state === "drag";
    state = "idle";
    id = null;
    if (!dragged) return;
    // A drag is not a press: the click it ends with is swallowed.
    element.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => element.removeEventListener("click", swallow, true), 0);
    const [t0, x0] = samples[0];
    const [t1, x1] = samples[samples.length - 1];
    const speed = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
    const wash = latest.current.scrim?.current;
    if (offset > width * CLOSE_SHARE || speed > FLICK) {
      if (wash) {
        wash.style.transition = "opacity 240ms ease";
        wash.style.opacity = "0";
      }
      if (latest.current.exits) {
        // No slide of its own: it goes the rest of the way, then closes.
        move(moving(), `${width * toward}px 0`, "translate 200ms ease-out");
        setTimeout(() => latest.current.onClose(), 200);
        return;
      }
      // Close from where it was let go: the slide out carries on from there.
      move(moving(), undefined, "");
      latest.current.onClose();
      return;
    }
    move(moving(), "", SPRING);
    if (wash) {
      wash.style.transition = "opacity 240ms ease";
      wash.style.opacity = "";
    }
  };

  const swallow = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };

  element.addEventListener("pointerdown", onDown);
  element.addEventListener("pointermove", onMove, { passive: false });
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onUp);
  return () => {
    element.removeEventListener("pointerdown", onDown);
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onUp);
    element.removeEventListener("pointercancel", onUp);
  };
}

/** Opened again, or closed: whatever a drag left is cleared, so the pane slides in whole. */
export function reset(element: HTMLElement, latest: Latest): void {
  move([element, latest.current.alongside?.current], "", "");
  const wash = latest.current.scrim?.current;
  if (wash) {
    wash.style.opacity = "";
    wash.style.transition = "";
  }
}

/** Sets the `translate`, and the `transition`, of each element given that is there. */
function move(
  elements: Array<HTMLElement | null | undefined>,
  translate?: string,
  transition?: string,
) {
  for (const element of elements) {
    if (!element) continue;
    if (transition !== undefined) element.style.transition = transition;
    if (translate !== undefined) element.style.translate = translate;
  }
}
