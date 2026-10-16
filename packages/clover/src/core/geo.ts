import { bodiesOf, parseAnnotationTarget } from "./annotations";
import type { Collection, Manifest } from "./presentation";
import { selectSequence } from "./selectors";
import { type LanguageMapLike, localize } from "./value";

/**
 * Where a IIIF resource is, read for a map: navPlace (on a Collection, Manifest, Canvas
 * or Annotation, and annotation bodies that are GeoJSON), and Georeference Extension
 * annotations, reduced to what a basic overlay needs. Framework-free and small: the map
 * itself, and MapLibre, load only when a `Map` is shown.
 *
 * - navPlace: https://iiif.io/api/extension/navplace/
 * - Georeference: https://iiif.io/api/extension/georef/
 */

export type Position = [number, number];

export interface GeoGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoGeometry[];
}

export interface MapFeature {
  type: "Feature";
  id?: string | number;
  geometry: GeoGeometry;
  /**
   * Flat, for MapLibre (which turns nested objects into strings): the text to show and
   * its language, the Canvas it belongs to, and any simplestyle keys it carried (`fill`,
   * `stroke`, …).
   */
  properties: Record<string, string | number | boolean> & {
    title?: string;
    titleLang?: string;
    canvasId?: string;
  };
}

export interface MapFeatureCollection {
  type: "FeatureCollection";
  features: MapFeature[];
}

/** A georeferenced image, reduced to an affine overlay. */
export interface Georeference {
  id: string;
  /** The Canvas it georeferences, when it targets one. */
  canvasId?: string;
  /** Ground control points: image pixel [x, y] ↔ [longitude, latitude]. */
  points: Array<{ resource: Position; geo: Position }>;
  /** The extent the points are measured in: the Canvas, or the image service. */
  width: number;
  height: number;
  /** The part of the image that is map (an SvgSelector polygon), in the same units. */
  mask?: Position[];
  /** Its name: the annotation's label, or the Canvas's. */
  label?: LanguageMapLike;
  /** What to draw: an image body (or a bare image service) for `thumbnailSource`. */
  image: Record<string, unknown>;
}

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

const GEOMETRIES = new Set([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
]);

/** simplestyle keys a feature may carry for its own look. */
const STYLE_KEYS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "marker-color",
];

/** Any GeoJSON value (collection, feature or bare geometry) as features. */
function featuresOf(geo: unknown): Json[] {
  const value = geo as Json | null;
  if (!value || typeof value !== "object") return [];
  if (value.type === "FeatureCollection") {
    return (asArray(value.features) as Json[]).filter(
      (feature) => feature?.geometry,
    );
  }
  if (value.type === "Feature") return value.geometry ? [value] : [];
  if (GEOMETRIES.has(value.type)) return [{ type: "Feature", geometry: value }];
  return [];
}

function flatten(
  feature: Json,
  owner: { label?: unknown; canvasId?: string },
  language: string | undefined,
): MapFeature {
  const own = (feature.properties ?? {}) as Json;
  const properties: MapFeature["properties"] = {};
  for (const key of STYLE_KEYS) {
    const value = own[key];
    if (typeof value === "string" || typeof value === "number") {
      properties[key] = value;
    }
  }
  // The feature's own label, or else its owner's, with the language it is in.
  const ownTitle = localize(own.label as LanguageMapLike, language);
  const title = ownTitle.text
    ? ownTitle
    : localize(owner.label as LanguageMapLike, language);
  if (title.text) {
    properties.title = title.text.replace(/<[^>]*>/g, "");
    if (title.lang) properties.titleLang = title.lang;
  }
  if (owner.canvasId) properties.canvasId = owner.canvasId;
  return {
    type: "Feature",
    ...(feature.id != null ? { id: feature.id } : {}),
    geometry: feature.geometry,
    properties,
  };
}

const GEOREFERENCING = "georeferencing";

const motivations = (annotation: Json) =>
  asArray(annotation?.motivation) as string[];

/** The annotations on a Canvas's pages that are loaded. */
function annotationsOf(canvas: Json): Json[] {
  return (asArray(canvas.annotations) as Json[]).flatMap(
    (page) => asArray(page?.items) as Json[],
  );
}

const navPlaces = new WeakMap<object, Map<string, MapFeatureCollection>>();

/**
 * Every navPlace feature of the Root's resource: the Collection's, the Manifest's, each
 * Canvas's, and each loaded annotation's (its `navPlace`, or a GeoJSON body as Cookbook
 * 0139 has). A feature from a Canvas or annotation names that Canvas. Memoised on the
 * Manifest (and the Collection), so the same collection comes back while nothing changes.
 */
export function navPlaceOf(
  manifest: Manifest | null,
  collection: Collection | null = null,
  language?: string,
): MapFeatureCollection {
  if (!manifest) return NO_FEATURES;
  const key = `${language ?? ""}|${(collection as Json | null)?.id ?? ""}`;
  let byKey = navPlaces.get(manifest);
  if (!byKey) navPlaces.set(manifest, (byKey = new Map()));
  const cached = byKey.get(key);
  if (cached) return cached;

  const features: MapFeature[] = [];
  const add = (geo: unknown, owner: { label?: unknown; canvasId?: string }) =>
    features.push(...featuresOf(geo).map((f) => flatten(f, owner, language)));

  const c = collection as Json | null;
  if (c?.navPlace) add(c.navPlace, { label: c.label });
  const m = manifest as Json;
  if (m.navPlace) add(m.navPlace, { label: m.label });
  for (const canvas of selectSequence(manifest).canvases as Json[]) {
    if (canvas.navPlace) {
      add(canvas.navPlace, { label: canvas.label, canvasId: canvas.id });
    }
    for (const annotation of annotationsOf(canvas)) {
      if (motivations(annotation).includes(GEOREFERENCING)) continue;
      const canvasId =
        parseAnnotationTarget(asArray(annotation.target)[0] as never).id ||
        canvas.id;
      const owner = { label: annotation.label ?? canvas.label, canvasId };
      if (annotation.navPlace) add(annotation.navPlace, owner);
      for (const body of bodiesOf(annotation)) {
        if (body?.type === "Feature" || body?.type === "FeatureCollection") {
          add(body, owner);
        }
      }
    }
  }
  const result: MapFeatureCollection = features.length
    ? { type: "FeatureCollection", features }
    : NO_FEATURES;
  byKey.set(key, result);
  return result;
}

const NO_FEATURES: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const NO_GEOREFERENCES: Georeference[] = [];

/** The points of the first polygon in an SvgSelector, or undefined. */
function readMask(svg: unknown): Position[] | undefined {
  if (typeof svg !== "string") return undefined;
  const points = /points\s*=\s*["']([^"']+)["']/i.exec(svg)?.[1];
  if (!points) return undefined;
  const numbers = points
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const mask: Position[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    mask.push([numbers[i], numbers[i + 1]]);
  }
  return mask.length >= 3 && mask.every((p) => p.every(Number.isFinite))
    ? mask
    : undefined;
}

/** The painting image of a Canvas: its first image body. */
function paintedImage(canvas: Json | undefined): Json | undefined {
  for (const page of asArray(canvas?.items) as Json[]) {
    for (const annotation of asArray(page?.items) as Json[]) {
      if (!motivations(annotation).includes("painting")) continue;
      const body = bodiesOf(annotation).find(
        (item) => item?.type === "Image" || item?.service,
      );
      if (body) return body;
    }
  }
  return undefined;
}

/**
 * One Georeference Extension annotation as an overlay: its control points, the extent
 * they are measured in, its mask, and the image to draw (the Canvas's painted image, or
 * the image service it targets directly). Null when it cannot be drawn: fewer than three
 * points, no extent, or nothing to draw.
 */
export function readGeoreference(
  annotation: Json,
  canvas?: Json,
): Georeference | null {
  if (!motivations(annotation).includes(GEOREFERENCING)) return null;
  const body = bodiesOf(annotation).find(
    (item) => item?.type === "FeatureCollection",
  );
  const points: Georeference["points"] = [];
  for (const feature of featuresOf(body)) {
    const resource = (feature.properties as Json | undefined)?.resourceCoords;
    const geo =
      feature.geometry?.type === "Point" && feature.geometry.coordinates;
    if (!Array.isArray(resource) || !Array.isArray(geo)) continue;
    const point = {
      resource: [Number(resource[0]), Number(resource[1])] as Position,
      geo: [Number(geo[0]), Number(geo[1])] as Position,
    };
    if ([...point.resource, ...point.geo].every(Number.isFinite)) {
      points.push(point);
    }
  }
  if (points.length < 3) return null;

  const target = asArray(annotation.target)[0] as Json | string | undefined;
  const source = (
    typeof target === "string"
      ? { id: target }
      : typeof target?.source === "string"
        ? { id: target.source }
        : (target?.source ?? target ?? {})
  ) as Json;
  const sourceId = String(source.id ?? source["@id"] ?? "").split("#")[0];
  const sourceType = String(source.type ?? source["@type"] ?? "");
  const isService = /ImageService/.test(sourceType);
  const width = Number(source.width ?? canvas?.width);
  const height = Number(source.height ?? canvas?.height);
  if (!(width > 0 && height > 0)) return null;

  const image = isService
    ? { service: [{ id: sourceId, type: sourceType, profile: source.profile }] }
    : paintedImage(canvas);
  if (!image) return null;

  const selector = asArray((target as Json | undefined)?.selector).find(
    (item) => (item as Json)?.type === "SvgSelector",
  ) as Json | undefined;
  const mask = readMask(selector?.value);
  const whole =
    mask?.length === 4 &&
    mask.every(
      ([x, y]) => (x === 0 || x === width) && (y === 0 || y === height),
    );
  const label = (annotation.label ?? canvas?.label) as LanguageMapLike;
  return {
    id: String(annotation.id ?? sourceId),
    ...(isService || !sourceId ? {} : { canvasId: canvas?.id ?? sourceId }),
    points,
    width,
    height,
    ...(mask && !whole ? { mask } : {}),
    ...(label ? { label } : {}),
    image,
  };
}

const georeferences = new WeakMap<object, Georeference[]>();

/**
 * The georeferenced images of the Manifest's Canvases, from their loaded annotation pages.
 * Memoised on the Manifest: embedding a fetched page makes a new one.
 */
export function georeferencesOf(manifest: Manifest | null): Georeference[] {
  if (!manifest) return NO_GEOREFERENCES;
  const cached = georeferences.get(manifest);
  if (cached) return cached;
  const found: Georeference[] = [];
  for (const canvas of selectSequence(manifest).canvases as Json[]) {
    for (const annotation of annotationsOf(canvas)) {
      const georeference = readGeoreference(annotation, canvas);
      if (georeference) found.push(georeference);
    }
  }
  const result = found.length ? found : NO_GEOREFERENCES;
  georeferences.set(manifest, result);
  return result;
}

export { hasMapData } from "./geo-detect";

/**
 * The URL of an overlay's image, about `size` pixels on its longer side: an image service
 * is asked for that size where its level allows (`!w,h` at level 2, `w,` at level 1), and
 * for its whole image at level 0; without a service, the image itself. The map's own, so
 * it shares no module with the parts (see the Map notes in AGENTS.md).
 */
export function overlayImageUrl(
  image: Record<string, unknown>,
  size = 2048,
): string | undefined {
  for (const service of asArray(image.service) as Json[]) {
    const id = service?.id ?? service?.["@id"];
    if (typeof id !== "string") continue;
    const type = String(service.type ?? service["@type"] ?? "");
    const profile = JSON.stringify(service.profile ?? "");
    const level = Number(/level([012])/.exec(profile)?.[1] ?? 0);
    const v2 = type === "ImageService2" || /image\/2/.test(profile);
    const region = `${id.replace(/\/$/, "")}/full/`;
    const sized =
      level === 2
        ? `!${size},${size}`
        : level === 1
          ? `${size},`
          : v2
            ? "full"
            : "max";
    return `${region}${sized}/0/default.jpg`;
  }
  return typeof image.id === "string" ? image.id : undefined;
}

// ── The affine overlay ────────────────────────────────────────────────────────

const toMercator = ([lng, lat]: Position): Position => [
  (lng * Math.PI) / 180,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

const fromMercator = ([x, y]: Position): Position => [
  (x * 180) / Math.PI,
  ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI,
];

/** Solve the 3×3 system `m · v = b` (Cramer's rule); null when singular. */
function solve3(m: number[][], b: number[]): number[] | null {
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  if (Math.abs(d) < 1e-12) return null;
  return [0, 1, 2].map(
    (column) =>
      det(m.map((row, i) => row.map((v, j) => (j === column ? b[i] : v)))) / d,
  );
}

/**
 * The first-order polynomial (affine) transform that best fits the control points, image
 * pixels to [longitude, latitude], by least squares in Web Mercator. Exact for three
 * points. Null when the points are collinear.
 */
export function affineTransform(
  points: Georeference["points"],
): ((pixel: Position) => Position) | null {
  if (points.length < 3) return null;
  const ata = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const atx = [0, 0, 0];
  const aty = [0, 0, 0];
  for (const { resource, geo } of points) {
    const row = [resource[0], resource[1], 1];
    const [mx, my] = toMercator(geo);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) ata[i][j] += row[i] * row[j];
      atx[i] += row[i] * mx;
      aty[i] += row[i] * my;
    }
  }
  const fx = solve3(ata, atx);
  const fy = solve3(ata, aty);
  if (!fx || !fy) return null;
  return ([x, y]) =>
    fromMercator([
      fx[0] * x + fx[1] * y + fx[2],
      fy[0] * x + fy[1] * y + fy[2],
    ]);
}

/**
 * Where the image's corners land, in the order MapLibre's image and canvas sources take
 * them: top left, top right, bottom right, bottom left. Null when the points do not fix
 * a transform.
 */
export function cornersOf(
  georeference: Georeference,
): [Position, Position, Position, Position] | null {
  const transform = affineTransform(georeference.points);
  if (!transform) return null;
  const { width: w, height: h } = georeference;
  return [
    transform([0, 0]),
    transform([w, 0]),
    transform([w, h]),
    transform([0, h]),
  ];
}

// ── Bounds ────────────────────────────────────────────────────────────────────

function positionsOf(geometry: GeoGeometry | undefined): Position[] {
  if (!geometry) return [];
  if (geometry.type === "GeometryCollection") {
    return (geometry.geometries ?? []).flatMap(positionsOf);
  }
  const flat: Position[] = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      flat.push([value[0], value[1]]);
    } else value.forEach(walk);
  };
  walk(geometry.coordinates);
  return flat;
}

/** The [[west, south], [east, north]] that holds the features and the overlays. */
export function boundsOf(
  features: MapFeature[],
  overlays: Georeference[] = [],
): [Position, Position] | null {
  const positions = [
    ...features.flatMap((feature) => positionsOf(feature.geometry)),
    ...overlays.flatMap((overlay) => cornersOf(overlay) ?? []),
  ].filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (!positions.length) return null;
  const lngs = positions.map(([lng]) => lng);
  const lats = positions.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
