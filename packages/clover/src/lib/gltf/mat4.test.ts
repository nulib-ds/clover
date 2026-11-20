import { Euler, Matrix4 } from "three";
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

  it("turns as an intrinsic Euler rotation in XYZ order (IIIF/api#2504)", () => {
    // Rx · Ry · Rz: x by 90° about its own axes, then y about the axes x left. The
    // y axis lands on z; read extrinsically it would land on x instead.
    expect(close(transform(rotation([90, 90, 0]), [0, 1, 0]))).toEqual([
      0, 0, 1,
    ]);
    expect(close(transform(rotation([0, 0, 90]), [1, 0, 0]))).toEqual([
      0, 1, 0,
    ]);
  });

  it("turns as three.js's XYZ Euler does, so both Scene engines agree", () => {
    for (const [x, y, z] of [
      [90, 90, 0],
      [30, -60, 120],
      [-90, 45, 10],
    ] as const) {
      const radians = (degrees: number) => (degrees * Math.PI) / 180;
      const three = new Matrix4().makeRotationFromEuler(
        new Euler(radians(x), radians(y), radians(z), "XYZ"),
      );
      expect(close([...rotation([x, y, z])])).toEqual(close(three.elements));
    }
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
