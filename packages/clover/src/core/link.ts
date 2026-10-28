import { parseAnnotationTarget } from "./annotations";
import { bodiesOf } from "./painting";
import { asArray } from "../lib/asArray";

/**
 * Where a `linking` annotation leads (Cookbook 0022): its first body that is not text. A
 * Canvas, with the Manifest its `partOf` names; a Manifest or Collection; or a web page.
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
    if (body?.type === "TextualBody" || typeof body?.value === "string")
      continue;
    const source: any = body?.type === "SpecificResource" ? body.source : body;
    const id = typeof source === "string" ? source : source?.id;
    if (typeof id !== "string" || !id) continue;
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
 * `tagging` or `identifying` annotation's body that is a resource of its own, a
 * `SpecificResource`'s `source` or a bare `id`, by http(s) only. The list offers it as a
 * link; on the image the tag stays a tag, framed when pressed, never followed.
 */
export function readTagSource(
  annotation: Record<string, any>,
): AnnotationLink | undefined {
  const motivation = asArray(annotation?.motivation);
  if (!motivation.includes("tagging") && !motivation.includes("identifying"))
    return undefined;
  for (const body of bodiesOf(annotation)) {
    if (body?.type === "TextualBody" || typeof body?.value === "string")
      continue;
    const source: any = body?.type === "SpecificResource" ? body.source : body;
    const id = typeof source === "string" ? source : source?.id;
    if (typeof id === "string" && /^https?:\/\//i.test(id)) return { id };
  }
  return undefined;
}
