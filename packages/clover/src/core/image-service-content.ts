import {
  imageRequestUrl,
  type ImageServiceInfo,
  parseInfo,
} from "../lib/renderer/sources/imageService";
import type { Loaded } from "./load";
import { type Manifest, toPresentation4 } from "./presentation";

/**
 * A IIIF Image service as the content: its `info.json`, given or fetched, shown as the one
 * image it is. Image API 2 and 3 alike. Wrapped as a Manifest of one Canvas the size of
 * the image, painted by it, with no label, so a Body draws the image and a Label draws
 * nothing. Its own module, loaded only for such content, so no other page carries it.
 *
 * Every request it spells is one the service's own `info.json` allows (`fittedSize`).
 */

/**
 * The largest size of the whole image the service will deliver: the full size where its
 * limits allow it, else the largest it lists, else (where it takes any size) the full
 * size scaled into its limits. A level 0 service without `sizes` delivers only the full.
 */
export function fittedSize(info: ImageServiceInfo): {
  width: number;
  height: number;
} {
  const { width, height, maxWidth, maxHeight, maxArea } = info;
  const fits = (w: number, h: number) =>
    (!maxWidth || w <= maxWidth) &&
    (!maxHeight || h <= maxHeight) &&
    (!maxArea || w * h <= maxArea);
  if (fits(width, height)) return { width, height };
  const listed = info.sizes.filter((size) => fits(size.width, size.height));
  if (listed.length) return listed[listed.length - 1];
  if (!info.sizeByW) return { width, height };
  const scale = Math.min(
    maxWidth ? maxWidth / width : 1,
    maxHeight ? maxHeight / height : 1,
    maxArea ? Math.sqrt(maxArea / (width * height)) : 1,
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

/** The smallest listed size at least `edge` on its longer side, for the thumbnail. */
function thumbnailSize(info: ImageServiceInfo, edge = 200) {
  return (
    info.sizes.find((size) => Math.max(size.width, size.height) >= edge) ??
    fittedSize(info)
  );
}

const FORMATS: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** The image at `size`, as a Presentation 3 Image body with its service. */
function imageBody(
  info: ImageServiceInfo,
  service: Record<string, unknown>,
  size: { width: number; height: number },
) {
  const whole = { x: 0, y: 0, width: info.width, height: info.height };
  return {
    id: imageRequestUrl(info, whole, size.width, size.height),
    type: "Image",
    format: FORMATS[info.format] ?? "image/jpeg",
    width: size.width,
    height: size.height,
    service: [service],
  };
}

/** The service as a Presentation 3 `service` entry: its id, type and profile. */
function serviceEntry(doc: Record<string, any>, info: ImageServiceInfo) {
  if (info.version === 3) {
    return {
      id: info.id,
      type: "ImageService3",
      profile: typeof doc.profile === "string" ? doc.profile : "level0",
    };
  }
  const profile = ([] as unknown[])
    .concat(doc.profile ?? [])
    .find((value) => typeof value === "string");
  return {
    "@id": info.id,
    "@type": "ImageService2",
    profile: profile ?? "http://iiif.io/api/image/2/level0.json",
  };
}

/**
 * The service as a Manifest of one Canvas. The Manifest's id is the service's, so a
 * content state written of it (`partOf`) opens the same image again; its Canvas's is
 * made from it. What `info.json` says of rights (Image 3's `rights`, Image 2's `license`
 * and `attribution`) is kept; nothing is said of the image that the service does not.
 */
export async function imageServiceContent(
  json: Record<string, any>,
  requestedId?: string,
): Promise<Loaded> {
  const info = parseInfo(json, requestedId);
  const service = serviceEntry(json, info);
  const canvasId = `${info.id}/canvas`;
  const rights = [json.rights, json.license]
    .flat()
    .find((value) => typeof value === "string");
  const attribution = json.attribution;

  const manifest: Record<string, unknown> = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: info.id,
    type: "Manifest",
    label: { none: [""] },
    thumbnail: [imageBody(info, service, thumbnailSize(info))],
    items: [
      {
        id: canvasId,
        type: "Canvas",
        width: info.width,
        height: info.height,
        items: [
          {
            id: `${canvasId}/page`,
            type: "AnnotationPage",
            items: [
              {
                id: `${canvasId}/page/image`,
                type: "Annotation",
                motivation: "painting",
                body: imageBody(info, service, fittedSize(info)),
                target: canvasId,
              },
            ],
          },
        ],
      },
    ],
  };
  if (rights) manifest.rights = rights;
  if (attribution) {
    manifest.requiredStatement = {
      label: { en: ["Attribution"] },
      value: {
        none: ([] as unknown[])
          .concat(attribution)
          .map((value: any) =>
            typeof value === "string" ? value : String(value?.["@value"] ?? ""),
          )
          .filter(Boolean),
      },
    };
  }
  return { manifest: await toPresentation4<Manifest>(manifest) };
}
