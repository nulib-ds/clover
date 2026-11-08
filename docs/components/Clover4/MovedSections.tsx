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
const COMPOSING: Record<string, string> = {
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

const BASE = "/docs/styling/base";
const FONTS = "/docs/styling/fonts";
const COLORS = "/docs/styling/colors";
const CLASSES = "/docs/styling/classes";
const VARIABLES = "/docs/styling/variables";

/**
 * Styling's sections that moved to pages of their own (Mat, 2026-11-07: "break styling
 * page out into multiple sections like composing is"), by their old anchors, the
 * Variables' groups among them. The stylesheets stay on the page.
 */
const STYLING: Record<string, string> = {
  // Base styling, its examples with it (Mat, 2026-11-08: "add a Base section").
  "base-styling": BASE,
  "a-layout-that-works": BASE,
  "composed-layouts": BASE,
  "font-sizes-and-spacing": FONTS,
  headings: FONTS,
  colors: COLORS,
  "colors-and-contrast": COLORS,
  "high-contrast": COLORS,
  do: COLORS,
  dont: COLORS,
  "every-pair": COLORS,
  "contrast-guide": COLORS,
  "classes-and-states": CLASSES,
  "lists-in-markdown-text": CLASSES,
  variables: VARIABLES,
  "colors-1": VARIABLES,
  "the-media-player": VARIABLES,
  "sizes-and-spaces": VARIABLES,
  "shape-and-motion": VARIABLES,
  "the-body": VARIABLES,
  "items-summary-logo-map-and-search": VARIABLES,
  templates: VARIABLES,
};

/** Each page's moved sections, and the new anchor where a section's id changed ("" for the page's top). */
const PAGES = {
  composing: {
    moved: COMPOSING,
    renamed: {
      "parts-of-your-own": "creating-custom-components",
      "helper-components": "ui-components",
      "the-information-panel": "panel",
      "panes-side-by-side": "splitting-panes",
      "value-summary-and-readmore": "long-values",
    } as Record<string, string>,
  },
  styling: {
    moved: STYLING,
    renamed: {
      colors: "setting-colors",
      "colors-and-contrast": "",
      "font-sizes-and-spacing": "",
      variables: "",
      "every-pair": "contrast-guide",
      // The Variables' Colors, second to the page's own Colors before.
      "colors-1": "colors",
      "base-styling": "using-basecss",
    } as Record<string, string>,
  },
};

/**
 * On a page whose sections moved (`page`: Composing's, Styling's), a link to an old
 * section goes on to its new page, at its anchor, or at the page's top where the section
 * became the page.
 */
export function MovedSections({
  page = "composing",
}: {
  page?: keyof typeof PAGES;
}) {
  const { basePath } = useRouter();
  useEffect(() => {
    const forward = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const { moved, renamed } = PAGES[page];
      const to = moved[id];
      if (!to) return;
      const anchor = renamed[id] ?? id;
      location.replace(`${basePath}${to}${anchor ? `#${anchor}` : ""}`);
    };
    forward();
    // An old section's link followed on the page itself changes only its hash.
    window.addEventListener("hashchange", forward);
    return () => window.removeEventListener("hashchange", forward);
  }, [basePath, page]);
  return null;
}
