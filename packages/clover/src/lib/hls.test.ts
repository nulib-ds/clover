import { isHls } from "./hls";

describe("isHls", () => {
  it("knows a playlist by its path, its query or fragment set aside", () => {
    expect(isHls("https://example.org/a/playlist.m3u8")).toBe(true);
    expect(isHls("https://example.org/a/playlist.M3U8?token=1")).toBe(true);
    expect(isHls("https://example.org/a/playlist.m3u8#t=10")).toBe(true);
    expect(isHls("https://example.org/a/film.mp4")).toBe(false);
    expect(isHls("https://example.org/m3u8/film.mp4")).toBe(false);
  });

  it("knows a playlist by each of HLS's MIME types, in any case", () => {
    for (const type of [
      "application/vnd.apple.mpegurl",
      "vnd.apple.mpegurl",
      "audio/mpegurl",
      "audio/x-mpegurl",
      "application/x-mpegurl",
      "video/x-mpegurl",
      "video/mpegurl",
      "application/mpegurl",
      "Application/VND.Apple.MpegURL",
    ])
      expect(isHls("https://example.org/stream", type)).toBe(true);
    expect(isHls("https://example.org/stream", "video/mp4")).toBe(false);
    expect(isHls("https://example.org/stream", "audio/mpeg")).toBe(false);
    expect(isHls(undefined, undefined)).toBe(false);
  });
});
