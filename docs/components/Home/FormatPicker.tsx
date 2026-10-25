"use client";

import React, { useId, useRef } from "react";
import styles from "docs/components/Home/Home.module.css";
import { resourceByKey } from "docs/components/Playground/playground-config";

/**
 * The formats Clover opens, each by one of the playground's resources (Mat, 2026-10-25:
 * images, A/V, 3D models and textual materials), in the order the story names them.
 */
const FORMATS: { name: string; more?: string; key: string }[] = [
  { name: "Image", key: "catalog" },
  // "A/V" shown (Mat, 2026-10-25), spelled out after it for a screen reader (`more`).
  { name: "A/V", more: " (audio and video)", key: "footage" },
  { name: "3D model", key: "model" },
  { name: "Text", key: "manuscript" },
];

/**
 * How long the formats are held in place after a pick once the page above them has
 * stopped changing height, and the most they are ever held.
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
const holdInPlace = (element: HTMLElement) => {
  const root = document.documentElement;
  const top = element.getBoundingClientRect().top;
  const began = performance.now();
  let moved = began;
  let frame = 0;
  root.style.overflowAnchor = "none";
  root.style.minHeight = `${root.scrollHeight}px`;
  const events = ["wheel", "touchstart", "keydown"] as const;
  const release = () => {
    cancelAnimationFrame(frame);
    root.style.overflowAnchor = "";
    root.style.minHeight = "";
    events.forEach((name) => window.removeEventListener(name, release));
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
    window.addEventListener(name, release, { passive: true }),
  );
};

/**
 * The Adaptable story's formats, in the column the other stories give their figures: a
 * thumbnail of each, which opens its resource in the playground's Viewer and so in the
 * example viewer held beside the stories, which follows it (`Parts.tsx`).
 *
 * Native radios, one stop in the tab order, the arrow keys moving between them, named for
 * what they choose, as the header's code switch is (`CodeSwitch.tsx`). The chosen one is
 * the resource the playground shows; another of its resources leaves none chosen. Each is
 * named by its visible word (WCAG 2.5.3), its thumbnail decoration; the chosen one is
 * ringed, a heavier edge than the others' hairline, so it never rests on color (1.4.1).
 */
export function FormatPicker({
  chosen,
  onPick,
}: {
  /** The playground's resource, by key. */
  chosen: string | null;
  onPick: (key: string) => void;
}) {
  const name = useId();
  const group = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={group}
      className={styles.formats}
      role="radiogroup"
      aria-label="Open a format in the example viewer"
    >
      {FORMATS.map((format) => {
        const resource = resourceByKey(format.key);
        return (
          <label key={format.key} className={styles.format}>
            <input
              className={styles.visuallyHidden}
              type="radio"
              name={name}
              value={format.key}
              checked={chosen === format.key}
              onChange={() => {
                if (group.current) holdInPlace(group.current);
                onPick(format.key);
              }}
            />
            <span className={styles.formatThumb}>
              {resource && (
                <img src={resource.thumbnail} alt="" loading="lazy" />
              )}
            </span>
            {/*
             * Its name the visible word, and where that is short, the words after it,
             * read but not shown, so the name still begins with what is seen (WCAG 2.5.3).
             */}
            <span className={styles.formatName}>
              {format.name}
              {format.more && (
                <span className={styles.visuallyHidden}>{format.more}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
