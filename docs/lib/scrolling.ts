/*
 * Whether the page, or a box in it, is scrolling: true from each scroll until a moment
 * after the last. A page scrolled under a resting pointer brings one element after
 * another under it, and each says the pointer has entered it, so a hover drawn through
 * React state would redraw at every one, mid-scroll (Mat, 2026-10-21: smooth). What the
 * reader points at is what they move the pointer to: handlers ask this first, and take
 * the pointer's next move instead.
 */
const SETTLE = 150;

let last = -Infinity;
if (typeof window !== "undefined") {
  window.addEventListener(
    "scroll",
    () => {
      last = performance.now();
    },
    { capture: true, passive: true },
  );
}

export const isScrolling = () => performance.now() - last < SETTLE;
