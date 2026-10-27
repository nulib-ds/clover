import type { CloverRequest } from "./request";
import {
  fetchInfo,
  findImageServiceId,
} from "../lib/renderer/sources/imageService";
import {
  type RegionShare,
  sizedImageUrl,
} from "../lib/renderer/sources/sizedImage";
import { paintedBodies } from "./painted-bodies";
import { asArray } from "../lib/asArray";

/**
 * A small picture of a IIIF resource, for a list or a strip of them.
 *
 * - The resource's own `thumbnail` comes first; then, for a Canvas, the first image it
 *   paints; then its placeholder or accompanying Canvas's (video and sound).
 * - An image service is asked for nothing until its own `info.json` has been read (the
 *   renderer's cached fetch, so a Canvas shown later does not ask again), and then only
 *   as strictly as it says it can answer (`sizedImageUrl`): never more than the image has,
 *   nor than its limits, at level 0 only a size it lists (Mat, 2026-10-24: "be
 *   responsible when making IIIF image server requests"). What a manifest says of a
 *   service is not trusted to say what its server does.
 * - Without a service, the image itself is used.
 */

export interface ThumbnailSource {
  /** Ready to use: an image with no service. */
  src?: string;
  /** An image service: its `info.json` is read before a URL is made (`resolveThumbnail`). */
  service?: string;
  /**
   * Only part of the image: shares of it (a target's region), or a region in Image API
   * syntax in the service's own pixels (a painting's selector), read against its `info.json`.
   */
  region?: RegionShare | string;
  /** Used if the service cannot answer. */
  fallback?: string;
}

type Json = Record<string, any>;

/** The first image a Canvas paints: a `Choice`'s first item, a SpecificResource's source. */
function firstPaintedImage(container: Json | undefined): Json | undefined {
  return paintedBodies(container).find(
    ({ body }) => body.type === "Image" || (body.id && !body.type),
  )?.body;
}

/**
 * A region in Image API syntax (`x,y,w,h` in the image's pixels, or `pct:`) as shares of
 * an image this size. Null for one it cannot read (`square`).
 */
function regionShare(
  region: string,
  { width, height }: { width: number; height: number },
): RegionShare | null {
  if (region === "full") return { x: 0, y: 0, width: 1, height: 1 };
  const match = /^(pct:)?([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/.exec(region);
  if (!match) return null;
  const [x, y, w, h] = match.slice(2).map(Number);
  const [across, down] = match[1] ? [100, 100] : [width, height];
  return { x: x / across, y: y / down, width: w / across, height: h / down };
}

/**
 * An image body (or a bare `{ service }`) as a source: its service, to be read before it
 * is asked for anything (`resolveThumbnail`), with all of it or the `region` of it a
 * painting cuts out (Image API region syntax); or, without a service, the image itself.
 * The image is the fallback, for a service that cannot answer.
 */
export function imageSource(
  image: Json | undefined,
  region = "full",
): ThumbnailSource | null {
  if (!image) return null;
  const service = findImageServiceId(image.service);
  if (service) {
    return region === "full"
      ? { service, fallback: image.id }
      : { service, region, fallback: image.id };
  }
  return image.id ? { src: image.id } : null;
}

/**
 * Where a resource's thumbnail comes from, to be sized by `resolveThumbnail`. Null if it
 * has nothing to show.
 */
export function thumbnailSource(resource: unknown): ThumbnailSource | null {
  const value = resource as Json | undefined;
  if (!value) return null;
  return (
    imageSource(asArray(value.thumbnail)[0] as Json | undefined) ??
    imageSource(firstPaintedImage(value)) ??
    imageSource(firstPaintedImage(value.placeholderContainer)) ??
    imageSource(firstPaintedImage(value.accompanyingContainer))
  );
}

/**
 * A picture to stand in for a Canvas as large as it is drawn, to be sized by
 * `resolveThumbnail`: the first image it paints first, then its placeholder's or
 * accompanying Canvas's, and only then its own `thumbnail`, which is often small. Null if
 * it has nothing to show.
 */
export function stillSource(resource: unknown): ThumbnailSource | null {
  const value = resource as Json | undefined;
  if (!value) return null;
  return (
    imageSource(firstPaintedImage(value)) ??
    imageSource(firstPaintedImage(value.placeholderContainer)) ??
    imageSource(firstPaintedImage(value.accompanyingContainer)) ??
    imageSource(asArray(value.thumbnail)[0] as Json | undefined)
  );
}

/**
 * A source's URL at about `size` pixels on its longer side: a service's, made from its own
 * `info.json` (`sizedImageUrl`), else the fallback, as where the service cannot answer.
 */
export async function resolveThumbnail(
  source: ThumbnailSource,
  size = 200,
  request?: CloverRequest,
): Promise<string | undefined> {
  if (source.src) return source.src;
  if (!source.service) return source.fallback;
  try {
    const info = await fetchInfo(source.service, { request });
    const share =
      typeof source.region === "string"
        ? regionShare(source.region, info)
        : source.region;
    if (share === null) return source.fallback;
    return sizedImageUrl(info, size, share) ?? source.fallback;
  } catch {
    return source.fallback;
  }
}
