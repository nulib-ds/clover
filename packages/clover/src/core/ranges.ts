import { parseAnnotationTarget } from "./annotations";
import type { Manifest } from "./presentation";
import type { LanguageMapLike } from "./value";

/**
 * Chapters of a time-based Canvas, from the Manifest's Ranges: a Range whose items name
 * the Canvas with a time fragment (`#t=0,30`, or a `FragmentSelector` with `t=`) is a
 * chapter. Ranges nest, and a reference cycle is walked once. Chapters come back by start
 * time with the gaps closed, as a seek bar draws them contiguous.
 */

export interface Chapter {
  /** Its Range's id, as `Contents` keys the Range. */
  id?: string;
  label?: LanguageMapLike;
  start: number;
  end?: number;
}

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

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

/**
 * A Range item's Canvas reference, with its fragment restored.
 *
 * `@iiif/parser` 4.0.3's upgrader rewrites the `#` of a Range item's Canvas id as `/`
 * (`canvas/1#t=0,30` becomes `canvas/1/t=0,30`), losing the fragment. A trailing
 * `/t=` or `/xywh=` on a Range item is read as the fragment it was. SpecificResource
 * items are not affected.
 */
export function rangeItemTarget(item: unknown): unknown {
  if (typeof item === "string") return restoreFragment(item);
  const json = item as Json;
  if (json?.type === "SpecificResource") return json;
  return typeof json?.id === "string" ? restoreFragment(json.id) : json;
}

const restoreFragment = (id: string) =>
  id.replace(/\/((?:t|xywh)=[^/#]*)$/, "#$1");

const memo = new WeakMap<Manifest, Map<string, Chapter[]>>();
const NONE: Chapter[] = [];

export function chaptersOf(
  manifest: Manifest | null,
  canvasId: string | null,
  duration?: number,
): Chapter[] {
  if (!manifest || !canvasId) return NONE;
  let byCanvas = memo.get(manifest);
  if (!byCanvas) memo.set(manifest, (byCanvas = new Map()));
  const key = `${canvasId}|${duration ?? ""}`;
  const cached = byCanvas.get(key);
  if (cached) return cached;

  const found: Chapter[] = [];
  const visited = new Set<unknown>();
  const walk = (range: Json) => {
    if (!range || visited.has(range.id ?? range)) return;
    visited.add(range.id ?? range);
    for (const item of asArray(range.items) as Json[]) {
      if (item?.type === "Range") {
        walk(item);
        continue;
      }
      const parsed = parseAnnotationTarget(rangeItemTarget(item) as any);
      if (parsed.id.split("#")[0] !== canvasId) continue;
      const time = parseTime(parsed.t);
      if (time)
        found.push({
          ...(range.id ? { id: range.id } : {}),
          label: range.label,
          ...time,
        });
    }
  };
  for (const structure of asArray((manifest as Json).structures) as Json[]) {
    walk(structure);
  }
  found.sort((a, b) => a.start - b.start);
  const chapters = found.length
    ? found.map((chapter, index) => ({
        ...chapter,
        end: chapter.end ?? found[index + 1]?.start ?? duration,
      }))
    : NONE;
  byCanvas.set(key, chapters);
  return chapters;
}

/** One entry of a table of contents: a Range, where it starts, and the Ranges within. */
export interface ContentsNode {
  id: string;
  label?: LanguageMapLike;
  /** The first Canvas the Range (or its first descendant) names; none for an empty Range. */
  canvasId?: string;
  /** Every Canvas the Range covers, its own and its descendants'. */
  canvasIds: string[];
  /** The span on that Canvas, for time-based media. */
  time?: { start: number; end?: number };
  /** The region on that Canvas, when the Range names one. */
  region?: { x: number; y: number; w: number; h: number };
  children: ContentsNode[];
}

const tocs = new WeakMap<Manifest, ContentsNode[]>();
const NO_TOC: ContentsNode[] = [];

/**
 * The Manifest's table of contents, from `structures`. A single top Range that only wraps
 * others is unwrapped, as a reader expects its chapters, not one entry holding them.
 * Ranges marked `no-nav` are left out (their children are kept), and a cycle is walked once.
 */
export function tableOfContents(manifest: Manifest | null): ContentsNode[] {
  if (!manifest) return NO_TOC;
  const cached = tocs.get(manifest);
  if (cached) return cached;

  const visited = new Set<unknown>();
  const build = (range: Json): ContentsNode[] => {
    if (!range || visited.has(range.id ?? range)) return [];
    visited.add(range.id ?? range);
    const children: ContentsNode[] = [];
    const canvasIds: string[] = [];
    let first: ReturnType<typeof parseAnnotationTarget> | undefined;
    for (const item of asArray(range.items) as Json[]) {
      if (item?.type === "Range") {
        const built = build(item);
        children.push(...built);
        built.forEach((child) => canvasIds.push(...child.canvasIds));
      } else {
        const parsed = parseAnnotationTarget(rangeItemTarget(item) as any);
        if (!parsed.id) continue;
        first ??= parsed;
        canvasIds.push(parsed.id);
      }
    }
    const behavior = asArray(range.behavior);
    if (behavior.includes("no-nav")) return children;
    const start = first ?? undefined;
    const node: ContentsNode = {
      id: range.id ?? `range-${visited.size}`,
      label: range.label,
      canvasId: start?.id ?? children[0]?.canvasId,
      canvasIds: [...new Set(canvasIds)],
      children,
    };
    const time = parseTime(start?.t);
    if (time) node.time = time;
    else if (!start && children[0]?.time) node.time = children[0].time;
    if (start?.rect) node.region = start.rect;
    return [node];
  };

  const roots = (asArray((manifest as Json).structures) as Json[]).flatMap(
    build,
  );
  const nodes =
    roots.length === 1 && roots[0].children.length ? roots[0].children : roots;
  const result = nodes.length ? nodes : NO_TOC;
  tocs.set(manifest, result);
  return result;
}

/**
 * The entry the reader is in: the deepest covering `canvasId` whose span holds `time` (or
 * that has no span). Null when none is.
 */
export function currentContents(
  nodes: ContentsNode[],
  canvasId: string | null,
  time?: number,
): string | null {
  let best: { id: string; depth: number } | null = null;
  const walk = (node: ContentsNode, depth: number) => {
    if (canvasId && node.canvasIds.includes(canvasId)) {
      const within =
        !node.time ||
        (time !== undefined &&
          time >= node.time.start &&
          (node.time.end === undefined || time < node.time.end));
      if (within && (!best || depth >= best.depth))
        best = { id: node.id, depth };
    }
    node.children.forEach((child) => walk(child, depth + 1));
  };
  nodes.forEach((node) => walk(node, 0));
  return best ? (best as { id: string }).id : null;
}
