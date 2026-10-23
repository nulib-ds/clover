import { emptyBox, growBox, turnsNothing } from "./bounds";
import type { GltfAsset } from "./load";
import { identity, multiply, rotation, scaling, translation } from "./mat4";

/** An asset of one POSITION accessor over these points, with these bounds, if any. */
const asset = (points: number[], bounds?: { min: number[]; max: number[] }) => {
  const data = new Float32Array(points);
  return {
    json: {
      bufferViews: [{ buffer: 0, byteLength: data.byteLength }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: points.length / 3,
          type: "VEC3",
          ...bounds,
        },
      ],
    },
    buffers: [data.buffer],
    images: [],
  } as unknown as GltfAsset;
};

const close = (box: { min: number[]; max: number[] }) => ({
  min: box.min.map((value) => +value.toFixed(4) + 0),
  max: box.max.map((value) => +value.toFixed(4) + 0),
});

describe("turnsNothing", () => {
  it("holds for a scale, a mirror, a swap of axes and a move", () => {
    expect(turnsNothing(identity())).toBe(true);
    expect(
      turnsNothing(multiply(translation([4, 5, 6]), scaling([2, -1, 3]))),
    ).toBe(true);
    expect(turnsNothing(rotation([0, 0, 90]))).toBe(true);
  });

  it("fails for a turn off the axes", () => {
    expect(turnsNothing(rotation([0, 0, 45]))).toBe(false);
  });
});

describe("growBox", () => {
  // A thin bar from (-1, -0.1) to (1, 0.1): its box's other corners hold no point.
  const bar = [-1, -0.1, 0, 1, 0.1, 0];
  const bounds = { min: [-1, -0.1, 0], max: [1, 0.1, 0] };

  it("places an accessor's bounds where nothing turns them", () => {
    const box = growBox(
      emptyBox(),
      asset(bar, bounds),
      0,
      multiply(translation([10, 0, 0]), scaling([2, 2, 2])),
    );
    expect(close(box)).toEqual({ min: [8, -0.2, 0], max: [12, 0.2, 0] });
  });

  it("places every point where a turn would grow its box's corners", () => {
    // Turned 45°, the bar's points reach 0.6364 across; its box's corners, 0.7778.
    const box = growBox(
      emptyBox(),
      asset(bar, bounds),
      0,
      rotation([0, 0, 45]),
    );
    expect(close(box)).toEqual({
      min: [-0.6364, -0.7778, 0],
      max: [0.6364, 0.7778, 0],
    });
  });

  it("reads the points of an accessor without bounds, and grows a box it is given", () => {
    const box = growBox(
      { min: [-5, 0, 0], max: [0, 0, 0] },
      asset([1, 2, 3, -1, 0, 4]),
      0,
      identity(),
    );
    expect(close(box)).toEqual({ min: [-5, 0, 0], max: [1, 2, 4] });
  });
});
