import { containAspect } from "./rect";

describe("containAspect", () => {
  it("centers the largest rectangle of an aspect inside a box", () => {
    const box = { x: 10, y: 0, width: 200, height: 200 };
    expect(containAspect(box, { width: 16, height: 9 })).toEqual({
      x: 10,
      y: 43.75,
      width: 200,
      height: 112.5,
    });
    expect(containAspect(box, null)).toBe(box);
  });

  it("gives a video its own frame size on a Canvas of no area (Cookbook 0015)", () => {
    // A Canvas with a duration and no width or height: nothing to fit inside.
    const none = { x: 0, y: 0, width: 0, height: 0 };
    expect(containAspect(none, { width: 640, height: 360 })).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 360,
    });
    expect(containAspect(none, null)).toBe(none);
  });
});
