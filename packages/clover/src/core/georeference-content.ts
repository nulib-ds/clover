import { asArray } from "../lib/asArray";
import type { Json } from "./json";
import {
  CloverContentError,
  DESCRIPTIVE,
  type LoadContentOptions,
  type Loaded,
  type loadContent,
} from "./load";
import { type Manifest, toPresentation4 } from "./presentation";
import { markGeoreferencedContent } from "./geo-detect";

/**
 * Georeference Extension annotations as the content, given alone or on pages (an
 * AnnotationPage, an AnnotationCollection): each lays a map onto the Canvas, or the
 * image, it targets. What they target is opened and each is placed on its Canvas, in a
 * page of its own, as a Manifest that carries its georeferences would hold it, so the
 * Map, the Panel's map and the Canvas's place box warp it as they would any other.
 *
 * What is opened, in order:
 * - the Manifest a target names (its Canvas's `partOf`, or its image service's Canvas's,
 *   as Allmaps writes them), the host's choice among several, at the first Canvas laid on;
 *   where it cannot be fetched, what follows, from the image services targeted;
 * - else the Canvases given whole in the targets, as one Manifest;
 * - else the image services targeted, as one Manifest of their images, each a Canvas the
 *   size the annotation measured it, named by the annotation's label;
 * - else the Canvas a target names, loaded from its id.
 *
 * Its own module, loaded only for such content, so no other page carries it.
 */

/** Where one georeference goes. */
interface Placed {
  annotation: Json;
  /** The Manifest its target names, through its Canvas. */
  manifestId?: string;
  /** The Canvas it georeferences. */
  canvasId?: string;
  /** That Canvas, where the target gives it whole. */
  canvas?: Json;
  /** The image service it targets, as the target describes it. */
  service?: Json;
}

const P3_CONTEXT = "http://iiif.io/api/presentation/3/context.json";

/** A reference's id, without its fragment. */
const idOf = (value: unknown): string =>
  String(
    typeof value === "string"
      ? value
      : ((value as Json)?.id ?? (value as Json)?.["@id"] ?? ""),
  ).split("#")[0];

const typeOf = (value: unknown): string =>
  String((value as Json)?.type ?? (value as Json)?.["@type"] ?? "");

/** What a resource says it is `partOf`, of one kind (or of none said). */
const partOf = (json: Json | undefined, kind: string): Json | undefined =>
  (asArray(json?.partOf) as Json[]).find(
    (each) => idOf(each) && (!typeOf(each) || typeOf(each) === kind),
  );

/** Where a georeference goes, read from its target. */
export function placeOf(annotation: Json): Placed {
  const target = asArray(annotation.target)[0] as Json | string | undefined;
  const specific =
    typeof target === "object" && target?.type === "SpecificResource";
  const source = (
    typeof target === "string"
      ? { id: target }
      : specific
        ? typeof target.source === "string"
          ? { id: target.source }
          : (target.source ?? {})
        : (target ?? {})
  ) as Json;
  if (/ImageService/.test(typeOf(source))) {
    const canvas = partOf(source, "Canvas");
    const manifest = partOf(canvas, "Manifest") ?? partOf(source, "Manifest");
    return {
      annotation,
      service: source,
      ...(canvas ? { canvasId: idOf(canvas) } : {}),
      ...(manifest ? { manifestId: idOf(manifest) } : {}),
    };
  }
  const manifest =
    partOf(source, "Manifest") ??
    (specific ? partOf(target as Json, "Manifest") : undefined);
  const canvasId = idOf(source);
  return {
    annotation,
    ...(canvasId ? { canvasId } : {}),
    ...(asArray(source.items).length ? { canvas: source } : {}),
    ...(manifest ? { manifestId: idOf(manifest) } : {}),
  };
}

const trimmed = (id: string) => id.replace(/\/+$/, "");

/** The image services a Canvas paints with, a `Choice`'s items too. */
function servicesOf(canvas: Json): string[] {
  const ids: string[] = [];
  for (const page of asArray(canvas.items) as Json[])
    for (const painting of asArray(page?.items) as Json[])
      for (const body of asArray(painting?.body) as Json[])
        for (const image of [body, ...(asArray(body?.items) as Json[])])
          for (const service of asArray(image?.service))
            if (idOf(service)) ids.push(trimmed(idOf(service)));
  return ids;
}

/** The Canvas a georeference lies on: by its id, else by the image service it targets. */
function canvasFor(canvases: Json[], placed: Placed): Json | undefined {
  const byId = canvases.find((canvas) => canvas.id === placed.canvasId);
  if (byId || !placed.service) return byId;
  const service = trimmed(idOf(placed.service));
  return canvases.find((canvas) => servicesOf(canvas).includes(service));
}

/**
 * The Manifest with each georeference on its Canvas, on a page of their own after the
 * Canvas's others, and the first Canvas one lies on. The Manifest is never mutated.
 */
function laidOn(
  manifest: Manifest,
  placed: Placed[],
  pageId: string,
): { manifest: Manifest; first?: string } {
  const canvases = asArray((manifest as Json).items) as Json[];
  const on = new Map<Json, Json[]>();
  let first: string | undefined;
  for (const each of placed) {
    const canvas = canvasFor(canvases, each);
    if (!canvas) continue;
    first ??= canvas.id;
    on.set(canvas, [...(on.get(canvas) ?? []), each.annotation]);
  }
  if (!on.size) return { manifest };
  let page = 0;
  const items = canvases.map((canvas) => {
    const annotations = on.get(canvas);
    if (!annotations) return canvas;
    return {
      ...canvas,
      annotations: [
        ...asArray(canvas.annotations),
        {
          id: `${pageId}#georeferencing-${++page}`,
          type: "AnnotationPage",
          items: annotations,
        },
      ],
    };
  });
  return { manifest: { ...manifest, items } as Manifest, first };
}

/** A label as a language map: a plain string (as some georeferencers write) in `none`. */
const languageMap = (label: unknown): Json | undefined =>
  typeof label === "string"
    ? { none: [label] }
    : label && typeof label === "object"
      ? (label as Json)
      : undefined;

/**
 * An image service a georeference targets, as a Canvas the size it was measured at,
 * painted by its whole image. The image's own address is the full image at full size,
 * which every level of the Image API delivers, a fallback only: the service's
 * `info.json` is read before anything is drawn from it.
 */
function serviceCanvas({ annotation, service }: Placed): Json | null {
  const id = trimmed(idOf(service));
  const [width, height] = [Number(service?.width), Number(service?.height)];
  if (!id || !(width > 0 && height > 0)) return null;
  const type = typeOf(service);
  const v2 = /ImageService[12]/.test(type);
  const canvasId = `${id}/canvas`;
  const label = languageMap(annotation.label);
  return {
    id: canvasId,
    type: "Canvas",
    width,
    height,
    ...(label ? { label } : {}),
    items: [
      {
        id: `${canvasId}/page`,
        type: "AnnotationPage",
        items: [
          {
            id: `${canvasId}/page/image`,
            type: "Annotation",
            motivation: "painting",
            target: canvasId,
            body: {
              id: `${id}/full/${v2 ? "full" : "max"}/0/default.jpg`,
              type: "Image",
              format: "image/jpeg",
              width,
              height,
              service: [
                v2
                  ? {
                      "@id": id,
                      "@type": type,
                      profile: service?.profile ?? "level0",
                    }
                  : { id, type, profile: service?.profile ?? "level0" },
              ],
            },
          },
        ],
      },
    ],
  };
}

/** What the content says of itself: its id, and what a Manifest can say too. */
type About = { id?: string; label?: unknown } & Record<string, unknown>;

/**
 * The Canvases given whole, else the images targeted, as one Manifest, saying what the
 * content says of itself (its label, rights, attribution…); null if neither.
 */
async function madeManifest(
  placed: Placed[],
  about: About,
): Promise<Manifest | null> {
  const canvases: Json[] = [];
  const seen = new Set<string>();
  for (const each of placed) {
    const canvas = each.canvas ?? (each.service ? serviceCanvas(each) : null);
    if (!canvas || seen.has(canvas.id)) continue;
    seen.add(canvas.id);
    canvases.push(canvas);
  }
  if (!canvases.length) return null;
  const label =
    languageMap(about.label) ??
    (placed.length === 1 ? languageMap(placed[0].annotation.label) : null);
  // All but `partOf`: a page's is its AnnotationCollection, never a Manifest's.
  const described: Json = {};
  for (const key of DESCRIPTIVE)
    if (key !== "partOf" && about[key] !== undefined)
      described[key] = about[key];
  return toPresentation4<Manifest>({
    "@context": P3_CONTEXT,
    ...described,
    id: about.id || canvases[0].id,
    type: "Manifest",
    label: label ?? { none: [""] },
    items: canvases,
  });
}

export async function georeferenceContent(
  annotations: Json[],
  options: LoadContentOptions,
  load: typeof loadContent,
  about: About = {},
): Promise<Loaded> {
  const placed = annotations.map(placeOf);
  const pageId = about.id || idOf(annotations[0]) || "georeferencing";
  const follows = (options.follows ?? 0) + 1;
  const named =
    placed.find(
      (each) => options.manifestId && each.manifestId === options.manifestId,
    ) ?? placed.find((each) => each.manifestId);

  let loaded: Loaded | null = null;
  if (named) {
    try {
      loaded = await load(named.manifestId!, { ...options, follows });
    } catch (error) {
      // A Manifest gone, or closed to this page: the images targeted, where there are.
      if (options.signal?.aborted || !placed.some((each) => each.service))
        throw error;
    }
  }
  if (!loaded) {
    const made = await madeManifest(placed, about);
    const canvasId = placed.find((each) => each.canvasId)?.canvasId;
    if (!made && !canvasId)
      throw new CloverContentError("The georeference targets nothing to show");
    loaded = made
      ? { manifest: made }
      : await load(canvasId!, { ...options, follows });
  }
  const { manifest, first } = laidOn(loaded.manifest, placed, pageId);
  return {
    ...loaded,
    // Its maps lay every sheet (`isGeoreferencedContent`), and know where one document
    // holds them all (`georeferencedContentAddress`, `geo.ts`): never a Collection's, of
    // pages.
    manifest: markGeoreferencedContent(
      manifest,
      /Collection/.test(String(about.type ?? about["@type"] ?? ""))
        ? undefined
        : about.id,
    ),
    ...(first ? { target: { canvasId: first } } : {}),
  };
}
