import { type Affine, type Point, apply } from "./affine";

/** An axis-aligned rectangle in whatever space the caller is working in. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function union(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** The axis-aligned bounds of `rect` after `m` — a rotated rect's bounding box. */
export function transformRect(m: Affine, rect: Rect): Rect {
  const corners = [
    apply(m, { x: rect.x, y: rect.y }),
    apply(m, { x: rect.x + rect.width, y: rect.y }),
    apply(m, { x: rect.x, y: rect.y + rect.height }),
    apply(m, { x: rect.x + rect.width, y: rect.y + rect.height }),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The largest rectangle of `size`'s aspect centered inside `box`; `box` until it is known.
 * A box of no area (a Canvas that gives a `duration` and no `width` or `height`, Cookbook
 * 0015) has nothing to fit inside: the picture or video at its own size, where the box starts.
 */
export function containAspect(
  box: Rect,
  size: { width: number; height: number } | null,
): Rect {
  if (!size) return box;
  if (!box.width || !box.height)
    return { x: box.x, y: box.y, width: size.width, height: size.height };
  const scale = Math.min(box.width / size.width, box.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
