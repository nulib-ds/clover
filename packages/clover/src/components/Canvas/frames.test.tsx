import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

import FrameAnimation, {
  FrameControls,
  framesAt,
  useAnimation,
} from "./FrameAnimation";
import {
  type IIIFCanvas,
  animationFrames,
  canvasScene,
  frameKey,
  paintedImages,
} from "./layout";
import muybridgeJson from "../../fixtures/muybridge-626-annie-g-galloping.json";
import stereoJson from "../../fixtures/iiif-cookbook/0688-stereogram-timeline.json";
import multimediaJson from "../../fixtures/iiif-cookbook/0489-multimedia-canvas.json";
import { p4 } from "../../fixtures/presentation4";
import { initCloverI18n } from "../../i18n";

const stereo = () => (p4(stereoJson) as any).items[0] as IIIFCanvas;
const multimedia = () => (p4(multimediaJson) as any).items[0] as IIIFCanvas;

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("animationFrames", () => {
  it("reads Cookbook 0688's two frames as a timeline, each for its own span", () => {
    const frames = animationFrames(stereo());
    // The first is written `#t=0,1` on a Canvas of 0.2 s: kept, the second paints over it.
    expect(frames.map((f) => [f.start, f.end])).toEqual([
      [0, 1],
      [0.1, 0.2],
    ]);
  });

  it("shows a frame with no end until the next one starts, the last until the end", () => {
    const painting = (t: string) => ({
      id: `https://example.org/annotation/${t}`,
      type: "Annotation",
      motivation: "painting",
      body: { id: `https://example.org/${t}.jpg`, type: "Image" },
      target: `https://example.org/canvas#t=${t}`,
    });
    const frames = animationFrames({
      id: "https://example.org/canvas",
      type: "Canvas",
      duration: 0.2,
      items: [
        {
          id: "https://example.org/page",
          type: "AnnotationPage",
          items: [painting("0"), painting("0.1")],
        },
      ],
    } as unknown as IIIFCanvas);
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

  // Cookbook 0489: an image and a video over it, from 11 s to 42 s, among timed texts.
  it("keeps each frame's own end, so frames due at once show together", () => {
    const canvas = multimedia();
    const frames = animationFrames(canvas);
    expect(frames.map((f) => [f.start, f.end])).toEqual([
      [0, 1],
      [1, 11],
      [11, 42],
      [11, 42],
      [42, 180],
    ]);
    const kinds = (at: number) =>
      framesAt(frames, at, 180).map(
        (index) => (frames[index].annotation.body as any).type,
      );
    expect(kinds(0.5)).toEqual(["TextualBody"]);
    expect(kinds(14).sort()).toEqual(["Image", "Video"]);
    expect(kinds(100)).toEqual(["TextualBody"]);
    // At the end, what lasts to it still shows.
    expect(kinds(180)).toEqual(["TextualBody"]);
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
      useAnimation(frames, "a", { autoplay: true, loop: true, duration: 0.2 }),
    );
    expect(looping.result.current.playing).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(looping.result.current.frame).toBe(1);
    act(() => vi.advanceTimersByTime(100));
    expect(looping.result.current.frame).toBe(0);

    const once = renderHook(() =>
      useAnimation(frames, "b", { autoplay: true, duration: 0.2 }),
    );
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(once.result.current.frame).toBe(1);
    expect(once.result.current.playing).toBe(false);
  });

  it("holds a frame not yet loaded, rather than blink to an empty Body", () => {
    const frames = animationFrames(stereo());
    let loaded = false;
    const { result } = renderHook(() =>
      useAnimation(frames, "d", {
        autoplay: true,
        loop: true,
        duration: 0.2,
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
      useAnimation(animationFrames(stereo()), "e", {
        autoplay: true,
        duration: 0.2,
        onEnded,
      }),
    );
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(result.current.playing).toBe(false);
  });

  it("runs over the Canvas's duration, showing every frame due at its time", () => {
    const frames = animationFrames(multimedia());
    const { result } = renderHook(() =>
      useAnimation(frames, "f", { autoplay: true, duration: 180 }),
    );
    expect(result.current.total).toBe(180);
    expect(result.current.shown).toEqual([0]);
    act(() => vi.advanceTimersByTime(14_000));
    expect(Math.round(result.current.time)).toBe(14);
    expect(result.current.shown).toEqual([2, 3]);
    // A move by the reader goes on from there, playing.
    act(() => result.current.seek(100));
    act(() => vi.advanceTimersByTime(1_000));
    expect(Math.round(result.current.time)).toBe(101);
    expect(result.current.shown).toEqual([4]);
    expect(result.current.playing).toBe(true);
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
  const state = (frame: number, frames = animationFrames(stereo())) => ({
    frame,
    shown: [frame],
    time: frames[frame]?.start ?? 0,
    total: frames.at(-1)?.end ?? 0,
    playing: true,
    repeat: false,
    setFrame: vi.fn(),
    seek: vi.fn(),
    setPlaying: vi.fn(),
    setRepeat: vi.fn(),
  });

  it("steps within the frames, pausing, and says which frame shows", () => {
    const frames = animationFrames(stereo());
    const animation = state(0);
    render(<FrameControls frames={frames} animation={animation} />);
    // Which frame shows, as a figure, no word, as Search shows its place.
    expect(screen.getByRole("button", { name: "1 / 2" })).toBeInTheDocument();
    // At the first frame there is no previous one, as the pager has none. The button
    // says so but stays focusable, and a press does nothing.
    const previous = screen.getByRole("button", { name: "Previous" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toBeEnabled();
    fireEvent.click(previous);
    expect(animation.setFrame).not.toHaveBeenCalled();
    expect(animation.setPlaying).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Next" })).not.toHaveAttribute(
      "aria-disabled",
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(animation.setFrame).toHaveBeenCalledWith(1);
    expect(animation.setPlaying).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    // A seek bar over the Canvas's time, saying where it is and which frame shows.
    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute(
      "aria-valuetext",
      // Tenths, the whole under ten seconds.
      "0:00.0 / 0:00.2, 1 / 2",
    );
  });

  it("seeks over the Canvas's time, its frames' starts marked as a chapter's are", async () => {
    const frames = animationFrames(multimedia());
    const animation = { ...state(3, frames), time: 14, total: 180 };
    render(<FrameControls frames={frames} animation={animation} />);
    const seek = screen.getByRole("slider", { name: "Seek" });
    expect(seek).toHaveAttribute("max", "180");
    expect(seek).toHaveAttribute("aria-valuetext", "0:14 / 3:00, 4 / 5");
    // A gap where each step after the first begins: 1 s, 11 s and 42 s.
    expect(seek).toHaveAttribute("data-gaps");
    expect(seek.style.getPropertyValue("--clover-transport-gaps")).toMatch(
      /^linear-gradient/,
    );
    fireEvent.change(seek, { target: { value: "60" } });
    expect(animation.seek).toHaveBeenCalledWith(60);
    // Previous goes to the step before, 1 s, the countdown; Next to 42 s.
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(animation.setFrame).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(animation.setFrame).toHaveBeenLastCalledWith(4);
    expect(screen.getByText("0:14 / 3:00")).toBeInTheDocument();
    // Over the seek bar, the time under the pointer, in the chapters' popover, alone.
    const area = seek.parentElement!;
    for (const box of [area, seek])
      vi.spyOn(box, "getBoundingClientRect").mockReturnValue({
        left: 0,
        width: 600,
      } as DOMRect);
    // jsdom has no PointerEvent: a mouse event of its name carries the pointer's place.
    act(() => {
      area.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 300, bubbles: true }),
      );
    });
    const tip = area.querySelector(".clover-tip")!;
    expect(tip).toHaveTextContent("1:30");
    expect(tip.querySelector(".clover-tip-image")).toBeNull();
    expect(area.style.getPropertyValue("--clover-transport-preview")).toBe(
      "50%",
    );
    fireEvent.pointerLeave(area);
    expect(area.querySelector(".clover-tip")).toBeNull();
    // Its menu pictures images alone: the video's frame goes by its number.
    fireEvent.click(screen.getByRole("button", { name: "4 / 5" }));
    const video = screen.getByRole("radio", { name: "4" });
    expect(video).toBeChecked();
    await new Promise((done) => setTimeout(done, 0));
    expect(video.closest("label")?.querySelector("img")).toBeNull();
    expect(video.closest("label")).toHaveTextContent("4");
  });

  it("lists the frames by their labels, as a Choice's menu, pausing to choose one", async () => {
    const [canvas] = (p4(muybridgeJson) as any).items as IIIFCanvas[];
    const frames = animationFrames(canvas);
    const animation = state(3, frames);
    render(<FrameControls frames={frames} animation={animation} />);
    const trigger = screen.getByRole("button", { name: "4 / 16" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Opening pauses, so the frame checked holds still to choose from.
    expect(animation.setPlaying).toHaveBeenCalledWith(false);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(16);
    // Named by the Manifest's labels, each with its picture; the frame showing checked.
    expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
    await waitFor(() =>
      expect(
        document.querySelectorAll(".clover-canvas-menu-image"),
      ).toHaveLength(16),
    );
    // Each frame's own image, which the scene loads to play it: it names no service.
    expect(
      document.querySelector(".clover-canvas-menu-image")?.getAttribute("src"),
    ).toMatch(
      /\/pct:1\.2882,1\.2152,23\.6669,23\.3242\/full\/0\/default\.jpg$/,
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
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute(
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
    // jsdom lays nothing out: the bar is as tall as two rows of a narrow Body.
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
    // It fades with the controls and sizes its menu against the Body, as a video's does.
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

  // Cookbook 0489: a video in a region over the image, and texts, each at its time.
  it("draws its video and text in the scene, each with its frame, the video on its clock", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const canvas = multimedia();
    const scene = canvasScene([canvas], "left-to-right");
    const frames = animationFrames(canvas);
    const renderer = { setHidden: vi.fn(), isReady: () => true };
    const onItems = vi.fn();
    render(
      <figure className="clover-canvas">
        <FrameAnimation
          renderer={renderer as any}
          frames={frames}
          byFrame={scene.frames[frameKey(canvas)]}
          animationKey={canvas.id}
          sceneVersion={1}
          duration={180}
          canvas={canvas}
          place={scene.placements[0]}
          onItems={onItems}
        />
      </figure>,
    );
    await waitFor(() =>
      expect(onItems).toHaveBeenLastCalledWith(expect.any(Array)),
    );
    const items = onItems.mock.calls.at(-1)![0] as any[];
    // The video and the three texts, never shown until their frames are.
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.hidden)).toBe(true);
    const video = items.find(
      (item) => item.media.element instanceof HTMLVideoElement,
    );
    expect(video.placement).toEqual({
      x: 1000,
      y: 500,
      width: 5000,
      height: 6000,
    });
    expect(video.media.element.src).toMatch(/30-minute-clock/);
    // At 0 s the first text shows, and is read outside the picture.
    const hidden = () => renderer.setHidden.mock.calls.at(-1)![0] as string[];
    const textIds = items
      .filter((item) => !(item.media.element instanceof HTMLMediaElement))
      .map((item) => item.id);
    expect(hidden()).not.toContain(textIds[0]);
    expect(hidden()).toContain(textIds[1]);
    expect(hidden()).toContain(video.id);
    expect(document.querySelector(".clover-canvas-media")).toHaveTextContent(
      "Press Play",
    );
    // At 11 s the video shows, from its own start, and a Mute is offered.
    fireEvent.change(screen.getByRole("slider", { name: "Seek" }), {
      target: { value: "14" },
    });
    await waitFor(() => expect(hidden()).not.toContain(video.id));
    expect(video.media.element.currentTime).toBeCloseTo(3);
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(play).toHaveBeenCalled());
    play.mockRestore();
    pause.mockRestore();
  });
});
