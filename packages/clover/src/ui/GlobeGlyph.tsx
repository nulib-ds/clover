import React from "react";

/**
 * A globe, before every choice of languages (`LanguageChoice`, the Transcript's caption
 * files): a little lighter than About's Download glyph beside it (`AboutActions`).
 */
export function GlobeGlyph() {
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
      <circle cx="256" cy="256" r="200" />
      <ellipse cx="256" cy="256" rx="84" ry="200" />
      <path d="M56 256h400M88 160h336M88 352h336" />
    </svg>
  );
}
