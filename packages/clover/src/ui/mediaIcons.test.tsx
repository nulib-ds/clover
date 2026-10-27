import { render } from "@testing-library/react";
import React from "react";

import { ZoomExitFullScreen, ZoomFullScreen } from "./controlGlyphs";
import { ExitFullScreenIcon, FullScreenIcon } from "./mediaIcons";

/** The glyph's path, as drawn. */
const drawn = (glyph: React.ReactElement) =>
  render(glyph).container.querySelector("path")?.getAttribute("d");

/*
 * Full screen is one control, in the controls over a Canvas or a Scene and in the media
 * transport: it looks the same in each (WCAG 3.2.4).
 */
describe("the transport's full-screen glyphs", () => {
  it("are the controls' own, to enter and to exit", () => {
    expect(drawn(<FullScreenIcon />)).toBe(
      drawn(
        <svg>
          <ZoomFullScreen />
        </svg>,
      ),
    );
    expect(drawn(<ExitFullScreenIcon />)).toBe(
      drawn(
        <svg>
          <ZoomExitFullScreen />
        </svg>,
      ),
    );
  });

  it("keep their own size and stay out of the accessibility tree", () => {
    const svg = render(<ExitFullScreenIcon />).container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
