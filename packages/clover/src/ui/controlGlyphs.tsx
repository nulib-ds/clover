import React from "react";

/*
 * The glyphs for the controls over a Canvas: zoom, full screen, rotate, reset, Choice.
 *
 * Bare `path` elements: `Button` wraps them in its own svg, and a `controlButtons`
 * replacement gets them wrapped in `ControlIcon`.
 */

export const ZoomIn = () => {
  return (
    <path
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="45"
      d="M256 112v288M400 256H112"
    />
  );
};

export const ZoomOut = () => {
  return (
    <path
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="45"
      d="M400 256H112"
    />
  );
};

/*
 * Full screen's glyphs: four arrows on the diagonals, one to each corner (Mat,
 * 2026-11-13: "use same arrows as expand/collapse for fullscreen", then "it should be
 * four arrows. all directions"), drawn as Document's way back to its pages draws its two:
 * each a heavy shaft, rounded at its tail, and a solid head, its corners rounded as the
 * other glyphs' joins are. Their fill and stroke their own, for the transport's svg too.
 */
const SHAFTS = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeWidth: 56,
} as const;
const HEADS = {
  fill: "currentColor",
  stroke: "currentColor",
  strokeLinejoin: "round",
  strokeWidth: 40,
} as const;

/** An arrow drawn to the top right corner, turned about the middle to each of the four. */
const Four = ({ shaft, head }: { shaft: string; head: string }) => (
  <>
    {[0, 90, 180, 270].map((turn) => (
      <g key={turn} transform={`rotate(${turn} 256 256)`}>
        <path {...SHAFTS} d={shaft} />
        <path {...HEADS} d={head} />
      </g>
    ))}
  </>
);

/** Four arrows pointing out, from the middle to the corners. */
export const ZoomFullScreen = () => (
  <Four shaft="M304 208L368 144" head="M432 80V192L320 80Z" />
);

/**
 * The four arrows pointing in, from the corners to the middle.
 *
 * Shown in place of the expand glyph while full screen is active, so the control reads as
 * where it will take you rather than where you already are.
 */
export const ZoomExitFullScreen = () => (
  <Four shaft="M440 72L360 152" head="M296 216V104L408 216Z" />
);

export const Reset = () => {
  return (
    <path d="M448 440a16 16 0 01-12.61-6.15c-22.86-29.27-44.07-51.86-73.32-67C335 352.88 301 345.59 256 344.23V424a16 16 0 01-27 11.57l-176-168a16 16 0 010-23.14l176-168A16 16 0 01256 88v80.36c74.14 3.41 129.38 30.91 164.35 81.87C449.32 292.44 464 350.9 464 424a16 16 0 01-16 16z" />
  );
};

export const Rotate = () => {
  return (
    <>
      <path
        fill="none"
        strokeLinecap="round"
        strokeMiterlimit="10"
        strokeWidth="45"
        d="M400 148l-21.12-24.57A191.43 191.43 0 00240 64C134 64 48 150 48 256s86 192 192 192a192.09 192.09 0 00181.07-128"
      />
      <path d="M464 97.42V208a16 16 0 01-16 16H337.42c-14.26 0-21.4-17.23-11.32-27.31L436.69 86.1C446.77 76 464 83.16 464 97.42z" />
    </>
  );
};

/**
 * Clover's glyphs are bare `path` elements, so a replacement gets them wrapped
 * in an svg it can drop straight in. Decorative, since the button carries the
 * name.
 */
/**
 * Three layers, stacked: a diamond over the edges of two more. Stands for "one of these,
 * over the others", what a Choice is (Mat, 2026-11-10: "Make Choice the three layers
 * icon"; a bulleted list before, which a recording's Chapters also wore).
 */
export const Choice = () => {
  return (
    <path
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="36"
      d="M256 72L448 168L256 264L64 168ZM64 256L256 352L448 256M64 344L256 440L448 344"
    />
  );
};

export const ControlIcon = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 512 512"
    fill="currentColor"
    stroke="currentColor"
    focusable="false"
    aria-hidden="true"
    role="presentation"
    data-testid="clover-canvas-button-svg"
    data-label={label}
  >
    {children}
  </svg>
);
