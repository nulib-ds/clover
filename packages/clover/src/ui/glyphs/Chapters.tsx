import React from "react";

/**
 * A list's lines and their dots: a recording's Chapters control, and Document's Contents.
 * The dots are lines of no length, whose round ends draw them as wide as the lines at
 * every `--clover-glyph-weight` (Mat, 2026-11-21: "the three dots on left here do not seem
 * to be affected by weight changes"; circles of a set radius before). Chromium, Firefox
 * and WebKit each draw a round end on a line of no length.
 */
export const ChaptersGlyph = () => (
  <path
    d="M155 141h288M155 256h288M155 371h288M69 141h0M69 256h0M69 371h0"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="40"
  />
);
