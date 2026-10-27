import { playerSurface } from "./playerSurface";

/** jsdom has no PointerEvent: a mouse event carrying a pointer's fields. */
function press(
  target: Element,
  type: "pointerdown" | "pointerup" | "pointermove",
  {
    pointerType = "mouse",
    x = 10,
    t = 0,
    buttons = 0,
  }: { pointerType?: string; x?: number; t?: number; buttons?: number } = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: 10,
  });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: 1 },
    isPrimary: { value: true },
    timeStamp: { value: t },
  });
  target.dispatchEvent(event);
}

function surfaceOn() {
  const host = document.createElement("div");
  document.body.append(host);
  const surface = playerSurface(host);
  const tap = vi.fn();
  surface.on("tap", tap);
  return { host, surface, tap };
}

afterEach(() => document.body.replaceChildren());

describe("playerSurface", () => {
  it("reports its first layout as open and each after it as a change, as the renderer does", async () => {
    const { surface } = surfaceOn();
    const open = vi.fn();
    const change = vi.fn();
    surface.on("open", open);
    surface.on("change", change);
    // Nothing to lay out: nothing reported.
    await surface.setImages([]);
    expect(open).not.toHaveBeenCalled();
    expect(surface.isOpen).toBe(false);

    const world = { x: 0, y: 0, width: 100, height: 100 };
    await surface.setImages([], { world });
    expect(open).toHaveBeenCalledTimes(1);
    expect(surface.isOpen).toBe(true);
    await surface.setImages([], { world, fit: true });
    expect(change).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("plays and pauses on a click, as the renderer's tap does", () => {
    const { host, tap } = surfaceOn();
    press(host, "pointerdown", { t: 0 });
    press(host, "pointerup", { t: 120 });
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("takes no long press, nor a drag, for a click", () => {
    const { host, tap } = surfaceOn();
    press(host, "pointerdown", { t: 0 });
    press(host, "pointerup", { t: 600 });
    press(host, "pointerdown", { t: 1000 });
    press(host, "pointerup", { t: 1100, x: 60 });
    expect(tap).not.toHaveBeenCalled();
  });

  it("leaves a finger's tap to the controls, and a pen's that does not hover", () => {
    const { host, tap } = surfaceOn();
    press(host, "pointerdown", { pointerType: "touch" });
    press(host, "pointerup", { pointerType: "touch", t: 50 });
    press(host, "pointerdown", { pointerType: "pen" });
    press(host, "pointerup", { pointerType: "pen", t: 50 });
    expect(tap).not.toHaveBeenCalled();
    // A pen seen hovering is pointed as a mouse is.
    press(host, "pointermove", { pointerType: "pen", buttons: 0 });
    press(host, "pointerdown", { pointerType: "pen" });
    press(host, "pointerup", { pointerType: "pen", t: 50 });
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("first lets go of a picked annotation, and does nothing more", () => {
    const { host, surface, tap } = surfaceOn();
    const dismiss = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    surface.setDismiss(dismiss);
    press(host, "pointerdown");
    press(host, "pointerup", { t: 50 });
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(tap).not.toHaveBeenCalled();
    press(host, "pointerdown");
    press(host, "pointerup", { t: 50 });
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("shows a video it is handed fitted in its viewport, until cleared", async () => {
    const { host, surface } = surfaceOn();
    const element = document.createElement("video");
    const world = { x: 0, y: 0, width: 16, height: 9 };
    await surface.setImages(
      [{ id: "video", placement: world, media: { element } }],
      { world },
    );
    expect(element.parentElement).toBe(host);
    expect(element.style.objectFit).toBe("contain");
    surface.clear();
    expect(element.isConnected).toBe(false);
  });

  it("lets go of its listeners when disposed", () => {
    const { host, surface, tap } = surfaceOn();
    surface.dispose();
    press(host, "pointerdown");
    press(host, "pointerup", { t: 50 });
    expect(tap).not.toHaveBeenCalled();
  });
});
