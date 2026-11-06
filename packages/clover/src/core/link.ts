import { parseAnnotationTarget } from "./annotations";
import { bodiesOf } from "./painting";
import { asArray } from "../lib/asArray";

/**
 * Where a `linking` annotation leads (Cookbook 0022): its first body that is a
 * `SpecificResource` with a `source` by address. A Canvas, with the Manifest its
 * `partOf` names; a Manifest or Collection; or a web page.
 */
export interface AnnotationLink {
  /** Its address: the Canvas's or Manifest's id, or the page's. */
  id: string;
  canvasId?: string;
  manifestId?: string;
}

export function readLink(
  annotation: Record<string, any>,
): AnnotationLink | undefined {
  if (!asArray(annotation?.motivation).includes("linking")) return undefined;
  for (const body of bodiesOf(annotation)) {
    const found = sourceOf(body);
    if (!found) continue;
    const { id, source } = found;
    if (source?.type === "Canvas") {
      const part = asArray(source.partOf).find(
        (each: any) => each?.id && (!each.type || each.type === "Manifest"),
      ) as { id: string } | undefined;
      const canvasId = parseAnnotationTarget(id).id;
      return { id, canvasId, ...(part ? { manifestId: part.id } : {}) };
    }
    if (source?.type === "Manifest" || source?.type === "Collection")
      return { id, manifestId: id };
    // A page on the web: only by http(s), never a script's address.
    if (/^https?:\/\//i.test(id)) return { id };
  }
  return undefined;
}

/**
 * What a tag names on the web (Cookbook 0258: a Wikidata entity beside its name): a
 * `tagging` or `identifying` annotation's `SpecificResource` body, its `source` by
 * http(s) only. The list offers it as a link; on the image the tag stays a tag, framed
 * when pressed, never followed. A body that is a resource itself, with an `id` of its own
 * (0139's GeoJSON Feature), names nothing to follow: its `id` only identifies it.
 */
export function readTagSource(
  annotation: Record<string, any>,
): AnnotationLink | undefined {
  const motivation = asArray(annotation?.motivation);
  if (!motivation.includes("tagging") && !motivation.includes("identifying"))
    return undefined;
  for (const body of bodiesOf(annotation)) {
    const found = sourceOf(body);
    if (found && /^https?:\/\//i.test(found.id)) return { id: found.id };
  }
  return undefined;
}

/**
 * The `source` of a `SpecificResource` body, by its address: a URI, or a resource with
 * an `id`. Only such a body leads anywhere: any other (text, a resource with an `id` of
 * its own) is what the annotation says, never a place to open.
 */
function sourceOf(
  body: any,
): { id: string; source: Record<string, any> | undefined } | undefined {
  if (body?.type !== "SpecificResource") return undefined;
  const source = body.source;
  if (typeof source === "string")
    return source ? { id: source, source: undefined } : undefined;
  const id = source?.id;
  return typeof id === "string" && id ? { id, source } : undefined;
}
