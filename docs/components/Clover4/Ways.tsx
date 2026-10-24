import React from "react";

import { Flavored } from "docs/components/Flavored";
import styles from "./Ways.module.css";

/**
 * Get started's two ways in, side by side (Mat, 2026-10-24: "really highlight the dual
 * options for getting started", above the fold). A reader has come from the homepage,
 * whose choice offered the two, so this says more than it did, in titles of its own:
 * over each, the component it starts from, as the reader's flavor writes it; then what
 * that way gives, its last sentence linking the page that goes on with it by the menu's
 * own name (Mat, 2026-10-24: no calls to action here), and its code. The two share their
 * rows, so the titles, the notes and the code line up across them; where the page is
 * narrow, one follows the other.
 */
export function Ways({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.ways}>{children}</div>
    </div>
  );
}

/**
 * One way: the component it starts from (`react`, `webComponents`), its title, and what
 * the page's MDX gives it: its note, linking on, and its code (a fence, both flavors).
 */
export function Way({
  id,
  title,
  react,
  webComponents,
  children,
}: {
  id: string;
  title: string;
  react: string;
  webComponents: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.way}>
      <div className={styles.head}>
        <p className={styles.name}>
          <Flavored react={react} webComponents={webComponents} />
        </p>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
