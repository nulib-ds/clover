import { playInSequence } from "./sequence";

const segments = [
  { src: "https://example.org/act-1.mp4", start: 0, duration: 100 },
  { src: "https://example.org/act-2.mp4", start: 100, duration: 50 },
];
const own = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  "currentTime",
)!;
const fileTime = (video: HTMLVideoElement) => own.get!.call(video) as number;

function make() {
  const video = document.createElement("video");
  video.src = segments[0].src;
  const undo = playInSequence(video, segments, 150);
  return { video, undo };
}

afterEach(() => vi.restoreAllMocks());

// Cookbook 0064: two files, one recording in the Canvas's time.
describe("playInSequence", () => {
  it("reads as one recording in the Canvas's time", () => {
    const { video, undo } = make();
    expect(video.duration).toBe(150);
    video.currentTime = 40;
    expect(video.currentTime).toBe(40);
    expect(video.src).toBe(segments[0].src);

    // Past the first file: the second loads, and the time waits there for it.
    video.currentTime = 120;
    expect(video.src).toBe(segments[1].src);
    expect(video.currentTime).toBe(120);
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(fileTime(video)).toBe(20);
    expect(video.currentTime).toBe(120);

    // And back into the first.
    video.currentTime = 30;
    expect(video.src).toBe(segments[0].src);
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.currentTime).toBe(30);

    undo();
    expect(Number.isNaN(video.duration)).toBe(true);
  });

  it("goes on into the next file at a file's end, and only the last end is heard", () => {
    const { video } = make();
    const heard = vi.fn();
    video.addEventListener("ended", heard);
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);

    video.dispatchEvent(new Event("ended"));
    expect(heard).not.toHaveBeenCalled();
    expect(video.src).toBe(segments[1].src);
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.currentTime).toBe(100);
    expect(play).toHaveBeenCalled();

    video.dispatchEvent(new Event("ended"));
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("gives what it has buffered in the Canvas's time", () => {
    vi.spyOn(HTMLMediaElement.prototype, "buffered", "get").mockReturnValue({
      length: 1,
      start: () => 0,
      end: () => 12,
    } as TimeRanges);
    const { video } = make();
    video.currentTime = 110;
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.buffered.end(0)).toBe(112);
  });

  // Captions in the Canvas's time, timed by the browser on the file's (WCAG 1.2.2).
  it("moves the captions' cues by where the file playing starts", () => {
    const video = document.createElement("video");
    const cue = { startTime: 110, endTime: 115 } as TextTrackCue;
    Object.defineProperty(video, "textTracks", {
      value: [{ cues: [cue] }],
    });
    playInSequence(video, segments, 150);
    video.currentTime = 105;
    expect(cue.startTime).toBe(10);
    expect(cue.endTime).toBe(15);
    video.currentTime = 5;
    expect(cue.startTime).toBe(110);
  });
});
