import React from "react";

/**
 * A box with an arrow leaving it: opens a page away from the viewer, in a tab of its own,
 * after the Annotations list's links. Regular (40), at `text-s` too, one weight for it
 * wherever it shows (Mat, 2026-11-21: "these should just be one."; 48 there before).
 */
export const ExternalGlyph = () => (
  <path
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="40"
    d="M218 96h-90a48 48 0 0 0-48 48v240a48 48 0 0 0 48 48h240a48 48 0 0 0 48-48v-90M304 80h128v128M432 80 240 272"
  />
);
