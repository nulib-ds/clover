import React from "react";

/*
 * The glyphs for the controls over a Canvas: zoom, full screen, rotate, reset, Choice.
 *
 * Bare `path` elements: `Button` wraps them in its own svg, and a `controlButtons`
 * replacement gets them wrapped in `ControlIcon`. Their strokes are Regular (40, 1.25px at
 * 1rem), but full screen's arrows, Bold (56), as arrows and chevrons are (Mat,
 * 2026-11-21: one Regular weight; 36 and 45 before).
 */

export const ZoomIn = () => {
  return (
    <path
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="40"
      d="M256 112v288M400 256H112"
    />
  );
};

export const ZoomOut = () => {
  return (
    <path
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="40"
      d="M400 256H112"
    />
  );
};

/*
 * Full screen's glyphs: four arrows on the diagonals, one to each corner (Mat,
 * 2026-11-13: "use same arrows as expand/collapse for fullscreen", then "it should be
 * four arrows. all directions"), shaped as Document's way back to its pages shapes its
 * two: each a shaft, rounded at its tail, and a solid head, its corners rounded as the
 * other glyphs' joins are. Regular, with heads a little smaller (Mat, 2026-11-21: "this
 * feels too bold compared to others"; shafts 56 and heads of 112 before), so the four sit
 * at the weight of the controls beside them. Their fill and stroke their own, for the
 * transport's svg too.
 */
const SHAFTS = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeWidth: 40,
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
  <Four shaft="M314 198L376 136" head="M416 96V176L336 96Z" />
);

/**
 * The four arrows pointing in, from the corners to the middle.
 *
 * Shown in place of the expand glyph while full screen is active, so the control reads as
 * where it will take you rather than where you already are.
 */
export const ZoomExitFullScreen = () => (
  <Four shaft="M427 85L339 173" head="M299 213V133L379 213Z" />
);

/**
 * Reset view: a viewfinder, four corner brackets round a solid center, the framing the
 * view opened with (Mat, 2026-11-21: 'think "reset view" -- it about bring the user back
 * to the original point', then, of a target and this, "I like the viewfinder"). An undo
 * arrow before, which said "undo the last thing" and, beside Rotate's arrow, read as
 * another turn. Its brackets Regular (40), their corners a frame's (40); a Scene's rotate
 * pad wears it in its last corner, the way home.
 */
export const Reset = () => {
  return (
    <>
      <path
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="40"
        d="M80 176v-56a40 40 0 0 1 40-40h56M336 80h56a40 40 0 0 1 40 40v56M432 336v56a40 40 0 0 1-40 40h-56M176 432h-56a40 40 0 0 1-40-40v-56"
      />
      <circle stroke="none" cx="256" cy="256" r="52" />
    </>
  );
};

export const Rotate = () => {
  return (
    <>
      <path
        fill="none"
        strokeLinecap="round"
        strokeMiterlimit="10"
        strokeWidth="40"
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
      strokeWidth="40"
      d="M256 64L448 160L256 256L64 160ZM64 256L256 352L448 256M64 352L256 448L448 352"
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
