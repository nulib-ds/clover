import type { AnnotationEntry } from "./annotation-sets";
import type { CloverState } from "./clover";
import type { Store } from "./store";
import { parseAnnotationTarget } from "./annotations";
import { type CloverRequest, fetchJson } from "./request";
import {
  SEARCH_SET_ID,
  type SearchHit,
  type SearchResults,
  type SearchService,
} from "./search-service";
import { asArray } from "../lib/asArray";

/**
 * Asking a Content Search service and reading its answer, version 1 or 2, into hits and
 * an annotation set. See `core/search-service.ts` for the two versions' shapes.
 */

/** Pages of results followed, at most. */
const MAX_PAGES = 10;

type Json = Record<string, any>;

/**
 * A Root's search, read into its store: the hits, or an error. One a newer search
 * superseded, or answered for another Manifest, is left unread. Embedding a fetched
 * annotation page replaces the Manifest object, not the Manifest, so it is known by id.
 */
export async function searchInto(
  store: Store<CloverState>,
  service: SearchService,
  query: string,
  request: CloverRequest | undefined,
  signal: AbortSignal,
): Promise<void> {
  const manifestId = store.get().manifest?.id;
  try {
    const { hits, set } = await search(service, query, { request, signal });
    if (signal.aborted || store.get().manifest?.id !== manifestId) return;
    store.set({ search: { query, status: "ready", hits, set } });
  } catch {
    if (signal.aborted) return;
    store.set({ search: { query, status: "error", hits: [], set: null } });
  }
}

/** Ask the service, following further pages, and read the hits. */
export async function search(
  service: SearchService,
  query: string,
  { request, signal }: { request?: CloverRequest; signal?: AbortSignal } = {},
): Promise<SearchResults> {
  const url = new URL(service.id);
  url.searchParams.set("q", query);
  const pages: Json[] = [];
  let next: string | null = url.toString();
  const seen = new Set<string>();
  while (next && pages.length < MAX_PAGES && !seen.has(next)) {
    seen.add(next);
    const page = (await fetchJson(request, next, signal)) as Json;
    pages.push(page);
    next = nextPage(page);
  }
  return readResults(pages, query);
}

/**
 * A version 1 target as a URI with a fragment: `on` is either that already, or a
 * Presentation 2 SpecificResource (`full` and a FragmentSelector).
 */
function targetV1(on: unknown): unknown {
  const value = asArray(on)[0] as Json | string | undefined;
  if (typeof value === "string" || !value) return value;
  const full = value.full ?? value["@id"];
  const fragment = (asArray(value.selector)[0] as Json | undefined)?.value;
  return typeof fragment === "string" && typeof full === "string"
    ? `${full}#${fragment}`
    : full;
}

function nextPage(page: Json): string | null {
  const next = page.next ?? page.within?.next;
  const id = typeof next === "string" ? next : (next?.id ?? next?.["@id"]);
  return typeof id === "string" ? id : null;
}

/** Read pages of results, of either version, into hits and a set. */
export function readResults(pages: Json[], query: string): SearchResults {
  const entries: AnnotationEntry[] = [];
  const hits: SearchHit[] = [];
  for (const page of pages) {
    const v1 = Array.isArray(page.resources);
    const annotations = (v1 ? page.resources : asArray(page.items)) as Json[];
    const byId = new Map<string, AnnotationEntry>();
    for (const annotation of annotations) {
      const id = annotation.id ?? annotation["@id"];
      const raw = v1 ? targetV1(annotation.on) : asArray(annotation.target)[0];
      const target = parseAnnotationTarget(raw as never);
      if (!id || !target.id) continue;
      const text = v1
        ? annotation.resource?.chars
        : asArray(annotation.body)
            .map((body) => (body as Json)?.value)
            .find((value) => typeof value === "string");
      const entry: AnnotationEntry = {
        id,
        setId: SEARCH_SET_ID,
        canvasId: target.id,
        target,
        motivation: ["highlighting"],
        bodies: [{ value: String(text ?? query) }],
        // One shape for the Canvas whichever version answered: a highlighting annotation.
        annotation: {
          id,
          type: "Annotation",
          motivation: ["highlighting"],
          body: { type: "TextualBody", value: String(text ?? query) },
          target: raw,
        },
      };
      byId.set(id, entry);
      entries.push(entry);
    }

    const grouped = v1 ? readHitsV1(page, byId) : readHitsV2(page, byId);
    const listed = new Set(grouped.flatMap((hit) => hit.entryIds));
    hits.push(...grouped);
    // An annotation no hit names is a hit of its own, its text the match.
    for (const entry of byId.values()) {
      if (listed.has(entry.id)) continue;
      hits.push({
        id: entry.id,
        canvasId: entry.canvasId,
        entryIds: [entry.id],
        match: entry.bodies[0]?.value ?? query,
      });
    }
  }
  return {
    query,
    hits,
    set: {
      id: SEARCH_SET_ID,
      label: { none: [query] },
      source: "search",
      entries,
    },
  };
}

function readHitsV1(page: Json, byId: Map<string, AnnotationEntry>) {
  const hits: SearchHit[] = [];
  for (const hit of asArray(page.hits) as Json[]) {
    const entryIds = (asArray(hit.annotations) as string[]).filter((id) =>
      byId.has(id),
    );
    if (!entryIds.length) continue;
    hits.push({
      id: entryIds.join(" "),
      canvasId: byId.get(entryIds[0])!.canvasId,
      entryIds,
      before: hit.before,
      match: String(hit.match ?? byId.get(entryIds[0])!.bodies[0]?.value ?? ""),
      after: hit.after,
    });
  }
  return hits;
}

function readHitsV2(page: Json, byId: Map<string, AnnotationEntry>) {
  const hits: SearchHit[] = [];
  for (const group of asArray(page.annotations) as Json[]) {
    for (const annotation of asArray(group?.items) as Json[]) {
      const motivation = asArray(annotation?.motivation);
      if (!motivation.includes("contextualizing")) continue;
      for (const target of asArray(annotation.target) as Json[]) {
        const source =
          typeof target?.source === "string"
            ? target.source
            : target?.source?.id;
        const entry = source ? byId.get(source) : undefined;
        if (!entry) continue;
        const quote = (asArray(target.selector) as Json[]).find(
          (selector) => selector?.type === "TextQuoteSelector",
        );
        hits.push({
          id: `${annotation.id ?? source}#${source}`,
          canvasId: entry.canvasId,
          entryIds: [entry.id],
          before: quote?.prefix,
          match: String(quote?.exact ?? entry.bodies[0]?.value ?? ""),
          after: quote?.suffix,
        });
      }
    }
  }
  return hits;
}
