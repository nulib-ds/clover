/*
 * For a story's picker that opens a resource in the playground's Viewer and keeps the
 * reader where they are (the Adaptable story's formats, `FormatPicker.tsx`): the page
 * above it loads again, and it stays where it is.
 */

/**
 * How long a picker is held in place after a pick once the page above it has stopped
 * changing height, and the most it is ever held.
 */
const SETTLE = 2000;
const HOLD_MOST = 8000;

/**
 * Holds `element` where it is in the window while the page above it changes height (the
 * parts' tiles, emptied and filled again as their Root loads another resource): each
 * frame, before it is painted, the page is scrolled by however far it moved, until nothing
 * has moved for `SETTLE`, or the reader scrolls on their own. Done here in every browser,
 * not left to scroll anchoring: Safari has none, and Firefox's loses its anchor as the
 * tiles empty. Meanwhile the browser's anchoring is off, so the two never compensate
 * twice, and the page keeps at least its height, so the emptied tiles never cut the
 * scroll short.
 */
export const holdInPlace = (element: HTMLElement) => {
  const root = document.documentElement;
  const top = element.getBoundingClientRect().top;
  const began = performance.now();
  let moved = began;
  let frame = 0;
  root.style.overflowAnchor = "none";
  root.style.minHeight = `${root.scrollHeight}px`;
  const events = ["wheel", "touchstart", "keydown"] as const;
  /*
   * The reader scrolling or pressing a key lets go; never the key that made the pick,
   * which may reach the window after the hold began.
   */
  const letGo = (event: Event) => {
    if (event.timeStamp > began) release();
  };
  const release = () => {
    cancelAnimationFrame(frame);
    root.style.overflowAnchor = "";
    root.style.minHeight = "";
    events.forEach((name) => window.removeEventListener(name, letGo));
  };
  const hold = (now: number) => {
    const drift = element.getBoundingClientRect().top - top;
    if (Math.abs(drift) >= 1) {
      window.scrollBy(0, drift);
      moved = now;
    }
    if (now - moved > SETTLE || now - began > HOLD_MOST) return release();
    frame = requestAnimationFrame(hold);
  };
  frame = requestAnimationFrame(hold);
  events.forEach((name) =>
    window.addEventListener(name, letGo, { passive: true }),
  );
};
