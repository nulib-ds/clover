import {
  type ParsedAnnotationTarget,
  bodiesOf,
  parseAnnotationTarget,
} from "./annotations";

export { bodiesOf };
import type { Manifest } from "./presentation";
import { selectSequence } from "./selectors";
import type { LanguageMapLike } from "./value";

/**
 * Annotations to read and to point at: everything a Manifest's Canvases carry in their
 * `annotations` (comments, tags, transcriptions, descriptions), and pages a host adds.
 * Painting annotations are the picture, not commentary, and caption files belong to the
 * media transcript, so neither is listed here.
 *
 * A set is one AnnotationPage. Sets are memoised on the Manifest and the added pages, so
 * the same arrays come back while nothing changes.
 */

export interface AnnotationBodyEntry {
  /** `TextualBody` text, as published: plain, or IIIF's limited HTML. */
  value?: string;
  format?: string;
  language?: string;
  /** An image body (Cookbook 0377): its URL. */
  image?: string;
  /** An image body's label, else its annotation's: the image's text alternative. */
  label?: LanguageMapLike;
}

export interface AnnotationEntry {
  id: string;
  /** The set it came from. */
  setId: string;
  /** The Canvas it targets. */
  canvasId: string;
  target: ParsedAnnotationTarget;
  motivation: string[];
  bodies: AnnotationBodyEntry[];
  /** The annotation as published, for a host's own rendering. */
  annotation: Record<string, any>;
}

export interface AnnotationSet {
  id: string;
  label?: LanguageMapLike;
  /** Where it came from: the Manifest's Canvases, the host, or a Content Search. */
  source: "manifest" | "added" | "search";
  entries: AnnotationEntry[];
}

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

const isCaptionFile = (body: Json) =>
  body?.format === "text/vtt" ||
  (typeof body?.id === "string" && /\.vtt(\?|$)/i.test(body.id));

export function readBodies(annotation: Json): AnnotationBodyEntry[] {
  const bodies: AnnotationBodyEntry[] = [];
  for (let body of bodiesOf(annotation)) {
    // A `Choice` of languages offers its first, as a viewer shows one at a time.
    if (body?.type === "Choice") body = asArray(body.items)[0] as Json;
    if (!body || isCaptionFile(body)) continue;
    if (body.type === "TextualBody" || typeof body.value === "string") {
      bodies.push({
        value: String(body.value ?? ""),
        format: body.format,
        language: asArray(body.language)[0] as string | undefined,
      });
    } else if (body.type === "Image" && body.id) {
      const label = body.label ?? annotation.label;
      bodies.push({
        image: body.id,
        format: body.format,
        ...(label ? { label } : {}),
      });
    }
  }
  return bodies;
}

/** The entries of one page, for the Canvas it hangs on (or its targets name). */
export function readPage(
  page: Json,
  setId: string,
  fallbackCanvasId?: string,
): AnnotationEntry[] {
  const entries: AnnotationEntry[] = [];
  for (const annotation of asArray(page?.items) as Json[]) {
    const motivation = asArray(annotation?.motivation) as string[];
    if (motivation.includes("painting")) continue;
    const bodies = readBodies(annotation);
    if (!bodies.length) continue;
    const target = parseAnnotationTarget(asArray(annotation.target)[0] as any);
    const canvasId = target.id || fallbackCanvasId;
    if (!canvasId || !annotation.id) continue;
    entries.push({
      id: annotation.id,
      setId,
      canvasId,
      target,
      motivation,
      bodies,
      annotation,
    });
  }
  return entries;
}

const manifestSets = new WeakMap<Manifest, AnnotationSet[]>();

/** The sets the Manifest's Canvases carry, merged by page id across Canvases. */
export function selectManifestSets(manifest: Manifest | null): AnnotationSet[] {
  if (!manifest) return [];
  let sets = manifestSets.get(manifest);
  if (!sets) {
    const byId = new Map<string, AnnotationSet>();
    for (const canvas of selectSequence(manifest).canvases as Json[]) {
      for (const page of asArray(canvas.annotations) as Json[]) {
        if (!Array.isArray(page?.items)) continue; // Not fetched yet.
        const id = page.id ?? `${canvas.id}#annotations`;
        let set = byId.get(id);
        if (!set) {
          set = { id, label: page.label, source: "manifest", entries: [] };
          byId.set(id, set);
        }
        set.entries.push(...readPage(page, id, canvas.id));
      }
    }
    sets = [...byId.values()].filter((set) => set.entries.length);
    manifestSets.set(manifest, sets);
  }
  return sets;
}

const allSets = new WeakMap<object, Map<unknown, AnnotationSet[]>>();
const NO_SETS: AnnotationSet[] = [];

/** The Manifest's sets, then the host's. */
export function selectAnnotationSets(
  manifest: Manifest | null,
  added: AnnotationSet[],
): AnnotationSet[] {
  const own = selectManifestSets(manifest);
  if (!added.length) return own.length ? own : NO_SETS;
  const key = manifest ?? NO_SETS;
  let byAdded = allSets.get(key);
  if (!byAdded) allSets.set(key, (byAdded = new Map()));
  let sets = byAdded.get(added);
  if (!sets) {
    sets = [...own, ...added];
    byAdded.set(added, sets);
  }
  return sets;
}

const drawnSets = new WeakMap<AnnotationSet[], Map<unknown, AnnotationSet[]>>();

/**
 * Every set the Canvas draws: the Manifest's, the host's, then a search's hits. The
 * Annotations list leaves the search out; its hits are listed by `Search`.
 */
export function selectDrawnSets(
  manifest: Manifest | null,
  added: AnnotationSet[],
  searchSet: AnnotationSet | null,
): AnnotationSet[] {
  const sets = selectAnnotationSets(manifest, added);
  if (!searchSet?.entries.length) return sets;
  let bySearch = drawnSets.get(sets);
  if (!bySearch) drawnSets.set(sets, (bySearch = new Map()));
  let drawn = bySearch.get(searchSet);
  if (!drawn) {
    drawn = [...sets, searchSet];
    bySearch.set(searchSet, drawn);
  }
  return drawn;
}

/** An entry by id, across sets. */
export function findEntry(
  sets: AnnotationSet[],
  id: string | null,
): AnnotationEntry | null {
  if (!id) return null;
  for (const set of sets) {
    const entry = set.entries.find((candidate) => candidate.id === id);
    if (entry) return entry;
  }
  return null;
}
