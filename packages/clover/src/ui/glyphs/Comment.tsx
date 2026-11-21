import React from "react";

/**
 * The annotations control (Mat, 2026-11-21, where a speech bubble was: "I like the marked
 * region idea, but perhaps making it larger and having the annotation be in top right with
 * two lines. no need for the jut of the speech bubble. the lines should indicate text.";
 * then "make region card in upper right even larger. should almost extend to left line.",
 * and of the two ways drawn, "I like card to the corner best. make annotation text block in
 * upper right just a tad taller."): an area of the picture outlined at Regular, its top-left
 * corner kept, and across the rest of its top a solid card holding two lines of text, 336
 * by 212, nearly golden. The corner and the region's right edge stop short of the card, so
 * the two read apart at 16px: 28 short, the golden scale's gap for a cut in one shape.
 *
 * The lines are holes, wound against the card and centered in it, not a second color, so
 * they always show the button's own background through them, at rest and inverted on hover
 * alike. Each path sets its own fill and stroke, as the controls' svg fills and strokes in
 * the text color.
 */
export const CommentGlyph = () => (
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="40"
      strokeLinecap="round"
      d="M88 112a40 40 0 0 0-40 40v272a40 40 0 0 0 40 40h288a40 40 0 0 0 40-40V300"
    />
    <path
      fill="currentColor"
      stroke="none"
      d="M176 40h256a40 40 0 0 1 40 40v132a40 40 0 0 1-40 40H176a40 40 0 0 1-40-40V80a40 40 0 0 1 40-40Zm4 58a16 16 0 0 0 0 32h244a16 16 0 0 0 0-32Zm0 64a16 16 0 0 0 0 32h151a16 16 0 0 0 0-32Z"
    />
  </>
);
