import React from "react";

/**
 * Full screen: two arrows on the diagonal, out to the corners, Back to pages' own two
 * turned to point out (Mat, 2026-11-22: "I like B · Back to pages, turned out"; four
 * arrows, one to each corner, from 2026-11-13). `ExitFullScreenGlyph` is the same two
 * arrows pointing in, so going into full screen and coming back mirror each other. Each
 * arrow is a shaft, rounded at its tail, and a solid head, its corners rounded as the
 * other glyphs' joins are, at Regular (40); their tails sit 76 apart across the middle,
 * the golden scale's 75. The controls over a Canvas and a Scene and the transport show
 * it. Each path sets its own fill and stroke, for the transport's svg too.
 */
export const FullScreenGlyph = () => (
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="40"
      d="M297 215L385 127M215 297L127 385"
    />
    <path
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="40"
      d="M425 87V167L345 87ZM87 425V345L167 425Z"
    />
  </>
);
