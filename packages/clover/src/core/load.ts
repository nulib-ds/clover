import type { ContentTargets, Target } from "./content-state";
import {
  type Presentation4Collection,
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
 * annotation's Canvas is `partOf`, at that Canvas). A single Annotation, of any motivation,
 * is read as a content state is: what it targets is opened, at its region and time, its
 * body shown there as a note. A Georeference Extension annotation, alone or on pages, is
 * the exception: what it targets is opened with the map laid on it (`georeferenceContent`).
 * It may also be a IIIF Image service, its `info.json` or its
 * base URI, shown as the one image it is (`imageServiceContent`). Everything is fetched
 * once, with the request settings, and upgraded to Presentation 4.
 */

export type IIIFContent = string | Record<string, unknown>;

/** The content-state reader, loaded only for one: a URL to show needs none. */
const readContentState = () => import("./content-state-reader");

/**
 * Whether JSON is read as a content state, rather than a IIIF resource to show: one (an
 * annotation with the `contentState` motivation, or its bare target, a SpecificResource),
 * or any other annotation given alone (Presentation 2's `oa:Annotation` too), whose
 * target is where to go. Here, beside the one that asks, not with content state's writer
 * (`content-state.ts`), which a Canvas loads only where its page asks for content states.
 */
function isContentState(json: unknown): boolean {
  const value = json as Record<string, unknown> | null;
  if (!value || typeof value !== "object") return false;
  return (
    value.type === "Annotation" ||
    value["@type"] === "oa:Annotation" ||
    value.type === "SpecificResource"
  );
}

/**
 * Whether JSON is an Image API service's `info.json`, rather than a Presentation resource,
 * by its types and contexts together (#423): its `type` (Image 3, `ImageService3`), its
 * `protocol` or its `@context` (Image 2 and 3, `…/api/image/…`), unless a context or type
 * says it is a Presentation resource. A Manifest may list the Image API's context beside
 * its own, as JSON-LD allows, where its bodies' services are Image 2.
 */
export const isImageService = (json: unknown): boolean => {
  const said = JSON.stringify(
    ["@context", "type", "@type", "protocol"].map(
      (key) => json && (json as Json)[key],
    ),
  );
  return (
    /ImageService[123]|iiif\.io\/api\/image/.test(said) &&
    !/presentation\/\d|"(sc:)?(Manifest|Collection|Canvas|Range|Timeline|Scene)"/.test(
      said,
    )
  );
};

/**
 * A URL's JSON. An image service's base URI need not answer with its `info.json` (the
 * Image API asks only for a redirect, which not every server makes), so where the URL
 * fails, and could be a base URI (it names no `.json` file, as a Manifest's address often
 * does), `/info.json` after it is tried once; the URL's own failure stands where that
 * fails too.
 */
async function fetchContent(
  request: CloverRequest | undefined,
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await fetchJson(request, url, signal);
  } catch (error) {
    if (signal?.aborted || /\.json([?#]|$)/i.test(url)) throw error;
    try {
      const json = await fetchJson(
        request,
        `${url.replace(/\/+$/, "")}/info.json`,
        signal,
      );
      if (isImageService(json)) return json;
    } catch {
      // The URL's own failure says more.
    }
    throw error;
  }
}

export interface Loaded {
  manifest: Manifest;
  /** The Collection the Manifest was reached through, when there was one. */
  collection?: Presentation4Collection;
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
  /**
   * The annotation a content state targets (a search's result, by its `id`), as a set of
   * its own, held for the search to come: its result where the answer has it, else listed
   * with the content's own (`searchInto`). With no query to search for, `follow` lists it
   * from the start, as `annotationSets`.
   */
  sought?: AnnotationSet;
  /** A content state's several targets, opened on the first (Cookbook 0540). */
  targets?: ContentTargets;
}

/**
 * What a Canvas says of itself that a Manifest can say too, for one shown on its own; and
 * what georeferences' page or Collection says, for the Manifest made of their images.
 */
export const DESCRIPTIVE = [
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

/**
 * Whether a Manifest is an image service shown as its image (`imageServiceContent`): one
 * Canvas, its id the service's with `/canvas` after it. It says nothing of itself but the
 * rights its `info.json` gave.
 */
export const isImageServiceManifest = (manifest: Json | null | undefined) =>
  Boolean(manifest) &&
  manifest!.items?.length === 1 &&
  manifest!.items[0]?.id === `${manifest!.id}/canvas`;

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
  /** How many content states have been followed to reach this content (`follow`). */
  follows?: number;
  /** Whether the host has a query to search for once the Manifest shows. */
  searching?: boolean;
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

/**
 * Pages of a paged Collection followed, at most, and never one twice: guards against a
 * `next` that leads back, which would list its members again.
 */
const MAX_COLLECTION_PAGES = 50;

/**
 * A Collection with its members in `items`. A paged Collection lists none of its own: its
 * members are on CollectionPages, followed from `first` through `next`.
 */
export async function withMembers(
  collection: Presentation4Collection,
  options: LoadOptions,
): Promise<Presentation4Collection> {
  const json = collection as unknown as Record<string, any>;
  if (Array.isArray(json.items) && json.items.length) return collection;
  if (!json.first) return collection;
  const items: unknown[] = [];
  const seen = new Set<unknown>();
  let next: unknown = json.first;
  for (let page = 0; next && page < MAX_COLLECTION_PAGES; page++) {
    const reference = typeof next === "string" ? { id: next } : (next as Json);
    if (seen.has(reference.id ?? reference)) break;
    seen.add(reference.id ?? reference);
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
  return { ...json, items } as unknown as Presentation4Collection;
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
  collection: Presentation4Collection,
  options: LoadOptions,
  depth = 0,
): Promise<Manifest | null> {
  for (const item of (collection.items ?? []) as Array<Record<string, any>>) {
    if (item.type === "Manifest") {
      return toPresentation4<Manifest>(await dereference(item, options));
    }
    if (item.type === "Collection" && depth < 8) {
      const nested = await withMembers(
        await toPresentation4<Presentation4Collection>(
          await dereference(item, options),
        ),
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
): Promise<Manifest | Presentation4Collection> {
  void preloadUpgrader();
  const json =
    typeof input === "string"
      ? await fetchJson(request, input.trim(), signal)
      : input;
  const resource = await toPresentation4<Manifest | Presentation4Collection>(
    json,
  );
  return resource.type === "Collection"
    ? withMembers(resource as Presentation4Collection, { request, signal })
    : resource;
}

export async function loadContent(
  input: IIIFContent,
  options: LoadContentOptions = {},
): Promise<Loaded> {
  const { request, signal } = options;
  // Load the upgrader alongside the first fetch, so upgrading adds no round trip.
  void preloadUpgrader();

  let json: unknown = input;
  if (typeof input === "string") {
    json = isUrl(input.trim())
      ? await fetchContent(request, input.trim(), signal)
      : (await readContentState()).decodeContentState(input);
    if (!json) throw new CloverContentError("Unreadable iiifContent");
  }

  /*
   * A content state, or an annotation given alone, names what to load and where to go in
   * it: followed in a chunk of its own, which loads what it names. A URL may answer with
   * a content state of its own, so two are followed, and no more.
   */
  if (isContentState(json) && (options.follows ?? 0) < 2) {
    const { follow } = await import("./follow-content");
    return follow(json as Json, options, loadContent);
  }

  /*
   * Annotations, made apart from any Manifest: shown in the Manifest their first
   * annotation's Canvas is `partOf`. Loaded only for them, so no other page carries it.
   */
  if (ANNOTATIONS.test(String((json as Json)?.type ?? ""))) {
    const { annotationsContent } = await import("./annotations-content");
    return annotationsContent(json as Json, options);
  }

  /* An image service, shown as its image. Loaded only for one, as annotations are. */
  if (isImageService(json)) {
    const { imageServiceContent } = await import("./image-service-content");
    return imageServiceContent(
      json as Json,
      typeof input === "string" ? input.trim() : undefined,
    );
  }

  const resource = await toPresentation4<Record<string, any>>(json);
  signal?.throwIfAborted?.();

  switch (resource.type) {
    case "Manifest":
      return { manifest: resource as Manifest };
    case "Collection": {
      const collection = await withMembers(
        resource as Presentation4Collection,
        options,
      );
      // The host's choice (or the content state's), or else the first member.
      const pick = options.manifestId;
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
      return { manifest, collection };
    }
    case "Canvas":
    case "Timeline":
    case "Scene": {
      /*
       * A Canvas, given itself, is what is shown, not the Manifest it is `partOf`: a
       * Manifest of one, saying what the Canvas says of itself (its label, summary,
       * metadata, rights…), and keeping its `partOf`, from which the full Manifest can
       * be opened in its place (`About`).
       */
      return {
        manifest: loneCanvas(resource),
        target: { canvasId: resource.id },
      };
    }
    default:
      throw new CloverContentError(
        `Cannot show a ${String(resource.type ?? "resource without a type")}`,
      );
  }
}
