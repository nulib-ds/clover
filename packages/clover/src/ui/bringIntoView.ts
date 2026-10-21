/*
 * Bringing an entry into view within the list that scrolls it: Annotations' picked entry
 * and Canvas groups, Transcript's playing cue. Never the page itself, which a reader may
 * have scrolled elsewhere (`scrollIntoView` moves every scrolling box round it, the page
 * too).
 */

/** The box that scrolls an element, short of the page itself, which is never moved. */
export function scrollerOf(node: Element): HTMLElement | null {
  for (
    let at = node.parentElement;
    at && at !== document.body;
    at = at.parentElement
  ) {
    if (/auto|scroll/.test(getComputedStyle(at).overflowY)) return at;
  }
  return null;
}

/**
 * Moves `scroller` so `target` sits at its top (`start`), or just into view (`nearest`),
 * clear of what it keeps clear of (the target's scroll margins: an accordion's stuck
 * headings), and smoothly unless the reader asks for less motion.
 */
export function bringIntoView(target: HTMLElement, where: "start" | "nearest") {
  const scroller = scrollerOf(target);
  if (!scroller) return;
  const style = getComputedStyle(target);
  const above = parseFloat(style.scrollMarginTop) || 0;
  const below = parseFloat(style.scrollMarginBottom) || 0;
  const box = target.getBoundingClientRect();
  const port = scroller.getBoundingClientRect();
  const top = box.top - port.top - above;
  const bottom = box.bottom - port.bottom + below;
  const by =
    where === "start" || top < 0 ? top : bottom > 0 ? Math.min(bottom, top) : 0;
  if (Math.abs(by) < 1) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollBy({ top: by, behavior: still ? "auto" : "smooth" });
}
