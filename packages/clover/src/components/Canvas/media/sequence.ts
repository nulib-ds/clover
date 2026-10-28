import type { MediaSegment } from "../layout";

type Time = { start: number; end: number };

/**
 * Plays a Canvas's files one after another on its time through its one element (Cookbook
 * 0064: an opera's two acts, each a video, the second from where the first ends), so it
 * reads as one recording, in the Canvas's time, to everything that reads the element:
 * the Transport, Contents and the Transcript, an annotation on the recording's time, a
 * link's `#t=`.
 *
 * - Its `currentTime` is the Canvas's: a file's own time plus where the file starts.
 *   Set past the file playing, the element loads the one that time falls in, and goes
 *   there, playing on if it was playing.
 * - Its `duration` is the Canvas's (`total`), and what it has `buffered`, the Canvas's
 *   time too.
 * - A file's end goes on into the next, playing: only the last one's `ended` is heard,
 *   this listener being the element's first.
 * - Its caption tracks' cues are moved by where the file playing starts, so the browser,
 *   timing them on the file's time, shows each at its moment on the Canvas's (WCAG 1.2.2).
 *
 * Returns what undoes it.
 */
export function playInSequence(
  video: HTMLVideoElement,
  segments: MediaSegment[],
  total: number | undefined,
): () => void {
  const proto = HTMLMediaElement.prototype;
  const time = Object.getOwnPropertyDescriptor(proto, "currentTime")!;
  const buffered = Object.getOwnPropertyDescriptor(proto, "buffered")!;
  let index = 0;
  // A time asked for in a file still loading, and whether to play from it.
  let pending: { time: number; play: boolean } | null = null;

  const fileTime = () => time.get!.call(video) as number;
  const setFileTime = (seconds: number) => time.set!.call(video, seconds);
  const startOf = () => segments[index].start;
  const segmentAt = (seconds: number) => {
    let found = 0;
    segments.forEach((segment, i) => {
      if (segment.start <= seconds) found = i;
    });
    return found;
  };

  // Each cue's own times, as its file gives them in the Canvas's.
  const cueTimes = new WeakMap<TextTrackCue, Time>();
  const moveCues = () => {
    for (const track of Array.from(video.textTracks ?? [])) {
      for (const cue of Array.from(track.cues ?? [])) {
        let own = cueTimes.get(cue);
        if (!own) {
          own = { start: cue.startTime, end: cue.endTime };
          cueTimes.set(cue, own);
        }
        cue.startTime = own.start - startOf();
        cue.endTime = own.end - startOf();
      }
    }
  };

  const go = (next: number, seconds: number, play: boolean) => {
    pending = { time: seconds, play };
    if (next === index) return;
    index = next;
    moveCues();
    video.src = segments[next].src;
  };
  const arrived = () => {
    if (!pending) return;
    const { time: seconds, play } = pending;
    pending = null;
    setFileTime(Math.max(0, seconds - startOf()));
    if (play) void video.play()?.catch(() => undefined);
  };
  const ended = (event: Event) => {
    if (index >= segments.length - 1) return;
    event.stopImmediatePropagation();
    go(index + 1, segments[index + 1].start, true);
  };

  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => (pending ? pending.time : startOf() + fileTime()),
    set: (seconds: number) => {
      const next = segmentAt(seconds);
      if (next === index && !pending) {
        setFileTime(Math.max(0, seconds - startOf()));
        return;
      }
      go(next, seconds, pending?.play ?? !video.paused);
      // In the file loaded already: there now.
      if (next === index && video.readyState >= 1) arrived();
    },
  });
  Object.defineProperty(video, "duration", {
    configurable: true,
    get: () => total ?? Number.NaN,
  });
  Object.defineProperty(video, "buffered", {
    configurable: true,
    get: () => {
      const own = buffered.get!.call(video) as TimeRanges;
      const offset = startOf();
      return {
        length: own.length,
        start: (i: number) => offset + own.start(i),
        end: (i: number) => offset + own.end(i),
      } as TimeRanges;
    },
  });
  video.addEventListener("ended", ended);
  video.addEventListener("loadedmetadata", arrived);
  // A caption file loading later gets its cues moved too.
  const tracks = Array.from(video.querySelectorAll("track"));
  tracks.forEach((track) => track.addEventListener("load", moveCues));

  return () => {
    video.removeEventListener("ended", ended);
    video.removeEventListener("loadedmetadata", arrived);
    tracks.forEach((track) => track.removeEventListener("load", moveCues));
    for (const name of ["currentTime", "duration", "buffered"]) {
      delete (video as unknown as Record<string, unknown>)[name];
    }
  };
}
