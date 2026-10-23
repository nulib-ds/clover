/**
 * The 4×4 matrices a 3D view needs, and no more: column-major `Float32Array`s, as WebGL
 * takes them. A Scene's alone (`lib/gltf/`): Canvas's renderer is 2D and keeps its own
 * affine math (`lib/renderer/math/`).
 */

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export const identity = (): Mat4 =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** `a × b`: `b` first, then `a`. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/** A move, a quaternion's turn (`x, y, z, w`) and a scale, as glTF's nodes give them. */
export function compose(
  [tx, ty, tz]: Vec3,
  [x, y, z, w]: [number, number, number, number],
  [sx, sy, sz]: Vec3,
): Mat4 {
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return new Float32Array([
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ]);
}

export const translation = (move: Vec3) =>
  compose(move, [0, 0, 0, 1], [1, 1, 1]);
export const scaling = (scale: Vec3) => compose([0, 0, 0], [0, 0, 0, 1], scale);

/**
 * A turn about the space's own axes, in degrees: `x` first, then `y`, then `z`, as a
 * Presentation 4 `RotateTransform` turns.
 */
export function rotation([x, y, z]: Vec3): Mat4 {
  const about = (axis: 0 | 1 | 2, degrees: number) => {
    const angle = (degrees * Math.PI) / 180;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = identity();
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [2, 0] : [0, 1];
    m[i * 4 + i] = c;
    m[i * 4 + j] = s;
    m[j * 4 + i] = -s;
    m[j * 4 + j] = c;
    return m;
  };
  return multiply(about(2, z), multiply(about(1, y), about(0, x)));
}

/** A perspective projection, its vertical field of view in radians. */
export function perspective(
  fieldOfView: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const f = 1 / Math.tan(fieldOfView / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * range,
    -1,
    0,
    0,
    2 * far * near * range,
    0,
  ]);
}

/** The view from `eye` toward `target`, `y` up. */
export function lookAt(eye: Vec3, target: Vec3): Mat4 {
  const unit = (v: Vec3): Vec3 => {
    const length = Math.hypot(...v) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  };
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const back = unit([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);
  const right = unit(cross([0, 1, 0], back));
  const up = cross(back, right);
  return new Float32Array([
    right[0],
    up[0],
    back[0],
    0,
    right[1],
    up[1],
    back[1],
    0,
    right[2],
    up[2],
    back[2],
    0,
    -dot(right, eye),
    -dot(up, eye),
    -dot(back, eye),
    1,
  ]);
}

/** A point, moved by `m`. */
export const transform = (m: Mat4, [x, y, z]: Vec3): Vec3 => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** How `m` turns normals: its upper 3×3's inverse, transposed. */
export function normalMatrix(m: Mat4): Float32Array {
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return new Float32Array([
    A / det,
    B / det,
    C / det,
    (c * h - b * i) / det,
    (a * i - c * g) / det,
    (b * g - a * h) / det,
    (b * f - c * e) / det,
    (c * d - a * f) / det,
    (a * e - b * d) / det,
  ]);
}
