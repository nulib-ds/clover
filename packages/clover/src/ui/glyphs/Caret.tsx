import React from "react";

/**
 * Clover's caret: a right angle at the Bold weight, 56 (1.75px at 1rem, 1.31px at 12px),
 * pointing right and turned clockwise by `rotate` (90 down, 180 left, 270 up). One shape
 * for every chevron: stepping, paging, opening and closing, and the rotate pad's turns.
 */
export const CaretGlyph = ({ rotate = 0 }: { rotate?: number } = {}) => (
  <path
    fill="none"
    stroke="currentColor"
    strokeWidth="56"
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M192 96l160 160-160 160"
    transform={rotate ? `rotate(${rotate} 256 256)` : undefined}
  />
);
