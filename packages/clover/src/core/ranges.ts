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
export function rangeThumbnail(range: Json): { thumbnail?: Json } {
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

const listing = new WeakMap<Manifest, boolean>();

/**
 * Whether the Manifest has a table of contents (`core/contents.ts`'s `tableOfContents`
 * gives one): a Range it lists, one not `no-nav`, reached through Ranges that are. Walked
 * as the table is, a cycle once, and stopped at the first, so the Panel tells whether to
 * offer Contents without the table's reader, which loads with Contents.
 */
export function hasContents(manifest: Manifest | null): boolean {
  if (!manifest) return false;
  let has = listing.get(manifest);
  if (has === undefined) {
    const visited = new Set<unknown>();
    const listed = (range: Json): boolean => {
      if (!range || visited.has(range.id ?? range)) return false;
      visited.add(range.id ?? range);
      return (
        !asArray(range.behavior).includes("no-nav") ||
        (asArray(range.items) as Json[]).some(
          (item) => item?.type === "Range" && listed(item),
        )
      );
    };
    has = (asArray((manifest as Json).structures) as Json[]).some(listed);
    listing.set(manifest, has);
  }
  return has;
}
