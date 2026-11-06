import React from "react";
import { render } from "@testing-library/react";

import { Loading } from "./Loading";

let now = 0;
const elapsedOf = (mark: Element | null) =>
  (mark as HTMLElement | null)?.style.getPropertyValue(
    "--clover-loading-elapsed",
  );

/** A Body that shows one mark or another, as its parts load. */
function Body({ mark }: { mark: "body" | "canvas" | null }) {
  return (
    <div className="clover-body">
      <div className="clover-canvas">
        {mark === "canvas" && <Loading overlay />}
      </div>
      {mark === "body" && <Loading overlay />}
    </div>
  );
}

const lines = (container: HTMLElement) =>
  container.querySelectorAll(".clover-loading");

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the loading mark's one pass", () => {
  it("goes on from where it was as another mark in the Body takes over", () => {
    const { container, rerender } = render(<Body mark="body" />);
    expect(elapsedOf(lines(container)[0])).toBe("0ms");
    // The Manifest in, the Canvas's tiles on their way: one pass, not a second.
    now = 1200;
    rerender(<Body mark="canvas" />);
    const marks = lines(container);
    expect(marks).toHaveLength(1);
    expect(elapsedOf(marks[0])).toBe("1200ms");
  });

  it("goes on even from a mark gone before it showed", () => {
    const { container, rerender } = render(<Body mark="body" />);
    now = 100;
    rerender(<Body mark={null} />);
    expect(lines(container)).toHaveLength(0);
    now = 160;
    rerender(<Body mark="canvas" />);
    expect(elapsedOf(lines(container)[0])).toBe("160ms");
  });

  it("goes on in a Body drawn afresh, as a Viewer given another resource is", () => {
    const { container, rerender } = render(<Body key="old" mark="body" />);
    now = 400;
    // The Viewer remounts: its old Body gone, the new one's mark takes the pass over.
    rerender(<Body key="new" mark="canvas" />);
    expect(elapsedOf(lines(container)[0])).toBe("400ms");
  });

  it("never lends a pass to a Body that is still on the page", () => {
    const { container } = render(
      <>
        <Body mark="body" />
        <div id="other" />
      </>,
    );
    now = 400;
    // Another Viewer's mark, while the first's Body stays: a pass of its own.
    const other = render(<Body mark="canvas" />, {
      container: container.querySelector<HTMLElement>("#other")!,
    });
    expect(elapsedOf(lines(other.container)[0])).toBe("0ms");
  });

  it("begins again once nothing has loaded in the Body for a moment", () => {
    const { container, rerender } = render(<Body mark="body" />);
    now = 100;
    rerender(<Body mark={null} />);
    vi.advanceTimersByTime(200);
    now = 5000;
    rerender(<Body mark="canvas" />);
    expect(elapsedOf(lines(container)[0])).toBe("0ms");
  });

  it("runs to the end and goes once nothing loads, having shown", () => {
    // As a page with Clover's styles draws it: the line running its pass.
    const computed = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
      element.parentElement?.classList.contains("clover-loading")
        ? ({
            animationName: "clover-loading-pass",
            transform: "matrix(0.6, 0, 0, 1, 0, 0)",
          } as CSSStyleDeclaration)
        : computed(element),
    );
    const { container, rerender } = render(<Body mark="body" />);
    now = 1200;
    rerender(<Body mark={null} />);
    // Left in its place a moment, still running, for a mark that might take over.
    const [line] = lines(container);
    expect(line).toBeDefined();
    expect(elapsedOf(line)).toBe("1200ms");
    expect(line).not.toHaveAttribute("data-done");
    // Then done: `Loading.css` runs it from where it is to the end, and fades it.
    vi.advanceTimersByTime(100);
    expect(line).toHaveAttribute("data-done");
    // Held where the pass had it, for the run home to start from.
    expect((line.firstElementChild as HTMLElement).style.transform).toBe(
      "matrix(0.6, 0, 0, 1, 0, 0)",
    );
    vi.advanceTimersByTime(330);
    expect(lines(container)).toHaveLength(0);
  });

  it("leaves nothing behind where its styles are not on the page", () => {
    const { container, rerender } = render(<Body mark="body" />);
    now = 1200;
    rerender(<Body mark={null} />);
    expect(lines(container)).toHaveLength(0);
  });

  it("leaves nothing behind a load too quick to show it", () => {
    const { container, rerender } = render(<Body mark="body" />);
    now = 120;
    rerender(<Body mark={null} />);
    expect(lines(container)).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(lines(container)).toHaveLength(0);
  });
});
