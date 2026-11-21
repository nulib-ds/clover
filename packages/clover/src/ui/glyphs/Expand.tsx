import React from "react";

/** The Expand glyph's lines: rounded, Regular. */
const EXPAND_LINE = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 40,
} as const;

/**
 * A frame open at its upper right, a box inside it at the lower left, and an arrow from
 * the opening down to the box (Mat, 2026-11-14: "do the opposite icon. one point to bottom
 * left."): expands an Inset, and Document's map, the same wherever it is ("keep icon
 * consistent for expanding the inset"). The three are one figure, each 46 from the next,
 * the golden scale's gap for the parts of one, the box 132 square to meet the arrow so.
 */
export const ExpandGlyph = () => (
  <>
    <path {...EXPAND_LINE} d="M226 72H72V440H440V286" />
    <rect
      fill="currentColor"
      stroke="none"
      x="138"
      y="242"
      width="132"
      height="132"
      rx="16"
    />
    <path {...EXPAND_LINE} d="M429.77 82.2L312 200M424 200H312V88" />
  </>
);
