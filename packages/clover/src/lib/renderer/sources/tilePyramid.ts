import {
  type ImageServiceInfo,
  type RegionRect,
  alternateQuality,
  imageRequestUrl,
} from "./imageService";

/**
 * One resolution of an image, cut into a grid of tiles.
 *
 * `scaleFactor` is full-size pixels per level pixel, so 1 is full resolution and larger is
 * coarser. Every source is a pyramid, even when it has one level of one tile: a static
 * image, or a level 0 service that only lists `sizes`. One level-choice rule then serves
 * them all.
 */
export interface PyramidLevel {
  scaleFactor: number;
  /** Level size in its own pixels. */
  width: number;
  height: number;
  /** Tile size in level pixels. */
  tileWidth: number;
  tileHeight: number;
  cols: number;
  rows: number;
}

export interface TileAddress {
  level: number;
  col: number;
  row: number;
}

export interface TileRequest extends TileAddress {
  url: string;
  /** A second spelling to try once if `url` fails (level 0 `native` quality). */
  fallbackUrl?: string;
  /** The tile's area, in full-size image pixels. */
  region: RegionRect;
}

export interface TilePyramid {
  /** Full-size image pixels. */
  width: number;
  height: number;
  /** Coarsest first. */
  levels: PyramidLevel[];
  tile(address: TileAddress): TileRequest;
}

/** Edge length of tiles Clover cuts itself from a service that lists none. */
export const DERIVED_TILE_SIZE = 512;
/** The largest full-size image a level 0 service is asked for in one piece. */
const MAX_SINGLE_IMAGE_PIXELS = 16_000_000;

/** A static image: one level, one tile, at its own URL. */
export function staticPyramid(
  url: string,
  width: number,
  height: number,
): TilePyramid {
  const level: PyramidLevel = {
    scaleFactor: 1,
    width,
    height,
    tileWidth: width,
    tileHeight: height,
    cols: 1,
    rows: 1,
  };
  return {
    width,
    height,
    levels: [level],
    tile: (address) => ({
      ...address,
      url,
      region: { x: 0, y: 0, width, height },
    }),
  };
}

/**
 * The pyramid an image service supports, from what its `info.json` lists and what its
 * compliance level promises.
 */
export function servicePyramid(info: ImageServiceInfo): TilePyramid {
  const { width: W, height: H } = info;
  const levels: Array<PyramidLevel & { whole?: boolean }> = [];
  const arbitrary = info.regionByPx && info.sizeByW;

  const tileLevel = (s: number, tw: number, th: number): PyramidLevel => {
    const width = Math.ceil(W / s);
    const height = Math.ceil(H / s);
    return {
      scaleFactor: s,
      width,
      height,
      tileWidth: tw,
      tileHeight: th,
      cols: Math.ceil(width / tw),
      rows: Math.ceil(height / th),
    };
  };

  /** A whole image delivered at one size: a level of a single tile. */
  const wholeLevel = (width: number, height: number) => ({
    scaleFactor: W / width,
    width,
    height,
    tileWidth: width,
    tileHeight: height,
    cols: 1,
    rows: 1,
    whole: true,
  });

  const spec = info.tiles[0];
  if (spec) {
    for (const s of spec.scaleFactors) {
      levels.push(tileLevel(s, spec.width, spec.height));
    }
  } else if (arbitrary) {
    // Level 1 and 2 omit `tiles` and still serve any region: cut our own.
    for (let s = 1; ; s *= 2) {
      const level = tileLevel(s, DERIVED_TILE_SIZE, DERIVED_TILE_SIZE);
      levels.push(level);
      if (level.cols === 1 && level.rows === 1) break;
    }
  }

  // Listed sizes are promised even at level 0. Coarser than any tile level, they make the
  // first picture a single small request.
  const coarsestTile = Math.max(0, ...levels.map((l) => l.scaleFactor));
  for (const size of info.sizes) {
    const s = W / size.width;
    if (!withinLimits(info, size.width, size.height)) continue;
    if (s > coarsestTile + 1e-9)
      levels.push(wholeLevel(size.width, size.height));
  }

  // A tiled service whose coarsest level is still several tiles, and which lists no sizes,
  // gets one whole-image thumbnail of its own — if it honors arbitrary sizes.
  const coarsest = levels.reduce<PyramidLevel | null>(
    (best, l) => (!best || l.scaleFactor > best.scaleFactor ? l : best),
    null,
  );
  if (coarsest && coarsest.cols * coarsest.rows > 1 && info.sizeByW) {
    const s = Math.max(W, H) / DERIVED_TILE_SIZE;
    levels.push(wholeLevel(Math.ceil(W / s), Math.ceil(H / s)));
  }

  // Nothing tiled and nothing listed: the full image is all a level 0 server must serve.
  if (
    !levels.length ||
    (!spec && !arbitrary && W * H <= MAX_SINGLE_IMAGE_PIXELS)
  ) {
    if (!levels.some((l) => l.scaleFactor === 1)) levels.push(wholeLevel(W, H));
  }

  const ordered = dedupe(levels).sort((a, b) => b.scaleFactor - a.scaleFactor);
  const fallbackQuality = alternateQuality(info);

  return {
    width: W,
    height: H,
    levels: ordered,
    tile(address) {
      const level = ordered[address.level];
      const s = level.scaleFactor;
      const isWhole = level.cols === 1 && level.rows === 1;

      let region: RegionRect;
      let w: number;
      let h: number;
      if (isWhole) {
        region = { x: 0, y: 0, width: W, height: H };
        w = level.width;
        h = level.height;
      } else {
        const x = Math.round(address.col * level.tileWidth * s);
        const y = Math.round(address.row * level.tileHeight * s);
        region = {
          x,
          y,
          width: Math.min(Math.round(level.tileWidth * s), W - x),
          height: Math.min(Math.round(level.tileHeight * s), H - y),
        };
        // "The size of the tile is the region size divided by the scale factor, rounded up."
        w = Math.ceil(region.width / s);
        h = Math.ceil(region.height / s);
      }

      return {
        ...address,
        region,
        url: imageRequestUrl(info, region, w, h),
        fallbackUrl: fallbackQuality
          ? imageRequestUrl(info, region, w, h, fallbackQuality)
          : undefined,
      };
    },
  };
}

function withinLimits(info: ImageServiceInfo, w: number, h: number): boolean {
  if (info.maxWidth && w > info.maxWidth) return false;
  if (info.maxHeight && h > info.maxHeight) return false;
  if (info.maxArea && w * h > info.maxArea) return false;
  return true;
}

function dedupe<T extends PyramidLevel>(levels: T[]): T[] {
  const seen = new Map<string, T>();
  for (const level of levels) {
    const key = `${level.width}x${level.height}`;
    const existing = seen.get(key);
    // Prefer the tiled form of a resolution over a whole-image request of the same size.
    if (!existing || existing.cols * existing.rows < level.cols * level.rows) {
      seen.set(key, level);
    }
  }
  return [...seen.values()];
}

/**
 * The coarsest level that still has at least one level pixel per device pixel — or the
 * finest level, when even that is not enough.
 *
 * @param imagePixelsPerDevicePixel full-size image pixels spanned by one device pixel
 */
export function chooseLevel(
  pyramid: TilePyramid,
  imagePixelsPerDevicePixel: number,
): number {
  const levels = pyramid.levels;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i].scaleFactor <= imagePixelsPerDevicePixel * (1 + 1e-6)) {
      return i;
    }
  }
  return levels.length - 1;
}

/** Tiles of `level` that intersect `area` (full-size image pixels). */
export function tilesInRegion(
  pyramid: TilePyramid,
  level: number,
  area: RegionRect,
): TileAddress[] {
  const l = pyramid.levels[level];
  const spanX = l.tileWidth * l.scaleFactor;
  const spanY = l.tileHeight * l.scaleFactor;
  const x0 = Math.max(0, area.x);
  const y0 = Math.max(0, area.y);
  const x1 = Math.min(pyramid.width, area.x + area.width);
  const y1 = Math.min(pyramid.height, area.y + area.height);
  if (x1 <= x0 || y1 <= y0) return [];

  const c0 = Math.max(0, Math.floor(x0 / spanX));
  const c1 = Math.min(l.cols - 1, Math.floor((x1 - 1e-9) / spanX));
  const r0 = Math.max(0, Math.floor(y0 / spanY));
  const r1 = Math.min(l.rows - 1, Math.floor((y1 - 1e-9) / spanY));

  const tiles: TileAddress[] = [];
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) tiles.push({ level, col, row });
  }
  return tiles;
}
