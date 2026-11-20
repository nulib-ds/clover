import {
  apply,
  compose,
  invert,
  rotate,
  scale,
  toClipMat3,
  translate,
} from "./affine";
import { toCssMatrix } from "./cssMatrix";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe("affine", () => {
  it("composes right to left", () => {
    // Scale first, then translate.
    const m = compose(translate(10, 20), scale(2));
    const p = apply(m, { x: 3, y: 4 });
    expect(p).toEqual({ x: 16, y: 28 });
  });

  it("rotates clockwise on a y-down screen", () => {
    const p = apply(rotate(Math.PI / 2), { x: 1, y: 0 });
    close(p.x, 0);
    close(p.y, 1);
  });

  it("inverts back to the identity", () => {
    const m = compose(translate(5, -7), rotate(0.3), scale(4, 2));
    const inverse = invert(m)!;
    const p = apply(inverse, apply(m, { x: 123.4, y: -56.7 }));
    close(p.x, 123.4);
    close(p.y, -56.7);
  });

  it("refuses a singular matrix", () => {
    expect(invert(scale(0, 1))).toBeNull();
  });

  it("maps CSS pixels to clip space for the vertex shader", () => {
    const mat = toClipMat3(translate(0, 0), 200, 100);
    const clip = (x: number, y: number) => ({
      x: mat[0] * x + mat[3] * y + mat[6],
      y: mat[1] * x + mat[4] * y + mat[7],
    });
    // The result is float32, ready for upload.
    const expectClip = (p: { x: number; y: number }, x: number, y: number) => {
      expect(p.x).toBeCloseTo(x, 6);
      expect(p.y).toBeCloseTo(y, 6);
    };
    expectClip(clip(0, 0), -1, 1);
    expectClip(clip(200, 100), 1, -1);
    expectClip(clip(100, 50), 0, 0);
  });

  it("writes a compact CSS matrix", () => {
    expect(toCssMatrix(compose(translate(1.5, -2), scale(0.123456789)))).toBe(
      "matrix(0.123457,0,0,0.123457,1.5,-2)",
    );
  });
});
