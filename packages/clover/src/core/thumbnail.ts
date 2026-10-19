import type { CloverRequest } from "./request";
import {
  fetchInfo,
  findImageServiceId,
  imageRequestUrl,
} from "../lib/renderer/sources/imageService";

/**
 * A small picture of a IIIF resource, for a list or a strip of them.
 *
 * - The resource's own `thumbnail` comes first; then, for a Canvas, the first image it
 *   paints; then its placeholder or accompanying Canvas's (video and sound).
 * - An image service that can size images (level 1 or 2) is asked for one at once.
 * - A level 0 service can only hand out the sizes it lists, so its `info.json` is read
 *   first (the renderer's cached fetch, so a Canvas shown later does not ask again).
 * - Without a service, the image itself is used.
 */

export interface ThumbnailSource {
  /** Ready to use. */
  src?: string;
  /** Needs `info.json` before it has a URL: a level 0 (or unlabelled) service. */
  service?: string;
  /** Used if the service cannot answer. */
  fallback?: string;
}

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/** The compliance level a service declares: 0, 1 or 2, or undefined. */
export function serviceLevel(service: unknown): number | undefined {
  for (const candidate of asArray(service) as Json[]) {
    const profile = JSON.stringify(candidate?.profile ?? "");
    const match = /level([012])/.exec(profile);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/** The first image a Canvas paints: a `Choice`'s first item, a SpecificResource's source. */
function firstPaintedImage(container: Json | undefined): Json | undefined {
  for (const page of asArray(container?.items) as Json[]) {
    for (const annotation of asArray(page?.items) as Json[]) {
      const motivation = asArray(annotation?.motivation);
      if (motivation.length && !motivation.includes("painting")) continue;
      for (let body of asArray(annotation?.body) as Json[]) {
        if (body?.type === "Choice") body = asArray(body.items)[0] as Json;
        if (body?.type === "SpecificResource") {
          body =
            typeof body.source === "string" ? { id: body.source } : body.source;
        }
        if (body?.type === "Image" || (body?.id && !body?.type)) return body;
      }
    }
  }
  return undefined;
}

/**
 * An image body (or a bare `{ service }`) as a source of about `size` pixels: all of it,
 * or the `region` of it a painting cuts out (Image API region syntax).
 */
export function imageSource(
  image: Json | undefined,
  size: number,
  region = "full",
): ThumbnailSource | null {
  if (!image) return null;
  const service = findImageServiceId(image.service);
  if (service) {
    const level = serviceLevel(image.service);
    if (level === 1 || level === 2) {
      return { src: `${service}/${region}/!${size},${size}/0/default.jpg` };
    }
    return { service, fallback: image.id };
  }
  return image.id ? { src: image.id } : null;
}

/** Where a resource's thumbnail comes from. Null if it has nothing to show. */
export function thumbnailSource(
  resource: unknown,
  size = 200,
): ThumbnailSource | null {
  const value = resource as Json | undefined;
  if (!value) return null;
  const own = imageSource(
    asArray(value.thumbnail)[0] as Json | undefined,
    size,
  );
  if (own) return own;
  return (
    imageSource(firstPaintedImage(value), size) ??
    imageSource(firstPaintedImage(value.placeholderContainer), size) ??
    imageSource(firstPaintedImage(value.accompanyingContainer), size)
  );
}

/**
 * A picture to stand in for a Canvas as large as it is drawn, at about `size` pixels: the
 * first image it paints first, then its placeholder's or accompanying Canvas's, and only
 * then its own `thumbnail`, which is often small. Null if it has nothing to show.
 */
export function stillSource(
  resource: unknown,
  size: number,
): ThumbnailSource | null {
  const value = resource as Json | undefined;
  if (!value) return null;
  return (
    imageSource(firstPaintedImage(value), size) ??
    imageSource(firstPaintedImage(value.placeholderContainer), size) ??
    imageSource(firstPaintedImage(value.accompanyingContainer), size) ??
    imageSource(asArray(value.thumbnail)[0] as Json | undefined, size)
  );
}

/** A level 0 service's URL: the smallest listed size that fills `size`, else the largest. */
export async function resolveThumbnail(
  source: ThumbnailSource,
  size = 200,
  request?: CloverRequest,
): Promise<string | undefined> {
  if (source.src) return source.src;
  if (!source.service) return source.fallback;
  try {
    const info = await fetchInfo(source.service, { request });
    const full = { x: 0, y: 0, width: info.width, height: info.height };
    if (info.level > 0 || info.sizeByW) {
      const scale = Math.min(1, size / Math.max(info.width, info.height));
      return imageRequestUrl(
        info,
        full,
        Math.round(info.width * scale),
        Math.round(info.height * scale),
      );
    }
    const sizes = [...info.sizes].sort((a, b) => a.width - b.width);
    const pick =
      sizes.find((s) => Math.max(s.width, s.height) >= size) ?? sizes.at(-1);
    return pick
      ? imageRequestUrl(info, full, pick.width, pick.height)
      : source.fallback;
  } catch {
    return source.fallback;
  }
}
