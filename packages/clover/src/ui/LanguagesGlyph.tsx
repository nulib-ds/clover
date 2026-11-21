import React from "react";

import { useUniqueId } from "./useUniqueId";

/**
 * A, its bar at two thirds of its height, low enough that its counter stays open. Every
 * point is a whole unit of the grid, as Clover's glyphs' are: tenths cost bytes for less
 * than a thirtieth of a pixel.
 */
const A = "M44 415L144 167L244 415M84 330H204";

/**
 * A and 文 (wén, writing), before every choice of languages (`LanguageChoice`, the
 * Transcript's caption files; Mat, 2026-11-21, where a globe was). 文's strokes follow the
 * middle lines of PingFang SC and Hiragino Sans GB. Its lower-left stroke, 丿, turns level
 * on A's bar behind A's leg, so the bar seems to run on and come out as 文 (Mat: "draw the
 * lower left line of the wen as if it is come from the cross line of the A"), and an
 * outline around the A cuts it, parallel to the leg ("imagine there is an imaginary
 * outline of the A"). The outline is a mask, so each glyph takes an id of its own; its
 * width, 96, is A's 40 and a gap of 28 each side, the golden scale's gap for a cut in one
 * shape, which `ui/Codes.css` keeps at any `--clover-glyph-weight`. Regular, 40, at
 * `text-s` too, where text-size glyphs take 48: heavier, the letters' counters close.
 */
export function LanguagesGlyph() {
  const id = useUniqueId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="40"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <mask id={id} maskUnits="userSpaceOnUse">
        <rect width="512" height="512" fill="#fff" stroke="none" />
        <path d={A} stroke="#000" strokeWidth="96" />
      </mask>
      <path
        d={`${A}M337 97L359 125M238 149H466M289 162C313 235 365 292 468 330`}
      />
      <path mask={`url(#${id})`} d="M414 154C388 270 269 330 210 330" />
    </svg>
  );
}
