import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { p4 } from "../../../fixtures/presentation4";
import React from "react";

import Canvas, { containAspect } from "..";
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
import { clearVttCache } from "../../../core/vtt";
import * as Clover from "../../../index";

// Published fixtures, upgraded to Presentation 4 as Clover holds them.
const audio = p4(audioJson);
const video = p4(videoJson);
const accompanying = p4(accompanyingJson);
const languages = p4(languagesJson);
const captions = p4(captionsJson);
const poetry = p4(poetryJson);

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
    // DOM presentation by default, so no CORS is asked of the media.
    expect(element.crossOrigin).toBeNull();
    expect(renderer.setImages).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          placement: { x: 0, y: 0, width: 480, height: 360 },
          media: { element, presentation: "dom" },
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

  it("asks for CORS when frames are drawn as a texture", async () => {
    const onMediaElement = vi.fn();
    render(
      <Canvas
        canvases={video.items as any}
        options={{ media: { presentation: "texture" } }}
        onMediaElement={onMediaElement}
      />,
    );
    await transport();
    const element = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    expect(element.crossOrigin).toBe("anonymous");
    expect(renderer.setImages).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          media: { element, presentation: "texture" },
        }),
      ],
      expect.anything(),
    );

    // The CORS request fails outright: the video is made again without, and shown as DOM.
    act(() => element.dispatchEvent(new Event("error")));
    const retried = onMediaElement.mock.calls.at(-1)?.[0] as HTMLVideoElement;
    expect(retried).not.toBe(element);
    expect(retried.crossOrigin).toBeNull();
    expect(renderer.setImages).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          media: { element: retried, presentation: "dom" },
        }),
      ],
      expect.anything(),
    );
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
    // A notch where the second chapter begins; none for the first.
    const markers = container.querySelectorAll(
      ".clover-canvas-transport-chapter-marker",
    );
    expect(markers).toHaveLength(1);
    expect((markers[0] as HTMLElement).style.left).toBe("50%");
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
        <Clover.Content />
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
   * labelled "Environmental Noise".
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
          <Clover.Content />
          <Clover.Annotations />
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
      // Paused it was, and paused it stays.
      expect(play).not.toHaveBeenCalled();
      act(() => element.dispatchEvent(new Event("seeked")));
      expect(cues()).toHaveLength(1);
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
    // No picture of its own: the scene stays empty, on the 16:9 stage.
    expect(renderer.setImages).toHaveBeenLastCalledWith([], {
      world: { x: 0, y: 0, width: 1600, height: 900 },
      // Always fitted: a lone sound Canvas never moves.
      fit: true,
    });
    expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();
  });

  it("shows sound's accompanying image, fitted, without a navigator", async () => {
    render(<Canvas canvases={accompanying.items as any} />);
    await transport();
    const [images] = renderer.setImages.mock.lastCall;
    expect(images).toHaveLength(1);
    expect(images[0].media).toBeUndefined();
    expect(screen.queryByTestId("clover-canvas-navigator")).toBeNull();
  });

  it("does not load the media stage for a Canvas of images", () => {
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
  it("is a player: full screen in the transport, no top chrome, the camera held", async () => {
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
          More Information
        </button>
      </Canvas>,
    );
    await transport();
    const cluster = screen.getByTestId("clover-canvas-controls");
    expect(cluster).toContainElement(
      screen.getByRole("button", { name: "More Information" }),
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
  it("centres the largest rectangle of an aspect inside a box", () => {
    const box = { x: 10, y: 0, width: 200, height: 200 };
    expect(containAspect(box, { width: 16, height: 9 })).toEqual({
      x: 10,
      y: 43.75,
      width: 200,
      height: 112.5,
    });
    expect(containAspect(box, null)).toBe(box);
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
