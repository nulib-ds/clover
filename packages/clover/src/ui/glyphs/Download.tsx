import React from "react";

/**
 * An arrow down to a line, one weight for both, near the panel's chevrons beside it
 * (1.3px at `text-s`; Mat, 2026-10-28: "less hairline"; 2026-11-11, the line in place of
 * a tray: "use the `bar` variant"): About's downloads, and Document's. Each path is
 * unfilled itself, so a button that fills its glyphs never fills the arrow's head.
 */
export const DownloadGlyph = () => (
  <>
    <path
      d="M256 78v232M160 214l96 96 96-96"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="48"
    />
    <path
      d="M96 433h320"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="48"
    />
  </>
);
