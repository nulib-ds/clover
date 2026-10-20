import {
  GROUPS,
  type ParsedAnnotationTarget,
  parseAnnotationTarget,
} from "../../core/annotations";
import type { Rect } from "../../lib/renderer";

/** A target's parts: the items of an array or a group, each in turn, or itself. */
const partsOf = (target: any): unknown[] =>
  Array.isArray(target)
    ? target.flatMap(partsOf)
    : GROUPS.includes(target?.type)
      ? partsOf(target.items ?? [])
      : target == null
        ? []
        : [target];

/**
 * Every target of an annotation, in the order given, each read as one: an array's or a
 * Presentation 4 group's (`Independents`, `List`, `Composite`). Here rather than with
 * `parseAnnotationTarget`, which every Canvas loads, as only a track reads them all.
 */
export const annotationTargets = (target: unknown): ParsedAnnotationTarget[] =>
  partsOf(target).map((part) => parseAnnotationTarget(part as never));

/**
 * One stretch of a recording that an annotation marks, and where: a target with a region
 * and a time, `xywh=x,y,w,h&t=start,end` (both dimensions of a Media Fragment), placed in
 * the world.
 */
export interface TrackKey {
  /** In seconds. */
  start: number;
  /** In seconds; `Infinity` for one that lasts to the end of the recording. */
  end: number;
  world: Rect;
}

/**
 * Whether `next` starts where `key` ends (to the millisecond): the two are one movement,
 * so the region glides from the one to the other. A gap between them is time the region
 * is not there at all, as across a cut, or while what it marks is out of view.
 */
const meets = (key: TrackKey, next: TrackKey) =>
  Math.abs(key.end - next.start) < 0.001;

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/**
 * The keys in time order, each lasting until the next starts where it gives no end of its
 * own (`t=12`), so a run of keys written as moments is one movement too.
 */
export function orderKeys(keys: TrackKey[]): TrackKey[] {
  const ordered = [...keys].sort((a, b) => a.start - b.start);
  return ordered.map((key, index) => {
    const next = ordered[index + 1];
    return key.end === Infinity && next ? { ...key, end: next.start } : key;
  });
}

/**
 * Where a track is at `time`, or null while none of it is: within a key, its region,
 * moving toward the next key's region when the two meet, and held where they do not (the
 * last of a run, or before a cut).
 */
export function boxAt(keys: TrackKey[], time: number): Rect | null {
  // The last key to start by `time`.
  let low = 0;
  let high = keys.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (keys[middle].start <= time) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  const key = keys[found];
  if (!key || time >= key.end) return null;
  const next = keys[found + 1];
  if (!next || !meets(key, next) || !Number.isFinite(key.end)) return key.world;
  const f = (time - key.start) / (key.end - key.start || 1);
  const [a, b] = [key.world, next.world];
  return {
    x: lerp(a.x, b.x, f),
    y: lerp(a.y, b.y, f),
    width: lerp(a.width, b.width, f),
    height: lerp(a.height, b.height, f),
  };
}
