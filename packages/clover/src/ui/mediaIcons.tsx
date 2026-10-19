import React from "react";

/**
 * Ionicons-derived paths at `viewBox="0 0 512 512"`, matching every other glyph in Clover.
 * There is no icon package, by long-standing convention.
 *
 * Play and Pause are the same paths `Painting/AnimationControls.tsx` draws, so the two
 * transports read as one family.
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
 * the shape, not by colour (WCAG 1.4.1).
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

export const SettingsIcon = () => (
  <svg {...svgProps}>
    <path
      d="M262.29 192.31a64 64 0 1057.4 57.4 64.13 64.13 0 00-57.4-57.4zM416.39 256a154.34 154.34 0 01-1.53 20.79l45.21 35.46a10.81 10.81 0 012.45 13.75l-42.77 74a10.81 10.81 0 01-13.14 4.59l-44.9-18.08a16.11 16.11 0 00-15.17 1.75A164.48 164.48 0 01325 400.8a15.94 15.94 0 00-8.82 12.14l-6.73 47.89a11.08 11.08 0 01-10.68 9.17h-85.54a11.11 11.11 0 01-10.69-8.87l-6.72-47.82a16.07 16.07 0 00-9-12.22 155.3 155.3 0 01-21.46-12.57 16 16 0 00-15.11-1.71l-44.89 18.07a10.81 10.81 0 01-13.14-4.58l-42.77-74a10.8 10.8 0 012.45-13.75l38.21-30a16.05 16.05 0 006-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 00-6.07-13.94l-38.19-30A10.81 10.81 0 0149.48 186l42.77-74a10.81 10.81 0 0113.14-4.59l44.9 18.08a16.11 16.11 0 0015.17-1.75A164.48 164.48 0 01187 111.2a15.94 15.94 0 008.82-12.14l6.73-47.89A11.08 11.08 0 01213.23 42h85.54a11.11 11.11 0 0110.69 8.87l6.72 47.82a16.07 16.07 0 009 12.22 155.3 155.3 0 0121.46 12.57 16 16 0 0015.11 1.71l44.89-18.07a10.81 10.81 0 0113.14 4.58l42.77 74a10.8 10.8 0 01-2.45 13.75l-38.21 30a16.05 16.05 0 00-6.05 14.08c.33 4.14.55 8.3.55 12.47z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="32"
    />
  </svg>
);

export const FullScreenIcon = () => (
  <svg {...svgProps}>
    <path
      d="M432 320v112H320M421.8 421.77L304 304M80 192V80h112M90.2 90.23L208 208M320 80h112v112M421.77 90.2L304 208M192 432H80V320M90.23 421.8L208 304"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="32"
    />
  </svg>
);

export const ExitFullScreenIcon = () => (
  <svg {...svgProps}>
    <path
      d="M416 320h-96v96M448 288L320 416M96 192h96V96M64 224l128-128M416 192h-96V96M448 224L320 96M96 320h96v96M64 288l128 128"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="32"
    />
  </svg>
);

export const CheckIcon = () => (
  <svg {...svgProps}>
    <path
      d="M416 128L192 384l-96-96"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="44"
    />
  </svg>
);
