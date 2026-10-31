import { act, render } from "@testing-library/react";
import React, { useRef } from "react";

import { useDragToClose } from "./useDragToClose";

function Pane({
  onClose,
  enabled = true,
}: {
  onClose: () => void;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  useDragToClose(ref, { enabled, side: "end", onClose, alongside: edge });
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

async function setup() {
  const onClose = vi.fn();
  const { getByTestId, rerender } = render(<Pane onClose={onClose} />);
  // The drag's code loads as the pane first can be dragged, and attaches then.
  await act(async () => {
    await import("./dragToClose");
  });
  const pane = getByTestId("pane");
  pane.getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
  return {
    pane,
    edge: getByTestId("edge"),
    onClose,
    close: () => rerender(<Pane onClose={onClose} enabled={false} />),
  };
}

describe("useDragToClose", () => {
  it("follows a drag toward its edge, and closes when let go past a third", async () => {
    const { pane, onClose } = await setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    // Followed from where it is told to be a drag, so it never jumps the slop.
    pointer(pane, "pointermove", 140, 0, { at: 100 });
    expect(pane.style.translate).toBe("0px 0");
    pointer(pane, "pointermove", 180, 0, { at: 200 });
    expect(pane.style.translate).toBe("40px 0");
    pointer(pane, "pointermove", 260, 0, { at: 400 });
    pointer(pane, "pointerup", 260, 0, { at: 420 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("goes on from where it was let go, never back to where it opened", async () => {
    const { pane, onClose, close } = await setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 140, 0, { at: 100 });
    pointer(pane, "pointermove", 260, 0, { at: 400 });
    pointer(pane, "pointerup", 260, 0, { at: 420 });
    expect(onClose).toHaveBeenCalledTimes(1);
    // The rest of the way is its transform's, to where its own slide ends too.
    const out = "var(--clover-template-out, translateX(100%))";
    expect(pane.style.translate).toBe("");
    expect(pane.style.transform).toBe(out);
    expect(pane.style.transition).toMatch(/^transform \d+ms /);
    // Closing as it goes leaves that motion be.
    close();
    expect(pane.style.transform).toBe(out);
  });

  it("takes as long for the rest of the way as the finger's speed asks", async () => {
    const { pane } = await setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 110, 0, { at: 10 });
    // 200px in 100ms: 2 pixels a millisecond, 100px to go, twice that over the speed.
    pointer(pane, "pointermove", 310, 0, { at: 110 });
    pointer(pane, "pointerup", 310, 0, { at: 112 });
    expect(pane.style.transition).toMatch(/^transform 120ms /);
  });

  it("springs back from a short drag", async () => {
    const { pane, onClose } = await setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 160, 0, { at: 400 });
    pointer(pane, "pointerup", 160, 0, { at: 800 });
    expect(onClose).not.toHaveBeenCalled();
    expect(pane.style.translate).toBe("");
  });

  it("moves what sits on the pane's edge with it, and back", async () => {
    const { pane, edge } = await setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 160, 0, { at: 400 });
    // Slowly: a third of a pixel a millisecond is no flick.
    pointer(pane, "pointermove", 220, 0, { at: 600 });
    expect(edge.style.translate).toBe("60px 0");
    expect(edge.style.transition).toBe("none");
    pointer(pane, "pointerup", 220, 0, { at: 800 });
    expect(edge.style.translate).toBe("");
    expect(edge.style.transition).toBe(pane.style.transition);
  });

  it("finishes at once where the reader asks for less motion", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
    })) as unknown as typeof window.matchMedia;
    try {
      const { pane, onClose } = await setup();
      pointer(pane, "pointerdown", 100, 0, { at: 0 });
      pointer(pane, "pointermove", 140, 0, { at: 100 });
      pointer(pane, "pointermove", 260, 0, { at: 400 });
      pointer(pane, "pointerup", 260, 0, { at: 420 });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(pane.style.transition).toMatch(/^transform 0ms /);
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("closes on a flick however short", async () => {
    const { pane, onClose } = await setup();
    pointer(pane, "pointerdown", 100, 0, { at: 0 });
    pointer(pane, "pointermove", 130, 0, { at: 20 });
    pointer(pane, "pointermove", 170, 0, { at: 60 });
    pointer(pane, "pointerup", 170, 0, { at: 70 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves a drag up or down to scroll, and a mouse to select", async () => {
    const { pane, onClose } = await setup();
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
