import React from "react";

import type { Georeference } from "../../core/geo";
import type { CloverRequest } from "../../core/request";
import type { ThumbnailSource } from "../../core/thumbnail";
import { findImageServiceId } from "../../lib/renderer/sources/imageService";
import { EntryThumbnail } from "../../ui/EntryThumbnail";

/**
 * A georeferenced image's picture in the map's list, as an annotation's region shows
 * beside its words (`ui/EntryThumbnail`). Its own module, loaded by `MapView` only for a
 * map with an overlay listed.
 */
export default function OverlayPicture({
  overlay,
  request,
}: {
  overlay: Georeference;
  request?: CloverRequest;
}) {
  return <EntryThumbnail source={overlayPicture(overlay)} request={request} />;
}

/**
 * An overlay's picture in the list: its image service's, cut to the part that is map (its
 * mask's box, as shares of the image, so a service that serves another size cuts the same
 * part), asked small as its own `info.json` allows (`EntryThumbnail`, as an annotation's
 * region is), else the whole image at a size it lists. None without a service: the image
 * alone may be the whole scan.
 */
function overlayPicture(item: Georeference): ThumbnailSource | null {
  const service = findImageServiceId(
    (item.image as Record<string, unknown>).service,
  );
  if (!service) return null;
  if (!item.mask) return { service };
  const xs = item.mask.map(([x]) => x);
  const ys = item.mask.map(([, y]) => y);
  const [left, top] = [
    Math.max(0, Math.min(...xs)),
    Math.max(0, Math.min(...ys)),
  ];
  const [right, bottom] = [
    Math.min(item.width, Math.max(...xs)),
    Math.min(item.height, Math.max(...ys)),
  ];
  if (!(right > left && bottom > top)) return { service };
  return {
    service,
    // A server that cannot cut it (level 0) gives the whole sheet, at a size it lists.
    orWhole: true,
    region: {
      x: left / item.width,
      y: top / item.height,
      width: (right - left) / item.width,
      height: (bottom - top) / item.height,
    },
  };
}
