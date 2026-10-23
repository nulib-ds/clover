import {
  compose,
  identity,
  lookAt,
  multiply,
  normalMatrix,
  perspective,
  rotation,
  scaling,
  transform,
  translation,
} from "./mat4";

const close = (values: number[]) =>
  values.map((value) => +value.toFixed(5) + 0);

describe("mat4", () => {
  it("composes a node's move, turn and scale, the scale first", () => {
    // A quarter turn about y: x goes to -z.
    const half = Math.SQRT1_2;
    const m = compose([1, 2, 3], [0, half, 0, half], [2, 2, 2]);
    expect(close(transform(m, [1, 0, 0]))).toEqual([1, 2, 1]);
  });

  it("multiplies the second first", () => {
    const m = multiply(translation([10, 0, 0]), scaling([2, 2, 2]));
    expect(close(transform(m, [1, 1, 1]))).toEqual([12, 2, 2]);
    expect(close(Array.from(multiply(identity(), m)))).toEqual(
      close(Array.from(m)),
    );
  });

  it("turns about x, then y, then z, as Presentation 4 turns", () => {
    // x by 90°: y goes to z; then y by 90°: z goes to x.
    expect(close(transform(rotation([90, 90, 0]), [0, 1, 0]))).toEqual([
      1, 0, 0,
    ]);
    expect(close(transform(rotation([0, 0, 90]), [1, 0, 0]))).toEqual([
      0, 1, 0,
    ]);
  });

  it("turns normals by the inverse of a scale", () => {
    const n = normalMatrix(scaling([2, 4, 1]));
    expect(close([n[0], n[4], n[8]])).toEqual([0.5, 0.25, 1]);
  });

  it("looks from the eye toward the target, down its -z", () => {
    const view = lookAt([0, 0, 5], [0, 0, 0]);
    expect(close(transform(view, [0, 0, 0]))).toEqual([0, 0, -5]);
    expect(close(transform(view, [0, 0, 5]))).toEqual([0, 0, 0]);
  });

  it("projects the near plane to -1 and the far to 1", () => {
    const p = perspective(Math.PI / 2, 1, 1, 10);
    const depth = (z: number) => {
      const w = -z;
      return (p[10] * z + p[14]) / w;
    };
    expect(+depth(-1).toFixed(5)).toBe(-1);
    expect(+depth(-10).toFixed(5)).toBe(1);
  });
});
