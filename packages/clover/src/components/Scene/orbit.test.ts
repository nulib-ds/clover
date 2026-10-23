import {
  cameraPosition,
  fitDistance,
  homeOrbit,
  sameOrbit,
  turned,
  zoomed,
} from "./orbit";

const bounds = { center: [0, 1, 0] as [number, number, number], radius: 1 };

describe("orbit", () => {
  it("starts in front of the models, a little above, far enough to fit them", () => {
    const home = homeOrbit(bounds);
    expect(home.theta).toBe(0);
    expect(home.phi).toBeLessThan(Math.PI / 2);
    expect(home.distance).toBeCloseTo(fitDistance(1));
    const [x, y, z] = cameraPosition(home, bounds.center);
    expect(x).toBeCloseTo(0);
    expect(y).toBeGreaterThan(1);
    expect(z).toBeGreaterThan(0);
  });

  it("stands farther back for a narrow Body, so the models still fit across", () => {
    expect(fitDistance(1, 0.5)).toBeGreaterThan(fitDistance(1, 1));
    expect(fitDistance(1, 2)).toBeCloseTo(fitDistance(1, 1));
  });

  it("turns all the way round, but never tilts over the top or under", () => {
    const home = homeOrbit(bounds);
    expect(turned(home, Math.PI * 2, 0).theta).toBeCloseTo(Math.PI * 2);
    expect(sameOrbit(turned(home, Math.PI * 2, 0), home)).toBe(true);
    expect(turned(home, 0, -10).phi).toBeGreaterThan(0);
    expect(turned(home, 0, 10).phi).toBeLessThan(Math.PI);
  });

  it("zooms within reach of home", () => {
    const home = homeOrbit(bounds);
    expect(zoomed(home, 2, home).distance).toBeCloseTo(home.distance / 2);
    expect(zoomed(home, 1000, home).distance).toBeGreaterThan(0);
    expect(zoomed(home, 1 / 1000, home).distance).toBeLessThan(
      home.distance * 10,
    );
  });
});
