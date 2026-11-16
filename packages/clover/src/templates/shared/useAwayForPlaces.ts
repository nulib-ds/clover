import { useEffect, useRef } from "react";

import * as Clover from "../../parts";

/**
 * How many frames the map asked for is waited for, as its code may load first and a map
 * may wait out of sight until it has drawn (Document's): ten seconds.
 */
const MAP_FRAMES = 600;

/** A template's drawer (`useDrawer`), with the `id` its toggles' `aria-controls` name. */
export interface AwayDrawer {
  over: boolean;
  open: boolean;
  close: () => void;
  id: string;
  pane: { current: HTMLElement | null };
}

/**
 * A place asked for (About's places, Annotations' georeferenced images: the Root's
 * `place`) while a drawer lies over the view, as on a phone: the map it asked for opens
 * over the view, which the drawer would cover, so the drawer is put away, focus going to
 * its toggle as ever and then on to the map as it opens (the first control of what is
 * marked `data-asked`), unless focus has gone elsewhere meanwhile (Mat, 2026-11-13; WCAG
 * 2.4.3). The Default template's panel and Document's aside. Gives back what asked, as
 * focus was when it asked, before the drawer moved it, for the map to hand focus back to
 * as it is put away. Lean, as the templates' first loads carry it.
 */
export function useAwayForPlaces(drawer: AwayDrawer) {
  const { clover } = Clover.useClover("useAwayForPlaces");
  const latest = useRef(drawer);
  latest.current = drawer;
  const asker = useRef<Element | null>(null);
  useEffect(
    () =>
      clover.place.subscribe((key) => {
        if (!key) return;
        const from = document.activeElement;
        asker.current = from;
        const { over, open, close, id, pane } = latest.current;
        if (!over || !open) return;
        close();
        let frames = MAP_FRAMES;
        // Its Root's, as a page may hold several; plain checks, as `?.` costs bytes here.
        const root = pane.current && pane.current.closest(".clover-root");
        const land = () => {
          /*
           * Where focus may be meanwhile: where it was, on the page once a tap has left it
           * nowhere, or on a toggle of the drawer's, which the drawer gives it to; anywhere
           * else is the reader's own.
           */
          const active = document.activeElement;
          if (
            active &&
            active !== from &&
            active !== document.body &&
            !active.matches(`button[aria-controls~="${id}"]`)
          )
            return;
          // Its first control of its own, past MapLibre's (its zoom buttons, its credits).
          const map =
            root &&
            root.querySelector<HTMLElement>(
              "[data-asked] button:not(.clover-geomap-canvas *)",
            );
          if (map) map.focus();
          // Until it has focus: there, but out of sight, it cannot take it yet.
          if (document.activeElement !== map && --frames)
            requestAnimationFrame(land);
        };
        requestAnimationFrame(land);
      }),
    [clover],
  );
  return asker;
}
