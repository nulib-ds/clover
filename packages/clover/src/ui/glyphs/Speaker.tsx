import React from "react";

/** The speaker's body, alone: the transport's Muted draws its cross beside it. */
export const SpeakerBody = () => (
  <path d="M246 416a24 24 0 01-14.9-5.2L139.8 336H70a24 24 0 01-24-24V200a24 24 0 0124-24h69.8l91.3-74.8A24 24 0 01270 120v272a24 24 0 01-24 24z" />
);

/**
 * A speaker, for sound, its waves Regular (40): the transport's Volume and a recording
 * with no artwork (Mat, 2026-11-21: of the music note there, "we should do away with this
 * altogether. go for a speaker icon"), and Items' tile for sound with nothing to picture,
 * which draws a copy (`Items/Item.tsx`, held to this by `Speaker.test.tsx`). Its body
 * takes the color around it, the svg's fill. Muted, the transport draws the body and a
 * cross at the same weight (`ui/mediaIcons.tsx`).
 */
export const SpeakerGlyph = () => (
  <>
    <SpeakerBody />
    <path
      d="M336 176a112 112 0 010 160M384 128a176 176 0 010 256"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="40"
    />
  </>
);
