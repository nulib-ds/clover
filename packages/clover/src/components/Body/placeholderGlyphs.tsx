import React from "react";

/*
 * The placeholder's glyphs, drawn as `glyphs.tsx`'s are (a 512 box, taking the button's
 * color), apart from them: only the placeholder (`Canvas/Placeholder.tsx`) and the image
 * controls' tray (`Canvas/ImageControls.tsx`) draw them, both loaded when first needed,
 * while `glyphs.tsx` loads with every Canvas's controls. Beside the others, the
 * magnifiers' long paths rode on every first view, about 0.6 kB gzip.
 */

/** A rounded triangle: plays a video or sound from its placeholder. */
export const Play = () => (
  <path strokeLinejoin="round" strokeWidth="40" d="M184 128V384L392 256Z" />
);

/**
 * A magnifier with a plus: opens the Canvas from its placeholder. The Viewer's
 * placeholder toggle draws the same glyph.
 */
export const OpenViewer = () => (
  <>
    <path
      stroke="none"
      d="m456.69,421.39l-94.09-94.09c22.65-30.16,34.88-66.86,34.84-104.58,0-96.34-78.38-174.72-174.72-174.72S48,126.38,48,222.72s78.38,174.72,174.72,174.72c37.72.04,74.42-12.19,104.58-34.84l94.09,94.09c10.29,9.2,26.1,8.32,35.3-1.98,8.48-9.49,8.48-23.83,0-33.32Zm-233.97-73.87c-68.89-.08-124.72-55.91-124.8-124.8h0c0-68.93,55.87-124.8,124.8-124.8s124.8,55.87,124.8,124.8-55.87,124.8-124.8,124.8Z"
    />
    <path
      stroke="none"
      d="m279.5,197.76h-3.35s-28.47,0-28.47,0v-31.82c-.77-13.79-12.57-24.33-26.36-23.56-12.71.71-22.85,10.86-23.56,23.56v3.35h0v28.47h-31.82c-13.79.77-24.33,12.57-23.56,26.36.71,12.71,10.86,22.85,23.56,23.56h3.35s28.47,0,28.47,0v31.82c.77,13.79,12.57,24.33,26.36,23.56,12.71-.71,22.85-10.86,23.56-23.56v-3.35h0v-28.47h31.82c13.79-.77,24.33-12.57,23.56-26.36-.71-12.71-10.86-22.85-23.56-23.56Z"
    />
  </>
);

/**
 * A magnifier with a minus: closes the Canvas back to its placeholder, the other side of
 * `OpenViewer`'s toggle. The minus is the plus's crossbar.
 */
export const CloseViewer = () => (
  <>
    <path
      stroke="none"
      d="m456.69,421.39l-94.09-94.09c22.65-30.16,34.88-66.86,34.84-104.58,0-96.34-78.38-174.72-174.72-174.72S48,126.38,48,222.72s78.38,174.72,174.72,174.72c37.72.04,74.42-12.19,104.58-34.84l94.09,94.09c10.29,9.2,26.1,8.32,35.3-1.98,8.48-9.49,8.48-23.83,0-33.32Zm-233.97-73.87c-68.89-.08-124.72-55.91-124.8-124.8h0c0-68.93,55.87-124.8,124.8-124.8s124.8,55.87,124.8,124.8-55.87,124.8-124.8,124.8Z"
    />
    <path
      stroke="none"
      d="M167.26 197.76H278.1a24.96 24.96 0 0 1 0 49.92H167.26a24.96 24.96 0 0 1 0-49.92Z"
    />
  </>
);
