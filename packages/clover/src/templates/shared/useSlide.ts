import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Long enough for a panel's slide; it is `hidden` once it is out of sight. */
export const SLIDE_MS = 240;

/**
 * Present while open or sliding: `mounted` keeps it out of `hidden`, and `open` lags one
 * frame behind so the slide in has somewhere to start from.
 */
export function useSlide(want: boolean) {
  const [mounted, setMounted] = useState(want);
  const [open, setOpen] = useState(want);
  useEffect(() => {
    if (want) {
      setMounted(true);
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => setOpen(true)),
      );
      return () => cancelAnimationFrame(frame);
    }
    setOpen(false);
    const timer = setTimeout(() => setMounted(false), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [want]);
  return { mounted, open: want && open };
}

/**
 * Opening a panel that covers the page takes focus into it, at its current tab, as an
 * overlay should: the reader's next keys belong to it. Not on arrival with it open.
 * `shown` turns true in the commit that takes `hidden` off its wrapper, so it can be
 * focused at once.
 */
export function useFocusOnOpen(
  panel: React.RefObject<HTMLElement | null>,
  shown: boolean,
) {
  const was = useRef(shown);
  useEffect(() => {
    const opened = shown && !was.current;
    was.current = shown;
    if (!opened) return;
    // The selected tab; with stacked boxes, the open box's heading, or else the first.
    const at = (selector: string) =>
      panel.current?.querySelector<HTMLElement>(selector);
    (
      at('[role="tab"][aria-selected="true"]') ??
      at('.clover-sections-button[aria-expanded="true"]') ??
      at(".clover-sections-button")
    )?.focus({ preventScroll: true });
  }, [panel, shown]);
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Whether `element` is at least `rem` wide: measured before paint, and again whenever it
 * resizes. Its own width, not the window's, so a layout in a narrow column of a wide page
 * still knows it is narrow. True until measured (on the server, or with no layout yet).
 */
export function useWideEnough(
  element: React.RefObject<HTMLElement | null>,
  rem: number,
): boolean {
  const [wide, setWide] = useState(true);
  useIsomorphicLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      if (!width) return;
      const root = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      setWide(width >= rem * (root || 16));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [element, rem]);
  return wide;
}
