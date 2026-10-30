import { loadAnnotationSets } from "./annotation-collection";
import { manifestOfAnnotation } from "./annotation-sets";
import {
  CloverContentError,
  type LoadContentOptions,
  type Loaded,
  loadManifest,
} from "./load";

/**
 * Annotations as the content: an AnnotationPage (and the pages its `next` leads to) or
 * an AnnotationCollection, made apart from any Manifest. Each annotation names its
 * Canvas's Manifest (`partOf`): the first one's is opened (or the host's choice among
 * them), at that annotation's Canvas, that annotation to be picked, and all of them come
 * back as sets to show wherever their Canvases are. Its own module, loaded only for such
 * content, so no other page carries it.
 */
export async function annotationsContent(
  json: Record<string, any>,
  options: LoadContentOptions,
): Promise<Loaded> {
  // Walked as one whole (`selectAnnotationCollection`), under its own name.
  const content = {
    id: String(json.id ?? ""),
    type: /Collection/.test(String(json.type ?? json["@type"]))
      ? ("AnnotationCollection" as const)
      : ("AnnotationPage" as const),
    ...(json.label ? { label: json.label } : {}),
  };
  const annotationSets = (await loadAnnotationSets(json, options)).map(
    (set) => ({ ...set, content }),
  );
  const entries = annotationSets.flatMap((set) => set.entries);
  const first =
    entries.find(
      (entry) =>
        options.manifestId &&
        manifestOfAnnotation(entry.annotation) === options.manifestId,
    ) ?? entries.find((entry) => manifestOfAnnotation(entry.annotation));
  if (!first) {
    throw new CloverContentError("The annotations name no Manifest");
  }
  const manifest = await loadManifest(
    { id: manifestOfAnnotation(first.annotation), type: "Manifest" },
    options,
  );
  return {
    manifest,
    target: { canvasId: first.canvasId },
    annotationSets,
    pick: first.id,
  };
}
