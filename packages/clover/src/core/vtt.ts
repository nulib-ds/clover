import { type CloverRequest, cloverFetch } from "./request";

/**
 * WebVTT, read by Clover: cues with their start, end and text. The Canvas's captions and
 * the `Transcript` share one fetch per file through `loadVtt`.
 *
 * @see https://www.w3.org/TR/webvtt1/
 */

export interface Cue {
  start: number;
  end: number;
  /** The cue text with voice and styling tags (`<v Speaker>`, `<i>`) removed. */
  text: string;
  /** The speaker, when a `<v>` tag names one. */
  voice?: string;
}

/** `hh:mm:ss.ttt` or `mm:ss.ttt` in seconds; NaN if malformed. */
function seconds(timestamp: string): number {
  const parts = timestamp.trim().split(":").map(Number);
  if (parts.some(Number.isNaN)) return NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&lrm;": "‎",
  "&rlm;": "‏",
  "&quot;": '"',
  "&apos;": "'",
};

/**
 * A cue's words: voice and styling tags (`<v Speaker>`, `<i>`) dropped, and character
 * references decoded, named (`&amp;`) and numeric (`&#39;`, `&#x2019;`), in one pass
 * so `&amp;#39;` stays `&#39;`. One left unknown stays as written.
 */
export function cueText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|[a-z]+);/gi, (entity, dec, hex) => {
      if (!dec && !hex) return ENTITIES[entity.toLowerCase()] ?? entity;
      const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    });
}

export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  // Blocks are separated by blank lines; the first is the header.
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.length);
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing === -1) continue; // Header, NOTE, STYLE or REGION.
    const [from, rest] = lines[timing].split("-->");
    const start = seconds(from);
    const end = seconds(rest.trim().split(/\s+/)[0]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const raw = lines.slice(timing + 1).join("\n");
    const voice = /<v(?:\.[^\s>]+)*\s+([^>]+)>/.exec(raw)?.[1]?.trim();
    const body = cueText(raw);
    cues.push({ start, end, text: body, ...(voice ? { voice } : {}) });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/**
 * The cue playing at `time`: the latest to start at or before it that has not ended.
 * Binary search, so a long transcript costs a few comparisons per tick. -1 if none.
 */
export function cueAt(cues: Cue[], time: number): number {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  // Overlapping cues: step back to the latest one still running.
  for (let index = found; index >= 0; index--) {
    if (cues[index].end > time) return index;
    if (time - cues[index].start > 3600) break;
  }
  return -1;
}

const files = new Map<string, Promise<string>>();

/** A WebVTT file's text, fetched once per URL (with CORS and the request settings). */
export function loadVtt(url: string, request?: CloverRequest): Promise<string> {
  let file = files.get(url);
  if (!file) {
    file = cloverFetch(request, url)
      .then((response) =>
        response.ok
          ? response.text()
          : Promise.reject(new Error(String(response.status))),
      )
      .catch((error) => {
        files.delete(url); // A failure is not kept: a later caller may try again.
        throw error;
      });
    files.set(url, file);
  }
  return file;
}

/** Forget fetched files (tests). */
export const clearVttCache = () => files.clear();
