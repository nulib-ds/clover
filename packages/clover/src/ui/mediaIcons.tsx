import React from "react";

import { ExitFullScreenGlyph } from "./glyphs/ExitFullScreen";
import { FullScreenGlyph } from "./glyphs/FullScreen";
import { PlayGlyph } from "./glyphs/Play";
import { SpeakerBody, SpeakerGlyph } from "./glyphs/Speaker";

/**
 * The transports' glyphs, at `viewBox="0 0 512 512"`, matching every other glyph in
 * Clover. There is no icon package, by long-standing convention.
 *
 * Play and Pause are drawn by both transports, the media's and an animation's
 * (`Canvas/FrameAnimation.tsx`), so the two read as one family: Clover's one Play, the
 * placeholder's too (`glyphs/Play.tsx`), and a Pause to match it, two rounded bars as tall
 * as it shows. Volume is Clover's one speaker, which Items
 * and a recording with no artwork show too. Full screen is the controls' own glyphs
 * (`glyphs/FullScreen.tsx`, `glyphs/ExitFullScreen.tsx`), so the one control looks the
 * same wherever it sits (WCAG 3.2.4).
 * Every stroke is Regular (40).
 */

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  // Their own size, so they never fill a button without the stylesheet.
  width: 16,
  height: 16,
  viewBox: "0 0 512 512",
  "aria-hidden": true,
  focusable: false,
} as const;

export const PlayIcon = () => (
  <svg {...svgProps}>
    <PlayGlyph />
  </svg>
);

export const PauseIcon = () => (
  <svg {...svgProps}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="80"
      d="M178 148V364M334 148V364"
    />
  </svg>
);

export const VolumeHighIcon = () => (
  <svg {...svgProps}>
    <SpeakerGlyph />
  </svg>
);

export const VolumeMutedIcon = () => (
  <svg {...svgProps}>
    <SpeakerBody />
    <path
      d="M336 200l112 112M448 200L336 312"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="40"
    />
  </svg>
);

/**
 * Closed captions: a card with "CC" on it, outlined while they are off, filled while they
 * show (the letters then in the control's own fill, as if cut out). The state is told by
 * the shape, not by color (WCAG 1.4.1).
 */
export const CaptionsIcon = ({ on = false }: { on?: boolean }) => (
  <svg {...svgProps} data-on={on || undefined} className="clover-captions-icon">
    {on ? (
      // Filled: the outlined card's outer edge, so the two are one size. No `stroke`,
      // which the transport's glyph rules read as an outline (`Transport.css`).
      <rect
        x="22"
        y="86"
        width="468"
        height="340"
        rx="74"
        fill="currentColor"
      />
    ) : (
      <rect
        x="42"
        y="106"
        width="428"
        height="300"
        rx="54"
        fill="none"
        stroke="currentColor"
        strokeWidth="40"
      />
    )}
    <path
      className="clover-captions-icon-letters"
      d="M222 216a48 48 0 1 0 0 80M364 216a48 48 0 1 0 0 80"
      fill="none"
      stroke={on ? "var(--clover-color-control, #1a1d1e)" : "currentColor"}
      strokeLinecap="round"
      strokeWidth="40"
    />
  </svg>
);

/*
 * A video's fit, one control's two faces (Mat, 2026-11-01: "a toggle to full/contain
 * video … two different icons but be one button"): the frame, and arrows out to fill it
 * (offered while the video is fitted) or in to fit within it (while it fills).
 */
const Frame = () => (
  <rect
    x="42"
    y="106"
    width="428"
    height="300"
    rx="54"
    fill="none"
    stroke="currentColor"
    strokeWidth="40"
  />
);

export const FillIcon = () => (
  <svg {...svgProps}>
    <Frame />
    <path
      d="M176 208l-48 48 48 48M336 208l48 48-48 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="40"
    />
  </svg>
);

export const FitIcon = () => (
  <svg {...svgProps}>
    <Frame />
    <path
      d="M128 208l48 48-48 48M384 208l-48 48 48 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="40"
    />
  </svg>
);

export const FullScreenIcon = () => (
  <svg {...svgProps}>
    <FullScreenGlyph />
  </svg>
);

export const ExitFullScreenIcon = () => (
  <svg {...svgProps}>
    <ExitFullScreenGlyph />
  </svg>
);
