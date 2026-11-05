"use client";

import { useEffect } from "react";
import { useRouter } from "docs/lib/router";

const CUSTOMIZING = "/docs/composing/customizing";

/**
 * Composing's sections that moved to pages of their own (Mat, 2026-11-04), by their old
 * anchors: a link to `/docs/composing#languages` goes on to the section's new place, its
 * anchor kept. The site is a static export, so a hash cannot be forwarded on the server
 * (`Moved.tsx` forwards whole pages from the 404 page).
 */
const MOVED: Record<string, string> = {
  components: "/docs/composing/glossary",
  "core-components": "/docs/composing/glossary",
  "helper-components": "/docs/composing/glossary",
  hooks: "/docs/composing/helpers",
  "the-information-panel": CUSTOMIZING,
  "panes-side-by-side": CUSTOMIZING,
  "value-summary-and-readmore": CUSTOMIZING,
  templates: CUSTOMIZING,
  "creating-custom-components": CUSTOMIZING,
  "parts-of-your-own": CUSTOMIZING,
  headings: CUSTOMIZING,
  "controls-of-your-own": CUSTOMIZING,
  "custom-renderer": CUSTOMIZING,
  helpers: CUSTOMIZING,
  languages: CUSTOMIZING,
  styles: CUSTOMIZING,
};

/** The new anchor where the section's id changed. */
const RENAMED: Record<string, string> = {
  "parts-of-your-own": "creating-custom-components",
  "helper-components": "ui-components",
  "the-information-panel": "panel",
  "panes-side-by-side": "splitting-panes",
  "value-summary-and-readmore": "long-values",
};

export function MovedSections() {
  const { basePath } = useRouter();
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    const page = MOVED[id];
    if (!page) return;
    location.replace(`${basePath}${page}#${RENAMED[id] ?? id}`);
  }, [basePath]);
  return null;
}
