import { render } from "@testing-library/react";
import React, { useRef } from "react";

import { useDragToClose } from "./useDragToClose";

function Pane({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  useDragToClose(ref, { enabled: true, side: "end", onClose, alongside: edge });
  return (
    <>
      <div ref={ref} data-testid="pane" />
      <div ref={edge} data-testid="edge" />
    </>
  );
}

// jsdom has no PointerEvent: one made by hand, with what the hook reads.
function pointer(
  element: Element,
  type: string,
  x: number,
  y = 0,
  { pointerType = "touch", at = 0 } = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, "timeStamp", { value: at });
  element.dispatchEvent(event);
}

function setup() {
  const onClose = vi.fn();
  const { getByTestId } = render(<Pane onClose={onClose} />);
  const pane = getByTestId("pane");
  pane.getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
  return { pane, edge: getByTestId("edge"), onClose };
}

describe("useDragToClose", () => {
  it("follows a drag toward its edge, and closes when let go past a third", () => {
    const { pane, onClose } = setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 140, 0, { at: 100 });
    expect(pane.style.translate).toBe("40px 0");
    pointer(pane, "pointermove", 220, 0, { at: 400 });
    pointer(pane, "pointerup", 220, 0, { at: 420 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back from a short drag", () => {
    const { pane, onClose } = setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 160, 0, { at: 400 });
    pointer(pane, "pointerup", 160, 0, { at: 800 });
    expect(onClose).not.toHaveBeenCalled();
    expect(pane.style.translate).toBe("");
  });

  it("moves what sits on the pane's edge with it, and back", () => {
    const { pane, edge } = setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 160, 0, { at: 400 });
    expect(edge.style.translate).toBe("60px 0");
    expect(edge.style.transition).toBe("none");
    pointer(pane, "pointerup", 160, 0, { at: 800 });
    expect(edge.style.translate).toBe("");
    expect(edge.style.transition).toBe(pane.style.transition);
  });

  it("closes on a flick however short", () => {
    const { pane, onClose } = setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 130, 0, { at: 20 });
    pointer(pane, "pointermove", 170, 0, { at: 60 });
    pointer(pane, "pointerup", 170, 0, { at: 70 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves a drag up or down to scroll, and a mouse to select", () => {
    const { pane, onClose } = setup();
    pointer(pane, "pointerdown", 100, 100);
    pointer(pane, "pointermove", 110, 160);
    pointer(pane, "pointermove", 260, 160);
    pointer(pane, "pointerup", 260, 160);
    expect(pane.style.translate).toBe("");

    pointer(pane, "pointerdown", 100, 0, { pointerType: "mouse" });
    pointer(pane, "pointermove", 260, 0, { pointerType: "mouse" });
    pointer(pane, "pointerup", 260, 0, { pointerType: "mouse" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
