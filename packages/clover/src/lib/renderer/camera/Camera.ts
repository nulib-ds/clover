import {
  type Affine,
  type Point,
  apply,
  compose,
  rotate,
  scale,
  translate,
} from "../math/affine";
import { type Rect, rectCenter, transformRect } from "../math/rect";

/**
 * Where the camera looks, in world units.
 *
 * - `x`, `y`: the world point at the center of the viewport.
 * - `zoom`: CSS pixels per world unit.
 * - `rotation`: radians, clockwise on screen.
 *
 * World units are the pixels of the first image in the scene, so for a single image
 * "world" and "image" coordinates are the same thing — which is what a content-state
 * `xywh=` fragment wants.
 */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/** World → screen (CSS pixels, origin top-left of the stage). */
export function worldToScreen(
  camera: CameraState,
  viewport: ViewportSize,
): Affine {
  return compose(
    translate(viewport.width / 2, viewport.height / 2),
    rotate(camera.rotation),
    scale(camera.zoom),
    translate(-camera.x, -camera.y),
  );
}

export function screenToWorld(
  camera: CameraState,
  viewport: ViewportSize,
): Affine {
  // Built directly rather than inverted, so a zero zoom fails loudly instead of quietly.
  return compose(
    translate(camera.x, camera.y),
    scale(1 / camera.zoom),
    rotate(-camera.rotation),
    translate(-viewport.width / 2, -viewport.height / 2),
  );
}

export function screenPointToWorld(
  camera: CameraState,
  viewport: ViewportSize,
  point: Point,
): Point {
  return apply(screenToWorld(camera, viewport), point);
}

export function worldPointToScreen(
  camera: CameraState,
  viewport: ViewportSize,
  point: Point,
): Point {
  return apply(worldToScreen(camera, viewport), point);
}

/** The axis-aligned world rectangle the viewport covers (its bounding box if rotated). */
export function visibleWorldRect(
  camera: CameraState,
  viewport: ViewportSize,
): Rect {
  return transformRect(screenToWorld(camera, viewport), {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  });
}

/**
 * The camera that frames `bounds` inside the viewport, keeping `rotation`.
 *
 * `padding` is a fraction of the viewport left clear on each axis.
 */
export function fitCamera(
  bounds: Rect,
  viewport: ViewportSize,
  rotation = 0,
  padding = 0,
): CameraState {
  // Fit the rotated bounds: rotate the world rect about its own center and measure.
  const rotated = transformRect(rotate(rotation), bounds);
  const usableW = Math.max(1, viewport.width * (1 - padding * 2));
  const usableH = Math.max(1, viewport.height * (1 - padding * 2));
  const zoom = Math.min(
    usableW / Math.max(rotated.width, Number.EPSILON),
    usableH / Math.max(rotated.height, Number.EPSILON),
  );
  const center = rectCenter(bounds);
  return { x: center.x, y: center.y, zoom, rotation };
}

/**
 * The center that keeps world point `anchor` under screen point `screen` at the given
 * zoom and rotation. This is what makes zoom-at-cursor hold still mid-animation rather
 * than only at its end.
 */
export function anchoredCenter(
  anchor: Point,
  screen: Point,
  zoom: number,
  rotation: number,
  viewport: ViewportSize,
): Point {
  const offset = apply(compose(scale(1 / zoom), rotate(-rotation)), {
    x: screen.x - viewport.width / 2,
    y: screen.y - viewport.height / 2,
  });
  return { x: anchor.x - offset.x, y: anchor.y - offset.y };
}

export function sameCamera(a: CameraState, b: CameraState): boolean {
  return (
    a.x === b.x && a.y === b.y && a.zoom === b.zoom && a.rotation === b.rotation
  );
}
