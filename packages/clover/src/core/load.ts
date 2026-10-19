import {
  type Target,
  decodeContentState,
  isContentState,
  resolveContentState,
} from "./content-state";
import {
  type Collection,
  type Manifest,
  preloadUpgrader,
  toPresentation4,
} from "./presentation";
import { type CloverRequest, fetchJson } from "./request";
import type { AnnotationSet } from "./annotation-sets";

/**
 * Turning whatever a `Root` is handed into a Manifest to show.
 *
 * `iiifContent` may be a URL, a IIIF resource object (Presentation 2, 3 or 4), or a content
 * state (JSON or base64url). The resource may be a Manifest, a Collection (its first
 * Manifest is shown), a lone Canvas (its `partOf` Manifest, or a Manifest made around
 * it), or annotations, an AnnotationPage or AnnotationCollection (the Manifest their first
 * annotation's Canvas is `partOf`, at that Canvas). Everything is fetched once, with the
 * request settings, and upgraded to Presentation 4.
 */

export type IIIFContent = string | Record<string, unknown>;

export interface Loaded {
  manifest: Manifest;
  /** The Collection the Manifest was reached through, when there was one. */
  collection?: Collection;
  /** Where a content state, or a Canvas given directly, points. */
  target?: Target;
  /** A content state's note, as an annotation to show and pick (`resolveContentState`). */
  annotation?: Record<string, any>;
  /**
   * Annotations given as the content (an AnnotationPage or AnnotationCollection), as sets:
   * shown wherever their Canvases are, across the Manifests they name.
   */
  annotationSets?: AnnotationSet[];
  /** The annotation to pick on arrival: the first of those, on the Canvas opened. */
  pick?: string;
}

/** What a Canvas says of itself that a Manifest can say too, for one shown on its own. */
const DESCRIPTIVE = [
  "summary",
  "metadata",
  "requiredStatement",
  "rights",
  "provider",
  "homepage",
  "seeAlso",
  "rendering",
  "thumbnail",
  "navDate",
  "partOf",
];

/**
 * A Canvas on its own, as a Manifest of one: its id (so it is told from a Manifest that
 * holds it, `isLoneCanvas`), what it says of itself, and the Canvas.
 */
export function loneCanvas(canvas: Json): Manifest {
  const manifest: Json = {
    "@context": P4_CONTEXT,
    id: canvas.id,
    type: "Manifest",
    label: canvas.label ?? { none: [""] },
    items: [canvas],
  };
  for (const key of DESCRIPTIVE) {
    if (canvas[key] !== undefined && key !== "label")
      manifest[key] = canvas[key];
  }
  return manifest as unknown as Manifest;
}

/** Whether a Manifest is a Canvas shown on its own (`loneCanvas`). */
export const isLoneCanvas = (manifest: Json | null | undefined) =>
  Boolean(manifest) && manifest!.items?.[0]?.id === manifest!.id;

/** An AnnotationPage or AnnotationCollection, as the content. */
const ANNOTATIONS = /^(oa:)?Annotation(Page|Collection)$/;

export class CloverContentError extends Error {
  name = "CloverContentError";
}

const P4_CONTEXT = "http://iiif.io/api/presentation/4/context.json";

const isUrl = (value: string) => /^https?:\/\//i.test(value);

interface LoadOptions {
  request?: CloverRequest;
  signal?: AbortSignal;
}

export interface LoadContentOptions extends LoadOptions {
  /** In a Collection, the member Manifest to open instead of the first. */
  manifestId?: string;
}

/** A resource as JSON: fetched if it is only a reference. */
async function dereference(
  resource: Record<string, any>,
  { request, signal }: LoadOptions,
): Promise<Record<string, any>> {
  const embedded = Array.isArray(resource.items) && resource.items.length > 0;
  if (embedded || !resource.id) return resource;
  return (await fetchJson(request, resource.id, signal)) as Record<string, any>;
}

/** Pages of a paged Collection followed, at most: a guard against a `next` loop. */
const MAX_COLLECTION_PAGES = 50;

/**
 * A Collection with its members in `items`. A paged Collection lists none of its own: its
 * members are on CollectionPages, followed from `first` through `next`.
 */
export async function withMembers(
  collection: Collection,
  options: LoadOptions,
): Promise<Collection> {
  const json = collection as unknown as Record<string, any>;
  if (Array.isArray(json.items) && json.items.length) return collection;
  if (!json.first) return collection;
  const items: unknown[] = [];
  let next: unknown = json.first;
  for (let page = 0; next && page < MAX_COLLECTION_PAGES; page++) {
    const reference = typeof next === "string" ? { id: next } : (next as Json);
    const fetched = (
      reference.items
        ? reference
        : await fetchJson(options.request, reference.id, options.signal)
    ) as Json;
    const upgraded = await toPresentation4<Json>({
      "@context": fetched["@context"] ?? json["@context"],
      ...fetched,
      type: "Collection",
    });
    items.push(...((upgraded.items as unknown[]) ?? []));
    next = fetched.next;
  }
  return { ...json, items } as unknown as Collection;
}

/** A Collection member as a Manifest: fetched if only referenced, and upgraded. */
export async function loadManifest(
  member: Json,
  options: LoadOptions = {},
): Promise<Manifest> {
  return toPresentation4<Manifest>(await dereference(member, options));
}

type Json = Record<string, any>;

/** The first Manifest in a Collection, depth first, fetching what is only referenced. */
async function firstManifest(
  collection: Collection,
  options: LoadOptions,
  depth = 0,
): Promise<Manifest | null> {
  for (const item of (collection.items ?? []) as Array<Record<string, any>>) {
    if (item.type === "Manifest") {
      return toPresentation4<Manifest>(await dereference(item, options));
    }
    if (item.type === "Collection" && depth < 8) {
      const nested = await withMembers(
        await toPresentation4<Collection>(await dereference(item, options)),
        options,
      );
      const found = await firstManifest(nested, options, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * A resource as it is, upgraded: no Collection is opened and no content state followed.
 * What a standalone list of a Collection's members needs.
 */
export async function fetchResource(
  input: IIIFContent,
  { request, signal }: LoadOptions = {},
): Promise<Manifest | Collection> {
  void preloadUpgrader();
  const json =
    typeof input === "string"
      ? await fetchJson(request, input.trim(), signal)
      : input;
  const resource = await toPresentation4<Manifest | Collection>(json);
  return resource.type === "Collection"
    ? withMembers(resource as Collection, { request, signal })
    : resource;
}

export async function loadContent(
  input: IIIFContent,
  options: LoadContentOptions = {},
): Promise<Loaded> {
  const { request, signal } = options;
  // Load the upgrader alongside the first fetch, so upgrading adds no round trip.
  void preloadUpgrader();

  let target: Target | undefined;
  /** The Collection member a content state names, to open in place of the first. */
  let member: string | undefined;
  /** A content state's note. */
  let annotation: Record<string, any> | undefined;
  let json: unknown;

  /** A content state names what to load and where to go in it. */
  const followContentState = async (state: Record<string, any>) => {
    const resolved = resolveContentState(state);
    if (!resolved) throw new CloverContentError("Unreadable content state");
    target = resolved.target ?? target;
    member = resolved.manifestId ?? member;
    annotation = resolved.annotation ?? annotation;
    return fetchJson(request, resolved.id, signal);
  };

  if (typeof input === "string") {
    if (isUrl(input.trim())) {
      json = await fetchJson(request, input.trim(), signal);
    } else {
      const state = decodeContentState(input);
      if (!state) throw new CloverContentError("Unreadable iiifContent");
      json = isContentState(state) ? await followContentState(state) : state;
    }
  } else {
    json = input;
  }
  // A URL may answer with a content state of its own.
  if (isContentState(json)) {
    json = await followContentState(json as Record<string, any>);
  }

  /*
   * Annotations, made apart from any Manifest: shown in the Manifest their first
   * annotation's Canvas is `partOf`. Loaded only for them, so no other page carries it.
   */
  if (ANNOTATIONS.test(String((json as Json)?.type ?? ""))) {
    const { annotationsContent } = await import("./annotations-content");
    return annotationsContent(json as Json, options);
  }

  const resource = await toPresentation4<Record<string, any>>(json);
  signal?.throwIfAborted?.();

  switch (resource.type) {
    case "Manifest":
      return { manifest: resource as Manifest, target, annotation };
    case "Collection": {
      const collection = await withMembers(resource as Collection, options);
      // The host's choice, or the content state's, or else the first member.
      const pick = options.manifestId ?? member;
      const chosen = pick
        ? ((collection.items ?? []) as Json[]).find(
            (item) => item.id === pick && item.type === "Manifest",
          )
        : undefined;
      const manifest = chosen
        ? await loadManifest(chosen, options)
        : await firstManifest(collection, options);
      if (!manifest) {
        throw new CloverContentError("The Collection holds no Manifest");
      }
      return { manifest, collection, target, annotation };
    }
    case "Canvas":
    case "Timeline": {
      /*
       * A Canvas, given itself, is what is shown, not the Manifest it is `partOf`: a
       * Manifest of one, saying what the Canvas says of itself (its label, summary,
       * metadata, rights…), and keeping its `partOf`, from which the full Manifest can
       * be opened in its place (`About`).
       */
      const container = resource;
      target ??= { canvasId: container.id };
      return { manifest: loneCanvas(container), target, annotation };
    }
    default:
      throw new CloverContentError(
        `Cannot show a ${String(resource.type ?? "resource without a type")}`,
      );
  }
}
