import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A row or column of slides that scrolls natively: the browser's own scrolling, wheel,
 * trackpad and touch, with CSS scroll snapping. On top of that, three things a slider
 * needs (Items' slider and the Panel's tabs):
 *
 * - **Paging**, for previous / next buttons: by most of what fits, and whether there is
 *   anywhere to go.
 * - **Bringing a slide to rest** at the start or the center, which is how a host keeps
 *   its selection in view.
 * - **Dragging with a mouse**, which native scrolling only offers to touch. A drag that
 *   moves swallows the click that ends it, so dragging never activates a slide.
 *
 * Every position is measured from bounding rectangles and applied with `scrollBy`, so the
 * same code serves left-to-right and right-to-left (where `scrollLeft` runs negative).
 *
 * Slides are the elements carrying `data-track-index`, anywhere inside the viewport.
 */

export interface ScrollTrackOptions {
  /** Where a scrolled-to slide comes to rest, and where slides snap. */
  align?: "start" | "center";
  /** No snapping: scrolling stops wherever it stops. */
  dragFree?: boolean;
  /** Re-measure when the number of slides changes. */
  itemCount?: number;
  /** The direction the slides run: across (the default) or down. */
  axis?: "x" | "y";
}

export interface ScrollTrack {
  /** Attach to the scrolling element (a callback ref). */
  ref: (element: HTMLElement | null) => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  /**
   * Bring slide `index` to rest according to `align`. False where it could not: the
   * scrolling element or the slide not drawn yet.
   */
  scrollToIndex: (index: number, options?: { instant?: boolean }) => boolean;
  /** Re-measure, after slides change size. */
  measure: () => void;
}

/** Pixels a pointer must move before a press becomes a drag. */
const DRAG_THRESHOLD = 5;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

export function useScrollTrack({
  align = "start",
  dragFree = false,
  itemCount = 0,
  axis = "x",
}: ScrollTrackOptions = {}): ScrollTrack {
  const down = axis === "y";
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const alignment = useRef(align);
  alignment.current = align;
  const snap = dragFree ? "none" : `${axis} mandatory`;

  const measure = useCallback(() => {
    if (!viewport) return;
    // `scrollLeft` runs negative right to left.
    const position = Math.abs(down ? viewport.scrollTop : viewport.scrollLeft);
    const max = down
      ? viewport.scrollHeight - viewport.clientHeight
      : viewport.scrollWidth - viewport.clientWidth;
    setCanScrollPrev(position > 1);
    setCanScrollNext(position < max - 1);
  }, [viewport, down]);

  // The viewport's own scrolling and snapping, set here so they hold without CSS.
  useEffect(() => {
    if (!viewport) return;
    const style = viewport.style;
    style.overflowX = down ? "hidden" : "auto";
    style.overflowY = down ? "auto" : "hidden";
    style.scrollSnapType = snap;
    style.setProperty("--clover-track-align", align);
    if (down) style.overscrollBehaviorY = "contain";
    else style.overscrollBehaviorX = "contain";
  }, [viewport, snap, align, down]);

  // Keep the buttons' state current as the track scrolls or resizes.
  useEffect(() => {
    if (!viewport) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    viewport.addEventListener("scroll", schedule, { passive: true });
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    observer?.observe(viewport);
    if (viewport.firstElementChild)
      observer?.observe(viewport.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", schedule);
      observer?.disconnect();
    };
  }, [viewport, measure, itemCount]);

  /** Scroll by a distance along the row. */
  const scrollAlong = useCallback(
    (distance: number, instant = false) => {
      if (!viewport || !distance) return;
      const behavior: ScrollBehavior =
        instant || prefersReducedMotion() ? "auto" : "smooth";
      viewport.scrollBy({ [down ? "top" : "left"]: distance, behavior });
    },
    [viewport, down],
  );

  /** Bring slide `index` to rest where `align` puts it: its start (by the row's direction) or its center. */
  const scrollToIndex = useCallback(
    (index: number, { instant = false } = {}) => {
      const slide = viewport?.querySelector<HTMLElement>(
        `[data-track-index="${index}"]`,
      );
      if (!viewport || !slide) return false;
      const box = viewport.getBoundingClientRect();
      const rect = slide.getBoundingClientRect();
      const rtl = getComputedStyle(viewport).direction === "rtl";
      if (down) {
        scrollAlong(
          alignment.current === "center"
            ? rect.top + rect.height / 2 - (box.top + box.height / 2)
            : rect.top - box.top,
          instant,
        );
        return true;
      }
      scrollAlong(
        alignment.current === "center"
          ? rect.left + rect.width / 2 - (box.left + box.width / 2)
          : rtl
            ? rect.right - box.right
            : rect.left - box.left,
        instant,
      );
      return true;
    },
    [viewport, scrollAlong, down],
  );

  const page = useCallback(
    (direction: 1 | -1) => {
      if (!viewport) return;
      const rtl = !down && getComputedStyle(viewport).direction === "rtl";
      // Most of a screen, so the last slide seen stays in view as a landmark.
      const extent = down ? viewport.clientHeight : viewport.clientWidth;
      scrollAlong(direction * extent * 0.9 * (rtl ? -1 : 1));
    },
    [viewport, scrollAlong, down],
  );
  const scrollNext = useCallback(() => page(1), [page]);
  const scrollPrev = useCallback(() => page(-1), [page]);

  // Drag to scroll with a mouse; touch and pens scroll natively.
  useEffect(() => {
    if (!viewport) return;
    let start: { x: number; scroll: number } | null = null;
    let dragging = false;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      start = {
        x: down ? event.clientY : event.clientX,
        scroll: down ? viewport.scrollTop : viewport.scrollLeft,
      };
      dragging = false;
    };
    const onMove = (event: PointerEvent) => {
      if (!start) return;
      const moved = (down ? event.clientY : event.clientX) - start.x;
      if (!dragging && Math.abs(moved) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        viewport.setPointerCapture?.(event.pointerId);
        // Snapping would fight the pointer; it comes back on release.
        viewport.style.scrollSnapType = "none";
        viewport.dataset.dragging = "true";
      }
      if (down) viewport.scrollTop = start.scroll - moved;
      else viewport.scrollLeft = start.scroll - moved;
    };
    const onUp = (event: PointerEvent) => {
      if (!start) return;
      start = null;
      if (!dragging) return;
      viewport.releasePointerCapture?.(event.pointerId);
      delete viewport.dataset.dragging;
      // Restoring snapping settles the track on the nearest slide.
      viewport.style.scrollSnapType = snap;
    };
    // The click that ends a drag is not a press on a slide.
    const onClick = (event: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      event.preventDefault();
      event.stopPropagation();
    };

    viewport.addEventListener("pointerdown", onDown);
    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
    viewport.addEventListener("click", onClick, true);
    return () => {
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
      viewport.removeEventListener("click", onClick, true);
    };
  }, [viewport, snap, down]);

  return {
    ref: setViewport,
    canScrollPrev,
    canScrollNext,
    scrollPrev,
    scrollNext,
    scrollToIndex,
    measure,
  };
}
