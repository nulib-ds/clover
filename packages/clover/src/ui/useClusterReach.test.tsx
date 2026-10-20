import { render } from "@testing-library/react";
import React, { useState } from "react";

import { useClusterReach } from "./useClusterReach";

/*
 * jsdom lays nothing out: each element's offsets are read from its `data-*` attributes,
 * as a browser would place a wrapped cluster.
 */
const box = (name: "left" | "top" | "width" | "height") =>
  function (this: HTMLElement) {
    return Number(this.dataset[name] ?? 0);
  };

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    box("left"),
  );
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    box("top"),
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    box("width"),
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    box("height"),
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    box("height"),
  );
  // Laid out, unless hidden.
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.hidden ? null : this.parentElement;
    },
  );
});

afterEach(() => vi.restoreAllMocks());

function Stage({
  width,
  controls,
  height = 600,
  at = { left: 400, top: 26 },
}: {
  width: number;
  controls: Array<{ left: number; top: number; hidden?: boolean }>;
  /** The stage's height. */
  height?: number;
  /** Where the cluster sits in the stage. */
  at?: { left: number; top: number };
}) {
  const [cluster, setCluster] = useState<HTMLDivElement | null>(null);
  useClusterReach(cluster);
  return (
    <div className="clover-canvas" data-testid="canvas" data-height={height}>
      <div
        data-width={width}
        data-left={at.left}
        data-top={at.top}
        ref={setCluster}
      >
        {controls.map(({ left, top, hidden }, index) => (
          <button
            data-height={36}
            data-left={left}
            data-top={top}
            data-width={36}
            hidden={hidden}
            key={index}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

const reach = (canvas: HTMLElement) => ({
  width: canvas.style.getPropertyValue("--clover-canvas-controls-width"),
  height: canvas.style.getPropertyValue("--clover-canvas-controls-height"),
});

describe("useClusterReach", () => {
  it("measures from its controls, not its box, which may be wider", () => {
    const { getByTestId } = render(
      <Stage
        width={81}
        controls={[
          { left: 45, top: 0 },
          { left: 45, top: 46 },
        ]}
      />,
    );
    expect(reach(getByTestId("canvas"))).toEqual({
      width: "36px",
      height: "82px",
    });
  });

  it("measures the rows it wraps onto, and leaves out a hidden control", () => {
    const { getByTestId, unmount } = render(
      <Stage
        width={81}
        controls={[
          { left: 45, top: 0 },
          { left: 0, top: 0 },
          { left: 0, top: 200, hidden: true },
        ]}
      />,
    );
    const canvas = getByTestId("canvas");
    expect(reach(canvas)).toEqual({ width: "81px", height: "36px" });
    // Gone with the cluster.
    unmount();
    expect(reach(canvas)).toEqual({ width: "", height: "" });
  });

  // A short stage: below the controls, a popup would have nothing to show.
  it("puts its popups beside it on a short stage, where there is room", () => {
    const one = [{ left: 0, top: 0 }];
    const short = render(<Stage width={36} controls={one} height={117} />);
    expect(short.getByTestId("canvas")).toHaveAttribute(
      "data-popups",
      "beside",
    );
    short.unmount();
    // Tall: below it.
    const tall = render(<Stage width={36} controls={one} />);
    expect(tall.getByTestId("canvas")).not.toHaveAttribute("data-popups");
    tall.unmount();
    // Short, but the controls fill the width: below it still.
    const full = render(
      <Stage
        width={36}
        controls={one}
        height={117}
        at={{ left: 60, top: 26 }}
      />,
    );
    expect(full.getByTestId("canvas")).not.toHaveAttribute("data-popups");
  });
});
