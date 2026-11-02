import { act, render } from "@testing-library/react";
import React, { useRef, useState } from "react";

import {
  DEFAULT_HIDE_DELAY,
  LEAVE_DELAY,
  useControlsVisibility,
} from "./useControlsVisibility";
import { TAP_MS } from "../../lib/pointer";

function Probe() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const picture = useRef<HTMLDivElement>(null);
  const visible = useControlsVisibility(element, undefined, picture);
  return (
    <div data-testid="probe" data-visible={visible} ref={setElement}>
      <button type="button">Inside</button>
      <div data-testid="controls">
        <button type="button">Zoom in</button>
      </div>
      <div className="clover-canvas-navigator" data-testid="navigator" />
      <div data-testid="picture" ref={picture}>
        <button type="button">Hotspot</button>
      </div>
    </div>
  );
}

const mouse = (type: string) =>
  Object.assign(new MouseEvent(type), { pointerType: "mouse" });

/**
 * A finger's or pen's pointer event at `x`, bubbling from `target`: touching the screen
 * (`buttons` 1) until it lifts, unless `buttons` says otherwise (0, a pen hovering).
 */
function press(
  target: Element,
  type: string,
  {
    x = 10,
    id = 1,
    pointerType = "touch",
    isPrimary = true,
    buttons = type === "pointerup" ? 0 : 1,
  } = {},
) {
  let event!: Event;
  act(() => {
    event = Object.assign(
      new MouseEvent(type, {
        clientX: x,
        clientY: 10,
        buttons,
        bubbles: true,
        cancelable: true,
      }),
      { pointerId: id, pointerType, isPrimary },
    );
    target.dispatchEvent(event);
  });
  return event;
}

/** A pointer's click on `target`, as a browser makes of a press (`detail` 1). */
function click(target: Element, detail = 1) {
  let event!: MouseEvent;
  act(() => {
    event = new MouseEvent("click", {
      detail,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
  });
  return event;
}

/** The faded navigator, over the picture's top left corner. */
function navigatorAt(probe: HTMLElement) {
  const navigator = probe.querySelector(".clover-canvas-navigator")!;
  vi.spyOn(navigator, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 50,
    bottom: 50,
    width: 50,
    height: 50,
  } as DOMRect);
}

/** A finger (or pen) put down on `target` and lifted where it was. */
function tap(target: Element, options: Parameters<typeof press>[2] = {}) {
  press(target, "pointerdown", options);
  press(target, "pointerup", options);
}

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/** How long a finger's controls wait: a mouse's. */
const TOUCH_DELAY = DEFAULT_HIDE_DELAY;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useControlsVisibility", () => {
  it("shows on pointer activity and fades after the hide delay", () => {
    const { getByTestId } = render(<Probe />);
    const probe = getByTestId("probe");
    act(() => void probe.dispatchEvent(mouse("pointermove")));
    expect(probe).toHaveAttribute("data-visible", "true");
    act(() => void vi.advanceTimersByTime(DEFAULT_HIDE_DELAY));
    expect(probe).toHaveAttribute("data-visible", "false");
  });

  it("waits a second after the pointer leaves before fading", () => {
    const { getByTestId } = render(<Probe />);
    const probe = getByTestId("probe");
    act(() => void probe.dispatchEvent(mouse("pointermove")));
    act(() => void probe.dispatchEvent(mouse("pointerleave")));
    act(() => void vi.advanceTimersByTime(LEAVE_DELAY - 1));
    expect(probe).toHaveAttribute("data-visible", "true");
    act(() => void vi.advanceTimersByTime(1));
    expect(probe).toHaveAttribute("data-visible", "false");
  });

  it("waits a second after keyboard focus leaves before fading", () => {
    const { getByTestId, getByRole } = render(<Probe />);
    const probe = getByTestId("probe");
    const inside = getByRole("button", { name: "Inside" });
    act(() => inside.focus());
    act(
      () =>
        void inside.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true }),
        ),
    );
    act(() => inside.blur());
    expect(probe).toHaveAttribute("data-visible", "true");
    act(() => void vi.advanceTimersByTime(LEAVE_DELAY));
    expect(probe).toHaveAttribute("data-visible", "false");
  });

  it("does not flash faded controls back when a mouse-focused viewer blurs", () => {
    const { getByTestId, getByRole } = render(<Probe />);
    const probe = getByTestId("probe");
    const inside = getByRole("button", { name: "Inside" });
    press(inside, "pointerdown", { pointerType: "mouse" });
    act(() => inside.focus());
    wait(DEFAULT_HIDE_DELAY);
    expect(probe).toHaveAttribute("data-visible", "false");
    act(() => inside.blur());
    expect(probe).toHaveAttribute("data-visible", "false");
  });

  /*
   * A screen reader may move focus without `:focus-visible`, so the CSS that holds
   * the controls for the keyboard cannot be relied on: focus from anything but a
   * press shows them.
   */
  it("shows for focus that no press brought, and holds it until focus leaves", () => {
    const { getByTestId, getByRole } = render(<Probe />);
    const probe = getByTestId("probe");
    const inside = getByRole("button", { name: "Inside" });
    act(() => inside.focus());
    expect(probe).toHaveAttribute("data-visible", "true");

    // A mouse passing over and away does not take it from under focus.
    act(() => void probe.dispatchEvent(mouse("pointermove")));
    act(() => void probe.dispatchEvent(mouse("pointerleave")));
    wait(DEFAULT_HIDE_DELAY * 30);
    expect(probe).toHaveAttribute("data-visible", "true");

    // Focus leaving lets it linger its second.
    act(() => inside.blur());
    wait(LEAVE_DELAY - 1);
    expect(probe).toHaveAttribute("data-visible", "true");
    wait(1);
    expect(probe).toHaveAttribute("data-visible", "false");
  });

  it("leaves focus a press brought to the pointer's rules", () => {
    const { getByTestId, getByRole } = render(<Probe />);
    const probe = getByTestId("probe");
    const zoom = getByRole("button", { name: "Zoom in" });
    // A finger on a control, and the focus the browser gives it.
    tap(zoom);
    act(() => zoom.focus());
    wait(TAP_MS);
    expect(probe).toHaveAttribute("data-visible", "false");
  });

  it("treats a pen that hovers as a mouse: shown by its moves, and faded after the delay", () => {
    const { getByTestId } = render(<Probe />);
    const probe = getByTestId("probe");
    const picture = getByTestId("picture");
    press(picture, "pointermove", { pointerType: "pen", buttons: 0 });
    expect(probe).toHaveAttribute("data-visible", "true");
    wait(DEFAULT_HIDE_DELAY);
    expect(probe).toHaveAttribute("data-visible", "false");

    // Its tap on the picture is a mouse's press: it shows the controls, on the timer.
    tap(picture, { pointerType: "pen" });
    expect(probe).toHaveAttribute("data-visible", "true");
    wait(DEFAULT_HIDE_DELAY);
    expect(probe).toHaveAttribute("data-visible", "false");
  });

  describe.each(["touch", "pen", "mouse"])(
    "a %s press on the picture where faded controls sit",
    (pointerType) => {
      it("only shows the controls: the hotspot beneath sees neither the press nor its click", () => {
        const { getByTestId, getByRole } = render(<Probe />);
        const probe = getByTestId("probe");
        navigatorAt(probe);
        const hotspot = getByRole("button", { name: "Hotspot" });
        const reached = vi.fn();
        for (const type of ["pointerdown", "pointerup", "click"])
          hotspot.addEventListener(type, reached);

        const down = press(hotspot, "pointerdown", { pointerType });
        const up = press(hotspot, "pointerup", { pointerType });
        const clicked = click(hotspot);
        expect(reached).not.toHaveBeenCalled();
        expect(down.defaultPrevented).toBe(true);
        expect(up.defaultPrevented).toBe(true);
        expect(clicked.defaultPrevented).toBe(true);
        wait(TAP_MS);
        expect(probe).toHaveAttribute("data-visible", "true");

        // Clear of the faded controls, the hotspot takes its own press.
        press(hotspot, "pointerdown", { pointerType, x: 80 });
        press(hotspot, "pointerup", { pointerType, x: 80 });
        click(hotspot);
        expect(reached).toHaveBeenCalledTimes(3);
      });
    },
  );

  it("swallows no later click than the held press's own, the keyboard's say", () => {
    const { getByTestId, getByRole } = render(<Probe />);
    navigatorAt(getByTestId("probe"));
    const hotspot = getByRole("button", { name: "Hotspot" });
    // A drag from under the faded navigator: held, and no click comes of it.
    press(hotspot, "pointerdown");
    press(hotspot, "pointermove", { x: 60 });
    press(hotspot, "pointerup", { x: 60 });
    const reached = vi.fn();
    hotspot.addEventListener("click", reached);
    wait(TAP_MS);
    click(hotspot, 0);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  describe.each(["touch", "pen"])("under a %s", (pointerType) => {
    it("shows on a tap on the picture, and fades after a mouse's wait, or the next tap", () => {
      const { getByTestId } = render(<Probe />);
      const probe = getByTestId("probe");
      const picture = getByTestId("picture");

      tap(picture, { pointerType });
      // It waits out a double tap's window first.
      expect(probe).toHaveAttribute("data-visible", "false");
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "true");

      // As long as a mouse's, for whoever needs longer to reach one (WCAG 2.2.1).
      wait(TOUCH_DELAY - 1);
      expect(probe).toHaveAttribute("data-visible", "true");
      wait(1);
      expect(probe).toHaveAttribute("data-visible", "false");

      tap(picture, { pointerType });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "true");
      tap(picture, { pointerType });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("keeps the wait when a pressed control lets focus drop to the page", () => {
      const { getByTestId, getByRole } = render(<Probe />);
      const probe = getByTestId("probe");
      const picture = getByTestId("picture");
      const zoom = getByRole("button", { name: "Inside" });
      tap(picture, { pointerType });
      wait(TAP_MS);
      // Focus the press gave inside the viewer (the viewport's, in a browser).
      act(() => zoom.focus());
      // Pause pressed: Safari gives the button no focus, and focus leaves for the page.
      tap(getByRole("button", { name: "Zoom in" }), { pointerType });
      act(() => zoom.blur());
      wait(LEAVE_DELAY * 2);
      expect(probe).toHaveAttribute("data-visible", "true");
      wait(TOUCH_DELAY - LEAVE_DELAY * 2);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("runs no timer while a finger is down, and starts the wait again as it lifts", () => {
      const { getByTestId } = render(<Probe />);
      const probe = getByTestId("probe");
      const picture = getByTestId("picture");
      tap(picture, { pointerType });
      wait(TAP_MS);

      // A drag across the picture, held a long while.
      press(picture, "pointerdown", { pointerType });
      press(picture, "pointermove", { pointerType, x: 60 });
      wait(TOUCH_DELAY * 3);
      expect(probe).toHaveAttribute("data-visible", "true");
      press(picture, "pointerup", { pointerType, x: 60 });
      wait(TOUCH_DELAY - 1);
      expect(probe).toHaveAttribute("data-visible", "true");
      wait(1);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("leaves the controls as they were on a double tap, which zooms", () => {
      const { getByTestId } = render(<Probe />);
      const probe = getByTestId("probe");
      const picture = getByTestId("picture");

      tap(picture, { pointerType });
      tap(picture, { pointerType, x: 14 });
      wait(TAP_MS * 2);
      expect(probe).toHaveAttribute("data-visible", "false");

      tap(picture, { pointerType });
      wait(TAP_MS);
      tap(picture, { pointerType });
      tap(picture, { pointerType });
      wait(TAP_MS * 2);
      expect(probe).toHaveAttribute("data-visible", "true");
    });

    it("leaves it alone on a drag or a pinch", () => {
      const { getByTestId } = render(<Probe />);
      const probe = getByTestId("probe");
      const picture = getByTestId("picture");

      press(picture, "pointerdown", { pointerType });
      press(picture, "pointermove", { pointerType, x: 60 });
      press(picture, "pointerup", { pointerType, x: 60 });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "false");

      press(picture, "pointerdown", { pointerType, id: 1 });
      press(picture, "pointerdown", { pointerType, id: 2, isPrimary: false });
      press(picture, "pointerup", { pointerType, id: 2, isPrimary: false });
      press(picture, "pointerup", { pointerType, id: 1 });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("shows on a tap where a faded control sits, and never hides there", () => {
      const { getByTestId } = render(<Probe />);
      const probe = getByTestId("probe");

      // A faded control takes no pointer, so the press lands on the cluster around it.
      tap(getByTestId("controls"), { pointerType });
      // Not at once: the click the browser makes of the tap would land on the control.
      expect(probe).toHaveAttribute("data-visible", "false");
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "true");
      tap(getByTestId("controls"), { pointerType });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "true");
    });

    it("leaves it to a control, a hotspot included, to handle its own press", () => {
      const { getByTestId, getByRole } = render(<Probe />);
      const probe = getByTestId("probe");

      tap(getByRole("button", { name: "Zoom in" }), { pointerType });
      tap(getByRole("button", { name: "Hotspot" }), { pointerType });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("starts the wait again when one of them is used, then fades", () => {
      const { getByTestId, getByRole } = render(<Probe />);
      const probe = getByTestId("probe");
      const zoom = getByRole("button", { name: "Zoom in" });

      tap(getByTestId("picture"), { pointerType });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "true");

      // A tap on one, Play say, late in the wait: it starts over.
      wait(TOUCH_DELAY - 100);
      tap(zoom, { pointerType });
      wait(TOUCH_DELAY - 1);
      expect(probe).toHaveAttribute("data-visible", "true");
      wait(1);
      expect(probe).toHaveAttribute("data-visible", "false");

      // A drag along one, the seek bar's, from where it was pressed.
      tap(getByTestId("picture"), { pointerType });
      wait(TAP_MS);
      press(zoom, "pointerdown", { pointerType });
      press(zoom, "pointermove", { pointerType, x: 80 });
      press(zoom, "pointerup", { pointerType, x: 80 });
      wait(TOUCH_DELAY);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it.each([
      ["a pick in a menu", "label"],
      ["Play on a paused video", "button"],
    ])(
      "waits again after %s the stylesheet held in sight, then fades",
      (_, tag) => {
        const { getByTestId, getByRole } = render(<Probe />);
        const probe = getByTestId("probe");
        tap(getByTestId("picture"), { pointerType });
        wait(TAP_MS + TOUCH_DELAY);
        expect(probe).toHaveAttribute("data-visible", "false");
        // Held by the stylesheet meanwhile: a menu open among them, or paused.
        probe.style.setProperty("--clover-controls-shown", "1");
        const control = document.createElement(tag);
        getByRole("button", { name: "Zoom in" }).after(control);
        tap(control, { pointerType });
        probe.style.removeProperty("--clover-controls-shown");
        expect(probe).toHaveAttribute("data-visible", "true");
        wait(TOUCH_DELAY - 1);
        expect(probe).toHaveAttribute("data-visible", "true");
        wait(1);
        expect(probe).toHaveAttribute("data-visible", "false");
      },
    );

    it("drops a tap's waiting reveal when a control is pressed, so nothing stays up", () => {
      const { getByTestId, getByRole } = render(<Probe />);
      const probe = getByTestId("probe");
      const picture = getByTestId("picture");
      const zoom = getByRole("button", { name: "Zoom in" });

      // The picture tapped, and Play at once, inside the double tap's window.
      tap(picture, { pointerType });
      tap(zoom, { pointerType });
      wait(TAP_MS + TOUCH_DELAY);
      expect(probe).toHaveAttribute("data-visible", "false");

      // Shown, the picture tapped (to hide them), and a control at once: they still go.
      tap(picture, { pointerType });
      wait(TAP_MS);
      expect(probe).toHaveAttribute("data-visible", "true");
      tap(picture, { pointerType });
      tap(zoom, { pointerType });
      wait(TAP_MS + TOUCH_DELAY);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("leaves faded controls faded when a control that never fades is used", () => {
      const { getByTestId, getByRole } = render(<Probe />);
      const probe = getByTestId("probe");
      tap(getByRole("button", { name: "Zoom in" }), { pointerType });
      wait(TAP_MS + TOUCH_DELAY);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("keeps focus that no press brought, a screen reader's, past a control's use", () => {
      const { getByTestId, getByRole } = render(<Probe />);
      const probe = getByTestId("probe");
      const zoom = getByRole("button", { name: "Zoom in" });
      act(() => zoom.focus());
      expect(probe).toHaveAttribute("data-visible", "true");
      // A screen reader's activation is a click, with no press before it.
      click(zoom);
      wait(LEAVE_DELAY * 10);
      expect(probe).toHaveAttribute("data-visible", "true");
    });

    it("lets a hotspot take its press, the controls waiting again as it lifts", () => {
      const { getByTestId, getByRole } = render(<Probe />);
      const probe = getByTestId("probe");
      tap(getByTestId("picture"), { pointerType });
      wait(TAP_MS);
      tap(getByRole("button", { name: "Hotspot" }), { pointerType });
      wait(TOUCH_DELAY - 1);
      expect(probe).toHaveAttribute("data-visible", "true");
      wait(1);
      expect(probe).toHaveAttribute("data-visible", "false");
    });

    it("stops a mouse's timer, so the controls a mouse showed stay under a finger", () => {
      const { getByTestId } = render(<Probe />);
      const probe = getByTestId("probe");
      act(() => void probe.dispatchEvent(mouse("pointermove")));
      press(getByTestId("picture"), "pointerdown", { pointerType });
      wait(DEFAULT_HIDE_DELAY * 2);
      expect(probe).toHaveAttribute("data-visible", "true");
    });
  });
});
