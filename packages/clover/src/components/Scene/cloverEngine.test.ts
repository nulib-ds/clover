import { createEngine, placement } from "./cloverEngine";
import { transform } from "../../lib/gltf/mat4";

describe("Clover's engine for a Scene", () => {
  it("places a model as the Scene says: its transforms in order, then at its point", () => {
    const m = placement({
      id: "a",
      src: "a.glb",
      position: [10, 0, 0],
      transforms: [
        { type: "scale", x: 2, y: 2, z: 2 },
        { type: "rotate", x: 0, y: 90, z: 0 },
        { type: "translate", x: 0, y: 1, z: 0 },
      ],
    });
    // (1, 0, 0) scaled to (2, 0, 0), turned to (0, 0, -2), moved up 1, then to its point.
    expect(transform(m, [1, 0, 0]).map((v) => +v.toFixed(5) + 0)).toEqual([
      10, 1, -2,
    ]);
  });

  it("says so, rather than drawing nothing, where the browser offers no WebGL2", () => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    try {
      const host = document.createElement("div");
      expect(() => createEngine(host, { onLost: () => undefined })).toThrow(
        "it offers no WebGL2",
      );
      expect(host.querySelector("canvas")).toBeNull();
    } finally {
      HTMLCanvasElement.prototype.getContext = getContext;
    }
  });
});
