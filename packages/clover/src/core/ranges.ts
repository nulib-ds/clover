import { parseAnnotationTarget } from "./annotations";
import type { Manifest } from "./presentation";
import type { LanguageMapLike } from "./value";
import { asArray } from "../lib/asArray";
import { parseTime } from "../lib/time";

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
  /**
   * Its Range's `thumbnail` (Cookbook 0229), the first it gives, as written: what draws
   * it asks its service as its `info.json` allows (`ui/EntryThumbnail`).
   */
  thumbnail?: Record<string, unknown>;
}

type Json = Record<string, any>;

// Kept in `lib/time.ts`, so the Canvas reads a target's time without the Ranges' reader.
export { parseTime } from "../lib/time";

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

/**
 * A Range's own `thumbnail`, the first it gives, as written; none without one. Read into
 * a request only where it is drawn, so a page that draws none loads none of that.
 */
function rangeThumbnail(range: Json): { thumbnail?: Json } {
  const first = asArray(range.thumbnail)[0] as Json | undefined;
  return first && typeof first === "object" ? { thumbnail: first } : {};
}

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
    // A `no-nav` Range's own stretch is no chapter (Cookbook 0229), as Contents lists none.
    const listed = !asArray(range.behavior).includes("no-nav");
    for (const item of asArray(range.items) as Json[]) {
      if (item?.type === "Range") {
        walk(item);
        continue;
      }
      if (!listed) continue;
      const parsed = parseAnnotationTarget(rangeItemTarget(item) as any);
      if (parsed.id.split("#")[0] !== canvasId) continue;
      const time = parseTime(parsed.t);
      if (time)
        found.push({
          ...(range.id ? { id: range.id } : {}),
          label: range.label,
          ...time,
          ...rangeThumbnail(range),
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
  /**
   * Its own Canvases and their parts, in the order the Range reads them (Cookbook 0025:
   * an article's columns, page 2 then page 5): for a `sequence` (Cookbook 0027), where a
   * region is among them, which the Canvas draws (`range-regions.ts`), or where its pages
   * are out of the Manifest's order; two or more are stepped through in Contents. None on
   * a recording's time, nor for any other run of whole pages in order, which Items steps.
   */
  parts?: ContentsPart[];
  /**
   * A Range of `behavior` `sequence` (Cookbook 0027): an order of the Canvases of its own,
   * the first of them the default, as `currentContents` takes it.
   */
  sequence?: true;
  /** Its Range's `thumbnail` (Cookbook 0229), the first it gives, as written. */
  thumbnail?: Record<string, unknown>;
  children: ContentsNode[];
}

/** One Canvas, or a region of one, in a Range's reading order. */
export interface ContentsPart {
  canvasId: string;
  region?: { x: number; y: number; w: number; h: number };
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

  // Each Canvas's place in the Manifest, to tell a Range's pages out of order.
  const order = new Map(
    (asArray((manifest as Json).items) as Json[]).map((canvas, index) => [
      canvas?.id,
      index,
    ]),
  );
  const visited = new Set<unknown>();
  const build = (range: Json): ContentsNode[] => {
    if (!range || visited.has(range.id ?? range)) return [];
    visited.add(range.id ?? range);
    const children: ContentsNode[] = [];
    const canvasIds: string[] = [];
    const parts: Array<ReturnType<typeof parseAnnotationTarget>> = [];
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
        parts.push(parsed);
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
      ...(behavior.includes("sequence") ? { sequence: true as const } : {}),
      ...rangeThumbnail(range),
      children,
    };
    const time = parseTime(start?.t);
    if (time) node.time = time;
    else if (!start && children[0]?.time) node.time = children[0].time;
    if (start?.rect) node.region = start.rect;
    // A sequence's pages are read in its order, whatever it is (Mat, 2026-10-28).
    const ordered =
      behavior.includes("sequence") &&
      parts.length > 1 &&
      !parts.some((part) => part.t);
    if (ordered || worthStepping(parts, order))
      node.parts = parts.map((part) => ({
        canvasId: part.id!,
        ...(part.rect ? { region: part.rect } : {}),
      }));
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
 * Whether a Range's own Canvases are worth keeping as its parts: none on a recording's
 * time, and a region among them, or two or more pages not in the Manifest's order one
 * after another (a page twice, page 2 then page 5).
 */
function worthStepping(
  parts: Array<ReturnType<typeof parseAnnotationTarget>>,
  order: Map<unknown, number>,
): boolean {
  if (!parts.length || parts.some((part) => part.t)) return false;
  if (parts.some((part) => part.rect)) return true;
  return parts.some(
    (part, index) =>
      index > 0 &&
      order.get(part.id) !== (order.get(parts[index - 1].id) ?? NaN) + 1,
  );
}

/**
 * The entry the reader is in: the deepest covering `canvasId` whose span holds `time` (or
 * that has no span). Null when none is.
 */
export function currentContents(
  nodes: ContentsNode[],
  canvasId: string | null,
  time?: number,
  /**
   * The entry the reader chose: it, or the deepest entry in it, is current wherever it
   * covers the Canvas and time, over any other that does (one of two sequences).
   */
  chosen?: string | null,
): string | null {
  type Best = { id: string; depth: number; sequence?: true } | null;
  let best: Best = null;
  let inChosen: Best = null;
  const deeper = (than: Best, node: ContentsNode, depth: number) =>
    !than ||
    depth > than.depth ||
    // The later of two alike; of two sequences, the first, the default.
    (depth === than.depth && !(than.sequence && node.sequence));
  const walk = (node: ContentsNode, depth: number, within: boolean) => {
    const under = within || node.id === chosen;
    if (canvasId && node.canvasIds.includes(canvasId)) {
      const covers =
        !node.time ||
        (time !== undefined &&
          time >= node.time.start &&
          (node.time.end === undefined || time < node.time.end));
      if (covers) {
        const found = {
          id: node.id,
          depth,
          ...(node.sequence ? { sequence: true as const } : {}),
        };
        if (deeper(best, node, depth)) best = found;
        if (under && deeper(inChosen, node, depth)) inChosen = found;
      }
    }
    node.children.forEach((child) => walk(child, depth + 1, under));
  };
  nodes.forEach((node) => walk(node, 0, false));
  const result = (inChosen ?? best) as Best;
  return result ? result.id : null;
}
