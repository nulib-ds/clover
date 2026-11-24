import { attachOrbitGestures, type OrbitInput } from "./gestures";

/** A pointer event as jsdom can make one: a mouse event with its id and type. */
const pointer = (
  element: Element,
  type: string,
  x: number,
  { id = 1, kind = "touch", y = 50 } = {},
) =>
  element.dispatchEvent(
    Object.assign(
      new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1,
        bubbles: true,
      }),
      { pointerId: id, pointerType: kind },
    ),
  );

// Each a second apart, so none reads as part of an earlier test's scroll.
let clock = new Event("wheel").timeStamp + 60_000;
const wheel = (element: Element, init: WheelEventInit) => {
  clock += 1000;
  const event = new WheelEvent("wheel", {
    cancelable: true,
    bubbles: true,
    ...init,
  });
  Object.defineProperty(event, "timeStamp", { value: clock });
  element.dispatchEvent(event);
  return event;
};

function setup(cooperative = true) {
  const element = document.createElement("div");
  document.body.append(element);
  const input = {
    turn: vi.fn(),
    zoom: vi.fn(),
    step: vi.fn(),
    hint: vi.fn(),
  } satisfies OrbitInput;
  const stop = attachOrbitGestures(element, input, {
    cooperative,
    span: () => 200,
  });
  return { element, input, stop };
}

const hinted = (input: { hint: ReturnType<typeof vi.fn> }) =>
  input.hint.mock.calls.map(([kind]) => kind);

afterEach(() => {
  document.body.replaceChildren();
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: null,
  });
});

// As a Canvas's and a Map's gestures are (Mat, 2026-11-23: "gesture parity across all cases").
describe("the Scene's gestures", () => {
  it("leaves one finger's drag to the page and says to use two", () => {
    const { element, input } = setup();
    expect(element.hasAttribute("data-cooperative")).toBe(true);
    pointer(element, "pointerdown", 50);
    pointer(element, "pointermove", 80);
    pointer(element, "pointercancel", 80);
    expect(input.turn).not.toHaveBeenCalled();
    expect(hinted(input)).toContain("touch");
  });

  it("turns by one finger's drag when not cooperative, and by a mouse's always", () => {
    const off = setup(false);
    expect(off.element.hasAttribute("data-cooperative")).toBe(false);
    pointer(off.element, "pointerdown", 50);
    pointer(off.element, "pointermove", 80);
    expect(off.input.turn).toHaveBeenCalled();

    const on = setup();
    pointer(on.element, "pointerdown", 50, { kind: "mouse" });
    pointer(on.element, "pointermove", 80, { kind: "mouse" });
    expect(on.input.turn).toHaveBeenCalled();
    expect(hinted(on.input)).toEqual([]);
  });

  it("pinches and turns with two fingers, keeping the page from moving under them", () => {
    const { element, input } = setup();
    pointer(element, "pointerdown", 50, { id: 1 });
    pointer(element, "pointerdown", 100, { id: 2 });
    const move = new Event("touchmove", { cancelable: true });
    Object.defineProperty(move, "targetTouches", { value: [{}, {}] });
    element.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);
    pointer(element, "pointermove", 150, { id: 2 });
    expect(input.zoom).toHaveBeenCalledWith(2);
    // Their middle moved 25px right: the front turns right.
    const [dTheta] = input.turn.mock.calls[0];
    expect(dTheta).toBeCloseTo((-25 / 200) * 2 * Math.PI);
    expect(hinted(input)).toEqual([]);
  });

  it("comes nearer on a double tap or a double click, and goes back with Shift", () => {
    const { element, input } = setup();
    for (let tap = 0; tap < 2; tap++) {
      pointer(element, "pointerdown", 50);
      pointer(element, "pointerup", 50);
    }
    expect(input.step).toHaveBeenCalledWith(false);

    pointer(element, "pointerdown", 50, { kind: "mouse" });
    pointer(element, "pointerup", 50, { kind: "mouse" });
    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    element.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, shiftKey: true }),
    );
    expect(input.step.mock.calls).toEqual([[false], [false], [true]]);
  });

  it("goes back on two fingers' tap, as on a map, and not after a pinch", () => {
    const { element, input } = setup();
    pointer(element, "pointerdown", 50, { id: 1 });
    pointer(element, "pointerdown", 100, { id: 2 });
    pointer(element, "pointerup", 100, { id: 2 });
    pointer(element, "pointerup", 50, { id: 1 });
    expect(input.step).toHaveBeenCalledWith(true);

    input.step.mockClear();
    pointer(element, "pointerdown", 50, { id: 1 });
    pointer(element, "pointerdown", 100, { id: 2 });
    pointer(element, "pointermove", 150, { id: 2 });
    pointer(element, "pointerup", 150, { id: 2 });
    pointer(element, "pointerup", 50, { id: 1 });
    expect(input.step).not.toHaveBeenCalled();
  });

  it("leaves a plain wheel to the page, with no hint, and zooms with Ctrl or ⌘", () => {
    const { element, input } = setup();
    expect(wheel(element, { deltaY: 100 }).defaultPrevented).toBe(false);
    expect(input.zoom).not.toHaveBeenCalled();
    expect(hinted(input)).toEqual([]);
    expect(
      wheel(element, { deltaY: -20, ctrlKey: true }).defaultPrevented,
    ).toBe(true);
    expect(input.zoom.mock.calls[0][0]).toBeGreaterThan(1);
    expect(
      wheel(element, { deltaY: 100, metaKey: true }).defaultPrevented,
    ).toBe(true);
    expect(input.zoom).toHaveBeenCalledTimes(2);
  });

  // The Document template's full viewer (Mat, 2026-11-23: "as the user opts in to it").
  it("turns on one finger's drag where its view takes every drag", () => {
    const { element, input } = setup();
    const style = window.getComputedStyle;
    const spy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((node, pseudo) =>
        node === element
          ? ({ touchAction: "none" } as CSSStyleDeclaration)
          : style(node, pseudo),
      );
    pointer(element, "pointerdown", 50);
    pointer(element, "pointermove", 80);
    spy.mockRestore();
    expect(input.turn).toHaveBeenCalled();
    expect(hinted(input)).toEqual([]);
  });

  it("gives the wheel and a finger's drag to the view in full screen", () => {
    const { element, input } = setup();
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.body,
    });
    pointer(element, "pointerdown", 50);
    pointer(element, "pointermove", 80);
    expect(input.turn).toHaveBeenCalled();
    expect(wheel(element, { deltaY: 100 }).defaultPrevented).toBe(true);
    expect(input.zoom).toHaveBeenCalled();
    expect(hinted(input)).toEqual([]);
  });

  it("lets go of the view, and the mark, when stopped", () => {
    const { element, input, stop } = setup();
    stop();
    expect(element.hasAttribute("data-cooperative")).toBe(false);
    wheel(element, { deltaY: 100, ctrlKey: true });
    expect(input.zoom).not.toHaveBeenCalled();
  });
});
