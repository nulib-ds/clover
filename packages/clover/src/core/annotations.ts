/**
 * Where an annotation points, read from any form of Presentation 4 target:
 *
 * - a URI, `canvas#xywh=x,y,w,h` or `canvas#t=start,end`;
 * - a reference, `{ id, type }`, whose id carries the same fragments (what the upgrader
 *   makes of a Presentation 3 string target);
 * - a `SpecificResource`, `{ source, selector }`, with a `FragmentSelector`,
 *   `PointSelector` or `SvgSelector` (or an array of them, of which the first that
 *   applies wins);
 * - several of these, as Presentation 4 groups them (`Independents`, `List`,
 *   `Composite`, which the upgrader makes of a Presentation 3 array), of which this reads
 *   the first; `annotationTargets` (`components/Canvas/track.ts`, with the hotspots that
 *   follow a recording) reads them all.
 *
 * A fragment may give a region and a time at once (`xywh=…&t=…`, both dimensions of a
 * Media Fragment): the region through that stretch of a recording.
 */
export interface ParsedAnnotationTarget {
  /** The Canvas (or other resource) targeted, without its fragment. */
  id: string;
  point?: { x: number; y: number };
  rect?: { x: number; y: number; w: number; h: number };
  svg?: string;
  /** A media fragment's time, as written: `start` or `start,end`. */
  t?: string;
}

type Target =
  | string
  | {
      id?: string;
      type?: string;
      source?: string | { id?: string };
      selector?: unknown;
    };

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/** `xywh=`, `t=`, or both, in a fragment or a selector's value. */
function readFragment(
  id: string,
  fragment: string,
): ParsedAnnotationTarget | null {
  const time = /(?:^|[#&])t=([^&]+)/.exec(fragment);
  const t = time && { t: time[1] };
  const xywh = /(?:^|[#&])xywh=(?:pixel:)?([^&]+)/.exec(fragment);
  if (xywh) {
    const [x, y, w, h] = xywh[1].split(",").map(Number);
    if ([x, y, w, h].every(Number.isFinite)) {
      return { id, rect: { x, y, w, h }, ...t };
    }
  }
  return t && { id, ...t };
}

/** A URI with its fragment (`#…`, or the `&t=` some publishers append) read. */
function readUri(uri: string): ParsedAnnotationTarget {
  const hash = uri.indexOf("#");
  if (hash >= 0) {
    const id = uri.slice(0, hash);
    return readFragment(id, uri.slice(hash)) ?? { id };
  }
  const query = uri.indexOf("&t=");
  if (query >= 0) return { id: uri.slice(0, query), t: uri.slice(query + 3) };
  return { id: uri };
}

/** Presentation 4's groups of several targets (or bodies), each item one of its own. */
export const GROUPS = ["Independents", "Composite", "List"];

/** A target's first part: the first item of an array or a group, or the target itself. */
const first = (target: any): Target =>
  Array.isArray(target)
    ? first(target[0])
    : GROUPS.includes(target?.type)
      ? first(target.items?.[0])
      : target;

export function parseAnnotationTarget(target: Target): ParsedAnnotationTarget {
  return readTarget(first(target));
}

function readTarget(target: Target): ParsedAnnotationTarget {
  if (typeof target === "string") return readUri(target);
  if (!target || typeof target !== "object") return { id: "" };

  if (target.type !== "SpecificResource" || target.source === undefined) {
    return readUri(target.id ?? "");
  }

  const source =
    typeof target.source === "string"
      ? readUri(target.source)
      : readUri(target.source?.id ?? "");

  for (const raw of asArray(target.selector)) {
    const selector = raw as Record<string, any>;
    if (selector?.type === "PointSelector") {
      return {
        id: source.id,
        point: { x: Number(selector.x), y: Number(selector.y) },
      };
    }
    if (selector?.type === "SvgSelector" && selector.value) {
      return { id: source.id, svg: String(selector.value) };
    }
    if (selector?.type === "FragmentSelector" && selector.value) {
      const parsed = readFragment(source.id, String(selector.value));
      if (parsed) return parsed;
    }
  }
  return source;
}

/** An annotation's bodies, with Presentation 4's groups unwrapped. */
export function bodiesOf(
  annotation: Record<string, any>,
): Record<string, any>[] {
  return (toArray(annotation?.body) as Record<string, any>[]).flatMap((body) =>
    GROUPS.includes(body?.type)
      ? (toArray(body.items) as Record<string, any>[])
      : [body],
  );
}

const toArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];
