import { type ImageServiceInfo, imageRequestUrl } from "./imageService";

/*
 * Apart from `imageService.ts`, which a Canvas loads up front for its tiles: only the
 * pictures that are not tiles (thumbnails, stills, regions, frames, a map's overlay) need
 * this, and they load it with them.
 */

/** A region of the image as shares of it: 0 to 1 across and down. */
export interface RegionShare {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A picture of all of the image, or of a region of it (`share`), at about `size` pixels
 * on its longer side, asked strictly as the server's own info.json says it can answer
 * (Mat, 2026-10-24: "always look at info json and build accordingly/strictly"): never
 * more pixels than the image or region has, within its `maxWidth`, `maxHeight` and
 * `maxArea`, in its version's canonical form (`imageRequestUrl`). A server that sizes
 * (`sizeByW`, level 1 and up) is asked for the size; one that does not (level 0) only for
 * a size it lists, the smallest that fills `size`, else the largest, else the whole image
 * at its own size. Null for a region from a server that cannot cut one.
 */
export function sizedImageUrl(
  info: ImageServiceInfo,
  size: number,
  share?: RegionShare,
): string | null {
  const clip = (value: number, limit: number) =>
    Math.min(Math.max(Math.round(value), 0), limit);
  const x = share ? clip(share.x * info.width, info.width - 1) : 0;
  const y = share ? clip(share.y * info.height, info.height - 1) : 0;
  const region = {
    x,
    y,
    width: share
      ? Math.max(1, clip(share.width * info.width, info.width - x))
      : info.width,
    height: share
      ? Math.max(1, clip(share.height * info.height, info.height - y))
      : info.height,
  };
  const whole = region.width === info.width && region.height === info.height;
  if (!whole && !info.regionByPx) return null;
  if (info.sizeByW) {
    let scale = Math.min(1, size / Math.max(region.width, region.height));
    if (info.maxWidth) scale = Math.min(scale, info.maxWidth / region.width);
    if (info.maxHeight) scale = Math.min(scale, info.maxHeight / region.height);
    if (info.maxArea)
      scale = Math.min(
        scale,
        Math.sqrt(info.maxArea / (region.width * region.height)),
      );
    return imageRequestUrl(
      info,
      region,
      Math.max(1, Math.floor(region.width * scale)),
      Math.max(1, Math.floor(region.height * scale)),
    );
  }
  if (!whole) return null;
  const sizes = [...info.sizes].sort((a, b) => a.width - b.width);
  const pick = sizes.find((s) => Math.max(s.width, s.height) >= size) ??
    sizes.at(-1) ?? { width: info.width, height: info.height };
  return imageRequestUrl(info, region, pick.width, pick.height);
}
