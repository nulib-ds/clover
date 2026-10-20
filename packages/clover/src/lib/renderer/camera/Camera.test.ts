import {
  anchoredCenter,
  fitCamera,
  screenPointToWorld,
  visibleWorldRect,
  worldPointToScreen,
} from "./Camera";

const viewport = { width: 800, height: 600 };

describe("Camera", () => {
  it("round-trips points between world and screen", () => {
    const camera = { x: 5000, y: 3000, zoom: 0.37, rotation: 0.7 };
    const world = { x: 4321.5, y: 2987.25 };
    const back = screenPointToWorld(
      camera,
      viewport,
      worldPointToScreen(camera, viewport, world),
    );
    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.y).toBeCloseTo(world.y, 6);
  });

  it("puts the camera center in the middle of the viewport", () => {
    const camera = { x: 100, y: 50, zoom: 2, rotation: 0 };
    expect(worldPointToScreen(camera, viewport, { x: 100, y: 50 })).toEqual({
      x: 400,
      y: 300,
    });
  });

  it("fits a landscape image to the viewport width", () => {
    const camera = fitCamera(
      { x: 0, y: 0, width: 8949, height: 5709 },
      viewport,
    );
    expect(camera.zoom).toBeCloseTo(800 / 8949, 9);
    expect(camera.x).toBe(8949 / 2);
    expect(camera.y).toBe(5709 / 2);
  });

  it("fits the rotated extent when rotated a quarter turn", () => {
    const camera = fitCamera(
      { x: 0, y: 0, width: 8949, height: 5709 },
      viewport,
      Math.PI / 2,
    );
    // On its side the image is 5709 wide and 8949 tall: height now limits.
    expect(camera.zoom).toBeCloseTo(600 / 8949, 9);
  });

  it("reports the visible world rectangle", () => {
    const rect = visibleWorldRect(
      { x: 400, y: 300, zoom: 1, rotation: 0 },
      viewport,
    );
    expect(rect).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it("keeps an anchor under the same screen point at any zoom", () => {
    const anchor = { x: 1200, y: 800 };
    const screen = { x: 650, y: 120 };
    for (const zoom of [0.1, 0.5, 2, 8]) {
      const center = anchoredCenter(anchor, screen, zoom, 0.4, viewport);
      const p = worldPointToScreen(
        { ...center, zoom, rotation: 0.4 },
        viewport,
        anchor,
      );
      expect(p.x).toBeCloseTo(screen.x, 6);
      expect(p.y).toBeCloseTo(screen.y, 6);
    }
  });
});
