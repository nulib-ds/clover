import React from "react";

/**
 * Pinch: a hand pointing at a touch, a ring around its fingertip and another where the
 * thumb would be, two fingers on the view (Mat, 2026-11-23: "mdi gesture pinch. without
 * the arrows"). It is Material Design Icons' `gesture-pinch` (Pictogrammers, Apache
 * License 2.0, https://pictogrammers.com/library/mdi/icon/gesture-pinch/), its two
 * arrows left out, set on Clover's 512 grid: its 24 grid scaled 24 times, the hand and
 * rings centered, 40 from the top and foot. Filled, as MDI draws it, so it takes no
 * glyph weight. The hint that says to use two fingers shows it (`GestureHint`).
 */
export const PinchGlyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    transform="translate(-68 -80) scale(24)"
    d="M13 9a1 1 0 0 1 1-1a1 1 0 0 1 1 1v4.47l1.21.13l4.94 2.2c.52.24.85.76.85 1.34v4.36c-.03.82-.68 1.47-1.5 1.5H14c-.38 0-.74-.15-1-.43l-4.9-4.2l.74-.77c.19-.21.46-.32.74-.32h.22L13 19zm1-4c1.42 0 2.74.76 3.45 2c1.11 1.9.46 4.35-1.45 5.46v-1.23c.64-.56 1-1.38 1-2.23a3 3 0 0 0-3-3a3 3 0 0 0-3 3c0 .85.36 1.67 1 2.23v1.23c-1.23-.71-2-2.03-2-3.46a4 4 0 0 1 4-4M9 14c.73 0 1.41.19 2 .54v1.22c-.53-.47-1.23-.76-2-.76a3 3 0 0 0-3 3c0 1 .5 1.87 1.22 2.42L9.31 22H9a4 4 0 0 1-4-4a4 4 0 0 1 4-4"
  />
);
