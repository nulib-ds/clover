import { parseAnnotationTarget } from "./annotations";
import { serviceLevel } from "./thumbnail";
import { findImageServiceId } from "../lib/renderer/sources/imageService";

/*
 * Apart from `thumbnail.ts`, which every page loads for its strip: this reads annotation
 * targets, and only the Annotations list (loaded on demand) needs it.
 */

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/**
 * A small picture of a region of a Canvas (an annotation's `xywh`, in the Canvas's own
 * coordinates), cut by the image server: the image painted there is found, the region
 * read in its pixels (scaled from where it is painted), and asked for at no more than
 * `size` pixels a side, nor more than the region has: Image API 3 refuses to scale up
 * unless asked with `^`, and a region smaller than `size` would need it. Only from a
 * service that can cut and size (level 1 or 2), so nothing larger than that is ever
 * fetched; null otherwise, or where nothing is painted.
 */
export function regionSource(
  canvas: Json | undefined,
  rect: { x: number; y: number; w: number; h: number },
  size: number,
): string | null {
  for (const page of asArray(canvas?.items) as Json[]) {
    for (const annotation of asArray(page?.items) as Json[]) {
      const motivation = asArray(annotation?.motivation);
      if (motivation.length && !motivation.includes("painting")) continue;
      for (const body of asArray(annotation?.body) as Json[]) {
        if (body?.type !== "Image" || !body.width || !body.height) continue;
        const level = serviceLevel(body.service);
        const service = findImageServiceId(body.service);
        if (!service || (level !== 1 && level !== 2)) continue;
        // Where it is painted: all of the Canvas, or the region its target names.
        const target = parseAnnotationTarget(
          asArray(annotation.target)[0] as any,
        ).rect ?? { x: 0, y: 0, w: canvas!.width, h: canvas!.height };
        // The region in the image's pixels, and the part of it the image covers.
        const sx = body.width / target.w;
        const sy = body.height / target.h;
        const left = (rect.x - target.x) * sx;
        const top = (rect.y - target.y) * sy;
        const x = Math.round(Math.max(0, left));
        const y = Math.round(Math.max(0, top));
        const w = Math.round(Math.min(body.width, left + rect.w * sx)) - x;
        const h = Math.round(Math.min(body.height, top + rect.h * sy)) - y;
        if (!(w > 0 && h > 0)) continue; // Not on this image.
        // Best fit within both: never more pixels than the region has.
        const fit = `!${Math.min(size, w)},${Math.min(size, h)}`;
        return `${service}/${x},${y},${w},${h}/${fit}/0/default.jpg`;
      }
    }
  }
  return null;
}
