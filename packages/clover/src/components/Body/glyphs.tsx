import React from "react";

/*
 * Glyphs for `Canvas`'s own controls, drawn like `Image/Controls/glyphs.tsx`: a 512 box,
 * taking the button's color.
 */

/**
 * A solid speech bubble with two lines of "text": the annotations control.
 *
 * The lines are holes (`evenodd`), not a second color, so they always show the button's
 * own background through them, at rest and inverted on hover alike.
 */
export const Comment = () => (
  <path
    fillRule="evenodd"
    stroke="none"
    d="M144 72H368A96 96 0 0 1 464 168V296A96 96 0 0 1 368 392H200L104 460L144 392A96 96 0 0 1 48 296V168A96 96 0 0 1 144 72Z M168 184H344A16 16 0 0 1 344 216H168A16 16 0 0 1 168 184Z M168 264H280A16 16 0 0 1 280 296H168A16 16 0 0 1 168 264Z"
  />
);

/**
 * A list's lines and their dots: a recording's Chapters control, as the transport drew
 * it (`ui/mediaIcons.tsx`'s `ChaptersIcon`), as shapes for a control's own `svg`.
 */
export const Chapters = () => (
  <>
    <path
      d="M160 144h288M160 256h288M160 368h288"
      fill="none"
      strokeLinecap="round"
      strokeWidth="32"
    />
    <circle cx="80" cy="144" r="20" stroke="none" />
    <circle cx="80" cy="256" r="20" stroke="none" />
    <circle cx="80" cy="368" r="20" stroke="none" />
  </>
);

/** A serifed lower-case `i`: the information control. */
export const Information = () => (
  <path
    stroke="none"
    d="M256 72A48 48 0 1 1 256 168A48 48 0 1 1 256 72Z M192 216H296V384H328V432H184V384H216V264H192Z"
  />
);

/**
 * A map pin, a teardrop standing on its point, round and friendly, a hole through its head
 * (`evenodd`, as the bubble's lines are): the map control.
 */
export const Place = () => (
  <path
    fillRule="evenodd"
    stroke="none"
    d="M256 40C166 40 100 108 100 196C100 300 216 420 246 452A14 14 0 0 0 266 452C296 420 412 300 412 196C412 108 346 40 256 40Z M256 136A60 60 0 1 1 256 256A60 60 0 1 1 256 136Z"
  />
);

/** A cross, drawn as `ZoomIn` is: closes the caption. */
export const Close = () => (
  <path
    strokeLinecap="round"
    strokeWidth="45"
    d="M154 154L358 358M358 154L154 358"
  />
);
