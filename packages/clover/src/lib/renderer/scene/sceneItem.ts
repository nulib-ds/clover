import type { LoadedImage } from "../io/decode";
import type { TileCache } from "../io/TileCache";
import { type Rect, union } from "../math/rect";
import { parseRegion } from "./regions";
import {
  type FetchInfoOptions,
  type RegionRect,
  fetchInfo,
} from "../sources/imageService";
import {
  type TilePyramid,
  servicePyramid,
  staticPyramid,
  tilesInRegion,
} from "../sources/tilePyramid";

/** One image in the scene, as the caller describes it. */
export interface SceneImage {
  /** Stable identity; reusing an id across `setImages` calls keeps the prepared item. */
  id: string;
  /** A IIIF Image API service: its base URI or its `info.json`. Preferred over `url`. */
  service?: string;
  /**
   * A static image. With a `service` too, it is the fallback if the service cannot be
   * reached.
   */
  url?: string;
  /**
   * The image's size in its own coordinates, when known (a IIIF body's `width`/`height`).
   * World units are then those coordinates even when a smaller derivative is what is
   * drawn, so a region read off the camera is a valid `xywh=` for the resource.
   */
  width?: number;
  height?: number;
  /** Show only this part: `x,y,w,h` or `pct:x,y,w,h`, in the coordinates above. */
  region?: string;
  /**
   * Where the image goes in the world, scaled to fill it — a painting annotation's
   * target on its Canvas. Without one, images are laid side by side.
   */
  placement?: Rect;
  /**
   * A video (or a sound played through one) instead of an image. Its frames are drawn
   * where `placement` puts them: as a positioned `<video>` the browser composites
   * (`dom`, the default), or uploaded to the GPU each frame (`texture`), which needs
   * CORS. Sound shows its element as a video does; it simply has no picture.
   */
  /** A video, shown as itself in the DOM layer with the camera's transform. */
  media?: { element: HTMLVideoElement };
  /**
   * Kept, with its tiles loaded, but not drawn: the frames of an animation not showing.
   * Not part of the image's identity, so changing it (`setHidden`) never prepares it
   * again; the frame is ready the instant it shows.
   */
  hidden?: boolean;
}

/** A scene image, resolved: its pyramid, its clip, and where it sits in the world. */
export interface SceneItem {
  id: string;
  spec: SceneImage;
  pyramid: TilePyramid;
  /** For a media item: its element, as a drawable source. */
  media?: LoadedImage;
  /** The image's own coordinate space: its declared size, or its full pixel size. */
  size: { width: number; height: number };
  /** The part shown, in full-size image pixels. */
  clip: RegionRect;
  /** The same part in the image's own coordinates — what annotations target. */
  contentClip: RegionRect;
  /** Where it sits in the world. Set by `layoutItems`. */
  rect: Rect;
}

export interface PrepareContext {
  cache: TileCache;
  loadStatic: (url: string) => Promise<LoadedImage>;
  infoOptions?: FetchInfoOptions;
}

/**
 * Resolve an image and fetch its coarsest tiles, so the item can be drawn the moment it
 * replaces whatever was on screen.
 */
export async function prepareItem(
  spec: SceneImage,
  context: PrepareContext,
): Promise<SceneItem> {
  if (spec.media) return prepareMedia(spec, spec.media);

  let pyramid: TilePyramid | null = null;
  let serviceError: unknown = null;

  if (spec.service) {
    try {
      pyramid = servicePyramid(
        await fetchInfo(spec.service, context.infoOptions),
      );
    } catch (error) {
      serviceError = error;
    }
  }

  if (!pyramid) {
    if (!spec.url) throw serviceError ?? new Error("Image has no source");
    const image = await context.loadStatic(spec.url);
    context.cache.seed(spec.url, image);
    pyramid = staticPyramid(spec.url, image.naturalWidth, image.naturalHeight);
  }

  const size =
    spec.width && spec.height && spec.width > 0 && spec.height > 0
      ? { width: spec.width, height: spec.height }
      : { width: pyramid.width, height: pyramid.height };

  const contentClip = parseRegion(spec.region, size.width, size.height) ?? {
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
  };
  const toPixelsX = pyramid.width / size.width;
  const toPixelsY = pyramid.height / size.height;
  const clip = {
    x: contentClip.x * toPixelsX,
    y: contentClip.y * toPixelsY,
    width: contentClip.width * toPixelsX,
    height: contentClip.height * toPixelsY,
  };

  const item: SceneItem = {
    id: spec.id,
    spec,
    pyramid,
    size,
    clip,
    contentClip,
    rect: { x: 0, y: 0, width: contentClip.width, height: contentClip.height },
  };

  // The coarsest level under the clip: usually one small request.
  await context.cache.prefetch(
    tilesInRegion(pyramid, 0, clip).map((address) => {
      const tile = pyramid!.tile(address);
      return { url: tile.url, fallbackUrl: tile.fallbackUrl };
    }),
  );

  return item;
}

/** Media keys never reach the tile cache: their "tile" is the element itself. */
export const MEDIA_KEY_PREFIX = "media:";

/**
 * A media item: a one-tile pyramid whose tile is the element. Sized by its declared size,
 * or its placement, so it lays out before the element has loaded any metadata.
 */
function prepareMedia(
  spec: SceneImage,
  media: NonNullable<SceneImage["media"]>,
): SceneItem {
  const width =
    spec.width || spec.placement?.width || media.element.videoWidth || 1600;
  const height =
    spec.height || spec.placement?.height || media.element.videoHeight || 900;
  const key = `${MEDIA_KEY_PREFIX}${spec.id}`;
  const size = { width, height };
  const clip = { x: 0, y: 0, width, height };
  return {
    id: spec.id,
    spec,
    pyramid: staticPyramid(key, width, height),
    media: {
      kind: "media",
      source: media.element,
      width,
      height,
      naturalWidth: width,
      naturalHeight: height,
    },
    size,
    clip,
    contentClip: clip,
    rect: { ...clip },
  };
}

/**
 * Side by side, each scaled to the first item's height — the strip OpenSeadragon's
 * multi-image world produced — in the first item's own coordinates.
 */
export function layoutItems(items: SceneItem[]): Rect | null {
  if (!items.length) return null;
  if (items.every((item) => item.spec.placement)) {
    for (const item of items) item.rect = { ...item.spec.placement! };
    return union(items.map((item) => item.rect));
  }
  const height = items[0].contentClip.height;
  let x = 0;
  for (const item of items) {
    const width = (item.contentClip.width * height) / item.contentClip.height;
    item.rect = { x, y: 0, width, height };
    x += width;
  }
  return { x: 0, y: 0, width: x, height };
}

/** Full-size image pixels → world units, per axis. */
export function pixelsToWorld(item: SceneItem): { x: number; y: number } {
  return {
    x: item.rect.width / item.clip.width,
    y: item.rect.height / item.clip.height,
  };
}

/** Whether two specs describe the same picture, so a prepared item can be kept. */
export function sameSpec(a: SceneImage, b: SceneImage): boolean {
  return (
    a.service === b.service &&
    a.url === b.url &&
    a.width === b.width &&
    a.height === b.height &&
    a.region === b.region &&
    a.media?.element === b.media?.element &&
    JSON.stringify(a.placement) === JSON.stringify(b.placement)
  );
}
