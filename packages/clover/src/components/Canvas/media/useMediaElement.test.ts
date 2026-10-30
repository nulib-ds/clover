import { renderHook, waitFor } from "@testing-library/react";

import type { MediaPlacement } from "../layout";
import { useMediaElement } from "./useMediaElement";

const hls = vi.hoisted(() => ({
  supported: true,
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  destroy: vi.fn(),
}));

// A class, not `vi.fn()`: `restoreAllMocks` after each test would strip a mocked
// constructor's implementation, and the next `new Hls()` would have no methods.
vi.mock("hls.js", () => {
  class Hls {
    static isSupported = () => hls.supported;
    loadSource = hls.loadSource;
    attachMedia = hls.attachMedia;
    destroy = hls.destroy;
  }
  return { default: Hls };
});

const media = (src: string, format?: string): MediaPlacement => ({
  id: src,
  kind: "video",
  src,
  format,
  placement: { x: 0, y: 0, width: 1920, height: 1080 },
  captions: [],
});

const STREAM = "https://example.org/stream/master.m3u8";

beforeAll(() => {
  // jsdom has no media pipeline.
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: () => undefined,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  hls.supported = true;
});

afterEach(() => vi.restoreAllMocks());

describe("useMediaElement", () => {
  it("plays HLS through hls.js, even where the browser claims native HLS", async () => {
    // Chromium answers "maybe" for HLS now; that no longer means Safari.
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue(
      "maybe",
    );
    const { result } = renderHook(() =>
      useMediaElement(media(STREAM, "application/x-mpegURL"), {}),
    );
    await waitFor(() => expect(hls.attachMedia).toHaveBeenCalled());
    expect(hls.loadSource).toHaveBeenCalledWith(STREAM);
    expect(hls.attachMedia).toHaveBeenCalledWith(result.current);
    expect(result.current?.getAttribute("src")).toBeNull();
  });

  it("falls back to native HLS where hls.js cannot run", async () => {
    hls.supported = false;
    const { result } = renderHook(() => useMediaElement(media(STREAM), {}));
    await waitFor(() =>
      expect(result.current?.getAttribute("src")).toBe(STREAM),
    );
    expect(hls.attachMedia).not.toHaveBeenCalled();
  });

  it("plays other video directly, without loading hls.js", async () => {
    const { result } = renderHook(() =>
      useMediaElement(media("https://example.org/film.mp4", "video/mp4"), {}),
    );
    expect(result.current?.getAttribute("src")).toBe(
      "https://example.org/film.mp4",
    );
    await Promise.resolve();
    expect(hls.loadSource).not.toHaveBeenCalled();
  });

  it("makes every caption track hidden, its cues live for Clover to draw", async () => {
    // jsdom has no text tracks: a list that fires `change` as a browser's does.
    const tracks = Object.assign(new EventTarget(), {
      items: [{ mode: "disabled" }, { mode: "disabled" }] as Array<{
        mode: string;
      }>,
    });
    const iterable = new Proxy(tracks, {
      get: (target, key) =>
        key === Symbol.iterator
          ? () => target.items[Symbol.iterator]()
          : key === "length"
            ? target.items.length
            : typeof key === "string" && /^\d+$/.test(key)
              ? target.items[Number(key)]
              : ((target as any)[key]?.bind?.(target) ?? (target as any)[key]),
    });
    vi.spyOn(HTMLMediaElement.prototype, "textTracks", "get").mockReturnValue(
      iterable as unknown as TextTrackList,
    );
    renderHook(() =>
      useMediaElement(media("https://example.org/film.mp4", "video/mp4"), {}),
    );
    await waitFor(() =>
      expect(tracks.items.map((t) => t.mode)).toEqual(["hidden", "hidden"]),
    );
    // What shows from then on is `useCaptionTracks`' to keep.
  });

  it("asks for no CORS: the browser shows the element itself", () => {
    const { result } = renderHook(() =>
      useMediaElement(media("https://example.org/film.mp4", "video/mp4"), {}),
    );
    expect(result.current?.crossOrigin).toBeNull();
  });

  it("names each caption track in the reader's language, of its kind, for the system player's menu", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("WEBVTT\n"));
    const { result } = renderHook(() =>
      useMediaElement(
        {
          ...media("https://example.org/film.mp4", "video/mp4"),
          captions: [
            {
              id: "https://example.org/film.vtt",
              label: { en: ["Captions"], it: ["Sottotitoli"] },
              language: "it",
              kind: "subtitles",
            },
          ],
        },
        { language: "it" },
      ),
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.querySelector("track")?.label).toBe("Sottotitoli");
    expect(result.current?.querySelector("track")?.kind).toBe("subtitles");
  });
});
