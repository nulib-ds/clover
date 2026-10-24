import type { CloverRequest } from "../../core/request";
import {
  fetchInfo,
  findImageServiceId,
} from "../../lib/renderer/sources/imageService";
import { sizedImageUrl } from "../../lib/renderer/sources/sizedImage";

/**
 * The URL of an overlay's image, about `size` pixels on its longer side: asked of its
 * image service as the service's own `info.json` says it can answer (`sizedImageUrl`:
 * never more than the image has, within its limits, at level 0 a size it lists); without
 * a service, or where it cannot answer, the image itself. Loaded only to draw an overlay,
 * so a map with none, and the parts, never load it.
 */
export async function overlayImageUrl(
  image: Record<string, unknown>,
  size: number,
  request: CloverRequest | undefined,
): Promise<string | undefined> {
  const fallback = typeof image.id === "string" ? image.id : undefined;
  const service = findImageServiceId(image.service);
  if (!service) return fallback;
  try {
    const info = await fetchInfo(service, { request });
    return sizedImageUrl(info, size) ?? fallback;
  } catch {
    return fallback;
  }
}
