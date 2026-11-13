import type { AnnotationSet } from "./annotation-sets";
import { parseAnnotationTarget } from "./annotations";
import type { ResolvedContentState, Target } from "./content-state";
import { resolveContentState } from "./content-state-reader";
import { isGeoreferencing } from "./geo-detect";
import type { Json } from "./json";
import {
  CloverContentError,
  isImageServiceManifest,
  type LoadContentOptions,
  type Loaded,
  type loadContent,
} from "./load";
import { readSvgShape } from "./svg-shape";
import { asArray } from "../lib/asArray";

/**
 * Following a content state, or any annotation given alone, to what it targets: its own
 * chunk, loaded only when one is followed (`loadContent`), so neither a page that opens a
 * URL nor one that only decodes a content state carries it.
 *
 * An annotation of any motivation (a comment, a tag, a highlight, an image) is read as a
 * content state is (`resolveContentState`): its target is where to go, a region and a
 * time in it, and its body, where it has one, the note shown and picked there. Beyond
 * that, here: Presentation 2's (`oa:Annotation`, as Mirador 2 wrote them) read as 3's
 * (`readAnnotation`), an SvgSelector's box as the region to go to, and, once the
 * resource has loaded, a target that names a Range or an image service placed on its
 * Canvas (`placeTarget`).
 */

const PRESENTATION_2 = "http://iiif.io/api/presentation/2/context.json";

/** Whether JSON is a Presentation 2 annotation: its `oa:` type, or 2's `@id` and context. */
const isPresentation2Annotation = (json: Json) =>
  json?.["@type"] === "oa:Annotation" ||
  (json?.["@id"] !== undefined &&
    asArray(json?.["@context"]).includes(PRESENTATION_2));

/** A reference's id, from a string or an object (`@id` or `id`). */
const idOf = (value: unknown): string | undefined =>
  typeof value === "string"
    ? value
    : ((value as Json)?.["@id"] ?? (value as Json)?.id);

/**
 * An annotation as Presentation 3 writes it. One of Presentation 2 is read by
 * `@iiif/parser`'s reader of 2 (loaded only for it), and given back what that leaves out:
 * the Manifest its target is `within`, as the target's `partOf`, and a text body's
 * `chars`, as a `TextualBody`'s `value`.
 */
export async function readAnnotation(json: Json): Promise<Json> {
  if (!isPresentation2Annotation(json)) return json;
  const { convertPresentation2 } = await import("@iiif/parser/presentation-2");
  const read = convertPresentation2({
    "@context": PRESENTATION_2,
    ...JSON.parse(JSON.stringify(json)),
  }) as Json;
  const within = (asArray(json.on) as unknown[]).map((on) =>
    idOf(asArray((on as Json)?.within)[0]),
  );
  const target = (asArray(read.target) as unknown[]).map((each, index) => {
    const manifest = within[index];
    if (!manifest) return each;
    const partOf = [{ id: manifest, type: "Manifest" }];
    const source = (each as Json)?.type === "SpecificResource";
    const canvas = idOf(source ? (each as Json).source : each);
    if (!canvas) return each;
    return source
      ? { ...(each as Json), source: { id: canvas, type: "Canvas", partOf } }
      : { id: canvas, type: "Canvas", partOf };
  });
  const body = (asArray(read.body) as Json[]).map((each) =>
    typeof each?.chars === "string"
      ? {
          type: "TextualBody",
          value: each.chars,
          ...(each.format ? { format: each.format } : {}),
          ...(each.language ? { language: each.language } : {}),
        }
      : each,
  );
  return {
    ...read,
    "@context": undefined,
    type: "Annotation",
    target: target.length === 1 ? target[0] : target,
    ...(body.length ? { body: body.length === 1 ? body[0] : body } : {}),
  };
}

/**
 * A content state, or an annotation, followed: what it names loaded (by `load`, which is
 * `loadContent`, handed in so this chunk never imports the loader back), then opened at
 * its target, with its note. Where what it names was itself a content state, that one's
 * target and note stand, as they name a place in what loaded.
 */
export async function follow(
  state: Json,
  options: LoadContentOptions,
  load: typeof loadContent,
): Promise<Loaded> {
  // A georeference is not a place to go: what it targets opens, the map laid on it.
  if (isGeoreferencing(state)) {
    const { georeferenceContent } = await import("./georeference-content");
    return georeferenceContent([state], options, load, {
      id: String(state.id ?? ""),
      rights: state.rights,
      requiredStatement: state.requiredStatement,
    });
  }
  const resolved = await resolve(state);
  if (!resolved) throw new CloverContentError("Unreadable content state");
  const loaded = await load(resolved.id, {
    ...options,
    // The host's choice of member first, then the content state's.
    manifestId: options.manifestId ?? resolved.manifestId,
    follows: (options.follows ?? 0) + 1,
  });
  const { target } = resolved;
  /*
   * The annotation it targets (a search's result, by its `id`; Mat, 2026-11-12). With a
   * query to search for, it is held for the answer (`sought`): the search's result where
   * the answer has it, else listed (`searchInto`), as it is where the Manifest has no
   * service to ask (`clover.search`). With no query, it is listed from the start, as the
   * content's own annotations are, and picked.
   */
  const set = soughtSet(resolved.sought);
  return placeTarget({
    ...loaded,
    target:
      target && (!loaded.target || loaded.target.canvasId === target.canvasId)
        ? { ...loaded.target, ...target }
        : (loaded.target ?? target),
    annotation: loaded.annotation ?? resolved.annotation,
    ...(set && !loaded.annotationSets && !options.searching
      ? { annotationSets: [set], pick: resolved.pick }
      : {}),
    sought: loaded.sought ?? (options.searching ? set : undefined),
    targets: loaded.targets ?? resolved.targets,
  });
}

/**
 * The annotation a content state targets, as a set of its own, as its note's is
 * (`${id}#content-state`): listed with the content's own annotations where no search
 * answers with it. Made here, not by `readPage`, which leaves out an annotation without a
 * body, as a search's result is: the list names one by its number. Its text bodies are
 * read here too, not by `readBodies`: importing that, or the search service's reader,
 * moves them into chunks every Map and element page loads (500 B on a Map alone).
 */
function soughtSet(annotation: Json | undefined): AnnotationSet | undefined {
  const target =
    annotation && parseAnnotationTarget(asArray(annotation.target)[0] as never);
  if (!target?.id) return undefined;
  const id = `${annotation!.id}#content-state`;
  return {
    id,
    source: "added",
    entries: [
      {
        id: annotation!.id,
        setId: id,
        canvasId: target.id,
        target,
        motivation: asArray(annotation!.motivation) as string[],
        bodies: (asArray(annotation!.body) as Json[])
          .filter((body) => typeof body?.value === "string")
          .map((body) => ({
            value: body.value as string,
            format: body.format,
            language: asArray(body.language)[0] as string | undefined,
          })),
        annotation: annotation!,
      },
    ],
  };
}

/**
 * What a content state, or an annotation, asks for (`resolveContentState`), with the box
 * an SvgSelector's shapes fill as its region where it names no other. Its note keeps the
 * annotation's `label` (an image body's text alternative), and an annotation that paints,
 * given alone, is shown as one, not painted into the Canvas.
 */
export async function resolve(
  state: Json,
): Promise<ResolvedContentState | null> {
  const json = await readAnnotation(state);
  const resolved = resolveContentState(json);
  if (!resolved) return null;
  const targeted = json.type === "Annotation" ? asArray(json.target)[0] : json;
  // A target that is an annotation (a search's hit): where that one targets.
  const first =
    (targeted as Json)?.type === "Annotation"
      ? asArray((targeted as Json).target)[0]
      : targeted;
  const region = svgRegion(parseAnnotationTarget(first as any).svg);
  const note = resolved.annotation;
  return {
    ...resolved,
    ...(resolved.target && !resolved.target.region && region
      ? { target: { ...resolved.target, region } }
      : {}),
    ...(note
      ? {
          annotation: {
            ...note,
            motivation: asArray(note.motivation).filter(
              (motivation) => motivation !== "painting",
            ),
            ...(json.label ? { label: json.label } : {}),
          },
        }
      : {}),
  };
}

/** A media fragment's start, in seconds (`t=start` or `t=start,end`). */
function startTime(t: string | undefined): number | undefined {
  const seconds = t ? Number(t.split(",")[0]) : NaN;
  return Number.isFinite(seconds) ? seconds : undefined;
}

/** The box an SvgSelector's shapes fill, as a region to go to; none where it draws none. */
function svgRegion(svg: string | undefined): Target["region"] | undefined {
  const box = svg ? readSvgShape(svg)?.box : undefined;
  return box && box.width > 0 && box.height > 0
    ? { x: box.x, y: box.y, w: box.width, h: box.height }
    : undefined;
}

/** Where a Range starts: the first Canvas it, or the first Range within it, names. */
function rangeStart(
  manifest: Json,
  rangeId: string,
): { canvasId: string; region?: Target["region"]; time?: number } | null {
  const seen = new Set<unknown>();
  const find = (ranges: Json[]): Json | undefined => {
    for (const range of ranges) {
      if (!range || seen.has(range)) continue;
      seen.add(range);
      if (range.type === "Range" && range.id === rangeId) return range;
      const inner = find(asArray(range.items) as Json[]);
      if (inner) return inner;
    }
    return undefined;
  };
  const first = (range: Json, depth = 0): ReturnType<typeof rangeStart> => {
    for (const item of asArray(range.items) as Json[]) {
      if (item?.type === "Range") {
        const found = depth < 16 ? first(item, depth + 1) : null;
        if (found) return found;
        continue;
      }
      // A Range item's fragment, which the upgrader writes after a `/` (`ranges.ts`).
      const raw = typeof item === "string" ? item : item?.id;
      const parsed = parseAnnotationTarget(
        item?.type === "SpecificResource"
          ? item
          : String(raw ?? "").replace(/\/((?:t|xywh)=[^/#]*)$/, "#$1"),
      );
      if (!parsed.id) continue;
      const time = startTime(parsed.t);
      return {
        canvasId: parsed.id,
        ...(parsed.rect ? { region: parsed.rect } : {}),
        ...(time !== undefined ? { time } : {}),
      };
    }
    return null;
  };
  const range = find(asArray(manifest.structures) as Json[]);
  return range ? first(range) : null;
}

/** A target on another Canvas: its source's id replaced, its fragment or selector kept. */
function retarget(target: unknown, canvasId: string): unknown {
  if (typeof target === "string") {
    const hash = target.indexOf("#");
    return hash < 0 ? canvasId : canvasId + target.slice(hash);
  }
  const json = target as Json;
  if (json?.type === "SpecificResource")
    return {
      ...json,
      source:
        typeof json.source === "object"
          ? { ...json.source, id: canvasId, type: "Canvas" }
          : { id: canvasId, type: "Canvas" },
    };
  return retarget(String(json?.id ?? ""), canvasId);
}

/**
 * A content state's, or an annotation's, target placed on a Canvas of what loaded, where
 * it named something else: a Range (its first Canvas, with that Canvas's region or time
 * where the target gives none), or an image service (the one Canvas Clover shows it as).
 * Its note moves with it, so it is shown and picked there.
 */
export function placeTarget(loaded: Loaded): Loaded {
  const { manifest, target } = loaded;
  if (!target) return loaded;
  const canvases = asArray((manifest as Json).items) as Json[];
  if (canvases.some((canvas) => canvas?.id === target.canvasId)) return loaded;
  // An image service is shown as one Canvas, whatever it named.
  const service = isImageServiceManifest(manifest as Json)
    ? { canvasId: canvases[0].id as string }
    : null;
  const place: ReturnType<typeof rangeStart> =
    service ?? rangeStart(manifest as Json, target.canvasId);
  if (!place) return loaded;
  const annotation = loaded.annotation && {
    ...loaded.annotation,
    target: retarget(loaded.annotation.target, place.canvasId),
  };
  return {
    ...loaded,
    target: {
      ...target,
      canvasId: place.canvasId,
      ...(target.region ? {} : place.region ? { region: place.region } : {}),
      ...(target.time !== undefined
        ? {}
        : place.time !== undefined
          ? { time: place.time }
          : {}),
    },
    ...(annotation ? { annotation } : {}),
  };
}
