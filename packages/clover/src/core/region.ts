import { parseAnnotationTarget } from "./annotations";
import type { ThumbnailSource } from "./thumbnail";
import { findImageServiceId } from "../lib/renderer/sources/imageService";
import { isPainting } from "./painting";
import { asArray } from "../lib/asArray";
import type { Json } from "./json";

/*
 * Apart from `thumbnail.ts`, which every page loads for its strip: this reads annotation
 * targets, and only the Annotations list (loaded on demand) needs it.
 */

/**
 * A small picture of a region of a Canvas (an annotation's `xywh`, in the Canvas's own
 * coordinates), to be cut by the image server (`resolveThumbnail`): the image painted
 * there is found, and the region read as shares of it (scaled from where it is painted),
 * so the service's own `info.json` decides how it is asked for, never more than the
 * region has, and from a server that cannot cut a region, nothing (no fallback: all of
 * the image is not the region). A `Choice`'s first image stands for it, or the one named
 * (`image`: a layer's annotation is cut from its own layer, Cookbook 0326). Null where no
 * image with a service is painted there.
 */
export function regionSource(
  canvas: Json | undefined,
  rect: { x: number; y: number; w: number; h: number },
  image?: string,
): ThumbnailSource | null {
  for (const page of asArray(canvas?.items) as Json[]) {
    for (const annotation of asArray(page?.items) as Json[]) {
      if (!isPainting(annotation)) continue;
      const bodies = (asArray(annotation?.body) as Json[]).flatMap((body) =>
        body?.type === "Choice"
          ? (asArray(body.items) as Json[]).filter((item, index) =>
              image ? item?.id === image : index === 0,
            )
          : image && body?.id !== image
            ? []
            : [body],
      );
      for (const body of bodies) {
        if (body?.type !== "Image" || !body.width || !body.height) continue;
        const service = findImageServiceId(body.service);
        if (!service) continue;
        // Where it is painted: all of the Canvas, or the region its target names.
        const target = parseAnnotationTarget(
          asArray(annotation.target)[0] as any,
        ).rect ?? { x: 0, y: 0, w: canvas!.width, h: canvas!.height };
        // The region in shares of the image, and the part of it the image covers.
        const left = (rect.x - target.x) / target.w;
        const top = (rect.y - target.y) / target.h;
        const x = Math.max(0, left);
        const y = Math.max(0, top);
        const width = Math.min(1, left + rect.w / target.w) - x;
        const height = Math.min(1, top + rect.h / target.h) - y;
        if (!(width > 0 && height > 0)) continue; // Not on this image.
        return { service, region: { x, y, width, height } };
      }
    }
  }
  return null;
}
