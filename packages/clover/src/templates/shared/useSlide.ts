import React, { useEffect, useLayoutEffect, useState } from "react";

/** Long enough for a panel's slide; it is `hidden` once it is out of sight. */
export const SLIDE_MS = 240;

/**
 * The narrowest the page (Default's Body, Document's pages) and the panel may be dragged,
 * side by side: one pair for both templates, so their layouts never drift apart.
 */
export const PAGE_MIN = "16rem";
export const PANEL_MIN = "14rem";
/**
 * The room the two need beside each other: their minimums and the bar between them. Any
 * narrower (a phone) and the panel slides over the page instead.
 */
export const BESIDE_REM = 16 + 14 + 1;

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

/** Into the panel: its selected tab, or with stacked boxes the open box's heading, or else the first. */
export function panelFocus(pane: HTMLElement) {
  const at = (selector: string) => pane.querySelector<HTMLElement>(selector);
  return (
    at('[role="tab"][aria-selected="true"]') ??
    at('.clover-sections-button[aria-expanded="true"]') ??
    at(".clover-sections-button")
  );
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Whether `element` is at least `rem` wide: measured before paint, and again whenever it
 * resizes. Its own width, not the window's, so a layout in a narrow column of a wide page
 * still knows it is narrow. `undefined` until measured (on the server, or with no layout
 * yet), so the first measure is never mistaken for the layout narrowing or widening.
 */
export function useWideEnough(
  element: React.RefObject<HTMLElement | null>,
  rem: number,
): boolean | undefined {
  const [wide, setWide] = useState<boolean>();
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
