import type React from "react";

import type { DragToCloseOptions } from "./useDragToClose";
import { SLIDE_MS } from "./useSlide";

/** How far, as a share of its width, a pane must be dragged to close when let go. */
const CLOSE_SHARE = 1 / 3;
/** A flick this fast toward the edge closes it however short, in pixels a millisecond. */
const FLICK = 0.5;
/** Movement before a press is read as a drag one way or the other, in pixels. */
const SLOP = 8;
const SPRING = "translate 240ms cubic-bezier(0.16, 1, 0.3, 1)";
/**
 * Let go to close, it goes the rest of the way at the finger's own speed, slowing evenly
 * to rest at the edge, as a thrown drawer does (Mat, 2026-10-31: "that smooth app feel"):
 * an ease out that starts at twice its average speed, so it takes twice the rest of the
 * way over the finger's speed, within these bounds (ms). Never past the pane's own slide,
 * after which it is hidden.
 */
const EXIT_MS = [120, SLIDE_MS] as const;
const EXIT_EASE = "cubic-bezier(0.33, 0.67, 0.67, 1)";

/** Panes on their way out from a drag, each with what tidies up once it is out. */
const leaving = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

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
      // Followed from here, so it never jumps the slop it took to tell a drag.
      startX = event.clientX;
      samples = [[event.timeStamp, 0]];
      // Kept on the pane past its edge where it can be; a pointer already gone cannot be.
      try {
        element.setPointerCapture?.(event.pointerId);
      } catch {
        // The drag goes on without it.
      }
      move(moving(), undefined, "none");
    }
    offset = Math.max(0, (event.clientX - startX) * toward);
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
    // Where the reader asks for less motion, it finishes at once, as its slide does.
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (offset > width * CLOSE_SHARE || speed > FLICK) {
      const time = still
        ? 0
        : Math.min(
            EXIT_MS[1],
            Math.max(
              EXIT_MS[0],
              (2 * (width - offset)) / Math.max(speed, 0.001),
            ),
          );
      const exit = `${time}ms ${EXIT_EASE}`;
      if (wash) {
        wash.style.transition = `opacity ${exit}`;
        wash.style.opacity = "0";
      }
      if (latest.current.exits) {
        // No slide of its own: it goes the rest of the way, then closes.
        move(moving(), `${width * toward}px 0`, `translate ${exit}`);
        setTimeout(() => latest.current.onClose(), time);
        return;
      }
      /*
       * Its own slide out ends where this does, off its edge (`--clover-template-out`, the
       * drawer's, else a whole width), so the drag hands the rest of the way to its
       * `transform`, from where it was let go: the slide, as it closes, finds the same
       * motion already running and leaves it be, and nothing jumps back to where it
       * opened (it did, as the drag's `translate` was cleared under the slide).
       */
      element.style.transition = "none";
      element.style.translate = "";
      element.style.transform = `translateX(${offset * toward}px)`;
      element.getBoundingClientRect();
      element.style.transition = `transform ${exit}`;
      element.style.transform = `var(--clover-template-out, translateX(${toward * 100}%))`;
      move(
        [latest.current.alongside?.current],
        `${width * toward}px 0`,
        `translate ${exit}`,
      );
      leaving.set(
        element,
        setTimeout(() => clear(element, latest), time),
      );
      latest.current.onClose();
      return;
    }
    move(moving(), "", still ? "none" : SPRING);
    if (wash) {
      wash.style.transition = still ? "none" : "opacity 240ms ease";
      wash.style.opacity = "";
    }
    // Back at rest, its own slide's transition rules again, for the next close.
    setTimeout(() => {
      if (state === "idle" && !leaving.has(element))
        move(moving(), undefined, "");
    }, 240);
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

/**
 * Opened again, or closed: whatever a drag left is cleared, so the pane slides in whole.
 * A drag's way out, closing, is left to finish (it tidies up after itself); opened again
 * meanwhile, the pane slides back in from wherever it had got to.
 */
export function reset(element: HTMLElement, latest: Latest): void {
  if (leaving.has(element) && !latest.current.enabled) return;
  clear(element, latest);
}

function clear(element: HTMLElement, latest: Latest) {
  clearTimeout(leaving.get(element));
  leaving.delete(element);
  move([element, latest.current.alongside?.current], "", "");
  element.style.transform = "";
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
