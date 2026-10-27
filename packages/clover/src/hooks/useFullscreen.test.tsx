import { act, render, screen } from "@testing-library/react";
import React, { useState } from "react";

import useFullscreen from "./useFullscreen";
import useWithinFullscreen from "./useWithinFullscreen";

/*
 * Two hooks, not one answering both (DRY.md, A8, measured 2026-10-27): gzip folds the
 * second into the first, and the one written to answer both weighed more in every
 * template.
 */

/** The figure and a control inside it, each saying what the hooks say of it. */
function Probe() {
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const [control, setControl] = useState<HTMLElement | null>(null);
  const outer = [useFullscreen(figure), useWithinFullscreen(figure)];
  const inner = [useFullscreen(control), useWithinFullscreen(control)];
  return (
    <figure ref={setFigure} data-testid="figure">
      <output data-testid="outer">{outer.join(" ")}</output>
      <button ref={setControl} type="button">
        {inner.join(" ")}
      </button>
    </figure>
  );
}

/** As the browser does: the full-screen element changes, then the event says so. */
function fullScreen(element: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => element,
  });
  act(() => void document.dispatchEvent(new Event("fullscreenchange")));
}

afterEach(() => fullScreen(null));

describe("useFullscreen and useWithinFullscreen", () => {
  it("say whether the element is full screen, and whether it sits inside what is", () => {
    render(<Probe />);
    expect(screen.getByTestId("outer")).toHaveTextContent("false false");
    expect(screen.getByRole("button")).toHaveTextContent("false false");

    fullScreen(screen.getByTestId("figure"));
    // The figure is full screen; the control is not, but sits inside it.
    expect(screen.getByTestId("outer")).toHaveTextContent("true true");
    expect(screen.getByRole("button")).toHaveTextContent("false true");

    // Another element took over: neither is in it.
    fullScreen(document.createElement("div"));
    expect(screen.getByTestId("outer")).toHaveTextContent("false false");
    expect(screen.getByRole("button")).toHaveTextContent("false false");
  });

  it("know an element mounted while full screen", () => {
    const outside = document.createElement("section");
    document.body.append(outside);
    fullScreen(outside);
    render(<Probe />, { container: outside });
    expect(screen.getByTestId("outer")).toHaveTextContent("false true");
    outside.remove();
  });
});
