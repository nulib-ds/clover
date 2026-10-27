import type { AnnotationSet } from "./annotation-sets";
import type { Manifest } from "./presentation";
import { asArray } from "../lib/asArray";

/**
 * IIIF Content Search, versions 1 and 2: finding the Manifest's service, asking it, and
 * reading the answer into hits to list and an annotation set to draw.
 *
 * - **Version 2** answers with an AnnotationPage of `highlighting` annotations on the
 *   Canvases, and (optionally) `contextualizing` annotations whose TextQuoteSelectors give
 *   the words around each match. Further pages hang from `next`.
 * - **Version 1** answers with a Presentation 2 AnnotationList: `resources` (annotations
 *   `on` a Canvas region, their text in `resource.chars`) and `hits` grouping them with
 *   `before`, `match` and `after`. Further pages hang from `next` (or `within.next`).
 *
 * Neither is upgraded through `@iiif/parser`: the two shapes are small, and read
 * directly. Finding the service is here; asking it and reading the answer are in
 * `core/search.ts`. Both load statically: measured through esbuild, a lazy split cost
 * more than it saved (shared modules are hoisted into an extra chunk).
 */

export interface SearchService {
  id: string;
  version: 1 | 2;
}

export interface SearchHit {
  id: string;
  /** The Canvas the hit is on. */
  canvasId: string;
  /** The annotations (regions) it highlights; the first is the one to go to. */
  entryIds: string[];
  before?: string;
  match: string;
  after?: string;
}

export interface SearchResults {
  query: string;
  hits: SearchHit[];
  /** The hits as an annotation set, so the Canvas draws them where they are. */
  set: AnnotationSet;
}

/** The set's id, so hosts and parts can tell search hotspots from annotations. */
export const SEARCH_SET_ID = "content-search";

type Json = Record<string, any>;

const VERSION = /\/search\/([0-2])\//;

/** The Manifest's Content Search service (2 preferred over 1), or null. */
export function searchServiceOf(
  manifest: Manifest | null,
): SearchService | null {
  if (!manifest) return null;
  let found: SearchService | null = null;
  for (const service of asArray((manifest as Json).service) as Json[]) {
    const id = service?.id ?? service?.["@id"];
    if (typeof id !== "string") continue;
    const type = String(service.type ?? service["@type"] ?? "");
    const hint = [service.profile, service["@context"]]
      .flat()
      .map((value) => String(value ?? ""))
      .join(" ");
    const version =
      type === "SearchService2"
        ? 2
        : type === "SearchService1"
          ? 1
          : VERSION.test(hint)
            ? Number(VERSION.exec(hint)![1]) >= 2
              ? 2
              : 1
            : null;
    if (version === 2) return { id, version };
    if (version === 1) found ??= { id, version };
  }
  return found;
}
