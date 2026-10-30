import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { p4 } from "../../../fixtures/presentation4";
import React from "react";

import Canvas from "..";
import { containAspect } from "./MediaBody";
import { chapterAt } from "./Transport";
import { gapsOf } from "./seekGaps";
import { type FakeTrack, FakeTrackList } from "../testing/textTracks";
import { stubViewport } from "../testing/viewport";
import { formatTime } from "./useMediaController";
import audioJson from "../../../fixtures/iiif-cookbook/0002-mvm-audio.json";
import videoJson from "../../../fixtures/iiif-cookbook/0003-mvm-video.json";
import accompanyingJson from "../../../fixtures/iiif-cookbook/0014-accompanyingcanvas.json";
import languagesJson from "../../../fixtures/iiif-cookbook/0074-multiple-language-captions.json";
import operaJson from "../../../fixtures/iiif-cookbook/0026-toc-opera.json";
import captionsJson from "../../../fixtures/iiif-cookbook/0219-using-caption-file.json";
import poetryJson from "../../../fixtures/iiif-cookbook/0103-poetry-reading-annotations.json";
import hessJson from "../../../fixtures/mocks/rudolf-hess-nuremberg/manifest.json";
import { clearVttCache } from "../../../core/vtt";
import { clearInfoCache } from "../../../lib/renderer/sources/imageService";
import * as Clover from "../../../index";

// Published fixtures, upgraded to Presentation 4 as Clover holds them.
const audio = p4(audioJson);
const video = p4(videoJson);
const accompanying = p4(accompanyingJson);
const languages = p4(languagesJson);
const captions = p4(captionsJson);
const poetry = p4(poetryJson);
const tracking = p4(hessJson);

const listeners: Record<string, (detail?: unknown) => void> = {};
let renderer: Record<string, any>;

vi.mock("../../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => renderer),
}));

let paused = true;
const play = vi.fn(function (this: HTMLMediaElement) {
  paused = false;
  this.dispatchEvent(new Event("play"));
  return Promise.resolve();
});
const pause = vi.fn(function (this: HTMLMediaElement) {
  paused = true;
  this.dispatchEvent(new Event("pause"));
});

beforeAll(() => {
  // jsdom has no media pipeline: stand in for the parts the transport drives.
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get: () => paused,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: play,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: pause,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: () => undefined,
  });
});

// Each Canvas is on screen, so it loads; see the lazy-loading test for one that is not.
let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  viewport = stubViewport();
});
afterEach(() => viewport.restore());

beforeEach(() => {
  vi.clearAllMocks();
  paused = true;
  const host = document.createElement("div");
  host.tabIndex = 0;
  renderer = {
    host,
    setImages: vi.fn().mockResolvedValue(undefined),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    attachNavigator: vi.fn(() => vi.fn()),
    on: (event: string, listener: (detail?: unknown) => void) => {
      listeners[event] = listener;
      return () => delete listeners[event];
    },
  };
  document.body.appendChild(host);
});

/*
 * The transport renders before its element exists: the element is made in an effect,
 * handed up, and only then placed in the scene. Settle those effects before asserting.
 */
const transport = async () => {
  const bar = await screen.findByTestId("clover-canvas-transport");
  await act(async () => {});
  return bar;
};

beforeEach(() => clearVttCache());

// A pointer's pick of a menu's option: pressed on its row, which clicks its radio.
const pick = (radio: HTMLElement) => {
  fireEvent.pointerDown(radio);
  fireEvent.click(radio);
};

describe("Canvas media", () => {
  it("places a video in the scene once its element exists", async () => {
    const onMediaElement = vi.fn();
    render(
      <Canvas canvases={video.items as any} onMediaElement={onMediaElement} />,
    );
    await transport();

    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    expect(element).toBeInstanceOf(HTMLVideoElement);
    expect(element.src).toBe(
      "https://fixtures.iiif.io/video/indiana/lunchroom_manners/high/lunchroom_manners_1024kb.mp4",
    );
    // Shown as itself, in the DOM layer, so no CORS is asked of the media.
    expect(element.crossOrigin).toBeNull();
    expect(renderer.setImages).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          placement: { x: 0, y: 0, width: 480, height: 360 },
          media: { element },
        }),
      ],
      expect.anything(),
    );
    expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
      "data-media",
      "video",
    );
    // An overview cannot show a playing frame.
    expect(screen.queryByTestId("clover-canvas-navigator")).toBeNull();
  });

  it("plays and pauses from the transport, a click on the picture, and the keyboard", async () => {
    render(<Canvas canvases={video.items as any} />);
    await transport();

    const toggle = screen.getByRole("button", { name: "Play" });
    fireEvent.click(toggle);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    // A click toggles playback; double-click keeps zooming.
    expect(renderer.setGestures).toHaveBeenCalledWith({
      clickToZoom: false,
      dblClickToZoom: true,
      // A lone video never moves.
      navigable: false,
    });
    act(() => listeners.tap({ x: 1, y: 1 }));
    expect(pause).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(renderer.host, { key: "k" });
    expect(play).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(renderer.host, { key: " " });
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("keeps the camera still beside other Canvases when the host holds it so", async () => {
    const [first] = video.items as any[];
    render(
      <Canvas
        canvases={[first, { ...first, id: `${first.id}/2` }]}
        options={{ gestures: { navigable: false } }}
      />,
    );
    await transport();
    expect(renderer.setGestures).toHaveBeenCalledWith(
      expect.objectContaining({ navigable: false }),
    );
    expect(renderer.setGestures).not.toHaveBeenCalledWith(
      expect.objectContaining({ navigable: true }),
    );
    // Media's keys alone: none of the camera's.
    expect(screen.getByTestId("clover-canvas-viewport")).toHaveAttribute(
      "aria-keyshortcuts",
      "K Space J L M",
    );
  });

  it("seeks, skips and mutes", async () => {
    const onMediaElement = vi.fn();
    render(
      <Canvas canvases={video.items as any} onMediaElement={onMediaElement} />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;

    const seek = screen.getByRole("slider", { name: "Seek" });
    // The Canvas's declared duration until the media reports its own.
    expect(seek).toHaveAttribute("max", "572.034");
    expect(seek).toHaveAttribute("aria-valuetext", "0:00 / 9:32");

    fireEvent.change(seek, { target: { value: "120" } });
    expect(element.currentTime).toBe(120);
    fireEvent.keyDown(renderer.host, { key: "l" });
    expect(element.currentTime).toBe(130);
    fireEvent.keyDown(renderer.host, { key: "j" });
    expect(element.currentTime).toBe(120);

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(element.muted).toBe(true);
    act(() => element.dispatchEvent(new Event("volumechange")));
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });

  it("tells the host when playback ends", async () => {
    const onEnded = vi.fn();
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={video.items as any}
        onEnded={onEnded}
        onMediaElement={onMediaElement}
      />,
    );
    await transport();
    act(() =>
      onMediaElement.mock.calls.at(-1)?.[0].dispatchEvent(new Event("ended")),
    );
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("marks chapters on the seek bar and seeks to one from its menu", async () => {
    const onMediaElement = vi.fn();
    const { container } = render(
      <Canvas
        canvases={video.items as any}
        onMediaElement={onMediaElement}
        chapters={[
          { label: "Opening", start: 0, end: 10 },
          { label: "Lunch", start: 10, end: 20 },
        ]}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    Object.defineProperty(element, "duration", {
      configurable: true,
      value: 20,
    });
    act(() => {
      element.dispatchEvent(new Event("durationchange"));
    });
    // A gap cut in the seek bar where the second chapter begins; none for the first.
    const seek = container.querySelector<HTMLElement>(
      ".clover-canvas-transport-seek",
    )!;
    expect(seek).toHaveAttribute("data-gaps");
    const mask = seek.style.getPropertyValue("--clover-transport-gaps");
    expect(mask.match(/transparent/g)).toHaveLength(1);
    // Where the thumb stands halfway: it travels the bar less its own width.
    expect(mask).toContain(
      "calc(var(--clover-transport-thumb) / 2 + (100% - var(--clover-transport-thumb)) * 0.5 - var(--clover-transport-gap) / 2)",
    );
    expect(screen.getByText("Opening")).toHaveClass(
      "clover-canvas-transport-chapter",
    );
    const button = screen.getByRole("button", { name: "Chapters" });
    fireEvent.click(button);
    pick(screen.getByRole("radio", { name: /Lunch/ }));
    expect(element.currentTime).toBe(10);
    // Closed, with focus back on its button rather than on the page.
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  /*
   * The chapter under the pointer on the seek bar: its stretch drawn out, the time under
   * the pointer and its title in a popover over it, and the host told, once a chapter, not
   * once a move. The bar's value names the chapter playing, for a screen reader. One a
   * list beside the Canvas marks (`highlightedChapter`) has its stretch drawn out, and no
   * popover.
   */
  it("shows the chapter under the pointer on the seek bar, and tells the host", async () => {
    const onMediaElement = vi.fn();
    const onChapterHighlight = vi.fn();
    const chapters = [
      { id: "range/1", label: "Opening", start: 0, end: 10 },
      { id: "range/2", label: "Lunch", start: 10, end: 20 },
    ];
    const canvas = (highlightedChapter?: string) => (
      <Canvas
        canvases={video.items as any}
        onMediaElement={onMediaElement}
        chapters={chapters}
        highlightedChapter={highlightedChapter}
        onChapterHighlight={onChapterHighlight}
      />
    );
    const { container, rerender } = render(canvas());
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    Object.defineProperty(element, "duration", {
      configurable: true,
      value: 20,
    });
    act(() => {
      element.dispatchEvent(new Event("durationchange"));
    });
    const area = container.querySelector<HTMLElement>(
      ".clover-canvas-transport-seek-area",
    )!;
    area.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 26 }) as DOMRect;
    // The time is read along the bar itself, as its thumb travels it (no thumb in jsdom).
    area.querySelector("input")!.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 26 }) as DOMRect;
    const stretch = () =>
      area.querySelector<HTMLElement>(".clover-canvas-transport-chapter-span");

    // jsdom has no PointerEvent: a mouse event of its name carries the place.
    const move = (clientX: number) =>
      fireEvent(
        area,
        new MouseEvent("pointermove", { bubbles: true, clientX }),
      );
    move(150);
    expect(onChapterHighlight).toHaveBeenLastCalledWith("range/2");
    // The time under the pointer, over the chapter's title, in its popover.
    const tip = () => area.querySelector(":scope > .clover-tip");
    expect(tip()?.querySelector(".clover-tip-lead")).toHaveTextContent("0:15");
    expect(tip()).toHaveTextContent(/Lunch$/);
    expect(area.style.getPropertyValue("--clover-transport-preview")).toBe(
      "75%",
    );
    expect(stretch()!.style.left).toBe("50%");
    expect(stretch()!.style.width).toBe("50%");
    // Along the same chapter, nothing more is said; its time follows the pointer.
    move(170);
    expect(onChapterHighlight).toHaveBeenCalledTimes(1);
    expect(tip()?.querySelector(".clover-tip-lead")).toHaveTextContent("0:17");
    fireEvent.pointerLeave(area);
    expect(onChapterHighlight).toHaveBeenLastCalledWith(null);
    expect(area.querySelector(".clover-tip")).toBeNull();
    expect(stretch()).toBeNull();

    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute(
      "aria-valuetext",
      "0:00 / 0:20, Opening",
    );

    rerender(canvas("range/1"));
    expect(stretch()!.style.left).toBe("0%");
    expect(stretch()!.style.width).toBe("50%");
    expect(area.querySelector(".clover-tip")).toBeNull();
  });

  // The Nuremberg reel's last Range ends at 10:00.4, the film at 11:11.
  it("plays no chapter past the end of the last, and shows the time alone there", () => {
    const chapters = [
      { label: "Opening", start: 0, end: 5 },
      { label: "Lunch", start: 5, end: 10 },
    ];
    expect(chapterAt(chapters, 7)).toBe(1);
    expect(chapterAt(chapters, 10)).toBe(-1);
    expect(chapterAt(chapters, 15)).toBe(-1);
    // A chapter with no end of its own plays until the next begins, or the end.
    expect(chapterAt([{ label: "All", start: 0 }], 15)).toBe(0);
  });

  it("cuts the seek bar where a chapter begins, or ends with none to follow", () => {
    // The reel's Ranges: 0:12.5 to 10:00.4, in nine, the film 11:11.
    const ends = [
      12.5, 85.6, 117.2, 158.1, 197.8, 297.5, 379.7, 473.4, 528.2, 600.4,
    ];
    const chapters = ends
      .slice(0, -1)
      .map((start, n) => ({ label: String(n), start, end: ends[n + 1] }));
    const at = gapsOf(chapters, 671.164).map(
      (share) => (share * 671.164) / 100,
    );
    expect(at.map((each) => Math.round(each * 10) / 10)).toEqual(ends);
    // Chapters from the start to the end: a gap between them alone.
    expect(
      gapsOf(
        [
          { start: 0, end: 10 },
          { start: 10, end: 20 },
        ],
        20,
      ),
    ).toEqual([50]);
  });

  // Cookbook 0229: a chapter's picture beside it in the menu, and over it on the seek bar.
  it("shows a chapter's picture in its menu and its popover", async () => {
    const onMediaElement = vi.fn();
    const { container } = render(
      <Canvas
        canvases={video.items as any}
        onMediaElement={onMediaElement}
        chapters={[
          { label: "Opening", start: 0, end: 10, thumbnail: "opening.png" },
          {
            label: "Lunch",
            start: 10,
            end: 20,
            thumbnail: { src: "lunch.png" },
          },
        ]}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    Object.defineProperty(element, "duration", {
      configurable: true,
      value: 20,
    });
    act(() => {
      element.dispatchEvent(new Event("durationchange"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Chapters" }));
    // The chapter playing has its picture under it; the others none.
    const opening = screen
      .getByRole("radio", { name: /Opening/ })
      .closest("label")!;
    await waitFor(() =>
      expect(
        opening.querySelector("img.clover-entry-thumbnail"),
      ).toHaveAttribute("src", "opening.png"),
    );
    const lunch = screen
      .getByRole("radio", { name: /Lunch/ })
      .closest("label")!;
    expect(lunch.querySelector("img")).toBeNull();
    // Named by its words alone.
    expect(
      screen.getByRole("radio", { name: "0:00 Opening" }),
    ).toBeInTheDocument();

    const area = container.querySelector<HTMLElement>(
      ".clover-canvas-transport-seek-area",
    )!;
    area.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 26 }) as DOMRect;
    fireEvent(
      area,
      new MouseEvent("pointermove", { bubbles: true, clientX: 20 }),
    );
    await waitFor(() =>
      expect(
        area.querySelector(":scope > .clover-tip img.clover-tip-image"),
      ).toHaveAttribute("src", "opening.png"),
    );
  });

  it("keeps a menu open while the arrow keys move through it", async () => {
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={video.items as any}
        onMediaElement={onMediaElement}
        chapters={[
          { label: "Opening", start: 0, end: 10 },
          { label: "Lunch", start: 10, end: 20 },
        ]}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    const button = screen.getByRole("button", { name: "Chapters" });
    fireEvent.click(button);

    // An arrow key checks the next radio and clicks it, with no pointer.
    const lunch = screen.getByRole("radio", { name: /Lunch/ });
    act(() => lunch.focus());
    fireEvent.keyDown(lunch, { key: "ArrowDown" });
    fireEvent.click(lunch);
    expect(element.currentTime).toBe(10);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(lunch).toHaveFocus();

    // Escape closes it and hands focus back to its button. Prevented, it closes nothing
    // else: not a modal `<dialog>` around the Canvas.
    expect(fireEvent.keyDown(lunch, { key: "Escape" })).toBe(false);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    // With the menu closed, Escape passes on.
    expect(fireEvent.keyDown(button, { key: "Escape" })).toBe(true);

    // Enter picks the focused option and closes it the same way.
    fireEvent.click(button);
    const opening = screen.getByRole("radio", { name: /Opening/ });
    act(() => opening.focus());
    fireEvent.keyDown(opening, { key: "Enter" });
    expect(element.currentTime).toBe(0);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes a menu when keyboard focus moves on past it, and leaves focus there", async () => {
    render(
      <Canvas
        canvases={video.items as any}
        chapters={[
          { label: "Opening", start: 0, end: 10 },
          { label: "Lunch", start: 10, end: 20 },
        ]}
      />,
    );
    await transport();
    const button = screen.getByRole("button", { name: "Chapters" });
    act(() => button.focus());
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    // Into the menu, and out of focus altogether (a press on an option's text, another
    // window): it stays open.
    const lunch = screen.getByRole("radio", { name: /Lunch/ });
    act(() => lunch.focus());
    act(() => lunch.blur());
    expect(button).toHaveAttribute("aria-expanded", "true");

    // On to another control, which the open menu might cover: it closes, and focus
    // stays where the reader took it.
    act(() => lunch.focus());
    const mute = screen.getByRole("button", { name: "Mute" });
    act(() => mute.focus());
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(mute).toHaveFocus();
  });

  it("offers caption tracks from the Canvas, with Off", async () => {
    // Fetched with CORS and handed over as a same-origin blob, since a `dom` video
    // does not ask for CORS and a cross-origin track would be refused.
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("WEBVTT\n"));
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/captions");
    URL.revokeObjectURL = vi.fn();
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={captions.items as any}
        onMediaElement={onMediaElement}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    const track = element.querySelector("track")!;
    expect(fetch).toHaveBeenCalledWith(
      "https://fixtures.iiif.io/video/indiana/lunchroom_manners/lunchroom_manners.vtt",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    await vi.waitFor(() =>
      expect(track.src).toBe("blob:http://localhost/captions"),
    );
    expect(track.label).toBe("Captions in WebVTT format");
    expect(track.srclang).toBe("en");

    const button = screen.getByRole("button", { name: "Captions" });
    expect(button).toHaveAttribute("data-active");
    // The track showing is told, not only shown by the button's fill.
    expect(button).toHaveAccessibleDescription("Captions in WebVTT format");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    // Each track by the code of its cues' language, then its name; Off by its name.
    expect(
      screen.getByRole("radio", { name: "EN Captions in WebVTT format" }),
    ).toBeChecked();
    expect(screen.getByText("EN")).toHaveClass("clover-canvas-transport-code");

    pick(screen.getByRole("radio", { name: "Off" }));
    expect(button).not.toHaveAttribute("data-active");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAccessibleDescription("Off");
  });

  it("draws the chosen track's cues in its language, as words alone", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("WEBVTT\n")),
    );
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/captions");
    URL.revokeObjectURL = vi.fn();
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={languages.items as any}
        onMediaElement={onMediaElement}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    // jsdom has no text tracks: stand in for Cookbook 0074's two, a cue showing in each.
    const track = (text: string) => ({
      mode: "showing",
      activeCues: [{ text }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(element, "textTracks", {
      configurable: true,
      value: [
        track("<v Ann>Tom &amp; Jerry</v>"),
        track("Tom &amp; Jerry, &#39;l&#x2019;altro&#39;"),
      ],
    });
    const button = screen.getByRole("button", { name: "Captions" });

    fireEvent.click(button);
    pick(
      screen.getByRole("radio", { name: "IT Sottotitoli in formato WebVTT" }),
    );
    const captions = () => document.querySelector(".clover-canvas-captions");
    // Each cue in its track's language, as an annotation's cue is in its own.
    expect(
      captions()?.querySelector(".clover-canvas-captions-cue"),
    ).toHaveAttribute("lang", "it");
    expect(captions()).toHaveTextContent("Tom & Jerry, 'l’altro'");

    fireEvent.click(button);
    pick(screen.getByRole("radio", { name: "EN Captions in WebVTT format" }));
    expect(
      captions()?.querySelector(".clover-canvas-captions-cue"),
    ).toHaveAttribute("lang", "en");
    expect(captions()).toHaveTextContent(/^Tom & Jerry$/);
  });

  it("tells the reader's pick, and shows the file it is given while captions are on; Off stays off", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("WEBVTT\n")),
    );
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/captions");
    URL.revokeObjectURL = vi.fn();
    const [english, italian] = (languages.items[0] as any).annotations[0]
      .items[0].body.items;
    const onCaptionChange = vi.fn();
    const canvas = (caption?: string) => (
      <Canvas
        canvases={languages.items as any}
        onCaptionChange={onCaptionChange}
        caption={caption}
      />
    );
    const { rerender } = render(canvas());
    await transport();
    const button = screen.getByRole("button", { name: "Captions" });
    fireEvent.click(button);
    pick(
      screen.getByRole("radio", { name: "IT Sottotitoli in formato WebVTT" }),
    );
    expect(onCaptionChange).toHaveBeenLastCalledWith({
      id: italian.id,
      language: "it",
    });

    // Given the English file (a transcript's language), it shows that one.
    rerender(canvas(english.id));
    expect(button).toHaveAccessibleDescription("Captions in WebVTT format");

    // Off stays off, whatever it is given; and what it is given is not told back.
    fireEvent.click(button);
    pick(screen.getByRole("radio", { name: "Off" }));
    expect(onCaptionChange).toHaveBeenLastCalledWith(null);
    rerender(canvas(italian.id));
    expect(button).toHaveAccessibleDescription("Off");
    expect(onCaptionChange).toHaveBeenCalledTimes(2);
  });

  it("offers captions the stream carries, and draws them in their language", async () => {
    // jsdom has no text tracks: stand in for those hls.js or the file add.
    const list = new FakeTrackList();
    const tracks = vi
      .spyOn(HTMLMediaElement.prototype, "textTracks", "get")
      .mockReturnValue(list as unknown as TextTrackList);
    render(<Canvas canvases={video.items as any} />);
    await transport();
    // The Manifest has none.
    expect(screen.queryByRole("button", { name: "Captions" })).toBeNull();

    let french!: FakeTrack;
    act(() => {
      french = list.add({
        label: "Français",
        language: "fr",
        cues: ["Bonjour"],
      });
    });
    // Off until the reader turns it on, though `addTextTrack` made it `hidden`.
    expect(french.mode).toBe("disabled");
    const button = screen.getByRole("button", { name: "Captions" });
    fireEvent.click(button);
    expect(screen.getByText("Français")).toHaveAttribute("lang", "fr");
    pick(screen.getByRole("radio", { name: "FR Français" }));
    // Clover draws it, so the browser does not.
    expect(french.mode).toBe("hidden");
    const drawn = document.querySelector(".clover-canvas-captions");
    expect(drawn?.querySelector(".clover-canvas-captions-cue")).toHaveAttribute(
      "lang",
      "fr",
    );
    expect(drawn).toHaveTextContent("Bonjour");
    tracks.mockRestore();
  });

  it("tags chapter titles and track names with the language they are written in", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("WEBVTT\n")),
    );
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/captions");
    URL.revokeObjectURL = vi.fn();
    render(
      <Canvas
        canvases={languages.items as any}
        chapters={[
          { label: "Atto Primo", lang: "it", start: 0, end: 10 },
          { label: "Atto Secondo", lang: "it", start: 10 },
        ]}
      />,
    );
    await transport();
    expect(screen.getByText("Atto Primo")).toHaveAttribute("lang", "it");

    fireEvent.click(screen.getByRole("button", { name: "Chapters" }));
    const second = screen
      .getByRole("radio", { name: /Atto Secondo/ })
      .closest("label")!;
    expect(within(second).getByText("Atto Secondo")).toHaveAttribute(
      "lang",
      "it",
    );
    // The time is the interface's, not the title's.
    expect(within(second).getByText("0:10")).not.toHaveAttribute("lang");

    fireEvent.click(screen.getByRole("button", { name: "Captions" }));
    expect(screen.getByText("Sottotitoli in formato WebVTT")).toHaveAttribute(
      "lang",
      "it",
    );
    expect(screen.getByText("Off")).not.toHaveAttribute("lang");
  });

  it("takes chapters from the Manifest's Ranges, each in its language", async () => {
    render(
      <Clover.Root iiifContent={operaJson}>
        <Clover.Body />
      </Clover.Root>,
    );
    const title = await screen.findByText(
      "Preludio e Coro d'introduzione – Bel conforto al mietitore",
      { selector: ".clover-canvas-transport-chapter" },
      { timeout: 5000 },
    );
    expect(title).toHaveAttribute("lang", "it");
    fireEvent.click(screen.getByRole("button", { name: "Chapters" }));
    expect(screen.getByText("Remainder of Atto Primo")).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("keeps the transport, and the focus on it, from one recording to the next", async () => {
    const onMediaElement = vi.fn();
    const [first] = video.items as any[];
    // Another recording, as auto-advance moves on to it.
    const next = JSON.parse(
      JSON.stringify(first)
        .replaceAll(first.id, `${first.id}/next`)
        .replace("1024kb", "512kb"),
    );
    const { rerender } = render(
      <Canvas canvases={[first]} onMediaElement={onMediaElement} />,
    );
    await transport();
    const toggle = screen.getByRole("button", { name: "Play" });
    act(() => toggle.focus());

    rerender(<Canvas canvases={[next]} onMediaElement={onMediaElement} />);
    await act(async () => {});
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    expect(element.src).toContain("512kb");
    expect(screen.getByRole("button", { name: "Play" })).toBe(toggle);
    expect(toggle).toHaveFocus();
  });

  it("hands focus to Play when the next recording lacks the control it was on", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("WEBVTT\n")),
    );
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/captions");
    URL.revokeObjectURL = vi.fn();
    // Cookbook 0074's recording, with captions, then 0003's, with none, as auto-advance
    // moves on; chapters for the first only.
    const [captioned] = languages.items as any[];
    const [plain] = video.items as any[];
    const chapters = [{ label: "Opening", start: 0, end: 10 }];
    const { rerender } = render(
      <Canvas canvases={[captioned]} chapters={chapters} />,
    );
    await transport();
    act(() => screen.getByRole("button", { name: "Captions" }).focus());

    rerender(<Canvas canvases={[plain]} chapters={chapters} />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Captions" })).toBeNull();
    const play = screen.getByRole("button", { name: "Play" });
    // Not dropped to the page (WCAG 2.4.3).
    expect(play).toHaveFocus();

    // The same for Chapters.
    act(() => screen.getByRole("button", { name: "Chapters" }).focus());
    rerender(<Canvas canvases={[captioned]} />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Chapters" })).toBeNull();
    expect(play).toHaveFocus();

    // Focus the reader took elsewhere is left there.
    act(() => screen.getByRole("button", { name: "Captions" }).focus());
    act(() => renderer.host.focus());
    rerender(<Canvas canvases={[plain]} />);
    await act(async () => {});
    expect(renderer.host).toHaveFocus();
  });

  /*
   * Cookbook 0103: a comment on 702 to 705 seconds of a reading, in an AnnotationPage
   * labeled "Environmental Noise".
   */
  describe("annotations on the recording's time", () => {
    const [canvas] = poetry.items as any[];
    const page = canvas.annotations[0];
    const annotations = page.items.map((annotation: any) => ({
      annotation,
      targetIndex: 0,
      pageLabel: page.label,
    }));
    const renderPoetry = async () => {
      const onMediaElement = vi.fn();
      render(
        <Canvas
          canvases={[canvas]}
          annotations={annotations}
          onMediaElement={onMediaElement}
        />,
      );
      await transport();
      await act(async () => {
        await import("../Annotations");
        await import("../AnnotationMenu");
      });
      return onMediaElement.mock.calls.at(-1)?.[0] as HTMLMediaElement;
    };
    const cues = () =>
      Array.from(
        document.querySelectorAll(
          '.clover-canvas-captions-cue[data-kind="annotation"]',
        ),
      );

    it("shows one as a cue while its stretch plays, under its page's label", async () => {
      const element = await renderPoetry();
      const at = (seconds: number) =>
        act(() => {
          element.currentTime = seconds;
          element.dispatchEvent(new Event("timeupdate"));
        });
      at(700);
      expect(cues()).toHaveLength(0);
      at(703);
      const [cue] = cues();
      expect(cue).toHaveTextContent(
        "Environmental NoiseSoft laughter, rustling",
      );
      expect(
        cue.querySelector(".clover-canvas-captions-cue-label"),
      ).toHaveAttribute("lang", "en");
      at(705);
      expect(cues()).toHaveLength(0);
    });

    it("goes there when picked from the Annotations list beside it", async () => {
      let media: HTMLMediaElement | null = null;
      const Spy = () => {
        const { clover } = Clover.useClover("Spy");
        React.useEffect(
          () => clover.media.subscribe(() => (media = clover.media.get())),
          [clover],
        );
        return null;
      };
      render(
        <Clover.Root iiifContent={poetryJson}>
          <Clover.Body />
          <Clover.Annotations scope="view" />
          <Spy />
        </Clover.Root>,
      );
      await transport();
      const entry = await screen.findByRole("button", {
        name: "Find in the recording: Soft laughter, rustling",
      });
      fireEvent.click(entry);
      await act(async () => {});
      expect(media!.currentTime).toBe(702);
    });

    it("lists them in the Canvas's annotations menu by time, under the page, and a pick goes there", async () => {
      const element = await renderPoetry();
      fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
      const menu = screen.getByTestId("clover-canvas-annotation-menu");
      expect(
        within(menu).getByRole("group", { name: "Environmental Noise" }),
      ).toBeInTheDocument();
      const item = within(menu).getByRole("radio", {
        name: "11:42 Soft laughter, rustling",
      });
      pick(item);
      expect(element.currentTime).toBe(702);
      // Paused it was; pressed, it plays from there (Mat, 2026-10-26).
      expect(play).toHaveBeenCalledTimes(1);
      act(() => element.dispatchEvent(new Event("seeked")));
      expect(cues()).toHaveLength(1);
    });
  });

  /*
   * The docs' `rudolf-hess-nuremberg` mock: Rudolf Hess, marked through a film in stretches of
   * `xywh=…&t=…`, his distress first, from 0:12.62, and not while an officer hides him
   * (0:23–0:35).
   */
  describe("annotations that follow the recording", () => {
    const [film] = tracking.items as any[];
    const page = film.annotations[0];
    const annotations = page.items.map((annotation: any) => ({
      annotation,
      targetIndex: 0,
      pageLabel: page.label,
    }));
    const drawn = async () => {
      // The renderer's overlay layer, in its viewport, and its first drawing.
      const container = document.createElement("div");
      renderer.host.appendChild(container);
      Object.assign(renderer, {
        overlays: { container, add: () => () => undefined, move: vi.fn() },
        invalidate: vi.fn(),
        fitAnnotation: vi.fn(),
      });
      await act(async () => {
        await import("../Annotations");
        await import("../AnnotationMenu");
      });
      await act(async () => listeners.open?.());
    };
    const hess = () =>
      document.querySelector<HTMLElement>(".clover-canvas-annotation")!;
    const seek = (element: HTMLMediaElement, seconds: number) =>
      act(() => {
        element.currentTime = seconds;
        element.dispatchEvent(new Event("seeked"));
      });

    it("lists one where it starts, and a pick goes there only when it is not on the recording", async () => {
      const onMediaElement = vi.fn();
      render(
        <Canvas
          canvases={[film]}
          annotations={annotations}
          onMediaElement={onMediaElement}
        />,
      );
      const item = async () => {
        if (!screen.queryByTestId("clover-canvas-annotation-menu"))
          fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
        const menu = await screen.findByTestId("clover-canvas-annotation-menu");
        return within(
          within(menu).getByRole("group", { name: "Rudolf Hess" }),
        ).getByRole("radio", { name: "0:12 Hess shows distress" });
      };
      // Over the film's still, the menu lists it already; a pick opens the film.
      pick(await item());
      await transport();
      await drawn();
      const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLMediaElement;
      expect(element.currentTime).toBe(12.62);
      // Not played, as its play button would; it moves, so nothing is zoomed to.
      expect(play).not.toHaveBeenCalled();
      expect(renderer.fitAnnotation).not.toHaveBeenCalled();
      act(() => element.dispatchEvent(new Event("seeked")));
      expect(hess()).not.toHaveAttribute("hidden");
      expect(hess()).toHaveAttribute("aria-current", "true");
      expect(renderer.overlays.move).toHaveBeenLastCalledWith(
        hess(),
        expect.objectContaining({ x: 262, y: 151 }),
      );

      // On the recording, picked again: the recording stays where it is.
      seek(element, 60);
      pick(await item());
      expect(element.currentTime).toBe(60);
      // Hidden behind the officer: back to where he is first marked.
      seek(element, 30);
      expect(hess()).toHaveAttribute("hidden");
      pick(await item());
      expect(element.currentTime).toBe(12.62);
    });

    it("goes there when picked from the Annotations list beside it", async () => {
      let media: HTMLMediaElement | null = null;
      const Spy = () => {
        const { clover } = Clover.useClover("Spy");
        React.useEffect(
          () => clover.media.subscribe(() => (media = clover.media.get())),
          [clover],
        );
        return null;
      };
      render(
        <Clover.Root iiifContent={hessJson}>
          <Clover.Body />
          <Clover.Annotations scope="view" />
          <Spy />
        </Clover.Root>,
      );
      const entry = await screen.findByRole("button", {
        name: "Find in the recording: Hess shows distress",
      });
      // Listed where it starts.
      expect(entry.closest("li")).toHaveTextContent("0:12");
      // The pick opens the film past its still, without playing it, and goes there.
      fireEvent.click(entry);
      await transport();
      await drawn();
      expect(media!.currentTime).toBe(12.62);
      expect(play).not.toHaveBeenCalled();
    });

    /*
     * Each page in the menu has its hide toggle, an eye after its label: hiding a page
     * hides only its annotations on the picture. Its items stay listed, the control that
     * opens the menu stays, and a pick still goes where the annotation is, and shows its
     * page again.
     */
    it("hides a page's annotations from the picture by its eye in the menu", async () => {
      const onMediaElement = vi.fn();
      render(
        <Canvas
          canvases={[film]}
          annotations={annotations.map((each: any) => ({
            ...each,
            pageId: page.id,
          }))}
          onMediaElement={onMediaElement}
        />,
      );
      const menu = async () => {
        if (!screen.queryByTestId("clover-canvas-annotation-menu"))
          fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
        return within(
          await screen.findByTestId("clover-canvas-annotation-menu"),
        ).getByRole("group", { name: "Rudolf Hess" });
      };
      pick(within(await menu()).getByRole("radio", { name: /distress/ }));
      await transport();
      await drawn();
      const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLMediaElement;
      seek(element, 14);
      expect(hess()).not.toHaveAttribute("hidden");

      // Named "Hide" and its page's label, its popover the one word.
      const eye = within(await menu()).getByRole("checkbox", {
        name: "Hide Rudolf Hess",
      });
      expect(
        eye.closest("label")!.querySelector(".clover-tip"),
      ).toHaveTextContent("Hide");
      fireEvent.click(eye);
      expect(eye).toBeChecked();
      expect(document.querySelector(".clover-canvas-annotation")).toBeNull();
      // Listed still, and still to be picked.
      expect(within(await menu()).getAllByRole("radio")).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Annotations" })).toBeVisible();
      seek(element, 300);
      pick(within(await menu()).getByRole("radio", { name: /led out/ }));
      expect(element.currentTime).toBe(85.67);
      expect(
        within(await menu()).getByRole("checkbox", {
          name: "Hide Rudolf Hess",
        }),
      ).not.toBeChecked();

      // Opened again, the menu focuses the picked item, not the checked eye before it.
      fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
      fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
      await menu();
      expect(document.activeElement).toHaveAccessibleName(
        "1:25 Hess is led out of the dock",
      );

      fireEvent.click(within(await menu()).getByRole("checkbox"));
      expect(within(await menu()).getByRole("checkbox")).toBeChecked();
      expect(document.querySelector(".clover-canvas-annotation")).toBeNull();
    });

    it("hides a set from the Root, so the menu and the list hide it together", async () => {
      let hidden: string[] = [];
      const Spy = () => {
        const { clover } = Clover.useClover("Spy");
        React.useEffect(
          () =>
            clover.store.subscribe(
              () => (hidden = clover.store.get().hiddenSets),
            ),
          [clover],
        );
        return null;
      };
      render(
        <Clover.Root iiifContent={hessJson}>
          <Clover.Body />
          <Clover.Annotations scope="view" />
          <Spy />
        </Clover.Root>,
      );
      // The list's toggle, beside the page's heading.
      const listed = await screen.findByRole("checkbox", {
        name: "Hide Rudolf Hess",
      });
      fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
      const menu = await screen.findByTestId("clover-canvas-annotation-menu");
      fireEvent.click(
        within(menu).getByRole("checkbox", { name: "Hide Rudolf Hess" }),
      );
      expect(hidden).toEqual([page.id]);
      expect(listed).toBeChecked();
      // The page's items stay in the menu.
      expect(
        within(
          within(menu).getByRole("group", { name: "Rudolf Hess" }),
        ).getAllByRole("radio"),
      ).toHaveLength(3);
    });
  });

  it("plays sound through the same transport, never placed", async () => {
    const onMediaElement = vi.fn();
    render(
      <Canvas canvases={audio.items as any} onMediaElement={onMediaElement} />,
    );
    await transport();
    // Nothing reads its samples, so no CORS is asked of it.
    expect(onMediaElement.mock.calls.at(-1)?.[0].crossOrigin).toBeNull();
    expect(screen.getByTestId("clover-canvas-media")).toHaveAttribute(
      "data-kind",
      "audio",
    );
    expect(screen.queryByTestId("clover-viewer-player-waveform")).toBeNull();
    expect(screen.queryByTestId("clover-canvas-navigator")).toBeNull();
    // No picture of its own: the scene stays empty, in its 16:9 frame.
    expect(renderer.setImages).toHaveBeenLastCalledWith([], {
      world: { x: 0, y: 0, width: 1600, height: 900 },
      // Always fitted: a lone sound Canvas never moves.
      fit: true,
    });
    expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();
  });

  /*
   * A lone recording of sound plays as a player (`Player.tsx`): nothing drawn in the
   * scene; its accompanying Canvas its artwork, asked as its image service's `info.json`
   * allows and named by that Canvas's label; its title for the eye, the view named by
   * it; and what it is part of under it.
   */
  it("plays lone sound as a player, its accompanying image its artwork", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) =>
        new Response(
          JSON.stringify({
            "@context": "http://iiif.io/api/image/3/context.json",
            id: String(input).replace(/\/info\.json$/, ""),
            type: "ImageService3",
            protocol: "http://iiif.io/api/image",
            profile: "level1",
            width: 772,
            height: 998,
          }),
        ),
    );
    render(<Canvas canvases={accompanying.items as any} partOf="A symphony" />);
    await transport();
    expect(screen.getByTestId("clover-canvas")).toHaveAttribute("data-player");
    expect(renderer.setImages.mock.lastCall?.[0] ?? []).toHaveLength(0);
    expect(screen.queryByTestId("clover-canvas-navigator")).toBeNull();
    const art = await screen.findByRole("img", {
      name: "First page of score for Gustav Mahler, Symphony No. 3",
    });
    // All of it at its own size, 772 by 998, short of the 1,200 a player asks for.
    expect(art.getAttribute("src")).toMatch(/\/full\/max\/0\/default\.jpg$/);
    expect(
      screen.getByText("Gustav Mahler, Symphony No. 3, CD 1", {
        selector: ".clover-canvas-player-title",
      }),
    ).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("A symphony")).toHaveClass(
      "clover-canvas-player-part-of",
    );
    fetch.mockRestore();
    clearInfoCache();
  });

  it("lists a player's chapters as tracks, the one playing marked, a press going to it", async () => {
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={audio.items as any}
        onMediaElement={onMediaElement}
        chapters={[
          { label: "Opening", start: 0, end: 10 },
          { label: "Lunch", start: 10, end: 20 },
        ]}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    const tracks = () =>
      within(screen.getByRole("list", { name: "Chapters" })).getAllByRole(
        "button",
      );
    // Each named by its title and its start, the number for the eye alone.
    expect(tracks().map((track) => track.textContent)).toEqual([
      "1Opening 0:00",
      "2Lunch 0:10",
    ]);
    expect(tracks()[0]).toHaveAttribute("aria-current", "true");
    fireEvent.click(tracks()[1]);
    expect(element.currentTime).toBe(10);
    act(() => {
      element.dispatchEvent(new Event("timeupdate"));
    });
    expect(tracks()[1]).toHaveAttribute("aria-current", "true");
    expect(tracks()[0]).not.toHaveAttribute("aria-current");
  });

  // Never for a recording beside a picture, or a video: those keep Canvas's look.
  it("plays no video as a player", async () => {
    render(<Canvas canvases={video.items as any} />);
    await transport();
    expect(screen.getByTestId("clover-canvas")).not.toHaveAttribute(
      "data-player",
    );
    expect(document.querySelector(".clover-canvas-player")).toBeNull();
  });

  it("does not load the media player for a Canvas of images", () => {
    render(<Canvas src="https://example.org/a.jpg" />);
    expect(screen.queryByTestId("clover-canvas-media")).toBeNull();
    expect(screen.getByTestId("clover-canvas")).not.toHaveAttribute(
      "data-media",
    );
  });
});

describe("lazy loading", () => {
  it("fetches nothing, images or media, until the Canvas nears the screen", async () => {
    viewport.restore();
    viewport = stubViewport({ onScreen: false });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("WEBVTT\n"));
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/captions");
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={captions.items as any}
        onMediaElement={onMediaElement}
      />,
    );
    const canvas = screen.getByTestId("clover-canvas");

    expect(renderer.setImages).not.toHaveBeenCalled();
    expect(screen.queryByTestId("clover-canvas-transport")).toBeNull();
    expect(onMediaElement).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();

    act(() => viewport.scrollIntoView(canvas));
    await transport();
    expect(renderer.setImages).toHaveBeenCalled();
    expect(onMediaElement.mock.calls.at(-1)?.[0]).toBeInstanceOf(
      HTMLVideoElement,
    );
    // Captions are fetched only now.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("a lone media Canvas", () => {
  it("is a player: full screen in the transport, no controls at the top, the camera held", async () => {
    render(<Canvas canvases={video.items as any} />);
    await transport();
    // No top cluster or scrim: full screen is in the transport, at the bottom.
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByTestId("clover-canvas-button")).toBeNull();
    expect(document.querySelector(".clover-canvas-scrim")).toBeNull();
    const fullscreen = screen.getByRole("button", { name: "Full screen" });
    expect(fullscreen).toHaveAttribute("data-button", "fullscreen");
    expect(screen.getByTestId("clover-canvas-transport")).toContainElement(
      fullscreen,
    );
    expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
      "data-navigable",
      "false",
    );
  });

  it("keeps a host's own control (the panel's toggle), and only that, over a lone video", async () => {
    render(
      <Canvas canvases={video.items as any}>
        <button type="button" data-button="panel">
          More information
        </button>
      </Canvas>,
    );
    await transport();
    const cluster = screen.getByTestId("clover-canvas-controls");
    expect(cluster).toContainElement(
      screen.getByRole("button", { name: "More information" }),
    );
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
  });

  it("on iPhone, full screen hands the video to the system player", async () => {
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: undefined,
    });
    const enter = vi.fn();
    (HTMLVideoElement.prototype as any).webkitEnterFullscreen = enter;
    try {
      render(<Canvas canvases={video.items as any} />);
      await transport();
      fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
      await vi.waitFor(() => expect(enter).toHaveBeenCalledTimes(1));
    } finally {
      delete (HTMLVideoElement.prototype as any).webkitEnterFullscreen;
      Object.defineProperty(document, "fullscreenEnabled", {
        configurable: true,
        value: true,
      });
    }
  });

  it("is fitted to the video's own aspect, not the Canvas's declared one", async () => {
    // Cookbook 0074 declares a 288 × 384 portrait Canvas for a landscape film.
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={languages.items as any}
        onMediaElement={onMediaElement}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    Object.defineProperties(element, {
      videoWidth: { value: 400 },
      videoHeight: { value: 300 },
    });
    act(() => element.dispatchEvent(new Event("loadedmetadata")));

    const fitted = { x: 0, y: 84, width: 288, height: 216 };
    expect(renderer.setImages).toHaveBeenLastCalledWith(
      [expect.objectContaining({ placement: fitted })],
      { world: fitted, fit: true },
    );
  });
});

describe("containAspect", () => {
  it("centers the largest rectangle of an aspect inside a box", () => {
    const box = { x: 10, y: 0, width: 200, height: 200 };
    expect(containAspect(box, { width: 16, height: 9 })).toEqual({
      x: 10,
      y: 43.75,
      width: 200,
      height: 112.5,
    });
    expect(containAspect(box, null)).toBe(box);
  });

  it("gives a video its own frame size on a Canvas of no area (Cookbook 0015)", () => {
    // A Canvas with a duration and no width or height: nothing to fit inside.
    const none = { x: 0, y: 0, width: 0, height: 0 };
    expect(containAspect(none, { width: 640, height: 360 })).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 360,
    });
    expect(containAspect(none, null)).toBe(none);
  });
});

describe("formatTime", () => {
  it("reads as m:ss, or h:mm:ss past an hour", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(572.034)).toBe("9:32");
    expect(formatTime(7278.466)).toBe("2:01:18");
    expect(formatTime(NaN)).toBe("0:00");
  });
});
