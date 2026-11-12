import type { Georeference } from "../../core/geo";
import type { ItemModel } from "../../core/items";
import type { ThumbnailSource } from "../../core/thumbnail";
import { type LanguageMapLike, localize } from "../../core/value";
import { findImageServiceId } from "../../lib/renderer/sources/imageService";

/**
 * Georeferenced images as Items' items: what the Map's own list (`MapItems`) and Items'
 * `of="georeferences"` (`Items/GeoreferenceItems`) both list, so the two read alike. Loaded
 * only with one of them.
 */

/** The part of an overlay's image that is map: its mask's box, else all of it. */
function cutOf(overlay: Georeference) {
  const whole = { x: 0, y: 0, width: overlay.width, height: overlay.height };
  if (!overlay.mask) return whole;
  const xs = overlay.mask.map(([x]) => x);
  const ys = overlay.mask.map(([, y]) => y);
  const [left, top] = [
    Math.max(0, Math.min(...xs)),
    Math.max(0, Math.min(...ys)),
  ];
  const [right, bottom] = [
    Math.min(overlay.width, Math.max(...xs)),
    Math.min(overlay.height, Math.max(...ys)),
  ];
  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : whole;
}

/**
 * An overlay's picture: its image service's, cut to the part that is map (its mask's box,
 * as shares of the image, so a service that serves another size cuts the same part), asked
 * small as its own `info.json` allows; where the server cannot cut (level 0), the whole
 * image at a size it lists. None without a service: the image alone may be the whole scan.
 */
export function overlayPicture(overlay: Georeference): ThumbnailSource | null {
  const service = findImageServiceId(
    (overlay.image as Record<string, unknown>).service,
  );
  if (!service) return null;
  const cut = cutOf(overlay);
  if (cut.width === overlay.width && cut.height === overlay.height)
    return { service };
  return {
    service,
    orWhole: true,
    region: {
      x: cut.x / overlay.width,
      y: cut.y / overlay.height,
      width: cut.width / overlay.width,
      height: cut.height / overlay.height,
    },
  };
}

/**
 * Overlays as items, each keyed `prefix` and its id: named by its label, those of one name
 * told apart by their place among it, as figures ("Sheet 21 2 / 3"), and one with no label
 * by `untitled` (its place in the list); its picture the map it is, its box that shape.
 */
export function overlayItems(
  overlays: Georeference[],
  language: string | undefined,
  untitled: (index: number) => { text: string; lang?: string },
  prefix = "",
): ItemModel[] {
  const names = overlays.map((overlay) => localize(overlay.label, language));
  return overlays.map((overlay, index) => {
    const name = names[index];
    const same = name.text
      ? names.flatMap((other, at) => (other.text === name.text ? [at] : []))
      : [];
    const text = name.text
      ? same.length > 1
        ? `${name.text} ${same.indexOf(index) + 1} / ${same.length}`
        : name.text
      : untitled(index).text;
    const lang = name.text ? name.lang : untitled(index).lang;
    const label: LanguageMapLike = { [lang ?? "none"]: [text] };
    const cut = cutOf(overlay);
    return {
      id: `${prefix}${overlay.id}`,
      label,
      parts: [
        {
          id: overlay.id,
          type: "Image",
          label,
          // Its box the shape of what it shows, so nothing moves as its picture arrives.
          resource: {
            id: overlay.canvasId ?? overlay.id,
            width: cut.width,
            height: cut.height,
          },
          source: overlayPicture(overlay),
        },
      ],
    };
  });
}
