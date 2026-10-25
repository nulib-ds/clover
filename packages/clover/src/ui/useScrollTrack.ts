import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A row (or column) of slides that scrolls natively: the browser's own scrolling, wheel,
 * trackpad and touch, with CSS scroll snapping. On top of that, three things a slider
 * needs:
 *
 * - **Paging**, for previous / next buttons: by what fits (`slidesToScroll: "auto"`) or by
 *   a number of slides, and whether there is anywhere to go.
 * - **Bringing a slide to rest** at the start, center or end, which is how a host keeps
 *   its selection in view.
 * - **Dragging with a mouse**, which native scrolling only offers to touch. A drag that
 *   moves swallows the click that ends it, so dragging never activates a slide.
 *
 * Every position is measured from bounding rectangles and applied with `scrollBy`, so the
 * same code serves left-to-right and right-to-left (where `scrollLeft` runs negative).
 *
 * Slides are the elements carrying `data-track-index`, anywhere inside the viewport.
 */

export type TrackOrientation = "horizontal" | "vertical";

export interface ScrollTrackOptions {
  /** Where a scrolled-to slide comes to rest, and where slides snap. */
  align?: "start" | "center" | "end";
  /** No snapping: scrolling stops wherever it stops. */
  dragFree?: boolean;
  /** Re-measure when the number of slides changes. */
  itemCount?: number;
  orientation?: TrackOrientation;
  /** Slides per page for `scrollNext`/`scrollPrev`; `"auto"` pages by what fits. */
  slidesToScroll?: number | "auto";
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
  orientation = "horizontal",
  slidesToScroll = "auto",
}: ScrollTrackOptions = {}): ScrollTrack {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const vertical = orientation === "vertical";
  const settings = useRef({ align, vertical, slidesToScroll });
  settings.current = { align, vertical, slidesToScroll };

  const measure = useCallback(() => {
    if (!viewport) return;
    const position = Math.abs(
      vertical ? viewport.scrollTop : viewport.scrollLeft,
    );
    const max = vertical
      ? viewport.scrollHeight - viewport.clientHeight
      : viewport.scrollWidth - viewport.clientWidth;
    setCanScrollPrev(position > 1);
    setCanScrollNext(position < max - 1);
  }, [viewport, vertical]);

  // The viewport's own scrolling and snapping, set here so they hold without CSS.
  useEffect(() => {
    if (!viewport) return;
    const style = viewport.style;
    style.overflowX = vertical ? "hidden" : "auto";
    style.overflowY = vertical ? "auto" : "hidden";
    style.scrollSnapType = dragFree
      ? "none"
      : `${vertical ? "y" : "x"} mandatory`;
    style.setProperty("--clover-track-align", align);
    style.overscrollBehaviorX = vertical ? "" : "contain";
  }, [viewport, vertical, dragFree, align]);

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

  /** Scroll by a distance along the axis. */
  const scrollAlong = useCallback(
    (distance: number, instant = false) => {
      if (!viewport || !distance) return;
      const behavior: ScrollBehavior =
        instant || prefersReducedMotion() ? "auto" : "smooth";
      viewport.scrollBy(
        settings.current.vertical
          ? { top: distance, behavior }
          : { left: distance, behavior },
      );
    },
    [viewport],
  );

  const slides = useCallback(
    () =>
      viewport
        ? Array.from(
            viewport.querySelectorAll<HTMLElement>("[data-track-index]"),
          )
        : [],
    [viewport],
  );

  /** How far slide `element` is from resting where `align` puts it. */
  const offsetOf = useCallback(
    (element: HTMLElement) => {
      if (!viewport) return 0;
      const { vertical, align } = settings.current;
      const box = viewport.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const [boxStart, boxSize, start, size] = vertical
        ? [box.top, box.height, rect.top, rect.height]
        : [box.left, box.width, rect.left, rect.width];
      const rtl = !vertical && getComputedStyle(viewport).direction === "rtl";
      if (align === "center")
        return start + size / 2 - (boxStart + boxSize / 2);
      const atStart = align === "start" ? !rtl : rtl;
      return atStart ? start - boxStart : start + size - (boxStart + boxSize);
    },
    [viewport],
  );

  const scrollToIndex = useCallback(
    (index: number, { instant = false } = {}) => {
      const target = slides().find(
        (slide) => Number(slide.dataset.trackIndex) === index,
      );
      if (target) scrollAlong(offsetOf(target), instant);
    },
    [slides, offsetOf, scrollAlong],
  );

  /** The slide nearest its resting place: where the reader is. */
  const currentIndex = useCallback(() => {
    let best = 0;
    let distance = Infinity;
    for (const slide of slides()) {
      const offset = Math.abs(offsetOf(slide));
      if (offset < distance) {
        distance = offset;
        best = Number(slide.dataset.trackIndex);
      }
    }
    return best;
  }, [slides, offsetOf]);

  const page = useCallback(
    (direction: 1 | -1) => {
      if (!viewport) return;
      const { slidesToScroll: step, vertical } = settings.current;
      if (step === "auto") {
        const size = vertical ? viewport.clientHeight : viewport.clientWidth;
        const rtl = !vertical && getComputedStyle(viewport).direction === "rtl";
        // Most of a screen, so the last slide seen stays in view as a landmark.
        scrollAlong(direction * size * 0.9 * (rtl ? -1 : 1));
        return;
      }
      scrollToIndex(Math.max(0, currentIndex() + direction * step));
    },
    [viewport, scrollAlong, scrollToIndex, currentIndex],
  );
  const scrollNext = useCallback(() => page(1), [page]);
  const scrollPrev = useCallback(() => page(-1), [page]);

  // Drag to scroll with a mouse; touch and pens scroll natively.
  useEffect(() => {
    if (!viewport) return;
    let start: { x: number; y: number; scroll: number } | null = null;
    let dragging = false;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      start = {
        x: event.clientX,
        y: event.clientY,
        scroll: vertical ? viewport.scrollTop : viewport.scrollLeft,
      };
      dragging = false;
    };
    const onMove = (event: PointerEvent) => {
      if (!start) return;
      const moved = vertical
        ? event.clientY - start.y
        : event.clientX - start.x;
      if (!dragging && Math.abs(moved) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        viewport.setPointerCapture?.(event.pointerId);
        // Snapping would fight the pointer; it comes back on release.
        viewport.style.scrollSnapType = "none";
        viewport.dataset.dragging = "true";
      }
      if (vertical) viewport.scrollTop = start.scroll - moved;
      else viewport.scrollLeft = start.scroll - moved;
    };
    const onUp = (event: PointerEvent) => {
      if (!start) return;
      start = null;
      if (!dragging) return;
      viewport.releasePointerCapture?.(event.pointerId);
      delete viewport.dataset.dragging;
      // Restoring snapping settles the track on the nearest slide.
      viewport.style.scrollSnapType = dragFree
        ? "none"
        : `${vertical ? "y" : "x"} mandatory`;
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
  }, [viewport, vertical, dragFree]);

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
