import {
  DEFAULT_GESTURES,
  GestureController,
  type GestureTarget,
} from "./GestureController";

function setup(options = DEFAULT_GESTURES) {
  const element = document.createElement("div");
  element.tabIndex = 0;
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
  document.body.appendChild(element);
  const target: GestureTarget = {
    panBy: vi.fn(),
    zoomBy: vi.fn(),
    flick: vi.fn(),
    home: vi.fn(),
    rotateBy: vi.fn(),
    setInteracting: vi.fn(),
  };
  const controller = new GestureController(element, target, options);
  return { element, target, controller };
}

describe("GestureController", () => {
  it("leaves a plain wheel to the page when scrollToZoom is off", () => {
    const { element, target } = setup();
    const event = new WheelEvent("wheel", { deltaY: 100, cancelable: true });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(target.zoomBy).not.toHaveBeenCalled();
  });

  it("zooms on a trackpad pinch even with scrollToZoom off", () => {
    const { element, target } = setup();
    const event = new WheelEvent("wheel", {
      deltaY: -20,
      ctrlKey: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const [factor] = (target.zoomBy as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(factor).toBeGreaterThan(1);
  });

  it("leaves the wheel to a box in the stage that scrolls that way", () => {
    const { element, target } = setup({
      ...DEFAULT_GESTURES,
      scrollToZoom: true,
    });
    // A long hotspot note, 400px of text in 100px, at its top.
    const note = document.createElement("span");
    note.style.overflowY = "auto";
    Object.defineProperty(note, "scrollHeight", { value: 400 });
    Object.defineProperty(note, "clientHeight", { value: 100 });
    element.append(note);
    const down = new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    note.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(target.zoomBy).not.toHaveBeenCalled();
    // Nothing more above it: the wheel up zooms, as anywhere else on the stage.
    const up = new WheelEvent("wheel", {
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    });
    note.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
    expect(target.zoomBy).toHaveBeenCalledTimes(1);
  });

  it("zooms on a plain wheel when scrollToZoom is on", () => {
    const { element, target } = setup({
      ...DEFAULT_GESTURES,
      scrollToZoom: true,
    });
    const event = new WheelEvent("wheel", { deltaY: 100, cancelable: true });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const [factor] = (target.zoomBy as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(factor).toBeLessThan(1);
  });

  it.each([
    ["ArrowLeft", "panBy", [40, 0, true]],
    ["ArrowRight", "panBy", [-40, 0, true]],
    ["ArrowUp", "panBy", [0, 20, true]],
    ["+", "zoomBy", [1.5, undefined, true]],
    ["-", "zoomBy", [1 / 1.5, undefined, true]],
    ["0", "home", []],
    ["r", "rotateBy", [90]],
    ["R", "rotateBy", [-90]],
  ])("maps %s to %s", (key, method, args) => {
    const { element, target } = setup();
    const event = new KeyboardEvent("keydown", { key, cancelable: true });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect((target as any)[method]).toHaveBeenCalledWith(...args);
  });

  it("ignores keys it does not handle, and modified keys", () => {
    const { element, target } = setup();
    const plain = new KeyboardEvent("keydown", { key: "x", cancelable: true });
    const modified = new KeyboardEvent("keydown", {
      key: "+",
      metaKey: true,
      cancelable: true,
    });
    element.dispatchEvent(plain);
    element.dispatchEvent(modified);
    expect(plain.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    expect(target.zoomBy).not.toHaveBeenCalled();
  });

  it("stops listening on dispose", () => {
    const { element, target, controller } = setup();
    controller.dispose();
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "0" }));
    expect(target.home).not.toHaveBeenCalled();
  });

  it("starts no drag from a hotspot or its popover, which handle their own presses", () => {
    const { element, target } = setup();
    const hotspot = document.createElement("button");
    const tip = document.createElement("span");
    tip.className = "clover-tip";
    hotspot.appendChild(tip);
    element.appendChild(hotspot);
    const pointer = (from: Element, type: string, x: number) =>
      from.dispatchEvent(
        Object.assign(
          new MouseEvent(type, {
            clientX: x,
            clientY: 10,
            button: 0,
            bubbles: true,
          }),
          { pointerId: 1, pointerType: "mouse" },
        ),
      );
    pointer(tip, "pointerdown", 10);
    pointer(element, "pointermove", 80);
    pointer(element, "pointerup", 80);
    expect(target.setInteracting).not.toHaveBeenCalled();
    expect(target.panBy).not.toHaveBeenCalled();
    expect(target.zoomBy).not.toHaveBeenCalled();
  });

  it("holds the camera still when not navigable, reporting only taps", () => {
    const { element, target } = setup({
      ...DEFAULT_GESTURES,
      clickToZoom: false,
      navigable: false,
    });
    target.tap = vi.fn();
    const pointer = (type: string, x: number) =>
      element.dispatchEvent(
        Object.assign(
          new MouseEvent(type, { clientX: x, clientY: 10, button: 0 }),
          { pointerId: 1, pointerType: "mouse" },
        ),
      );

    // A drag moves nothing.
    pointer("pointerdown", 10);
    pointer("pointermove", 60);
    pointer("pointerup", 60);
    expect(target.panBy).not.toHaveBeenCalled();
    expect(target.flick).not.toHaveBeenCalled();

    // A click is still a tap (play / pause).
    pointer("pointerdown", 20);
    pointer("pointerup", 20);
    expect(target.tap).toHaveBeenCalledTimes(1);

    // Double-click, keys and a trackpad pinch are left alone.
    element.dispatchEvent(new MouseEvent("dblclick", { clientX: 20 }));
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
    const pinch = new WheelEvent("wheel", { ctrlKey: true, cancelable: true });
    element.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(false);
    expect(target.zoomBy).not.toHaveBeenCalled();
  });

  describe("taps", () => {
    const tap = (
      element: HTMLElement,
      pointerType: string,
      { x = 20, shiftKey = false } = {},
    ) => {
      for (const type of ["pointerdown", "pointerup"])
        element.dispatchEvent(
          Object.assign(
            new MouseEvent(type, {
              clientX: x,
              clientY: 10,
              button: 0,
              shiftKey,
            }),
            { pointerId: 1, pointerType },
          ),
        );
    };

    it.each(["touch", "pen"])(
      "zooms in on a double %s tap, never on a single one",
      (pointerType) => {
        const { element, target } = setup();
        tap(element, pointerType);
        expect(target.zoomBy).not.toHaveBeenCalled();
        tap(element, pointerType, { x: 24 });
        expect(target.zoomBy).toHaveBeenCalledWith(2, { x: 24, y: 10 }, true);
      },
    );

    /*
     * A desktop tablet's pen, or an Apple Pencil that hovers, points as a mouse does: its
     * click zooms, and the renderer's `tap` (a video's play and pause) is a click's.
     */
    it("treats a pen it has seen hover as a mouse", () => {
      const { element, target } = setup();
      element.dispatchEvent(
        Object.assign(
          new MouseEvent("pointermove", { clientX: 20, clientY: 10 }),
          { pointerId: 1, pointerType: "pen" },
        ),
      );
      tap(element, "pen");
      expect(target.zoomBy).toHaveBeenCalledWith(2, { x: 20, y: 10 }, true);
      expect(target.zoomBy).toHaveBeenCalledTimes(1);

      const media = setup({ ...DEFAULT_GESTURES, clickToZoom: false });
      media.target.tap = vi.fn();
      media.element.dispatchEvent(
        Object.assign(new MouseEvent("pointermove"), {
          pointerId: 1,
          pointerType: "pen",
        }),
      );
      tap(media.element, "pen");
      expect(media.target.tap).toHaveBeenCalledTimes(1);
    });

    it("does not zoom on a double tap when the host turns both click zooms off", () => {
      const { element, target } = setup({
        ...DEFAULT_GESTURES,
        clickToZoom: false,
        dblClickToZoom: false,
      });
      tap(element, "touch");
      tap(element, "touch");
      expect(target.zoomBy).not.toHaveBeenCalled();
    });

    /*
     * One pointer can always zoom back out, whatever controls the host shows (WCAG
     * 2.5.1): zoomed in as far as it goes, a zoom in goes home.
     */
    it.each([
      {
        gesture: "a double tap",
        clickToZoom: true,
        zoomIn: (element: HTMLElement) => {
          tap(element, "touch");
          tap(element, "touch");
        },
      },
      {
        gesture: "a click",
        clickToZoom: true,
        zoomIn: (element: HTMLElement) => tap(element, "mouse"),
      },
      {
        gesture: "a double click",
        clickToZoom: false,
        zoomIn: (element: HTMLElement) =>
          element.dispatchEvent(new MouseEvent("dblclick", { clientX: 20 })),
      },
    ])(
      "goes home on $gesture at the largest zoom",
      ({ clickToZoom, zoomIn }) => {
        const { element, target } = setup({ ...DEFAULT_GESTURES, clickToZoom });
        target.atMaxZoom = () => false;
        zoomIn(element);
        expect(target.zoomBy).toHaveBeenCalledTimes(1);
        expect(target.home).not.toHaveBeenCalled();

        target.atMaxZoom = () => true;
        zoomIn(element);
        expect(target.zoomBy).toHaveBeenCalledTimes(1);
        expect(target.home).toHaveBeenCalledTimes(1);
      },
    );

    it("still zooms out on a Shift-click at the largest zoom", () => {
      const { element, target } = setup();
      target.atMaxZoom = () => true;
      tap(element, "mouse", { shiftKey: true });
      expect(target.zoomBy).toHaveBeenCalledWith(0.5, { x: 20, y: 10 }, true);
      expect(target.home).not.toHaveBeenCalled();
    });
  });
});
