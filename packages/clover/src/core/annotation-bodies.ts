import { bodiesOf } from "./annotations";
import type { LanguageMapLike } from "./value";

/**
 * What an annotation says: its text bodies (plain, HTML or Markdown, as their `format`
 * says) and its images (Cookbook 0377). Caption files belong to the media transcript, so
 * are left out. Light, for the Canvas's caption as well as the lists.
 */

export interface AnnotationBodyEntry {
  /** `TextualBody` text, as published: plain, or IIIF's limited HTML. */
  value?: string;
  format?: string;
  language?: string;
  /** An image body (Cookbook 0377): its URL. */
  image?: string;
  /** An image body's label, else its annotation's: the image's text alternative. */
  label?: LanguageMapLike;
}

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

const isCaptionFile = (body: Json) =>
  body?.format === "text/vtt" ||
  (typeof body?.id === "string" && /\.vtt(\?|$)/i.test(body.id));

export function readBodies(annotation: Json): AnnotationBodyEntry[] {
  const bodies: AnnotationBodyEntry[] = [];
  for (let body of bodiesOf(annotation)) {
    // A `Choice` of languages offers its first, as a viewer shows one at a time.
    if (body?.type === "Choice") body = asArray(body.items)[0] as Json;
    if (!body || isCaptionFile(body)) continue;
    if (body.type === "TextualBody" || typeof body.value === "string") {
      bodies.push({
        value: String(body.value ?? ""),
        format: body.format,
        language: asArray(body.language)[0] as string | undefined,
      });
    } else if (body.type === "Image" && body.id) {
      const label = body.label ?? annotation.label;
      bodies.push({
        image: body.id,
        format: body.format,
        ...(label ? { label } : {}),
      });
    }
  }
  return bodies;
}
