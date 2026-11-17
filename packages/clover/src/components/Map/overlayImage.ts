import {
  cornersOf,
  type Georeference,
  groundOf,
  type Position,
  toMercator,
} from "../../core/geo";
import type { CloverRequest } from "../../core/request";
import {
  fetchInfo,
  findImageServiceId,
} from "../../lib/renderer/sources/imageService";
import { sizedImageUrl } from "../../lib/renderer/sources/sizedImage";

/**
 * The URL of an overlay's image, about `size` pixels on its longer side: asked of its
 * image service as the service's own `info.json` says it can answer (`sizedImageUrl`:
 * never more than the image has, within its limits, at level 0 a size it lists); without
 * a service, or where it cannot answer, the image itself. Loaded only to draw an overlay,
 * so a map with none, and the parts, never load it.
 */
export async function overlayImageUrl(
  image: Record<string, unknown>,
  size: number,
  request: CloverRequest | undefined,
): Promise<string | undefined> {
  const fallback = typeof image.id === "string" ? image.id : undefined;
  const service = findImageServiceId(image.service);
  if (!service) return fallback;
  try {
    const info = await fetchInfo(service, { request });
    return sizedImageUrl(info, size) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * What of a georeferenced image lies outside its mask (a sheet's margins, its title,
 * another map on it): drawn at this strength, so the ground shows through it (Mat,
 * 2026-11-16: "partially obscure the part outside the line, make it semi transparent").
 */
const BEYOND_MASK = 0.382;

/** What an overlay's image is: its Canvas, else its image service, else the image. */
const imageOf = (overlay: Georeference) =>
  overlay.canvasId ??
  findImageServiceId(overlay.image.service) ??
  overlay.image.id;

/**
 * Where a position on the ground falls on an overlay's image, as a share of its width and
 * height: its fit undone by the corners MapLibre lays it by, in Web Mercator, where the
 * fit is affine, so exactly. Null where it has no fit.
 */
function shareOf(
  overlay: Georeference,
): ((position: Position) => Position) | null {
  const corners = cornersOf(overlay);
  if (!corners) return null;
  // Its top left, and from there along its top and down its side.
  const [o, x, , y] = corners.map(toMercator);
  const [ax, ay, bx, by] = [x[0] - o[0], x[1] - o[1], y[0] - o[0], y[1] - o[1]];
  const d = ax * by - bx * ay;
  if (!d) return null;
  return (position) => {
    const [px, py] = toMercator(position);
    const [dx, dy] = [px - o[0], py - o[1]];
    return [(dx * by - bx * dy) / d, (ax * dy - ay * dx) / d];
  };
}

/**
 * An overlay's picture: the image (about `size` px, `overlaySize`), on a canvas for
 * MapLibre's canvas source, whole (Mat, 2026-11-16: "for georeferenced images. show the
 * full image. draw the line"; clipped to its mask before): the map inside its mask at full
 * strength, the rest faded (`BEYOND_MASK`), the outlines drawing the line between. The
 * faded part leaves out every other map `laid`: where it lies on the ground, so the fade
 * shows over the streets alone (Mat, 2026-11-16: "if the semi transparent part intersects
 * another georeference point, just mask it entirely"), and where it is printed on this
 * image (Sanborn's Sheet 28: two), as warped with this one it would stand where it is
 * not. Null if the image will not load (or, without CORS, cannot be drawn into WebGL).
 */
export async function drawOverlay(
  overlay: Georeference,
  laid: Georeference[],
  request: CloverRequest | undefined,
  size: number,
  /** How its image is asked for across origins, as the Root's requests are (`sendsCredentials`). */
  crossOrigin: "anonymous" | "use-credentials",
): Promise<HTMLCanvasElement | null> {
  const url = await overlayImageUrl(overlay.image, size, request);
  if (!url) return null;
  const image = await new Promise<HTMLImageElement | null>((done) => {
    const element = new Image();
    element.crossOrigin = crossOrigin;
    element.onload = () => done(element);
    element.onerror = () => done(null);
    element.src = url;
  });
  if (!image?.naturalWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (overlay.mask) {
    // All of it faded, but for the other maps, then the map inside its mask, whole.
    context.globalAlpha = BEYOND_MASK;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
    const trace = (points: Position[]) => {
      context.beginPath();
      points.forEach(([x, y], index) =>
        index ? context.lineTo(x, y) : context.moveTo(x, y),
      );
      context.closePath();
    };
    // In the canvas's pixels: a point on the image, and one on the ground.
    const printed = ([x, y]: Position): Position => [
      (x * canvas.width) / overlay.width,
      (y * canvas.height) / overlay.height,
    ];
    const share = shareOf(overlay);
    const lying = (position: Position): Position => {
      const [u, v] = share!(position);
      return [u * canvas.width, v * canvas.height];
    };
    const sheet = imageOf(overlay);
    const cuts = laid
      .filter((other) => other !== overlay)
      .flatMap((other) => [
        ...(share ? [groundOf(other).map(lying)] : []),
        ...(other.mask &&
        sheet !== undefined &&
        imageOf(other) === sheet &&
        other.width === overlay.width &&
        other.height === overlay.height
          ? [other.mask.map(printed)]
          : []),
      ])
      .filter((points) => points.length > 2);
    if (cuts.length) {
      context.globalCompositeOperation = "destination-out";
      for (const points of cuts) {
        trace(points);
        context.fill();
      }
      context.globalCompositeOperation = "source-over";
    }
    trace(overlay.mask.map(printed));
    context.clip();
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
