import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { initCloverI18n } from "../i18n";
import Button from "./Button";
import { scrollNote } from "../components/Canvas/Annotations";
import { SHORTCUTS, Tip, forwardShortcut } from "./Tip";

afterEach(() => initCloverI18n({ lng: "en" }));

describe("Tip", () => {
  it("says what the control's accessible name says, and its key", () => {
    initCloverI18n({ lng: "en" });
    render(
      <Button id="zoomIn-1" label="Zoom in" shortcut={SHORTCUTS.zoomIn}>
        <path d="" />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Zoom in" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Plus");
    const tip = button.querySelector(".clover-tip")!;
    expect(tip).toHaveTextContent("Zoom in (+)");
    // The button carries the name; the popover is not read a second time.
    expect(tip).toHaveAttribute("aria-hidden", "true");
    // No SVG <title>, which browsers would show as a tooltip of their own.
    expect(button.querySelector("title")).toBeNull();
  });

  it("takes its format from the language's strings", () => {
    initCloverI18n({
      lng: "xx",
      resources: {
        xx: { clover: { controlShortcut: "{{shortcut}} : {{label}}" } },
      },
    });
    render(<Tip label="Muet" shortcut={SHORTCUTS.mute} />);
    expect(screen.getByText("M : Muet")).toBeInTheDocument();
  });

  it("shows the name alone for a control with no key", () => {
    render(<Tip label="Close" />);
    expect(screen.getByText("Close")).toHaveClass("clover-tip");
  });

  it("hides on Escape until focus leaves (WCAG 1.4.13)", () => {
    render(
      <Button id="reset-1" label="Reset" shortcut={SHORTCUTS.reset}>
        <path d="" />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Reset" });
    button.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("data-tip-hidden");
    fireEvent.focusOut(button);
    expect(button).not.toHaveAttribute("data-tip-hidden");
  });

  it("is held by a radio's label, and Escape hides it while the radio has focus", () => {
    render(
      <label>
        <input type="radio" name="language" />
        <span>IT</span>
        <Tip label="Sottotitoli in formato WebVTT" lang="it" />
      </label>,
    );
    const radio = screen.getByRole("radio");
    const label = radio.parentElement!;
    expect(label.querySelector(".clover-tip")).toHaveAttribute("lang", "it");
    radio.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(label).toHaveAttribute("data-tip-hidden");
    // Back once focus leaves the radio, and so the label.
    fireEvent.focusOut(radio);
    expect(label).not.toHaveAttribute("data-tip-hidden");
  });

  it("stays hidden as the pointer leaves, and shows when it comes back", () => {
    render(
      <Button id="reset-1" label="Reset" shortcut={SHORTCUTS.reset}>
        <path d="" />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Reset" });
    button.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    // Hidden from under a pointer resting on it, it is the pointer leaving.
    fireEvent.pointerLeave(button);
    expect(button).toHaveAttribute("data-tip-hidden");
    fireEvent.pointerEnter(button);
    expect(button).not.toHaveAttribute("data-tip-hidden");
  });
});

/*
 * WCAG 1.4.10 and 1.4.12: a popover widened by text spacing, zoom or a longer language
 * stays inside what clips it. JSDOM lays nothing out, so each box is given as a browser
 * would measure it; `e2e/specs/tips.spec.ts` measures the real thing.
 */
describe("Tip, longer than its room (WCAG 1.4.10)", () => {
  /** A hotspot's note: 400px of text in 100px, scrolled `top` down. */
  function longNote(top = 0) {
    render(
      <button type="button" aria-label="A long note" onKeyDown={scrollNote}>
        <Tip label="A long note" scrolls />
      </button>,
    );
    const button = screen.getByRole("button", { name: "A long note" });
    const tip = button.querySelector<HTMLElement>(".clover-tip")!;
    Object.defineProperty(tip, "scrollHeight", { value: 400 });
    Object.defineProperty(tip, "clientHeight", { value: 100 });
    tip.scrollTop = top;
    tip.scrollBy = vi.fn();
    return { button, tip };
  }

  it("never takes focus: a press on it focuses its control", () => {
    const { button, tip } = longNote();
    expect(tip).toHaveAttribute("tabindex", "-1");
    expect(tip).toHaveAttribute("aria-hidden", "true");
    const pressed = fireEvent.mouseDown(tip);
    expect(pressed).toBe(false);
    expect(button).toHaveFocus();
  });

  it("scrolls by the keys that scroll a box, from its control", () => {
    const { button, tip } = longNote();
    expect(fireEvent.keyDown(button, { key: "ArrowDown" })).toBe(false);
    expect(tip.scrollBy).toHaveBeenLastCalledWith({ top: 32 });
    fireEvent.keyDown(button, { key: "PageDown" });
    expect(tip.scrollBy).toHaveBeenLastCalledWith({ top: 68 });
    fireEvent.keyDown(button, { key: "End" });
    expect(tip.scrollBy).toHaveBeenLastCalledWith({ top: 400 });
  });

  it("leaves a key alone where there is no more to scroll that way", () => {
    const { button, tip } = longNote(0);
    // At the top: up and Home go on to whatever else hears them.
    expect(fireEvent.keyDown(button, { key: "ArrowUp" })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "Home" })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "Enter" })).toBe(true);
    expect(tip.scrollBy).not.toHaveBeenCalled();
  });

  it("is an ordinary popover where it is not asked to scroll", () => {
    render(<Tip label="Zoom in" />);
    const tip = document.querySelector(".clover-tip")!;
    expect(tip).not.toHaveAttribute("tabindex");
  });
});

describe("Tip, kept inside what clips it", () => {
  function box(element: Element, left: () => number, width: () => number) {
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => {
      const x = left();
      const w = width();
      return {
        x,
        y: 0,
        left: x,
        right: x + w,
        width: w,
        top: 0,
        bottom: 20,
        height: 20,
        toJSON: () => ({}),
      } as DOMRect;
    });
  }

  /** A 300px stage that hides its overflow, a control in it at `at`, and its Tip. */
  function stage(at: number, label = "Reset zoom") {
    const view = render(
      <div data-testid="stage" style={{ overflow: "hidden" }}>
        <button type="button" aria-label={label}>
          <Tip label={label} />
        </button>
      </div>,
    );
    const element = screen.getByTestId("stage");
    Object.defineProperty(element, "clientWidth", { value: 300 });
    box(
      element,
      () => 0,
      () => 300,
    );
    const button = screen.getByRole("button");
    box(
      button,
      () => at,
      () => 36,
    );
    const tip = button.querySelector<HTMLElement>(".clover-tip")!;
    // Its inline padding, `xs`, is the room it keeps from the edge.
    tip.style.paddingLeft = "6px";
    return { ...view, button, tip };
  }

  const room = (tip: HTMLElement) =>
    tip.style.getPropertyValue("--clover-tip-room");
  const shift = (tip: HTMLElement) =>
    tip.style.getPropertyValue("--clover-tip-shift");

  it("moves in from the stage's edge when the pointer comes to its control", () => {
    const { button, tip } = stage(270);
    // Centered on the control, 133px wide: 20px past the stage's end.
    box(
      tip,
      () => 288 - 133 / 2 + (parseFloat(shift(tip)) || 0),
      () => 133,
    );
    fireEvent.pointerEnter(button);
    expect(shift(tip)).toBe(`${294 - (288 + 133 / 2)}px`);
    expect(room(tip)).toBe("");
  });

  it("moves in from the start when focus comes to its control", () => {
    const { button, tip } = stage(4);
    box(
      tip,
      () => 22 - 40 + (parseFloat(shift(tip)) || 0),
      () => 80,
    );
    fireEvent.focus(button);
    expect(shift(tip)).toBe("24px");
  });

  it("stays where its family puts it when it fits", () => {
    const { button, tip } = stage(120);
    box(
      tip,
      () => 98,
      () => 80,
    );
    fireEvent.pointerEnter(button);
    expect(shift(tip)).toBe("");
    expect(room(tip)).toBe("");
  });

  it("wraps to the room beside its control, where it sits beside it", () => {
    const { button, tip } = stage(250);
    // Beside the control, toward the stage (the cluster as a column): ending 6px before it.
    box(
      tip,
      () => 244 - (parseFloat(room(tip)) || 260),
      () => parseFloat(room(tip)) || 260,
    );
    fireEvent.pointerEnter(button);
    expect(room(tip)).toBe("238px");
    expect(shift(tip)).toBe("");
  });

  it("wraps to the stage's width, less its clearance, when wider than the stage", () => {
    const { button, tip } = stage(132);
    box(
      tip,
      () => 150 - (parseFloat(room(tip)) || 400) / 2,
      () => parseFloat(room(tip)) || 400,
    );
    fireEvent.pointerEnter(button);
    expect(room(tip)).toBe("288px");
    expect(shift(tip)).toBe("");
  });

  it("measures afresh each time it shows", () => {
    const { button, tip } = stage(270);
    let width = 133;
    box(
      tip,
      () => 288 - width / 2 + (parseFloat(shift(tip)) || 0),
      () => width,
    );
    fireEvent.pointerEnter(button);
    expect(shift(tip)).not.toBe("");
    width = 10;
    fireEvent.pointerEnter(button);
    expect(shift(tip)).toBe("");
  });
});

describe("forwardShortcut", () => {
  function Stage() {
    const viewport = React.useRef<HTMLDivElement>(null);
    return (
      <figure onKeyDown={(event) => forwardShortcut(event, viewport.current)}>
        <button type="button">Zoom in</button>
        <input aria-label="Volume" />
        <div ref={viewport} data-testid="viewport" tabIndex={0} />
      </figure>
    );
  }

  it("sends a Canvas key pressed on one of its controls to the viewport", () => {
    render(<Stage />);
    const keys: string[] = [];
    screen
      .getByTestId("viewport")
      .addEventListener("keydown", (event) => keys.push(event.key));
    const button = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.keyDown(button, { key: "+" });
    fireEvent.keyDown(button, { key: "R", shiftKey: true });
    // A key the control uses itself, and one typed into a field, are left alone.
    fireEvent.keyDown(button, { key: " " });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Volume" }), {
      key: "m",
    });
    expect(keys).toEqual(["+", "R"]);
  });
});
