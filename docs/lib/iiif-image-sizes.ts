/*
 * A thumbnail asked of a IIIF Image server strictly as its `info.json` allows: at a size
 * of its own choosing where its level or features let a client ask for any, else at one
 * it lists, else at a scale its tiles are cut at where the whole image fits in one tile
 * (all a level 0 server may have). Never larger than the image, nor past its limits, and
 * in the canonical form of its version.
 */

type Json = Record<string, any>;

export interface Size {
  width: number;
  height: number;
}

export interface Sized extends Size {
  id: string;
}

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

const isVersion3 = (info: Json) =>
  info.type === "ImageService3" ||
  JSON.stringify(info["@context"] ?? "").includes("/image/3");

/** Its compliance level: 0, 1 or 2, from `profile` as version 3 or 2 writes it. */
const levelOf = (info: Json) => {
  const name = asArray(info.profile).find((p) => typeof p === "string");
  const match = /level([012])/.exec(String(name ?? ""));
  return match ? Number(match[1]) : 0;
};

/** Features beyond its level: version 3's `extraFeatures`, version 2's `supports`. */
const featuresOf = (info: Json) => [
  ...(asArray(info.extraFeatures) as string[]),
  ...asArray(info.profile).flatMap(
    (p: any) => asArray(p?.supports) as string[],
  ),
];

const isSize = (size: any): size is Size => size?.width > 0 && size?.height > 0;

/** Of the sizes, the smallest whose shorter side is still `wanted`, else the largest. */
export function chooseSize(sizes: Size[], wanted: number): Size | undefined {
  const byWidth = [...sizes].sort((a, b) => a.width - b.width);
  return (
    byWidth.find((size) => Math.min(size.width, size.height) >= wanted) ??
    byWidth.at(-1)
  );
}

/**
 * The whole image, or a region of it (`of`), scaled so its shorter side is `wanted`, never
 * up, within the image's limits.
 */
function freeSize(
  info: Json,
  wanted: number,
  of: Size = info as Size,
): Size | undefined {
  const { maxWidth, maxHeight, maxArea } = info;
  if (!isSize(of)) return undefined;
  const { width, height } = of;
  const scale = Math.min(1, wanted / Math.min(width, height));
  const size = {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
  const within =
    (!maxWidth || size.width <= maxWidth) &&
    (!maxHeight || size.height <= maxHeight) &&
    (!maxArea || size.width * size.height <= maxArea);
  return within ? size : undefined;
}

/** The whole image at each scale its tiles are cut at where it fits in one tile. */
function tileSizes(info: Json): Size[] {
  const { width, height, tiles } = info;
  if (!isSize({ width, height })) return [];
  return (asArray(tiles) as Json[]).flatMap((tile) =>
    (asArray(tile?.scaleFactors) as number[])
      .map((scale) => ({
        width: Math.ceil(width / scale),
        height: Math.ceil(height / scale),
      }))
      .filter(
        (size) =>
          size.width <= tile.width &&
          size.height <= (tile.height ?? tile.width),
      ),
  );
}

/** A thumbnail of the whole image behind `service`, from its `info.json`. */
export function thumbnailFrom(
  service: string,
  info: Json,
  wanted: number,
): Sized | undefined {
  const base = service.replace(/\/$/, "");
  const version3 = isVersion3(info);
  const level = levelOf(info);
  const features = featuresOf(info);
  const at = (size: Size, form: "w,h" | "w,") => ({
    id: `${base}/full/${form === "w,h" ? `${size.width},${size.height}` : `${size.width},`}/0/default.jpg`,
    ...size,
  });

  // Any size: version 3 asks by `w,h` (level 1 up), version 2 by `w,` (its canonical).
  const free = version3
    ? level >= 1 || features.includes("sizeByWh")
    : level >= 1 || features.includes("sizeByW");
  const chosen = free && freeSize(info, wanted);
  if (chosen) return at(chosen, version3 ? "w,h" : "w,");

  // One it lists, asked for as listed.
  const listed = chooseSize(asArray(info.sizes).filter(isSize), wanted);
  if (listed) return at(listed, "w,h");

  // A whole tile's worth, as its tiles are asked for.
  const tiled = chooseSize(tileSizes(info), wanted);
  return tiled ? at(tiled, version3 ? "w,h" : "w,") : undefined;
}

/**
 * A region in Image API syntax (`x,y,w,h` in the image's pixels, or `pct:x,y,w,h`), in
 * pixels and within the image, as its server would cut it; none where it misses the image.
 */
function regionPixels(
  region: string,
  info: Json,
): { x: number; y: number; width: number; height: number } | undefined {
  const match = /^(pct:)?([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/.exec(region);
  if (!match || !isSize(info)) return undefined;
  const [x, y, w, h] = match.slice(2).map(Number);
  const share = (value: number, of: number) =>
    match[1] ? Math.round((value / 100) * of) : Math.round(value);
  const left = share(x, info.width);
  const top = share(y, info.height);
  const width = Math.min(share(w, info.width), info.width - left);
  const height = Math.min(share(h, info.height), info.height - top);
  return width > 0 && height > 0
    ? { x: left, y: top, width, height }
    : undefined;
}

/**
 * A thumbnail of a region of the image behind `service` (a painting's `ImageApiSelector`,
 * Cookbook 0299), from its `info.json`: the region in pixels, its canonical form, at a
 * size of its own choosing, never larger than the region. Only where the server cuts
 * regions and sizes freely (level 1 up, or the features); else none, and the caller
 * takes the whole image.
 */
export function regionThumbnailFrom(
  service: string,
  info: Json,
  region: string,
  wanted: number,
): Sized | undefined {
  const rect = regionPixels(region, info);
  if (!rect) return undefined;
  if (rect.width === info.width && rect.height === info.height)
    return thumbnailFrom(service, info, wanted);
  const version3 = isVersion3(info);
  const level = levelOf(info);
  const features = featuresOf(info);
  const cuts = level >= 1 || features.includes("regionByPx");
  const sizes = version3
    ? level >= 1 || features.includes("sizeByWh")
    : level >= 1 || features.includes("sizeByW");
  const size = cuts && sizes ? freeSize(info, wanted, rect) : undefined;
  if (!size) return undefined;
  const base = service.replace(/\/$/, "");
  const at = version3 ? `${size.width},${size.height}` : `${size.width},`;
  return {
    id: `${base}/${rect.x},${rect.y},${rect.width},${rect.height}/${at}/0/default.jpg`,
    ...size,
  };
}
