import React from "react";

/**
 * A box with an arrow leaving it, after a link that opens a page away from the viewer in
 * a tab of its own (the Annotations list's): drawn as About's Download glyph is.
 */
export function ExternalGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="48"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M224 96h-96a48 48 0 0 0-48 48v240a48 48 0 0 0 48 48h240a48 48 0 0 0 48-48v-96M304 80h128v128M432 80 240 272" />
    </svg>
  );
}
