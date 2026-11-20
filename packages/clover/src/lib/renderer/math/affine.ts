/**
 * 2D affine transforms, in the `CanvasRenderingContext2D.setTransform` convention:
 *
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 *
 * The same six numbers are a CSS `matrix(a, b, c, d, e, f)` and, padded to 3×3, the
 * column-major `mat3` a WebGL shader expects. One representation serves every backend.
 *
 * Everything here is float64. A transform is narrowed to float32 only at upload, and only
 * after it has been composed down to "this quad's corner, on screen" — whose numbers are
 * small however large the image is. That ordering is what keeps a 100k px image from
 * jittering at full zoom.
 */

export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface Point {
  x: number;
  y: number;
}

export const IDENTITY: Readonly<Affine> = Object.freeze({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
});

export function translate(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

export function scale(x: number, y = x): Affine {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
}

/** Clockwise on screen, since the world is y-down. */
export function rotate(radians: number): Affine {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

/** `m × n`: apply `n` first, then `m`. */
export function multiply(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

/** Compose left to right: `compose(p, q, r)` is `p × q × r`, so `r` applies first. */
export function compose(...transforms: Affine[]): Affine {
  return transforms.reduce((acc, t) => multiply(acc, t), IDENTITY as Affine);
}

export function invert(m: Affine): Affine | null {
  const det = m.a * m.d - m.b * m.c;
  if (!det || !Number.isFinite(det)) return null;
  const inv = 1 / det;
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    e: (m.c * m.f - m.d * m.e) * inv,
    f: (m.b * m.e - m.a * m.f) * inv,
  };
}

export function apply(m: Affine, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/**
 * Column-major `mat3` for `uniformMatrix3fv`, mapping CSS pixels to clip space (−1…1,
 * y up) on the way, so the vertex shader is a single multiply.
 */
export function toClipMat3(
  m: Affine,
  width: number,
  height: number,
  out: Float32Array = new Float32Array(9),
): Float32Array {
  const sx = 2 / width;
  const sy = -2 / height;
  out[0] = m.a * sx;
  out[1] = m.b * sy;
  out[2] = 0;
  out[3] = m.c * sx;
  out[4] = m.d * sy;
  out[5] = 0;
  out[6] = m.e * sx - 1;
  out[7] = m.f * sy + 1;
  out[8] = 1;
  return out;
}
