"use client";

import React, { useId, useRef } from "react";
import styles from "docs/components/Home/Home.module.css";
import { holdInPlace } from "docs/components/Home/holdInPlace";
import { resourceByKey } from "docs/components/Playground/playground-config";

/**
 * The formats Clover opens, each by one of the playground's resources (Mat, 2026-10-25:
 * images, A/V, 3D models and textual materials), in the order the story names them.
 */
const FORMATS: { name: string; key: string }[] = [
  { name: "Image", key: "catalog" },
  { name: "Audio & video", key: "footage" },
  { name: "3D model", key: "model" },
  { name: "Text", key: "manuscript" },
];

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
            <span className={styles.formatName}>{format.name}</span>
          </label>
        );
      })}
    </div>
  );
}
