import {
  type ParsedAnnotationTarget,
  isRegionText,
  parseAnnotationTarget,
} from "./annotations";
import { type AnnotationBodyEntry, readBodies } from "./annotation-bodies";
import { asArray } from "../lib/asArray";

export type { AnnotationBodyEntry };
import type { Manifest } from "./presentation";
import { SEARCH_SET_ID } from "./search-service";
import { selectCanvas, selectSequence } from "./selectors";
import type { LanguageMapLike } from "./value";

/**
 * Annotations to read and to point at: everything a Manifest's Canvases carry in their
 * `annotations` (comments, tags, transcriptions, descriptions), and pages a host adds.
 * Painting annotations are the picture, not commentary, and caption files belong to the
 * media transcript, so neither is listed here.
 *
 * A set is one AnnotationPage. Sets are memoized on the Manifest and the added pages, so
 * the same arrays come back while nothing changes.
 */

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
  /**
   * A Range's region (`range-regions.ts`): its place among the Range's parts, "1 of 4",
   * which its hotspot shows after its name.
   */
  place?: { index: number; total: number };
  /**
   * An annotation of one image of a `Choice` (Cookbook 0326: an X-ray's tag), not of the
   * Canvas: the choice's key (`core/choice-key.ts`), the item's place in it, and the
   * image's id. It is drawn while that item is the one chosen, and its `target` is given
   * here in the Canvas's terms, placed through the image's painting.
   */
  layer?: { key: string; item: number; image: string };
}

/**
 * The set of the regions the Manifest's Ranges name (`range-regions.ts`), drawn as
 * annotations, listed by Contents.
 */
export const CONTENTS_SET_ID = "contents";

/** The annotation a Range's part draws as, by the part's place among its own items. */
export const regionEntryId = (rangeId: string, index: number) =>
  `${rangeId}#region-${index + 1}`;

export interface AnnotationSet {
  id: string;
  label?: LanguageMapLike;
  /**
   * Where it came from: the Manifest's Canvases, the host, a Content Search, or the
   * regions the Manifest's Ranges name (`contentsSet`).
   */
  source: "manifest" | "added" | "search" | "contents";
  entries: AnnotationEntry[];
  /** The AnnotationCollection its page is `partOf`, by id (Cookbook 0309). */
  collection?: string;
  /**
   * The AnnotationPage or AnnotationCollection it was given as, where it is the Root's
   * content (James Turner's tags across Manifests), walked as one whole.
   */
  content?: {
    id: string;
    type: "AnnotationPage" | "AnnotationCollection";
    label?: LanguageMapLike;
  };
}

/** An annotation page a Canvas names: by id, its Canvas, and whether it is fetched. */
export interface AnnotationPageRef {
  id: string;
  canvasId: string;
  fetched: boolean;
}

/**
 * Annotations walked as one whole, as a viewer walks a Collection's members: the
 * AnnotationPage or AnnotationCollection given as the content (James Turner's tags across
 * Manifests, all in hand), else an AnnotationCollection the Manifest's annotation pages
 * are part of (Cookbook 0309: layout markup across a newspaper's pages, managed as one
 * whole), whose pages load as the reader reaches them.
 */
export interface AnnotationCollection {
  id: string;
  type: "AnnotationPage" | "AnnotationCollection";
  label?: LanguageMapLike;
  /** The number of its annotations, where it says. */
  total?: number;
  /**
   * The Manifest's pages of it, in the Canvases' order, so a listing loads them as the
   * reader reaches them (`usePagesReached`, `clover.fetchAnnotationPages`). None for the
   * content's, whose annotations are all in hand.
   */
  pages: AnnotationPageRef[];
  /** Its annotations on the Manifest's Canvases, in their order, as far as fetched. */
  entries: AnnotationEntry[];
}

type Json = Record<string, any>;

const isLinking = (annotation: Json) =>
  asArray(annotation?.motivation).includes("linking");

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
    // A link alone (Cookbook 0022) is still something to list and follow.
    if (!bodies.length && !isLinking(annotation)) continue;
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

/**
 * Whether an image a Canvas paints, or an item of a `Choice` it paints, carries
 * annotations of its own (Cookbook 0326), which the Root then reads (`image-layers.ts`).
 */
export const paintsLayers = (manifest: Manifest): boolean =>
  (selectSequence(manifest).canvases as Json[]).some((canvas) =>
    (asArray(canvas.items) as Json[]).some((page) =>
      (asArray(page?.items) as Json[]).some((painting) =>
        (asArray(painting?.body) as Json[]).some((body) =>
          [body, ...(asArray(body?.items) as Json[])].some(
            (image) => asArray(image?.annotations).length > 0,
          ),
        ),
      ),
    ),
  );

/**
 * What names a page's set: its own `label`, else that of the AnnotationCollection it is
 * `partOf` (Cookbook 0309: pages on several Canvases grouped, and named, as one), read
 * from the page, then from a reference to it that may say more of the Collection. Sets
 * with one name are one layer, listed and hidden together.
 */
export function pageLabel(
  page: Json | undefined,
  reference?: Json,
): LanguageMapLike | undefined {
  for (const each of [page, reference]) if (each?.label) return each.label;
  for (const each of [page, reference]) {
    const collection = (asArray(each?.partOf) as Json[]).find(
      (part) =>
        /AnnotationCollection/.test(String(part?.type ?? part?.["@type"])) &&
        part.label,
    );
    if (collection) return collection.label;
  }
  return undefined;
}

/** The AnnotationCollections a page (or a reference to one) is `partOf`. */
const collectionsOf = (page: Json | undefined): Json[] =>
  (asArray(page?.partOf) as Json[]).filter(
    (part) =>
      part?.id &&
      /AnnotationCollection/.test(String(part?.type ?? part?.["@type"])),
  );

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
          const collection = collectionsOf(page)[0]?.id;
          set = {
            id,
            label: pageLabel(page),
            source: "manifest",
            entries: [],
            ...(collection ? { collection } : {}),
          };
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

const manifestPages = new WeakMap<Manifest, AnnotationPageRef[]>();
const NO_PAGES: AnnotationPageRef[] = [];

/** Every annotation page the Manifest's Canvases name, in their order, fetched or not. */
export function selectAnnotationPages(
  manifest: Manifest | null,
): AnnotationPageRef[] {
  if (!manifest) return NO_PAGES;
  let pages = manifestPages.get(manifest);
  if (!pages) {
    pages = (selectSequence(manifest).canvases as Json[]).flatMap((canvas) =>
      (asArray(canvas.annotations) as Json[])
        .filter((page) => page?.id)
        .map((page) => ({
          id: String(page.id),
          canvasId: String(canvas.id),
          fetched: Array.isArray(page.items),
        })),
    );
    manifestPages.set(manifest, pages);
  }
  return pages;
}

const manifestCollections = new WeakMap<
  Manifest,
  AnnotationCollection | null
>();

const contentCollections = new WeakMap<
  AnnotationSet[],
  AnnotationCollection | null
>();

/**
 * The annotations walked as one whole: those given as the content (`addedSets` marked
 * `content`), else the first AnnotationCollection the Manifest's annotation pages are
 * part of; null where there are neither.
 */
export function selectAnnotationCollection(
  manifest: Manifest | null,
  added: AnnotationSet[] = NO_SETS_ADDED,
): AnnotationCollection | null {
  if (!contentCollections.has(added)) {
    const sets = added.filter((set) => set.content);
    const content = sets[0]?.content;
    contentCollections.set(
      added,
      content
        ? {
            id: content.id,
            type: content.type,
            ...(content.label ? { label: content.label } : {}),
            pages: NO_PAGES,
            entries: sets.flatMap((set) => set.entries),
          }
        : null,
    );
  }
  return contentCollections.get(added) ?? manifestCollection(manifest);
}
const NO_SETS_ADDED: AnnotationSet[] = [];

/**
 * The first AnnotationCollection the Manifest's annotation pages are part of, named and
 * counted as its pages, or the Manifest's references to them, describe it (the Manifest
 * should, so a viewer names it before fetching a page), with its annotations fetched so
 * far; null where none is.
 */
function manifestCollection(
  manifest: Manifest | null,
): AnnotationCollection | null {
  if (!manifest) return null;
  if (manifestCollections.has(manifest))
    return manifestCollections.get(manifest)!;
  const pages = (selectSequence(manifest).canvases as Json[]).flatMap(
    (canvas) =>
      (asArray(canvas.annotations) as Json[]).flatMap((page) =>
        collectionsOf(page).map((part) => ({ part, page, canvas })),
      ),
  );
  const id = pages[0]?.part.id as string | undefined;
  const found = id
    ? (() => {
        const own = pages.filter(({ part }) => part.id === id);
        const label = own.find(({ part }) => part.label)?.part.label;
        const total = Number(own.find(({ part }) => part.total)?.part.total);
        const sets = selectManifestSets(manifest);
        return {
          id,
          type: "AnnotationCollection" as const,
          ...(label ? { label } : {}),
          ...(total > 0 ? { total } : {}),
          pages: own.map(({ page, canvas }) => ({
            id: String(page.id),
            canvasId: String(canvas.id),
            fetched: Array.isArray(page.items),
          })),
          // In the pages' order: a page's set is listed where its Canvas first names it.
          entries: own.flatMap(
            ({ page }) => sets.find((set) => set.id === page.id)?.entries ?? [],
          ),
        };
      })()
    : null;
  manifestCollections.set(manifest, found);
  return found;
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
    /*
     * A page once, however it came: one the host adds that the Manifest holds already
     * (Cookbook 0306, opened by its Annotation Page, whose Canvas names that page) keeps
     * the Manifest's place, and is not listed twice.
     */
    const seen = new Set(own.map((set) => set.id));
    sets = [
      ...own,
      ...added.filter((set) => !seen.has(set.id) && Boolean(seen.add(set.id))),
    ];
    byAdded.set(added, sets);
  }
  return sets;
}

const drawnSets = new WeakMap<
  AnnotationSet[],
  Map<unknown, Map<unknown, AnnotationSet[]>>
>();

/**
 * Every set the Canvas draws: the Manifest's, the host's, then a search's hits. The
 * Annotations list leaves the search out; its hits are listed by `Search`.
 */
export function selectDrawnSets(
  manifest: Manifest | null,
  added: AnnotationSet[],
  searchSet: AnnotationSet | null,
  regions: AnnotationSet | null = null,
): AnnotationSet[] {
  const sets = selectAnnotationSets(manifest, added);
  // The regions the Ranges name, drawn as annotations, and a search's hits over them.
  const search = searchSet?.entries.length ? searchSet : null;
  if (!regions && !search) return sets;
  let byRegions = drawnSets.get(sets);
  if (!byRegions) drawnSets.set(sets, (byRegions = new Map()));
  let bySearch = byRegions.get(regions);
  if (!bySearch) byRegions.set(regions, (bySearch = new Map()));
  let drawn = bySearch.get(search);
  if (!drawn) {
    drawn = [
      ...sets,
      ...(regions ? [regions] : []),
      ...(search ? [search] : []),
    ];
    bySearch.set(search, drawn);
  }
  return drawn;
}

/** A Canvas that plays: its `supplementing` text is a recording's, never hidden here. */
const plays = (canvas: Json | undefined) => Number(canvas?.duration) > 0;

/**
 * Whether a set starts hidden (Mat, 2026-10-26): a still Canvas's OCR, `supplementing`
 * text on its regions, line by line or word by word (Cookbook 0068, `isRegionText`), is at
 * the ready, for a search to point into, and not drawn over the page; a search's hits
 * (`highlighting`) are what show. A transcription of the whole page (Maktaba's) is there
 * to read and shows as ever, a Canvas that plays keeps its own, and caption files are
 * never in a set (`readBodies`). The reader shows one with `setSetVisible`, as any set.
 */
export function startsHidden(
  set: AnnotationSet,
  canvasOf: (id: string) => Json | undefined,
): boolean {
  if (set.source === "search" || !set.entries.length) return false;
  return set.entries.every(
    (entry) =>
      isRegionText(entry.motivation, entry.target) &&
      !plays(canvasOf(entry.canvasId)),
  );
}

const listedOf = new WeakMap<AnnotationSet[], AnnotationSet[]>();

/**
 * The sets listed to read (Annotations, the Panel's section): all but those that start
 * hidden (Mat, 2026-10-26: "don't show supplementing annotations in this"). A still
 * Canvas's OCR is reached through a search, and drawn as its hits; listed, it would be
 * hundreds of lines. The same array comes back while nothing changes.
 */
export function selectListedSets(
  manifest: Manifest | null,
  added: AnnotationSet[],
): AnnotationSet[] {
  const sets = selectAnnotationSets(manifest, added);
  let listed = listedOf.get(sets);
  if (!listed) {
    const kept = sets.filter(
      (set) =>
        !startsHidden(set, (id) => selectCanvas(manifest, id) ?? undefined),
    );
    listed = kept.length === sets.length ? sets : kept;
    listedOf.set(sets, listed);
  }
  return listed;
}

const hiddenOf = new WeakMap<
  AnnotationSet[],
  { hidden: string[]; shown: string[]; ids: string[] }
>();

/**
 * The sets not drawn: those switched off (`hiddenSets`), and those that start hidden
 * (`startsHidden`) and were not switched on (`shownSets`). The same array comes back
 * while nothing changes.
 */
export function selectHiddenSets(
  manifest: Manifest | null,
  added: AnnotationSet[],
  hidden: string[],
  shown: string[],
): string[] {
  const sets = selectAnnotationSets(manifest, added);
  const cached = hiddenOf.get(sets);
  if (cached && cached.hidden === hidden && cached.shown === shown)
    return cached.ids;
  const quiet = sets
    .filter(
      (set) =>
        !hidden.includes(set.id) &&
        !shown.includes(set.id) &&
        startsHidden(set, (id) => selectCanvas(manifest, id) ?? undefined),
    )
    .map((set) => set.id);
  const ids = quiet.length ? [...hidden, ...quiet] : hidden;
  hiddenOf.set(sets, { hidden, shown, ids });
  return ids;
}

const unlistedOf = new WeakMap<string[], { hidden: string[]; ids: string[] }>();

/**
 * The sets the Canvas's menu never offers, as the Annotations list leaves them out: the
 * search's hits (`SEARCH_SET_ID`, which `Search` lists), the Ranges' regions
 * (`CONTENTS_SET_ID`, which `Contents` lists), and those that start hidden and
 * are still hidden but for the reader's own switching off (`hiddenSets`), which the menu
 * offers to show again. The same array comes back while nothing changes.
 */
export function selectUnlistedSets(
  manifest: Manifest | null,
  added: AnnotationSet[],
  hidden: string[],
  shown: string[],
): string[] {
  const drawnHidden = selectHiddenSets(manifest, added, hidden, shown);
  const cached = unlistedOf.get(drawnHidden);
  if (cached && cached.hidden === hidden) return cached.ids;
  const ids = [
    SEARCH_SET_ID,
    CONTENTS_SET_ID,
    ...drawnHidden.filter((id) => !hidden.includes(id)),
  ];
  unlistedOf.set(drawnHidden, { hidden, ids });
  return ids;
}

/** An entry by id, across sets. */
/**
 * The Manifest an annotation's target says its Canvas is `partOf`, as annotations made
 * apart from any Manifest name it (a shared link, a page of tags across a collection).
 */
export function manifestOfAnnotation(
  annotation: Record<string, any>,
): string | undefined {
  for (const target of asArray(annotation?.target) as Record<string, any>[]) {
    const source = target?.type === "SpecificResource" ? target.source : target;
    const part = asArray(source?.partOf).find(
      (each: any) => each?.id && (!each.type || each.type === "Manifest"),
    ) as Record<string, any> | undefined;
    if (part) return part.id;
  }
  return undefined;
}

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
