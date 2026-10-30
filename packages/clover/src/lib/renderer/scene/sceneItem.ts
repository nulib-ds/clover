import type { LoadedImage } from "../io/decode";
import type { TileCache } from "../io/TileCache";
import {
  type Affine,
  apply,
  compose,
  invert,
  scale,
  translate,
} from "../math/affine";
import { type Rect, transformRect, union } from "../math/rect";
import { type Rotation, parseRegion, parseRotation } from "./regions";
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
   * Turn the part shown, as the Image API's rotation writes it: degrees clockwise, after a
   * mirror where it starts with `!` (an `ImageApiSelector`'s `rotation`, Cookbook 0040).
   * Turned here, from the tiles as they are, never asked of the server, whose `info.json`
   * may not offer it; the turned picture's bounding box fills `placement`.
   */
  rotation?: string;
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
  /**
   * A video, shown as itself in the DOM layer with the camera's transform; or an element
   * of text an animation paints (Cookbook 0489), laid out in the Canvas's units.
   */
  media?: { element: HTMLVideoElement | HTMLElement };
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
  /** Where `rotation` turns it: how, and the turned picture's size. */
  turn?: Turn;
}

/**
 * A turned picture: full-size image pixels → its own (its bounding box, from 0,0), the way
 * back, and its size there, in full-size image pixels.
 */
export interface Turn {
  orient: Affine;
  unorient: Affine;
  width: number;
  height: number;
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

  const rotation = parseRotation(spec.rotation);
  const turn = rotation ? turnOf(clip, rotation) : undefined;
  const item: SceneItem = {
    id: spec.id,
    spec,
    pyramid,
    size,
    clip,
    contentClip,
    rect: { x: 0, y: 0, width: contentClip.width, height: contentClip.height },
    ...(turn ? { turn } : {}),
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
    spec.width ||
    spec.placement?.width ||
    (media.element as HTMLVideoElement).videoWidth ||
    1600;
  const height =
    spec.height ||
    spec.placement?.height ||
    (media.element as HTMLVideoElement).videoHeight ||
    900;
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

/** A clip turned about its middle, mirrored first where asked, into its bounding box. */
export function turnOf(clip: RegionRect, { degrees, mirror }: Rotation): Turn {
  const radians = (degrees * Math.PI) / 180;
  // A quarter turn exactly, not 6e-17 off it.
  const exact = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);
  const cos = exact(Math.cos(radians));
  const sin = exact(Math.sin(radians));
  const width = Math.abs(clip.width * cos) + Math.abs(clip.height * sin);
  const height = Math.abs(clip.width * sin) + Math.abs(clip.height * cos);
  const orient = compose(
    translate(width / 2, height / 2),
    { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 },
    scale(mirror ? -1 : 1, 1),
    translate(-(clip.x + clip.width / 2), -(clip.y + clip.height / 2)),
  );
  return { orient, unorient: invert(orient)!, width, height };
}

/** Full-size image pixels → the picture as shown, from 0,0: its clip, turned where asked. */
export function orientOf(item: SceneItem): Affine {
  return item.turn?.orient ?? translate(-item.clip.x, -item.clip.y);
}

/**
 * A rectangle of the picture as shown (from 0,0) → the full-size image pixels under it:
 * where it is turned, their bounding box, inside the clip.
 */
export function shownToPixels(item: SceneItem, rect: Rect): RegionRect {
  const { turn, clip } = item;
  if (!turn) return { ...rect, x: clip.x + rect.x, y: clip.y + rect.y };
  const box = transformRect(turn.unorient, rect);
  const x = Math.max(box.x, clip.x);
  const y = Math.max(box.y, clip.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(box.x + box.width, clip.x + clip.width) - x),
    height: Math.max(0, Math.min(box.y + box.height, clip.y + clip.height) - y),
  };
}

/** A point of the picture as shown (from 0,0) → the full-size image pixel under it. */
export function shownPointToPixels(
  item: SceneItem,
  point: { x: number; y: number },
): { x: number; y: number } {
  const { turn, clip } = item;
  return turn
    ? apply(turn.unorient, point)
    : { x: clip.x + point.x, y: clip.y + point.y };
}

/** The picture as shown, in the image's own coordinates: its clip, or its turned one's box. */
function shownContent(item: SceneItem): { width: number; height: number } {
  const { turn, clip, contentClip } = item;
  if (!turn) return contentClip;
  return {
    width: (turn.width * contentClip.width) / clip.width,
    height: (turn.height * contentClip.height) / clip.height,
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
  const height = shownContent(items[0]).height;
  let x = 0;
  for (const item of items) {
    const shown = shownContent(item);
    const width = (shown.width * height) / shown.height;
    item.rect = { x, y: 0, width, height };
    x += width;
  }
  return { x: 0, y: 0, width: x, height };
}

/** Full-size image pixels, as shown (turned where it is), → world units, per axis. */
export function pixelsToWorld(item: SceneItem): { x: number; y: number } {
  const shown = item.turn ?? item.clip;
  return {
    x: item.rect.width / shown.width,
    y: item.rect.height / shown.height,
  };
}

/** Full-size image pixels → world units: the picture as shown, filling its place. */
export function itemToWorld(item: SceneItem): Affine {
  const k = pixelsToWorld(item);
  return compose(
    translate(item.rect.x, item.rect.y),
    scale(k.x, k.y),
    orientOf(item),
  );
}

/** Whether two specs describe the same picture, so a prepared item can be kept. */
export function sameSpec(a: SceneImage, b: SceneImage): boolean {
  return (
    a.service === b.service &&
    a.url === b.url &&
    a.width === b.width &&
    a.height === b.height &&
    a.region === b.region &&
    a.rotation === b.rotation &&
    a.media?.element === b.media?.element &&
    JSON.stringify(a.placement) === JSON.stringify(b.placement)
  );
}
