import React from "react";
import styles from "docs/components/Clover4/DefaultAnatomy.module.css";

/** Each region of Default, in reading order, with the parts it is made of. */
const REGIONS = [
  {
    key: "header",
    name: "Header",
    parts: ["Clover.Thumbnail", "Clover.Label"],
  },
  {
    key: "stage",
    name: "Stage",
    parts: ["Clover.Content", "Clover.PanelToggle"],
  },
  {
    key: "strip",
    name: "Strip",
    parts: ["ViewTitles", "Clover.Position", "Clover.Items"],
  },
  { key: "bar", name: "Bar", parts: ["Clover.SplitHandle"] },
  { key: "panel", name: "Panel", parts: ["Clover.Panel"] },
] as const;

/**
 * The Default template's regions, drawn where the template puts them (the Default
 * template's page; Mat, 2026-10-21): the header, stage and strip down the main pane, the
 * bar beside them, and the panel's pane. An ordered list in reading order, so it reads as
 * plainly as it looks; each region is numbered as the page's sections are.
 */
export function DefaultAnatomy() {
  return (
    <figure className={styles.anatomy}>
      <ol className={styles.regions}>
        {REGIONS.map((region, index) => (
          <li
            key={region.key}
            className={styles.region}
            data-region={region.key}
          >
            <span className={styles.name}>
              <span className={styles.number}>{index + 1}</span> {region.name}
            </span>
            <span className={styles.parts}>
              {region.parts.map((part) => (
                <code key={part}>{part}</code>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className={styles.caption}>
        Default&rsquo;s regions, where it lays them out: the header, stage and
        strip in the main pane, the bar, and the panel in a pane of its own. On
        a phone the panel slides over the stage instead, and the bar goes.
      </figcaption>
    </figure>
  );
}
