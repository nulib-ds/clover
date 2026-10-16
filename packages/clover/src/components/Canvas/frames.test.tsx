import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import React from "react";

import FrameAnimation, { FrameControls, useAnimation } from "./FrameAnimation";
import {
  type IIIFCanvas,
  animationFrames,
  canvasScene,
  frameKey,
  paintedImages,
} from "./layout";
import muybridgeJson from "../../fixtures/muybridge-626-annie-g-galloping.json";
import stereoJson from "../../fixtures/iiif-cookbook/0688-stereogram-timeline.json";
import { p4 } from "../../fixtures/presentation4";
import { initCloverI18n } from "../../i18n";

const stereo = () => (p4(stereoJson) as any).items[0] as IIIFCanvas;

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("animationFrames", () => {
  it("reads Cookbook 0688's two frames as a timeline: each until the next, the last until the end", () => {
    const frames = animationFrames(stereo());
    expect(frames.map((f) => [f.start, f.end])).toEqual([
      [0, 0.1],
      [0.1, 0.2],
    ]);
  });

  it("paints only the selected frame", () => {
    const canvas = stereo();
    const first = paintedImages(canvas, { [frameKey(canvas)]: 0 });
    const second = paintedImages(canvas, { [frameKey(canvas)]: 1 });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].region).not.toBe(second[0].region);
    // With no selection, the first frame.
    expect(paintedImages(canvas)).toEqual(first);
  });

  it("crops through the service in the service's size, not the body's declared one", () => {
    // Each eye's body declares a 1409 × 1628 crop, but carries the whole card's service
    // and a region measured on the whole card.
    const scene = canvasScene([stereo()], "left-to-right");
    for (const image of scene.images) {
      expect(image.service).toMatch(/1073279$/);
      expect(image.region).toBeDefined();
      expect(image.width).toBeUndefined();
      expect(image.height).toBeUndefined();
    }
  });

  it("is no animation with a single timed annotation", () => {
    const canvas = stereo();
    const one = {
      ...canvas,
      items: [
        { ...canvas.items![0], items: canvas.items![0].items!.slice(0, 1) },
      ],
    } as IIIFCanvas;
    expect(animationFrames(one)).toEqual([]);
    expect(paintedImages(one)).toHaveLength(1);
  });
});

describe("a Muybridge plate (nulib-ds/muybridge)", () => {
  const plate = () => (p4(muybridgeJson) as any).items as IIIFCanvas[];

  it("reads 16 frames of 0.1 s, and its whole-plate Canvas as no animation", () => {
    const [frames, original] = plate();
    const timeline = animationFrames(frames);
    expect(timeline).toHaveLength(16);
    expect(timeline.every((f) => Math.abs(f.end - f.start - 0.1) < 1e-9)).toBe(
      true,
    );
    expect(timeline.at(-1)?.end).toBeCloseTo(1.6);
    expect(animationFrames(original)).toEqual([]);
  });

  it("puts every frame in the scene, all but the first hidden, and maps them", () => {
    const [frames] = plate();
    const scene = canvasScene([frames], "left-to-right");
    expect(scene.images).toHaveLength(16);
    expect(scene.images.filter((image) => image.hidden)).toHaveLength(15);
    expect(scene.images[0].hidden).toBeUndefined();
    const byFrame = scene.frames[frameKey(frames)];
    expect(byFrame).toHaveLength(16);
    expect(byFrame[3]).toEqual([scene.images[3].id]);
    // Selecting a frame shows it in a scene built for it, too.
    const later = canvasScene([frames], "left-to-right", {
      [frameKey(frames)]: 5,
    });
    expect(later.images.findIndex((image) => !image.hidden)).toBe(5);
  });
});

describe("useAnimation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("plays each frame for its span, loops when asked, and stops at the end when not", () => {
    const frames = animationFrames(stereo());
    const looping = renderHook(() =>
      useAnimation(frames, "a", { autoplay: true, loop: true }),
    );
    expect(looping.result.current.playing).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(looping.result.current.frame).toBe(1);
    act(() => vi.advanceTimersByTime(100));
    expect(looping.result.current.frame).toBe(0);

    const once = renderHook(() =>
      useAnimation(frames, "b", { autoplay: true }),
    );
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(once.result.current.frame).toBe(1);
    expect(once.result.current.playing).toBe(false);
  });

  it("holds a frame not yet loaded, rather than blink to an empty stage", () => {
    const frames = animationFrames(stereo());
    let loaded = false;
    const { result } = renderHook(() =>
      useAnimation(frames, "d", {
        autoplay: true,
        loop: true,
        isReady: () => loaded,
      }),
    );
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.frame).toBe(0);
    loaded = true;
    act(() => vi.advanceTimersByTime(60));
    expect(result.current.frame).toBe(1);
  });

  it("hands on at the end when not looping, so a Root can auto-advance", () => {
    const onEnded = vi.fn();
    const { result } = renderHook(() =>
      useAnimation(animationFrames(stereo()), "e", { autoplay: true, onEnded }),
    );
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(result.current.playing).toBe(false);
  });

  it("never autoplays for a reader who asks for reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
    })) as never;
    const { result } = renderHook(() =>
      useAnimation(animationFrames(stereo()), "c", { autoplay: true }),
    );
    expect(result.current.playing).toBe(false);
    window.matchMedia = original;
  });
});

describe("FrameControls", () => {
  const state = (frame: number) => ({
    frame,
    playing: true,
    repeat: false,
    setFrame: vi.fn(),
    setPlaying: vi.fn(),
    setRepeat: vi.fn(),
  });

  it("steps within the frames, pausing, and says which frame shows", () => {
    const frames = animationFrames(stereo());
    const animation = state(0);
    render(<FrameControls frames={frames} animation={animation} />);
    expect(screen.getByText("Frame 1 of 2")).toBeInTheDocument();
    // At the first frame there is no previous one, as the pager has none. The button
    // says so but stays focusable, and a press does nothing.
    const previous = screen.getByRole("button", { name: "Previous frame" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toBeEnabled();
    fireEvent.click(previous);
    expect(animation.setFrame).not.toHaveBeenCalled();
    expect(animation.setPlaying).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Next frame" }),
    ).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(animation.setFrame).toHaveBeenCalledWith(1);
    expect(animation.setPlaying).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Frame" })).toHaveAttribute(
      "aria-valuetext",
      "Frame 1 of 2",
    );
  });

  it("lists the frames by their labels, as a Choice's menu, pausing to choose one", () => {
    const [canvas] = (p4(muybridgeJson) as any).items as IIIFCanvas[];
    const frames = animationFrames(canvas);
    const animation = state(3);
    render(<FrameControls frames={frames} animation={animation} />);
    const trigger = screen.getByRole("button", { name: "Frame 4 of 16" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Opening pauses, so the frame checked holds still to choose from.
    expect(animation.setPlaying).toHaveBeenCalledWith(false);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(16);
    // Named by the Manifest's labels, each with its picture; the frame showing checked.
    expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
    expect(document.querySelectorAll(".clover-canvas-menu-image")).toHaveLength(
      16,
    );
    fireEvent.click(screen.getByRole("radio", { name: "9" }));
    expect(animation.setFrame).toHaveBeenCalledWith(8);
    // Escape closes it and gives focus back to the label.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(trigger).toHaveFocus();
  });

  it("offers Repeat, as 3.x does, pressed when it loops", () => {
    const animation = state(1);
    render(
      <FrameControls
        frames={animationFrames(stereo())}
        animation={animation}
      />,
    );
    expect(screen.getByRole("button", { name: "Next frame" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const repeat = screen.getByRole("button", { name: "Repeat" });
    expect(repeat).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(repeat);
    expect(animation.setRepeat).toHaveBeenCalledWith(true);
  });
});

describe("FrameAnimation", () => {
  it("puts its bar in the media layer, as a video's, and gives the Canvas its height", () => {
    // jsdom lays nothing out: the bar is as tall as two rows of a narrow stage.
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(59);
    const canvas = stereo();
    const scene = canvasScene([canvas], "left-to-right");
    const renderer = { setHidden: vi.fn(), isReady: () => true };
    const { unmount } = render(
      <figure className="clover-canvas" data-testid="canvas">
        <FrameAnimation
          renderer={renderer as any}
          frames={animationFrames(canvas)}
          byFrame={scene.frames[frameKey(canvas)]}
          animationKey={canvas.id}
          sceneVersion={1}
        />
      </figure>,
    );
    const layer = screen.getByTestId("clover-canvas-frames").parentElement;
    // It fades with the chrome and sizes its menu against the stage, as a video's does.
    expect(layer).toHaveClass("clover-canvas-media");
    expect(layer).toHaveAttribute("data-kind", "frames");
    // What clears the bar (captions, the information box) clears both its rows.
    const figure = screen.getByTestId("canvas");
    expect(figure.style.getPropertyValue("--clover-transport-bar-height")).toBe(
      "59px",
    );
    unmount();
    expect(figure.style.getPropertyValue("--clover-transport-bar-height")).toBe(
      "",
    );
    height.mockRestore();
  });
});
