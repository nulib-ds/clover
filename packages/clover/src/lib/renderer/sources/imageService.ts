/**
 * IIIF Image API services, 3.0 back to 2.0: reading `info.json` and spelling requests.
 *
 * The renderer never asks a server for anything this module did not spell, so every
 * version difference lives here:
 *
 * | | 3.0 | 2.1.1 / 2.0 |
 * |---|---|---|
 * | identity | `id` | `@id` |
 * | compliance | `profile: "level1"` | `profile: ["…/level1.json", {…}]` |
 * | full size | `max` | `full` |
 * | tile size | `w,h` (canonical) | `w,` (canonical) |
 * | size limits | top-level `maxWidth`… | inside the profile object (2.1) |
 *
 * Requests use each version's **canonical** form. A level 0 server is often a static file
 * tree generated ahead of time (vips, iiif-tiler), which holds exactly one spelling of each
 * URL — the canonical one — and 404s on any other. The same reason gives a tile that covers
 * the whole image the region `full` rather than `0,0,w,h`.
 *
 * @see https://iiif.io/api/image/3.0/
 * @see https://iiif.io/api/image/2.1/
 * @see https://iiif.io/api/image/2.0/
 */

import { type CloverRequest, cloverFetch } from "../../../core/request";

export type ImageApiVersion = 2 | 3;

export interface TileSpec {
  width: number;
  height: number;
  scaleFactors: number[];
}

export interface ImageServiceInfo {
  /** Base URI, without `/info.json` or a trailing slash. */
  id: string;
  version: ImageApiVersion;
  /** Compliance level: what the server can do beyond what it lists. */
  level: 0 | 1 | 2;
  width: number;
  height: number;
  tiles: TileSpec[];
  sizes: Array<{ width: number; height: number }>;
  maxWidth?: number;
  maxHeight?: number;
  maxArea?: number;
  /** Whether arbitrary `x,y,w,h` regions are honored (level 1+, or advertised). */
  regionByPx: boolean;
  /** Whether arbitrary `w,` / `w,h` sizes are honored. */
  sizeByW: boolean;
  format: string;
  quality: string;
}

/** Formats every browser decodes, in Clover's order of preference. */
const DECODABLE = ["jpg", "png", "webp", "gif"];

export class ImageServiceError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ImageServiceError";
  }
}

/** `https://…/abc/info.json` or `https://…/abc/` → `https://…/abc`. */
export function serviceBase(uri: string): string {
  return uri.replace(/\/info\.json$/, "").replace(/\/+$/, "");
}

/**
 * The first image service on a resource, if any — `@id`/`id`, in either version's shape.
 * A IIIF Presentation `service` is an array; a Presentation 2 one may be a bare object.
 */
export function findImageServiceId(service: unknown): string | undefined {
  const services = Array.isArray(service) ? service : service ? [service] : [];
  for (const candidate of services) {
    if (!candidate || typeof candidate !== "object") continue;
    const s = candidate as Record<string, unknown>;
    const type = String(s.type ?? s["@type"] ?? "");
    const profile = JSON.stringify(s.profile ?? "");
    const isImageService =
      /ImageService/i.test(type) ||
      /iiif\.io\/api\/image/.test(profile) ||
      /^"level[012]"$/.test(profile) ||
      (!type && !s.profile);
    const id = (s["@id"] ?? s.id) as string | undefined;
    if (isImageService && typeof id === "string") return serviceBase(id);
  }
  return undefined;
}

/** Parse an `info.json` document. Throws if it is not a usable image service. */
export function parseInfo(
  json: unknown,
  requestedId?: string,
): ImageServiceInfo {
  if (!json || typeof json !== "object") {
    throw new ImageServiceError(
      "info.json is not an object",
      requestedId ?? "",
    );
  }
  const doc = json as Record<string, any>;
  const version = detectVersion(doc);
  const rawId = (
    version === 3 ? (doc.id ?? doc["@id"]) : (doc["@id"] ?? doc.id)
  ) as string | undefined;
  const id = serviceBase(rawId ?? requestedId ?? "");
  const width = Number(doc.width);
  const height = Number(doc.height);
  if (!id || !(width > 0) || !(height > 0)) {
    throw new ImageServiceError(
      "info.json is missing id, width or height",
      requestedId ?? id,
    );
  }

  // v2: profile is [complianceUri, …profileObjects]; v3: a string, with features top-level.
  const profiles: unknown[] = Array.isArray(doc.profile)
    ? doc.profile
    : [doc.profile];
  const complianceUri = profiles.find((p) => typeof p === "string") as
    | string
    | undefined;
  const profileObjects = profiles.filter(
    (p): p is Record<string, any> => !!p && typeof p === "object",
  );
  const level = detectLevel(complianceUri);

  const supports = new Set<string>([
    ...(Array.isArray(doc.extraFeatures) ? doc.extraFeatures : []),
    ...profileObjects.flatMap((p) =>
      Array.isArray(p.supports) ? p.supports : [],
    ),
  ]);

  const formats = [
    ...(Array.isArray(doc.preferredFormats) ? doc.preferredFormats : []),
  ].map((f: string) => String(f).toLowerCase());
  const format = formats.find((f) => DECODABLE.includes(f)) ?? "jpg";

  const maxOf = (key: "maxWidth" | "maxHeight" | "maxArea") => {
    const value =
      doc[key] ?? profileObjects.find((p) => p[key] !== undefined)?.[key];
    return Number(value) > 0 ? Number(value) : undefined;
  };
  let maxWidth = maxOf("maxWidth");
  let maxHeight = maxOf("maxHeight");
  // "If maxWidth is specified and maxHeight is not, maxHeight is assumed to equal it."
  if (maxWidth && !maxHeight) maxHeight = maxWidth;
  if (maxHeight && !maxWidth) maxWidth = undefined;

  return {
    id,
    version,
    level,
    width,
    height,
    tiles: parseTiles(doc.tiles),
    sizes: parseSizes(doc.sizes),
    maxWidth,
    maxHeight,
    maxArea: maxOf("maxArea"),
    regionByPx: level >= 1 || supports.has("regionByPx"),
    sizeByW: level >= 1 || supports.has("sizeByW") || supports.has("sizeByWh"),
    format,
    quality: "default",
  };
}

function detectVersion(doc: Record<string, any>): ImageApiVersion {
  const contexts = ([] as unknown[]).concat(doc["@context"] ?? []).map(String);
  if (contexts.some((c) => c.includes("/image/3"))) return 3;
  if (contexts.some((c) => c.includes("/image/2"))) return 2;
  if (doc.type === "ImageService3") return 3;
  return doc["@id"] ? 2 : 3;
}

function detectLevel(compliance: string | undefined): 0 | 1 | 2 {
  const match = compliance?.match(/level([012])/);
  return match ? (Number(match[1]) as 0 | 1 | 2) : 0;
}

function parseTiles(tiles: unknown): TileSpec[] {
  if (!Array.isArray(tiles)) return [];
  return tiles
    .map((t: any) => {
      const width = Number(t?.width);
      const height = Number(t?.height ?? t?.width);
      const scaleFactors = (
        Array.isArray(t?.scaleFactors) ? t.scaleFactors : [1]
      )
        .map(Number)
        .filter((s: number) => s > 0)
        .sort((a: number, b: number) => a - b);
      return { width, height, scaleFactors };
    })
    .filter((t) => t.width > 0 && t.height > 0 && t.scaleFactors.length);
}

function parseSizes(sizes: unknown): Array<{ width: number; height: number }> {
  if (!Array.isArray(sizes)) return [];
  return sizes
    .map((s: any) => ({ width: Number(s?.width), height: Number(s?.height) }))
    .filter((s) => s.width > 0 && s.height > 0)
    .sort((a, b) => a.width - b.width);
}

// ─── Request spelling ───────────────────────────────────────────────────────

export interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The URL for `region` of the image (in full-size pixels) delivered at `width × height`.
 *
 * `quality` overrides the service's, for the one retry a level 0 tree gets (see
 * `alternateQuality`).
 */
export function imageRequestUrl(
  info: ImageServiceInfo,
  region: RegionRect,
  width: number,
  height: number,
  quality = info.quality,
): string {
  const isFull =
    region.x === 0 &&
    region.y === 0 &&
    region.width === info.width &&
    region.height === info.height;
  const regionPart = isFull
    ? "full"
    : `${region.x},${region.y},${region.width},${region.height}`;

  const isFullSize = isFull && width === info.width && height === info.height;
  let sizePart: string;
  if (info.version === 3) {
    sizePart = isFullSize ? "max" : `${width},${height}`;
  } else {
    sizePart = isFullSize ? "full" : `${width},`;
  }

  return `${info.id}/${regionPart}/${sizePart}/0/${quality}.${info.format}`;
}

/**
 * A static level 0 tree generated under Image API 1.x conventions answers to `native`,
 * not `default`, though its info.json says 2. One retry with the other word is cheaper
 * than a canvas that stays blank for the life of the page.
 */
export function alternateQuality(info: ImageServiceInfo): string | undefined {
  return info.version === 2 && info.level === 0 ? "native" : undefined;
}

// ─── Fetching ───────────────────────────────────────────────────────────────

export interface FetchInfoOptions {
  request?: CloverRequest;
}

const infoCache = new Map<string, Promise<ImageServiceInfo>>();

/**
 * Fetch and parse a service's `info.json`, once per service per page. A failure is not
 * cached, so a later mount can try again.
 *
 * Deliberately not abortable: the request is shared by every viewer showing the service,
 * and one of them unmounting must not fail it for the rest.
 */
export function fetchInfo(
  serviceUri: string,
  { request }: FetchInfoOptions = {},
): Promise<ImageServiceInfo> {
  const base = serviceBase(serviceUri);
  const cached = infoCache.get(base);
  if (cached) return cached;

  const url = `${base}/info.json`;
  const pending = cloverFetch(request, url, {
    headers: { Accept: "application/ld+json, application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new ImageServiceError(
          `info.json request failed with ${response.status}`,
          url,
          response.status,
        );
      }
      return parseInfo(await response.json(), base);
    })
    .catch((error) => {
      infoCache.delete(base);
      throw error;
    });

  infoCache.set(base, pending);
  return pending;
}

/** Test seam. */
export function clearInfoCache(): void {
  infoCache.clear();
}
