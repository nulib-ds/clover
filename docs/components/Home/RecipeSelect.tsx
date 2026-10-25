"use client";

import React from "react";
import styles from "docs/components/Home/Home.module.css";
import ResourceField from "docs/components/Playground/ResourceField";

/**
 * The Natural story's recipes, under its words: the playground's own select (Mat,
 * 2026-10-25: "just use the same select as above. it will need dark capability. the
 * arrow should point up. try to keep it dry between the two"), listing the curated
 * Collection of the IIIF Cookbook's recipes alone (`of="recipes"`,
 * `docs/mocks/cookbook/`), in the site's dark palette on the black (`dark`), Open's
 * caret up. A recipe chosen opens in the playground's Viewer up top, and the reader goes
 * up with it (`onOpen`, `Homepage.tsx`). Its field shows the recipe up top, chosen here or
 * in the playground's own field, so the two are one choice; while there is none, the one
 * the example viewer beside the stories reads (0032, always), staged as that viewer shows
 * it, until Open opens it.
 */
export function RecipeSelect({
  current,
  resource,
  onOpen,
  staged,
}: {
  /** The playground's resource, by key (`own` for a recipe), as its field takes it. */
  current: string | null;
  /** Its address, or a content state. */
  resource: string | null;
  /** A recipe chosen here, by its address, to open in the playground. */
  onOpen: (content: string) => void;
  /**
   * The recipe the example viewer reads (0032), by its address: shown in the field while
   * the playground shows no recipe, not opened until the reader asks (Open).
   */
  staged?: string;
}) {
  return (
    <div className={`${styles.recipes} dark`}>
      <ResourceField
        current={current ?? ""}
        of="recipes"
        onOwn={onOpen}
        // None of the playground's own is listed here.
        onPick={() => undefined}
        own={resource ?? ""}
        staged={staged}
        toward="up"
      />
    </div>
  );
}
