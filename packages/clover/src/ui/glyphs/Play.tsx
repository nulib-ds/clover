import React from "react";

/**
 * A rounded triangle: plays a video or sound, in the transports, from its placeholder, and
 * over a page that plays among Document's pages (Mat, 2026-11-21: one Play everywhere).
 * Filled and stroked, its corners the stroke's round joins.
 */
export const PlayGlyph = () => (
  <path
    fill="currentColor"
    stroke="currentColor"
    strokeLinejoin="round"
    strokeWidth="40"
    d="M184 128V384L392 256Z"
  />
);
