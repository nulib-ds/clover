import { bodiesOf } from "./painting";
import type { LanguageMapLike } from "./value";
import { asArray } from "../lib/asArray";

/**
 * What an annotation says: its text bodies (plain, HTML or Markdown, as their `format`
 * says), its images (Cookbook 0377) and its named places (Cookbook 0139), each read too
 * where a `SpecificResource` holds it as its `source` (Cookbook 0045: a comment's words,
 * given a `styleClass`). Caption files belong to the media transcript, so are left out.
 * Light, for the Canvas's caption as well as the lists.
 */

export interface AnnotationBodyEntry {
  /** `TextualBody` text, as published: plain, or IIIF's limited HTML. */
  value?: string;
  format?: string;
  language?: string;
  /** An image body (Cookbook 0377): its URL. */
  image?: string;
  /**
   * An image body's label, else its annotation's: the image's text alternative. A place's
   * name, its feature's `label`, else its annotation's.
   */
  label?: LanguageMapLike;
  /**
   * A place, a GeoJSON `Feature` (Cookbook 0139: a map on the page, tagged with where it
   * shows): named by its `label`, which the Map draws it under too.
   */
  place?: true;
  /**
   * One item of a `Choice` (Cookbook 0346: the same words in English and in Japanese), by
   * the choice's place among the annotation's: of each, one shows, the one in the reader's
   * language (`bodyInLanguage`, `core/annotation-name.ts`).
   */
  choice?: number;
}

type Json = Record<string, any>;

const isCaptionFile = (body: Json) =>
  body?.format === "text/vtt" ||
  (typeof body?.id === "string" && /\.vtt(\?|$)/i.test(body.id));

export function readBodies(annotation: Json): AnnotationBodyEntry[] {
  const bodies: AnnotationBodyEntry[] = [];
  let choices = 0;
  const read = (body: Json | undefined, choice?: number) => {
    if (!body || isCaptionFile(body)) return;
    // The resource a `SpecificResource` holds: its style (`styleClass`) is not applied.
    if (body.type === "SpecificResource") {
      if (body.source && typeof body.source === "object")
        read(body.source, choice);
      return;
    }
    const of = choice === undefined ? {} : { choice };
    if (body.type === "TextualBody" || typeof body.value === "string") {
      bodies.push({
        value: String(body.value ?? ""),
        format: body.format,
        language: asArray(body.language)[0] as string | undefined,
        ...of,
      });
    } else if (body.type === "Image" && body.id) {
      const label = body.label ?? annotation.label;
      bodies.push({
        image: body.id,
        format: body.format,
        ...(label ? { label } : {}),
        ...of,
      });
    } else if (body.type === "Feature") {
      // A place with a name; one without names nothing, and is the Map's alone.
      const label = body.properties?.label ?? annotation.label;
      if (label && typeof label === "object")
        bodies.push({ label, place: true, ...of });
    }
  };
  for (const body of bodiesOf(annotation)) {
    // A `Choice`'s items are kept, as one choice: a viewer shows one at a time.
    if (body?.type !== "Choice") read(body);
    else {
      const choice = choices++;
      for (const item of asArray(body.items) as Json[]) read(item, choice);
    }
  }
  return bodies;
}
