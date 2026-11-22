import React from "react";

/**
 * A frame open at its upper right, a box inside it at the lower left, and an arrow from
 * the opening in to the box (Mat, 2026-11-14: "do the opposite icon. one point to bottom
 * left."): expands an Inset, and Document's map, the same wherever it is ("keep icon
 * consistent for expanding the inset"). Its frame is Reset view's viewfinder, the same
 * square with corners turning on 40, and its arrow Exit full screen's top-right arrow, a
 * shaft and a solid head (`ExitFullScreen.tsx`, which `Expand.test.tsx` holds it to), so
 * the three read as one family (Mat, 2026-11-22: "yes option 2"; an open head and a
 * square-cornered frame before). The three parts are one figure, each 46 from the next,
 * the golden scale's gap for the parts of one, the box 109 square to meet the arrow so.
 */
export const ExpandGlyph = () => (
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="40"
      d="M231 80H120a40 40 0 0 0-40 40v272a40 40 0 0 0 40 40h272a40 40 0 0 0 40-40V281"
    />
    <rect
      fill="currentColor"
      stroke="none"
      x="146"
      y="257"
      width="109"
      height="109"
      rx="16"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="40"
      d="M425 87L337 175"
    />
    <path
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="40"
      d="M297 215V135L377 215Z"
    />
  </>
);
