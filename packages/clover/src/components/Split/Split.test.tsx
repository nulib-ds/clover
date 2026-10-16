import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { initCloverI18n } from "../../i18n";
import { Split, SplitHandle, SplitPane, toPixels } from "./Split";

/*
 * jsdom has no PointerEvent: a mouse event that carries the pointer's id and type stands
 * in, so a press has its `button` and `clientX`.
 */
class PointerEventStandIn extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}
const nativePointerEvent = window.PointerEvent;
beforeAll(() => {
  window.PointerEvent ??= PointerEventStandIn as typeof PointerEvent;
});
afterAll(() => {
  window.PointerEvent = nativePointerEvent;
});

/*
 * jsdom lays nothing out: a 1000px split, its bars 3px, each sized pane as wide as its
 * size says (its `--clover-split-size`, or the `size` it starts at) up to `squeeze`, and
 * the panes without one sharing the rest, laid out left to right.
 */
const ACROSS = 1000;
const BAR = 3;
let squeeze = Infinity;
const unsized = (node: Element) =>
  node.classList.contains("clover-split-pane") &&
  !node.hasAttribute("data-sized");
const widthOf = (element: HTMLElement): number => {
  if (element.classList.contains("clover-split-handle")) return BAR;
  if (!element.classList.contains("clover-split-pane")) return 0;
  if (!unsized(element)) {
    const size = element.style.getPropertyValue("--clover-split-size");
    return Math.min(toPixels(size, ACROSS) ?? 0, squeeze);
  }
  const siblings = Array.from(element.parentElement!.children) as HTMLElement[];
  const rest = siblings
    .filter((node) => !unsized(node))
    .reduce((left, node) => left - widthOf(node), ACROSS);
  return rest / siblings.filter(unsized).length;
};
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  squeeze = Infinity;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(ACROSS);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const width = widthOf(this);
      let left = 0;
      for (
        let node = this.previousElementSibling;
        node;
        node = node.previousElementSibling
      )
        left += widthOf(node as HTMLElement);
      return {
        left,
        right: left + width,
        width,
        top: 0,
        bottom: 0,
      } as DOMRect;
    },
  );
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Layout({ storageKey }: { storageKey?: string }) {
  return (
    <Split storageKey={storageKey}>
      <SplitPane min="16rem">Stage</SplitPane>
      <SplitHandle />
      <SplitPane name="panel" size="24rem" min="14rem" data-testid="panel">
        Panel
      </SplitPane>
    </Split>
  );
}

const size = () =>
  screen.getByTestId("panel").style.getPropertyValue("--clover-split-size");

describe("Split", () => {
  it("holds each pane's minimum in the layout, not only under a handle", () => {
    render(
      <Split>
        <SplitPane min="16rem">Stage</SplitPane>
        <SplitHandle />
        <SplitPane size="24rem" min="14rem">
          Panel
        </SplitPane>
        <SplitPane>Rest</SplitPane>
      </Split>,
    );
    // The sized pane gives way, down to its minimum, before the other does.
    expect(screen.getByText("Stage").style.minWidth).toBe("16rem");
    expect(screen.getByText("Panel").style.minWidth).toBe("14rem");
    // Without one it can still shrink past its content.
    expect(parseFloat(screen.getByText("Rest").style.minWidth)).toBe(0);
  });

  it("lays panes side by side, the sized one at its size, and names its bar", () => {
    render(<Layout />);
    const split = document.querySelector(".clover-split") as HTMLElement;
    expect(split.style.display).toBe("flex");
    expect(size()).toBe("24rem");
    const handle = screen.getByRole("separator", { name: "Resize panels" });
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("moves by keyboard, toward the sized pane to shrink it, within its limits", async () => {
    render(<Layout />);
    const handle = screen.getByRole("separator");
    // The panel is after the bar: Left widens it, by 1rem; Shift moves 4rem.
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(size()).toBe("400px");
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    expect(size()).toBe("336px");
    // Home is its own minimum; End leaves the stage its minimum (1000 − the bar − 16rem).
    fireEvent.keyDown(handle, { key: "Home" });
    expect(size()).toBe("224px");
    fireEvent.keyDown(handle, { key: "End" });
    expect(size()).toBe("741px");
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "74"));
    expect(handle).toHaveAttribute("aria-valuemin", "22");
    expect(handle).toHaveAttribute("aria-valuemax", "74");
  });

  it("steps by a click or a tap through its narrowest, its own size and its widest (WCAG 2.5.7)", async () => {
    render(<Layout />);
    const handle = screen.getByRole("separator");
    // From its own size, wider: the stage keeps its minimum (1000 − the bar − 16rem).
    fireEvent.click(handle);
    expect(size()).toBe("741px");
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "74"));
    // From its widest, round to its narrowest.
    fireEvent.click(handle);
    expect(size()).toBe("224px");
    // Then its own size again, as it asked: the reader's is forgotten.
    fireEvent.click(handle);
    expect(size()).toBe("24rem");
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "38"));
    // From a width between two, the next above it.
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(size()).toBe("368px");
    fireEvent.click(handle);
    expect(size()).toBe("24rem");
  });

  it("follows a drag from where it was taken, and the click that ends a drag does not step", () => {
    render(<Layout />);
    const handle = screen.getByRole("separator");
    const at = (clientX: number) => ({ clientX, button: 0, pointerId: 1 });
    fireEvent.pointerDown(handle, at(616));
    expect(handle).toHaveAttribute("data-dragging");
    // The panel is after the bar: leftward widens it, by as far as the pointer goes.
    fireEvent.pointerMove(handle, at(596));
    expect(size()).toBe("404px");
    fireEvent.pointerMove(handle, at(656));
    expect(size()).toBe("344px");
    fireEvent.pointerUp(handle, at(656));
    fireEvent.click(handle, at(656));
    expect(size()).toBe("344px");
    expect(handle).not.toHaveAttribute("data-dragging");
  });

  it("takes a press that barely moves for a click, a finger's with more room than a mouse's", () => {
    render(<Layout />);
    const handle = screen.getByRole("separator");
    const at = (clientX: number, pointerType = "mouse") => ({
      clientX,
      button: 0,
      pointerId: 1,
      pointerType,
    });
    fireEvent.pointerDown(handle, at(616));
    fireEvent.pointerMove(handle, at(613));
    expect(size()).toBe("24rem");
    fireEvent.pointerUp(handle, at(613));
    fireEvent.click(handle, at(613));
    expect(size()).toBe("741px");

    // A finger may wander further: six pixels is still a tap, not a drag.
    fireEvent.pointerDown(handle, at(256, "touch"));
    fireEvent.pointerMove(handle, at(250, "touch"));
    expect(size()).toBe("741px");
    fireEvent.pointerUp(handle, at(250, "touch"));
    fireEvent.click(handle, at(250, "touch"));
    expect(size()).toBe("224px");
  });

  it("steps each pane of three within the room it shares with the pane beside it", async () => {
    render(
      <Split>
        <SplitPane
          name="sidebar"
          size="13rem"
          min="8rem"
          max="24rem"
          data-testid="sidebar"
        >
          Thumbnails
        </SplitPane>
        <SplitHandle aria-label="Resize the thumbnails" />
        <SplitPane min="16rem">Page</SplitPane>
        <SplitHandle aria-label="Resize the panel" />
        <SplitPane name="panel" size="24rem" min="14rem" data-testid="panel">
          Panel
        </SplitPane>
      </Split>,
    );
    const thumbnails = screen.getByRole("separator", {
      name: "Resize the thumbnails",
    });
    const panel = screen.getByRole("separator", { name: "Resize the panel" });
    const sidebar = () =>
      screen
        .getByTestId("sidebar")
        .style.getPropertyValue("--clover-split-size");
    // The page is 402px (1000 − 208 − 384 − two bars): the panel may take all but its
    // 16rem, not the split's whole width, which would squeeze the thumbnails.
    await waitFor(() => expect(panel).toHaveAttribute("aria-valuemax", "53"));
    fireEvent.click(panel);
    expect(size()).toBe("530px");
    fireEvent.click(panel);
    expect(size()).toBe("224px");
    fireEvent.click(panel);
    expect(size()).toBe("24rem");
    expect(sidebar()).toBe("13rem");

    // The thumbnails share the page's 402px in turn, up to their own 24rem at most.
    fireEvent.click(thumbnails);
    expect(sidebar()).toBe("354px");
    fireEvent.click(thumbnails);
    expect(sidebar()).toBe("128px");
    fireEvent.click(thumbnails);
    expect(sidebar()).toBe("13rem");
    expect(size()).toBe("24rem");
  });

  it("steps on from the width it was given, where the layout squeezes it below that", () => {
    render(<Layout />);
    const handle = screen.getByRole("separator");
    // Given no more than 300px, the panel stays under its own 24rem: still, it steps.
    squeeze = 300;
    fireEvent.click(handle);
    expect(size()).toBe("741px");
    fireEvent.click(handle);
    expect(size()).toBe("224px");
    fireEvent.click(handle);
    expect(size()).toBe("24rem");
    fireEvent.click(handle);
    expect(size()).toBe("741px");
  });

  it("lets go the second click of a double click, which lands where the bar was", () => {
    vi.useFakeTimers();
    const onStage = vi.fn();
    render(
      <Split>
        <SplitPane min="16rem">
          <button type="button" onClick={onStage} onPointerDown={onStage}>
            Stage
          </button>
        </SplitPane>
        <SplitHandle />
        <SplitPane size="24rem" min="14rem" data-testid="panel">
          Panel
        </SplitPane>
      </Split>,
    );
    const handle = screen.getByRole("separator");
    const stage = screen.getByRole("button", { name: "Stage" });
    const at = (clientX: number) => ({
      clientX,
      clientY: 300,
      button: 0,
      pointerId: 1,
    });
    const click = (target: Element, clientX: number) => {
      fireEvent.pointerDown(target, at(clientX));
      fireEvent.pointerUp(target, at(clientX));
      fireEvent.click(target, at(clientX));
    };
    // The step moves the bar from under the pointer: the stage is there now.
    click(handle, 616);
    expect(size()).toBe("741px");
    click(stage, 617);
    fireEvent.dblClick(stage, at(617));
    expect(onStage).not.toHaveBeenCalled();
    expect(size()).toBe("741px");

    // Once a double click's time has passed, a click there is the stage's.
    vi.advanceTimersByTime(500);
    click(stage, 617);
    expect(onStage).toHaveBeenCalled();

    // So it is as soon as the pointer moves away.
    onStage.mockClear();
    click(handle, 616);
    fireEvent.pointerMove(document.body, at(660));
    click(stage, 660);
    expect(onStage).toHaveBeenCalled();

    // And a second click on the bar itself is a step of its own.
    click(handle, 616);
    click(handle, 616);
    expect(size()).toBe("741px");
  });

  it("neither steps nor drags from a press on its popover, which covers the next pane", () => {
    render(<Layout />);
    const handle = screen.getByRole("separator");
    const tip = handle.querySelector(".clover-tip")!;
    const at = (clientX: number) => ({ clientX, button: 0, pointerId: 1 });
    fireEvent.pointerDown(tip, at(700));
    expect(handle).not.toHaveAttribute("data-dragging");
    fireEvent.pointerMove(tip, at(640));
    fireEvent.pointerUp(tip, at(640));
    fireEvent.click(tip, at(640));
    expect(size()).toBe("24rem");
  });

  it("leaves a click its own handler, and steps not when that handler prevents it", () => {
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Split>
        <SplitPane min="16rem">Stage</SplitPane>
        <SplitHandle onClick={onClick} />
        <SplitPane size="24rem" min="14rem" data-testid="panel">
          Panel
        </SplitPane>
      </Split>,
    );
    fireEvent.click(screen.getByRole("separator"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(size()).toBe("24rem");
  });

  it("names itself in a popover with the same words as its name, hidden from assistive technology", () => {
    render(<Layout />);
    const handle = screen.getByRole("separator", { name: "Resize panels" });
    const tip = handle.querySelector(".clover-tip");
    expect(tip).toHaveTextContent("Resize panels");
    expect(tip).toHaveAttribute("aria-hidden", "true");
    expect(handle).not.toHaveAttribute("title");
  });

  it("names its popover as it is named, when given a name of its own", () => {
    render(
      <Split>
        <SplitPane>Stage</SplitPane>
        <SplitHandle aria-label="Resize the thumbnails" />
        <SplitPane size="13rem">Thumbnails</SplitPane>
      </Split>,
    );
    const handle = screen.getByRole("separator", {
      name: "Resize the thumbnails",
    });
    expect(handle.querySelector(".clover-tip")).toHaveTextContent(
      "Resize the thumbnails",
    );
  });

  it("remembers the size under its storage key, for the same layout next time", async () => {
    const { unmount } = render(<Layout storageKey="test-split" />);
    fireEvent.keyDown(screen.getByRole("separator"), { key: "Home" });
    expect(JSON.parse(localStorage.getItem("test-split")!)).toEqual({
      panel: 224,
    });
    unmount();
    render(<Layout storageKey="test-split" />);
    await waitFor(() => expect(size()).toBe("224px"));
  });

  it("reads lengths in px, rem and percent of the split", () => {
    expect(toPixels(320, 1000)).toBe(320);
    expect(toPixels("20px", 1000)).toBe(20);
    expect(toPixels("2rem", 1000)).toBe(32);
    expect(toPixels("25%", 1000)).toBe(250);
    expect(toPixels(undefined, 1000)).toBeUndefined();
  });
});
