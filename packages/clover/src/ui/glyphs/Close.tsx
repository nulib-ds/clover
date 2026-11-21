import React from "react";

/**
 * A cross: closes the Panel, a caption, a place box, the map's tray, Document's aside and
 * the lightbox, and clears a field. Regular, 40 (1.25px at 1rem), the one cross at every
 * size, the field's Clear at `text-s` too (Mat, 2026-11-21: "why are these not the same.
 * they should use one."; Clear was 48 there before).
 */
export const CloseGlyph = () => (
  <path
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="40"
    d="M154 154L358 358M358 154L154 358"
  />
);
