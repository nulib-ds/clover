/** `m:ss`, or `h:mm:ss` past an hour, from the whole second it is in, as a player counts. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Go to a time and play from it: a press on a time (a cue, a timed annotation, a
 * chapter) asks to hear it from there (Mat, 2026-10-26: "clicking a time annotation/cue/
 * content range should make the audio/video begin playing"). The reader's press starts
 * it, so it is never autoplay (WCAG 1.4.2), and the transport's pause is at hand. A
 * browser that will not play leaves it there, paused.
 */
export function playFrom(element: HTMLMediaElement, seconds: number) {
  element.currentTime = seconds;
  if (!element.paused) return;
  try {
    void element.play()?.catch(() => undefined);
  } catch {
    // Not playable here (a document without media playback).
  }
}

/** `"30"`, `"0,30"` and `"0,"` are all legal; malformed is undefined, never NaN. */
export function parseTime(
  t?: string,
): { start: number; end?: number } | undefined {
  if (!t) return undefined;
  const [rawStart, rawEnd] = t.split(",");
  const start = Number(rawStart);
  if (rawStart === "" || Number.isNaN(start)) return undefined;
  if (rawEnd === undefined || rawEnd === "") return { start };
  const end = Number(rawEnd);
  return Number.isNaN(end) ? { start } : { start, end };
}
