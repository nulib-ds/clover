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
  for (const canvas of selectSequence(manifest).canvases as Json[]) {
    if (canvas.navPlace) return true;
    if (isGeoreferenced(canvas)) return true;
    for (const page of asArray(canvas.annotations) as Json[]) {
      for (const annotation of asArray(page?.items) as Json[]) {
        if (annotation?.navPlace) return true;
        const bodies = asArray(annotation?.body) as Json[];
        if (
          bodies.some(
            (body) =>
              body?.type === "Feature" || body?.type === "FeatureCollection",
          )
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Whether a Canvas's loaded annotation pages georeference it (a `georeferencing`
 * annotation): a look, as `hasMapData`'s, for the Canvas's map control.
 */
export function isGeoreferenced(canvas: unknown): boolean {
  return (asArray((canvas as Json | null)?.annotations) as Json[]).some(
    (page) =>
      (asArray(page?.items) as Json[]).some((annotation) =>
        asArray(annotation?.motivation).includes("georeferencing"),
      ),
  );
}

type Json = Record<string, any>;
