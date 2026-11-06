import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { useScrollTrack } from "./useScrollTrack";

/** A viewport 300 wide over 1000 of content, scrolled to `scrollLeft`. */
function sized(element: HTMLElement, scrollLeft = 0) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 1000 },
  });
  element.scrollLeft = scrollLeft;
}

function Track({
  onPress,
  axis,
  upward,
}: {
  onPress?: () => void;
  axis?: "x" | "y";
  upward?: boolean;
}) {
  const track = useScrollTrack({ itemCount: 3, axis, upward });
  return (
    <>
      <div data-testid="viewport" ref={track.ref}>
        <div>
          {[0, 1, 2].map((index) => (
            <button key={index} data-track-index={index} onClick={onPress}>
              {index}
            </button>
          ))}
        </div>
      </div>
      <output data-testid="state">
        {String(track.canScrollPrev)}/{String(track.canScrollNext)}
      </output>
      <button onClick={track.measure}>measure</button>
      <button onClick={track.scrollNext}>forward</button>
    </>
  );
}

/** jsdom has no PointerEvent: a mouse event carrying a pointer's fields. */
function pointer(element: Element, type: string, clientX = 0) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX });
  Object.defineProperties(event, {
    pointerType: { value: "mouse" },
    pointerId: { value: 1 },
  });
  element.dispatchEvent(event);
}

describe("useScrollTrack", () => {
  it("scrolls natively, snapping, without a stylesheet", () => {
    render(<Track />);
    const viewport = screen.getByTestId("viewport");
    expect(viewport.style.overflowX).toBe("auto");
    expect(viewport.style.scrollSnapType).toBe("x mandatory");
  });

  it("scrolls down a column with axis y", () => {
    render(<Track axis="y" />);
    const viewport = screen.getByTestId("viewport");
    expect(viewport.style.overflowY).toBe("auto");
    expect(viewport.style.overflowX).toBe("hidden");
    expect(viewport.style.scrollSnapType).toBe("y mandatory");
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1000 },
    });
    viewport.scrollTop = 700;
    fireEvent.click(screen.getByText("measure"));
    expect(screen.getByTestId("state")).toHaveTextContent("true/false");
  });

  // A column read from its foot up (a Manifest's `bottom-to-top`) starts at the bottom.
  it("runs an upward column from its foot: back is down, forward up", () => {
    render(<Track axis="y" upward />);
    const viewport = screen.getByTestId("viewport");
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1000 },
    });
    const scrollBy = vi.fn();
    viewport.scrollBy = scrollBy;
    viewport.scrollTop = 700;
    fireEvent.click(screen.getByText("measure"));
    expect(screen.getByTestId("state")).toHaveTextContent("false/true");
    fireEvent.click(screen.getByText("forward"));
    expect(scrollBy).toHaveBeenCalledWith({ top: -270, behavior: "smooth" });
    viewport.scrollTop = 0;
    fireEvent.click(screen.getByText("measure"));
    expect(screen.getByTestId("state")).toHaveTextContent("true/false");
  });

  it("keeps a row's wheel at its ends, and hands a column's on to the page", () => {
    const { unmount } = render(<Track />);
    expect(screen.getByTestId("viewport").style.overscrollBehaviorX).toBe(
      "contain",
    );
    unmount();
    render(<Track axis="y" />);
    const column = screen.getByTestId("viewport").style;
    expect(column.overscrollBehaviorY).toBeFalsy();
    expect(column.overscrollBehaviorX).toBeFalsy();
  });

  it("knows whether there is anywhere to go", () => {
    render(<Track />);
    const viewport = screen.getByTestId("viewport");
    sized(viewport, 0);
    fireEvent.click(screen.getByText("measure"));
    expect(screen.getByTestId("state")).toHaveTextContent("false/true");
    sized(viewport, 700);
    fireEvent.click(screen.getByText("measure"));
    expect(screen.getByTestId("state")).toHaveTextContent("true/false");
  });

  it("drags with a mouse, and the click ending a drag presses nothing", () => {
    const onPress = vi.fn();
    render(<Track onPress={onPress} />);
    const viewport = screen.getByTestId("viewport");
    sized(viewport, 100);
    const slide = screen.getByText("1");
    act(() => {
      pointer(viewport, "pointerdown", 200);
      pointer(viewport, "pointermove", 150);
      pointer(viewport, "pointerup", 150);
    });
    expect(viewport.scrollLeft).toBe(150);
    fireEvent.click(slide);
    expect(onPress).not.toHaveBeenCalled();
    // A plain press still presses.
    fireEvent.click(slide);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
