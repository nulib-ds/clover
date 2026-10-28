import { type AnnotationSet, readPage } from "./annotation-sets";
import { parseAnnotationTarget } from "./annotations";
import { choiceKey } from "./choice-key";
import { isPainting } from "./painting";
import type { Manifest } from "./presentation";
import { selectSequence } from "./selectors";
import type { LanguageMapLike } from "./value";
import { asArray } from "../lib/asArray";

/*
 * The annotations a Manifest's painted images carry themselves (Cookbook 0326). Loaded by
 * the Root only for a Manifest whose images carry some (`clover.ts`, `paintsLayers`), so
 * a page without never loads this.
 */

type Json = Record<string, any>;

/** The sets its painted images carry, merged by page id across Canvases. */
export function imageLayers(manifest: Manifest): AnnotationSet[] {
  const byId = new Map<string, AnnotationSet>();
  for (const canvas of selectSequence(manifest).canvases as Json[])
    readLayers(canvas, byId);
  return [...byId.values()];
}

/**
 * The annotations a Canvas's painted images carry themselves (Cookbook 0326: the X-ray of
 * a `Choice` tagged "A group of skulls."), each page a set, named by its own label or else
 * its image's ("X-ray"). Each annotation's target, a region of its image (an
 * `ImageApiSelector`'s `region`, an `xywh`), is restated in the Canvas's coordinates
 * through where the image is painted, so it is placed, framed and pictured as any; an
 * item of a `Choice` marks its entries with its `layer`, drawn while it is chosen.
 */
function readLayers(canvas: Json, byId: Map<string, AnnotationSet>): void {
  (asArray(canvas.items) as Json[]).forEach((page, p) =>
    (asArray(page?.items) as Json[]).forEach((painting, a) => {
      if (!isPainting(painting)) return;
      const at = parseAnnotationTarget(asArray(painting.target)[0] as any)
        .rect ?? {
        x: 0,
        y: 0,
        w: Number(canvas.width) || 0,
        h: Number(canvas.height) || 0,
      };
      (asArray(painting.body) as Json[]).forEach((body, b) => {
        const choice = body?.type === "Choice";
        const items = (choice ? asArray(body.items) : [body]) as Json[];
        items.forEach((image, i) => {
          for (const own of asArray(image?.annotations) as Json[]) {
            if (!Array.isArray(own?.items) || typeof image?.id !== "string")
              continue;
            const id = own.id ?? `${image.id}#annotations`;
            const layer = choice
              ? {
                  key: choiceKey(canvas.id, painting.id, p, a, b),
                  item: i,
                  image: image.id,
                }
              : undefined;
            const entries = readPage(own, id, canvas.id).map((entry) => {
              const region = imageRegion(entry.annotation, image);
              const x = Math.round(at.x + region.x * (at.w / region.width));
              const y = Math.round(at.y + region.y * (at.h / region.height));
              const w = Math.round(region.w * (at.w / region.width));
              const h = Math.round(region.h * (at.h / region.height));
              const target = `${canvas.id}#xywh=${x},${y},${w},${h}`;
              return {
                ...entry,
                canvasId: canvas.id,
                target: parseAnnotationTarget(target),
                annotation: { ...entry.annotation, target },
                ...(layer ? { layer } : {}),
              };
            });
            if (!entries.length) continue;
            let set = byId.get(id);
            if (!set) {
              set = {
                id,
                label: (own.label ?? image.label) as LanguageMapLike,
                source: "manifest",
                entries: [],
              };
              byId.set(id, set);
            }
            set.entries.push(...entries);
          }
        });
      });
    }),
  );
}

/**
 * The region of an image an annotation names, in the image's pixels, with the image's
 * size: an `ImageApiSelector`'s `region` (`x,y,w,h`, `pct:x,y,w,h`), a `FragmentSelector`'s
 * or an address's `xywh`, else all of it.
 */
function imageRegion(
  annotation: Json,
  image: Json,
): {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
} {
  const width = Number(image.width) || 1;
  const height = Number(image.height) || 1;
  const all = { x: 0, y: 0, w: width, h: height, width, height };
  const target = asArray(annotation?.target)[0] as Json | string | undefined;
  const selectors = (
    typeof target === "object" ? asArray(target?.selector) : []
  ) as Json[];
  const api = selectors.find((each) => each?.type === "ImageApiSelector");
  const value = typeof api?.region === "string" ? api.region : undefined;
  if (value) {
    const match = /^(pct:)?([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/.exec(value);
    if (!match) return all;
    const [x, y, w, h] = match.slice(2).map(Number);
    return match[1]
      ? {
          x: (x / 100) * width,
          y: (y / 100) * height,
          w: (w / 100) * width,
          h: (h / 100) * height,
          width,
          height,
        }
      : { x, y, w, h, width, height };
  }
  const rect = parseAnnotationTarget(target as any).rect;
  return rect ? { ...rect, width, height } : all;
}
