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

/** The whole image scaled so its shorter side is `wanted`, never up, within the limits. */
function freeSize(info: Json, wanted: number): Size | undefined {
  const { width, height, maxWidth, maxHeight, maxArea } = info;
  if (!isSize(info)) return undefined;
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
