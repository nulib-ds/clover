import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A row of slides that scrolls natively: the browser's own scrolling, wheel, trackpad and
 * touch, with CSS scroll snapping. On top of that, three things a slider needs (Items'
 * slider and the Panel's tabs, both in a row):
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
}

export interface ScrollTrack {
  /** Attach to the scrolling element (a callback ref). */
  ref: (element: HTMLElement | null) => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  /** Bring slide `index` to rest according to `align`. */
  scrollToIndex: (index: number, options?: { instant?: boolean }) => void;
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
}: ScrollTrackOptions = {}): ScrollTrack {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const alignment = useRef(align);
  alignment.current = align;
  const snap = dragFree ? "none" : "x mandatory";

  const measure = useCallback(() => {
    if (!viewport) return;
    // `scrollLeft` runs negative right to left.
    const position = Math.abs(viewport.scrollLeft);
    const max = viewport.scrollWidth - viewport.clientWidth;
    setCanScrollPrev(position > 1);
    setCanScrollNext(position < max - 1);
  }, [viewport]);

  // The viewport's own scrolling and snapping, set here so they hold without CSS.
  useEffect(() => {
    if (!viewport) return;
    const style = viewport.style;
    style.overflowX = "auto";
    style.overflowY = "hidden";
    style.scrollSnapType = snap;
    style.setProperty("--clover-track-align", align);
    style.overscrollBehaviorX = "contain";
  }, [viewport, snap, align]);

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
      viewport.scrollBy({ left: distance, behavior });
    },
    [viewport],
  );

  /** Bring slide `index` to rest where `align` puts it: its start (by the row's direction) or its center. */
  const scrollToIndex = useCallback(
    (index: number, { instant = false } = {}) => {
      const slide = viewport?.querySelector<HTMLElement>(
        `[data-track-index="${index}"]`,
      );
      if (!viewport || !slide) return;
      const box = viewport.getBoundingClientRect();
      const rect = slide.getBoundingClientRect();
      const rtl = getComputedStyle(viewport).direction === "rtl";
      scrollAlong(
        alignment.current === "center"
          ? rect.left + rect.width / 2 - (box.left + box.width / 2)
          : rtl
            ? rect.right - box.right
            : rect.left - box.left,
        instant,
      );
    },
    [viewport, scrollAlong],
  );

  const page = useCallback(
    (direction: 1 | -1) => {
      if (!viewport) return;
      const rtl = getComputedStyle(viewport).direction === "rtl";
      // Most of a screen, so the last slide seen stays in view as a landmark.
      scrollAlong(direction * viewport.clientWidth * 0.9 * (rtl ? -1 : 1));
    },
    [viewport, scrollAlong],
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
      start = { x: event.clientX, scroll: viewport.scrollLeft };
      dragging = false;
    };
    const onMove = (event: PointerEvent) => {
      if (!start) return;
      const moved = event.clientX - start.x;
      if (!dragging && Math.abs(moved) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        viewport.setPointerCapture?.(event.pointerId);
        // Snapping would fight the pointer; it comes back on release.
        viewport.style.scrollSnapType = "none";
        viewport.dataset.dragging = "true";
      }
      viewport.scrollLeft = start.scroll - moved;
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
  }, [viewport, snap]);

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
