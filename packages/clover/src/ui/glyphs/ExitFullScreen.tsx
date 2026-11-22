import React from "react";

/**
 * Exit full screen: two arrows on the diagonal, in from the corners toward the middle,
 * the drawing Document's Back to pages shows too (Mat, 2026-11-22: "make back to pages
 * and exit full screen the same. use back to pages."; four arrows in from 2026-11-13).
 * `FullScreenGlyph` is the same two arrows pointing out. Each arrow is a shaft, rounded at
 * its tail, and a solid head, its corners rounded as the other glyphs' joins are, at
 * Regular (40); the heads sit 76 apart across the middle, the golden scale's 75. The
 * controls over a Canvas and a Scene, the transport, the labeled way out
 * (`ui/ExitFullscreen.tsx`) and Document's Back to pages show it. Each path sets its own
 * fill and stroke, for the transport's svg too.
 */
export const ExitFullScreenGlyph = () => (
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="40"
      d="M425 87L337 175M87 425L175 337"
    />
    <path
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="40"
      d="M297 215V135L377 215ZM215 297V377L135 297Z"
    />
  </>
);
