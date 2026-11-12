import type { Presentation4Collection, Manifest } from "./presentation";
import { selectSequence } from "./selectors";
import { asArray } from "../lib/asArray";

/**
 * Whether a Manifest has anything to put on a map: navPlace on the Collection, Manifest,
 * a Canvas or an annotation, a GeoJSON annotation body, or a georeferencing annotation.
 * Only a look, never a read: the panel asks it to offer a Map tab, and the reading
 * (`core/geo.ts`) belongs to the map entry, so an app without a map carries none of it.
 */
export function hasMapData(
  manifest: Manifest | null,
  collection: Presentation4Collection | null = null,
): boolean {
  if (!manifest) return false;
  if ((collection as Json | null)?.navPlace || (manifest as Json).navPlace) {
    return true;
  }
  return selectSequence(manifest).canvases.some(canvasHasMapData);
}

/**
 * Whether a Canvas has anything of its own to put on a map: its navPlace, an annotation's
 * on it, a GeoJSON annotation body, or a georeferencing annotation, as far as its pages
 * are loaded. Only a look, as `hasMapData`'s, which asks it of each Canvas.
 */
export function canvasHasMapData(canvas: unknown): boolean {
  const json = canvas as Json | null;
  if (!json) return false;
  if (json.navPlace || isGeoreferenced(json)) return true;
  return (asArray(json.annotations) as Json[]).some((page) =>
    (asArray(page?.items) as Json[]).some(
      (annotation) =>
        Boolean(annotation?.navPlace) ||
        (asArray(annotation?.body) as Json[]).some(
          (body) =>
            body?.type === "Feature" || body?.type === "FeatureCollection",
        ),
    ),
  );
}

/**
 * Whether an annotation is a Georeference Extension annotation (motivation
 * `georeferencing`): a map to lay on what it targets, never a note or a place to go.
 */
export const isGeoreferencing = (annotation: unknown): boolean =>
  asArray((annotation as Json | null)?.motivation).includes("georeferencing");

/**
 * Whether a Canvas's loaded annotation pages georeference it (a `georeferencing`
 * annotation): a look, as `hasMapData`'s, for the Canvas's map control.
 */
export function isGeoreferenced(canvas: unknown): boolean {
  return (asArray((canvas as Json | null)?.annotations) as Json[]).some(
    (page) => (asArray(page?.items) as Json[]).some(isGeoreferencing),
  );
}

type Json = Record<string, any>;
