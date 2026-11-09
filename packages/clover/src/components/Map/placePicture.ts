import { loadManifest } from "../../core/load";
import type { CloverRequest } from "../../core/request";
import { resolveThumbnail, thumbnailSource } from "../../core/thumbnail";

/**
 * A place's picture, at about `size` pixels on its longer side, from what its feature
 * says it is made of (`pictureOf`, `core/geo.ts`): its owner's `thumbnail`, else its first
 * image, sized as Items' are, only as its service's own `info.json` allows
 * (`resolveThumbnail`). A Collection's member not yet loaded is loaded now, as the Root
 * loads one (`loadManifest`), once, for the place named (Mat, 2026-11-08: "I see image
 * services on the manifest"). Loaded with the map's popover, as it first names a place
 * that has one.
 */
export async function placePicture(
  picture: Record<string, any>,
  size: number,
  request?: CloverRequest,
): Promise<string | undefined> {
  let resource: unknown = picture;
  if (picture.type === "Manifest" && !picture.items) {
    const manifest = (await loadManifest(picture, { request })) as Record<
      string,
      any
    >;
    resource = manifest.thumbnail ? manifest : manifest.items?.[0];
  }
  const source = thumbnailSource(resource);
  return source ? resolveThumbnail(source, size, request) : undefined;
}
