import type { RegionRect } from "../sources/imageService";

/** A turn of the picture: degrees clockwise, after a mirror along its upright axis. */
export interface Rotation {
  degrees: number;
  mirror: boolean;
}

/**
 * A rotation, as the Image API writes it (§4.3): degrees clockwise, 0 to 360, mirrored
 * first along the vertical axis where it starts with `!` (`!90`).
 *
 * Returns null for none (`0`, `360`) and for anything else, so a malformed rotation shows
 * the image as it is.
 */
export function parseRotation(rotation: string | undefined): Rotation | null {
  const match = /^(!)?(\d+(?:\.\d+)?)$/.exec(rotation?.trim() ?? "");
  if (!match) return null;
  const turned = Number(match[2]);
  if (turned > 360) return null;
  const degrees = turned % 360;
  const mirror = Boolean(match[1]);
  return degrees || mirror ? { degrees, mirror } : null;
}

/**
 * A region of an image, as IIIF writes it — `x,y,w,h` in pixels or `pct:x,y,w,h` in
 * percent, optionally prefixed `xywh=` as a media fragment — clamped to the image.
 *
 * Returns null for anything that does not describe a non-empty area inside the image, so
 * a malformed region shows the whole image rather than nothing.
 */
export function parseRegion(
  region: string | undefined,
  width: number,
  height: number,
): RegionRect | null {
  if (!region) return null;
  let value = region.trim().replace(/^xywh=/, "");
  let percent = false;
  if (value.startsWith("pct:")) {
    percent = true;
    value = value.slice(4);
  } else if (value.startsWith("pixel:")) {
    value = value.slice(6);
  }

  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;

  let [x, y, w, h] = parts;
  if (percent) {
    x = (x / 100) * width;
    y = (y / 100) * height;
    w = (w / 100) * width;
    h = (h / 100) * height;
  }

  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(width, x + w);
  const y1 = Math.min(height, y + h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
