import type { AnnotationPageRef } from "./annotation-sets";
import type { Manifest } from "./presentation";
import { selectSequence } from "./selectors";
import { asArray } from "../lib/asArray";

/*
 * Apart from `annotation-sets.ts`, which every Body loads: only the Annotations list,
 * loaded when first drawn, names every page, fetched or not.
 */

type Json = Record<string, any>;

const manifestPages = new WeakMap<Manifest, AnnotationPageRef[]>();
const NO_PAGES: AnnotationPageRef[] = [];

/** Every annotation page the Manifest's Canvases name, in their order, fetched or not. */
export function selectAnnotationPages(
  manifest: Manifest | null,
): AnnotationPageRef[] {
  if (!manifest) return NO_PAGES;
  let pages = manifestPages.get(manifest);
  if (!pages) {
    pages = (selectSequence(manifest).canvases as Json[]).flatMap((canvas) =>
      (asArray(canvas.annotations) as Json[])
        .filter((page) => page?.id)
        .map((page) => ({
          id: String(page.id),
          canvasId: String(canvas.id),
          fetched: Array.isArray(page.items),
        })),
    );
    manifestPages.set(manifest, pages);
  }
  return pages;
}
