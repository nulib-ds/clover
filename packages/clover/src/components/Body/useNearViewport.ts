import { useEffect, useState } from "react";

/** How far ahead of the screen to start loading: half a screen in each direction. */
export const NEAR_VIEWPORT_MARGIN = "50%";

/**
 * Whether `element` has come within a margin of the screen yet. Once it has, it stays
 * `true`: loading starts a little before a Canvas scrolls into view and is never undone.
 *
 * A Canvas uses it to fetch nothing — no `info.json`, tiles, video, sound or captions —
 * until a reader could see it, so a page of many stays cheap until scrolled. Anything
 * hidden (`display: none`, a closed tab) never intersects, so it waits until shown.
 * Without IntersectionObserver, everything loads at once, as before.
 */
export function useNearViewport(
  element: Element | null,
  rootMargin = NEAR_VIEWPORT_MARGIN,
): boolean {
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, near, rootMargin]);

  return near;
}
