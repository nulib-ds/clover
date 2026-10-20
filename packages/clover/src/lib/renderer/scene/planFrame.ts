import {
  type CameraState,
  type ViewportSize,
  visibleWorldRect,
  worldToScreen,
} from "../camera/Camera";
import type { LoadedImage } from "../io/decode";
import type { TileWant } from "../io/TileCache";
import { type Affine, compose, scale, translate } from "../math/affine";
import { type Rect, intersects } from "../math/rect";
import { type SceneItem, pixelsToWorld } from "./sceneItem";
import type { RegionRect } from "../sources/imageService";
import {
  type TileAddress,
  chooseLevel,
  tilesInRegion,
} from "../sources/tilePyramid";

/** One tile to draw this frame, ready for a backend or a DOM layer. */
export interface PlannedDraw {
  item: SceneItem;
  url: string;
  image: LoadedImage;
  /** Source pixels → stage CSS pixels. */
  transform: Affine;
  /** The part of the source inside the item's clip, in source pixels. */
  crop: Rect;
  bleed: { right: boolean; bottom: boolean };
}

export interface FramePlan {
  /** In paint order: coarse before fine, item by item. */
  draws: PlannedDraw[];
  /** What the tile cache should be fetching, highest priority first. */
  wants: TileWant[];
  /** The level chosen per item, for diagnostics. */
  levels: number[];
}

export interface PlanInput {
  items: SceneItem[];
  camera: CameraState;
  viewport: ViewportSize;
  pixelRatio: number;
  getTile: (url: string) => LoadedImage | undefined;
  /** Also want every coarsest-level tile (the navigator shows the whole image). */
  wantOverview?: boolean;
  /**
   * Where the camera is heading, while it animates. Full-resolution tiles are then wanted
   * for the landing view, and the views passed through on the way get a coarser level.
   */
  destination?: CameraState;
}

/**
 * Priority bands: coarse tiles under the view, then the target level, then the coarser
 * tiles for a view passed through mid-animation, then the overview.
 */
const TARGET_BAND = 1e7;
const IN_FLIGHT_BAND = 1.5e7;
const OVERVIEW_BAND = 2e7;

/**
 * How many levels coarser than its target a view passed through mid-animation is fetched
 * at: a sixteenth of the tiles, enough for a picture in motion.
 */
const IN_FLIGHT_LEVELS = 2;

/** The part of an item a camera sees, the level that fits it, and where it looks. */
interface ItemView {
  /** The visible part of the item, in full-size image pixels. */
  area: RegionRect;
  /** The camera's center, in full-size image pixels. */
  center: { x: number; y: number };
  target: number;
}

/**
 * Decide one frame: which tiles to draw, and which to fetch.
 *
 * Pure — no DOM, no I/O — so it is the renderer's main test seam.
 *
 * Per item it picks the coarsest pyramid level with at least one level pixel per device
 * pixel, and wants that level's tiles under the view plus the coarsest level's (so there
 * is always *something*). It draws the target level, and when any of its tiles are still
 * missing, every coarser level that has tiles beneath it first — so a gap shows a blurrier
 * picture, never the background.
 *
 * While the camera animates, the target level is wanted for where it will land, not for
 * each view on the way: those would be superseded within a few frames, and on a fast link
 * would all be fetched, decoded and uploaded first. Views on the way get the coarsest
 * level and one `IN_FLIGHT_LEVELS` coarser than their target. Draws are always of the
 * current view, from whatever is loaded.
 */
export function planFrame(input: PlanInput): FramePlan {
  const { items, camera, viewport, pixelRatio, getTile, destination } = input;
  const view = worldToScreen(camera, viewport);
  const draws: PlannedDraw[] = [];
  const wants: TileWant[] = [];
  const levels: number[] = [];

  const want = (
    pyramid: SceneItem["pyramid"],
    address: TileAddress,
    priority: number,
  ) => {
    const tile = pyramid.tile(address);
    wants.push({ url: tile.url, fallbackUrl: tile.fallbackUrl, priority });
  };

  for (const item of items) {
    const { pyramid, clip, rect } = item;
    const k = pixelsToWorld(item);

    if (input.wantOverview) {
      for (const address of tilesInRegion(pyramid, 0, clip)) {
        want(pyramid, address, OVERVIEW_BAND);
      }
    }

    const here = itemView(item, camera, viewport, pixelRatio);
    const there = destination
      ? itemView(item, destination, viewport, pixelRatio)
      : here;
    levels.push(here?.target ?? -1);
    if (!here && !there) continue;

    const distanceFrom =
      (center: { x: number; y: number }) => (address: TileAddress) => {
        const r = pyramid.tile(address).region;
        return Math.hypot(
          r.x + r.width / 2 - center.x,
          r.y + r.height / 2 - center.y,
        );
      };

    // Where the camera lands: the coarsest level, then the target level.
    if (there) {
      const distance = distanceFrom(there.center);
      for (const address of tilesInRegion(pyramid, 0, there.area)) {
        want(pyramid, address, distance(address) / 1e3);
      }
      if (there.target > 0) {
        for (const address of tilesInRegion(
          pyramid,
          there.target,
          there.area,
        )) {
          want(pyramid, address, TARGET_BAND + distance(address));
        }
      }
    }
    if (!here) continue;

    const { area, target } = here;
    const distance = distanceFrom(here.center);
    const coarse = tilesInRegion(pyramid, 0, area);
    const fine = target === 0 ? [] : tilesInRegion(pyramid, target, area);
    if (there !== here) {
      // Passing through: the coarsest level, and a level a little short of the target.
      for (const address of coarse) {
        want(pyramid, address, distance(address) / 1e3);
      }
      const inFlight = target - IN_FLIGHT_LEVELS;
      if (inFlight > 0) {
        for (const address of tilesInRegion(pyramid, inFlight, area)) {
          want(pyramid, address, IN_FLIGHT_BAND + distance(address));
        }
      }
    }

    // A hidden item keeps its tiles coming, so it is ready to show, but is not painted.
    if (item.spec.hidden) continue;

    // Paint coarse to fine. When the target level is complete, it alone is enough.
    const targetTiles = target === 0 ? coarse : fine;
    const complete = targetTiles.every(
      (a) => getTile(pyramid.tile(a).url) !== undefined,
    );
    const paintLevels = complete
      ? [target]
      : Array.from({ length: target + 1 }, (_, i) => i);

    const itemToScreen = compose(
      view,
      translate(rect.x, rect.y),
      scale(k.x, k.y),
      translate(-clip.x, -clip.y),
    );

    for (const level of paintLevels) {
      const addresses =
        level === 0
          ? coarse
          : level === target
            ? fine
            : tilesInRegion(pyramid, level, area);
      const multiTile =
        pyramid.levels[level].cols * pyramid.levels[level].rows > 1;
      for (const address of addresses) {
        const tile = pyramid.tile(address);
        const image = getTile(tile.url);
        if (!image) continue;
        const draw = placeTile(
          item,
          tile.region,
          image,
          itemToScreen,
          multiTile,
        );
        if (draw) draws.push({ ...draw, url: tile.url });
      }
    }
  }

  wants.sort((a, b) => a.priority - b.priority);
  return { draws, wants: dedupeWants(wants), levels };
}

/** What `camera` sees of `item`, or null when the item is out of its view. */
function itemView(
  item: SceneItem,
  camera: CameraState,
  viewport: ViewportSize,
  pixelRatio: number,
): ItemView | null {
  const { pyramid, clip, rect } = item;
  const visible = visibleWorldRect(camera, viewport);
  if (!intersects(visible, rect)) return null;
  const k = pixelsToWorld(item);
  const x0 = Math.max(visible.x, rect.x);
  const y0 = Math.max(visible.y, rect.y);
  const x1 = Math.min(visible.x + visible.width, rect.x + rect.width);
  const y1 = Math.min(visible.y + visible.height, rect.y + rect.height);
  // Full-size image pixels under one device pixel.
  const imagePerDevice = 1 / (k.x * camera.zoom * pixelRatio);
  return {
    area: {
      x: clip.x + (x0 - rect.x) / k.x,
      y: clip.y + (y0 - rect.y) / k.y,
      width: (x1 - x0) / k.x,
      height: (y1 - y0) / k.y,
    },
    center: {
      x: clip.x + (camera.x - rect.x) / k.x,
      y: clip.y + (camera.y - rect.y) / k.y,
    },
    target: chooseLevel(pyramid, imagePerDevice),
  };
}

function placeTile(
  item: SceneItem,
  region: RegionRect,
  image: LoadedImage,
  itemToScreen: Affine,
  multiTile: boolean,
): Omit<PlannedDraw, "url"> | null {
  const { clip } = item;
  // Only the part of the tile inside the clip.
  const ix0 = Math.max(region.x, clip.x);
  const iy0 = Math.max(region.y, clip.y);
  const ix1 = Math.min(region.x + region.width, clip.x + clip.width);
  const iy1 = Math.min(region.y + region.height, clip.y + clip.height);
  if (ix1 <= ix0 || iy1 <= iy0) return null;

  const sx = image.width / region.width;
  const sy = image.height / region.height;
  const eps = 1e-6;

  return {
    item,
    image,
    transform: compose(
      itemToScreen,
      translate(region.x, region.y),
      scale(1 / sx, 1 / sy),
    ),
    crop: {
      x: (ix0 - region.x) * sx,
      y: (iy0 - region.y) * sy,
      width: (ix1 - ix0) * sx,
      height: (iy1 - iy0) * sy,
    },
    bleed: {
      right: multiTile && ix1 < clip.x + clip.width - eps,
      bottom: multiTile && iy1 < clip.y + clip.height - eps,
    },
  };
}

function dedupeWants(wants: TileWant[]): TileWant[] {
  const seen = new Set<string>();
  return wants.filter((want) => {
    if (seen.has(want.url)) return false;
    seen.add(want.url);
    return true;
  });
}
