import { type GltfAsset, readAccessor } from "./load";
import type { Mat4, Vec3 } from "./mat4";

/** A box along the Scene's axes. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

export const emptyBox = (): Box => ({
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
});

/**
 * Whether `model` only scales, mirrors, swaps and moves: each axis goes to an axis, so a
 * box's corners, placed, still bound its points as closely as the points themselves.
 */
export function turnsNothing(model: Mat4): boolean {
  for (let column = 0; column < 3; column++) {
    let axes = 0;
    for (let row = 0; row < 3; row++)
      if (Math.abs(model[column * 4 + row]) > 1e-6) axes++;
    if (axes > 1) return false;
  }
  return true;
}

/**
 * `box`, grown to hold a primitive's points (its POSITION accessor) placed by `model`.
 * Where `model` turns nothing, the accessor's own bounds, placed, are exact; where it
 * turns them, every point is placed, since a turned box's corners bound far more than it
 * holds (a scan whose node was turned 86° drew 28% smaller in its frame).
 */
export function growBox(
  box: Box,
  asset: GltfAsset,
  position: number,
  model: Mat4,
): Box {
  const accessor = asset.json.accessors![position];
  let points: ArrayLike<number>;
  if (
    turnsNothing(model) &&
    accessor.min &&
    accessor.max &&
    !accessor.normalized
  ) {
    const [min, max] = [accessor.min, accessor.max];
    points = Array.from({ length: 8 }, (_, corner) => [
      corner & 1 ? max[0] : min[0],
      corner & 2 ? max[1] : min[1],
      corner & 4 ? max[2] : min[2],
    ]).flat();
  } else points = readAccessor(asset, position);
  // Placed in place, a point at a time: a scan has hundreds of thousands.
  const m = model;
  for (let i = 0; i + 2 < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    const z = points[i + 2];
    for (let axis = 0; axis < 3; axis++) {
      const value =
        m[axis] * x + m[4 + axis] * y + m[8 + axis] * z + m[12 + axis];
      if (value < box.min[axis]) box.min[axis] = value;
      if (value > box.max[axis]) box.max[axis] = value;
    }
  }
  return box;
}
