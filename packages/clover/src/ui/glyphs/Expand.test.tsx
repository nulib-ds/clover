import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExitFullScreenGlyph } from "./ExitFullScreen";
import { ExpandGlyph } from "./Expand";

/** Every path a glyph draws, as its `d`. */
const paths = (glyph: React.ReactElement) =>
  [...renderToStaticMarkup(glyph).matchAll(/ d="([^"]+)"/g)].map(
    (match) => match[1],
  );

describe("ExpandGlyph", () => {
  // One family (Mat, 2026-11-22: "yes option 2"): Expand points in with Exit full
  // screen's top-right arrow, its shaft and its head, so a change to one is a change to
  // both.
  it("points in with Exit full screen's top-right arrow", () => {
    const [shaft, head] = paths(<ExitFullScreenGlyph />).map(
      (d) => d.split(/(?=M)/)[0],
    );
    const expand = paths(<ExpandGlyph />);
    expect(expand).toContain(shaft);
    expect(expand).toContain(head);
  });
});
