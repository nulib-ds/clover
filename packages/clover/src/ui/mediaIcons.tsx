import React from "react";

import { ZoomExitFullScreen, ZoomFullScreen } from "./controlGlyphs";

/**
 * Ionicons-derived paths at `viewBox="0 0 512 512"`, matching every other glyph in Clover.
 * There is no icon package, by long-standing convention.
 *
 * Play and Pause are drawn by both transports, the media's and an animation's
 * (`Canvas/FrameAnimation.tsx`), so the two read as one family. Full screen is the
 * controls' own glyphs (`controlGlyphs.tsx`), so the one control looks the same wherever
 * it sits (WCAG 3.2.4).
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
    <path d="M133 440a35.37 35.37 0 01-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0135.77.45l247.85 148.36a36 36 0 010 61.11L151.23 435a35.5 35.5 0 01-18.23 5z" />
  </svg>
);

export const PauseIcon = () => (
  <svg {...svgProps}>
    <path d="M224 432h-80V80h80zm144 0h-80V80h80z" />
  </svg>
);

export const VolumeHighIcon = () => (
  <svg {...svgProps}>
    <path d="M232 416a23.88 23.88 0 01-14.2-4.68 8.27 8.27 0 01-.66-.51L125.76 336H56a24 24 0 01-24-24V200a24 24 0 0124-24h69.75l91.37-74.81a8.27 8.27 0 01.66-.51A24 24 0 01256 120v272a24 24 0 01-24 24z" />
    <path
      d="M320 336a16 16 0 01-14.29-23.16c8.34-16.63 12.29-34.5 12.29-56.84s-3.95-40.21-12.29-56.84a16 16 0 0128.58-14.32C345.06 205.86 350 228.13 350 256s-4.94 50.14-15.71 71.16A16 16 0 01320 336zM368 384a16 16 0 01-13.87-24C373.85 325.75 384 292.28 384 256c0-36.28-10.15-69.75-29.87-104a16 16 0 0127.74-16C404.19 174.71 416 214.17 416 256s-11.81 81.29-34.13 120A16 16 0 01368 384z"
      fillOpacity="0.85"
    />
  </svg>
);

export const VolumeMutedIcon = () => (
  <svg {...svgProps}>
    <path d="M232 416a23.88 23.88 0 01-14.2-4.68 8.27 8.27 0 01-.66-.51L125.76 336H56a24 24 0 01-24-24V200a24 24 0 0124-24h69.75l91.37-74.81a8.27 8.27 0 01.66-.51A24 24 0 01256 120v272a24 24 0 01-24 24z" />
    <path
      d="M320 196l128 120M448 196L320 316"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="32"
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
        x="40"
        y="104"
        width="432"
        height="304"
        rx="56"
        fill="none"
        stroke="currentColor"
        strokeWidth="36"
      />
    )}
    <path
      className="clover-captions-icon-letters"
      d="M228 216a48 48 0 1 0 0 80M356 216a48 48 0 1 0 0 80"
      fill="none"
      stroke={on ? "var(--clover-color-control, #1a1d1e)" : "currentColor"}
      strokeLinecap="round"
      strokeWidth="36"
    />
  </svg>
);

export const ChaptersIcon = () => (
  <svg {...svgProps}>
    <path
      d="M160 144h288M160 256h288M160 368h288"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="32"
    />
    <circle cx="80" cy="144" r="20" />
    <circle cx="80" cy="256" r="20" />
    <circle cx="80" cy="368" r="20" />
  </svg>
);

export const FullScreenIcon = () => (
  <svg {...svgProps}>
    <ZoomFullScreen />
  </svg>
);

export const ExitFullScreenIcon = () => (
  <svg {...svgProps}>
    <ZoomExitFullScreen />
  </svg>
);
