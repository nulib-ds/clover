import { anchoredCenter, worldPointToScreen } from "./Camera";
import { CameraAnimator } from "./CameraAnimator";

const viewport = { width: 800, height: 600 };
const start = { x: 0, y: 0, zoom: 1, rotation: 0 };

function run(animator: CameraAnimator, frames = 600, dt = 1 / 60) {
  let steps = 0;
  while (animator.step(dt, viewport) && steps < frames) steps++;
  return steps;
}

describe("CameraAnimator", () => {
  it("settles exactly on its target", () => {
    const animator = new CameraAnimator(start);
    const target = { x: 300, y: -200, zoom: 4, rotation: Math.PI / 2 };
    animator.animateTo({ state: target }, viewport);
    const steps = run(animator);
    expect(steps).toBeLessThan(600);
    // Settled: a further frame has nothing left to do.
    expect(animator.step(1 / 60, viewport)).toBe(false);
    expect(animator.current).toEqual(target);
  });

  it("jumps when asked for an immediate move, or with animation off", () => {
    const target = { x: 10, y: 20, zoom: 3, rotation: 0 };
    const immediate = new CameraAnimator(start);
    immediate.animateTo({ state: target }, viewport, true);
    expect(immediate.current).toEqual(target);

    const reduced = new CameraAnimator(start, 0);
    reduced.animateTo({ state: target }, viewport);
    expect(reduced.current).toEqual(target);
  });

  it("holds an anchored point still on screen throughout a zoom", () => {
    const animator = new CameraAnimator(start);
    const world = { x: 120, y: -40 };
    const screen = worldPointToScreen(start, viewport, world);
    const zoom = 8;
    const center = anchoredCenter(world, screen, zoom, 0, viewport);
    animator.animateTo(
      { state: { ...center, zoom, rotation: 0 }, anchor: { world, screen } },
      viewport,
    );

    for (let i = 0; i < 5; i++) {
      animator.step(1 / 60, viewport);
      const p = worldPointToScreen(animator.current, viewport, world);
      expect(p.x).toBeCloseTo(screen.x, 6);
      expect(p.y).toBeCloseTo(screen.y, 6);
    }
  });

  it("drops an anchor its target disagrees with, so a clamped zoom still settles", () => {
    const animator = new CameraAnimator(start);
    const target = { x: 0, y: 0, zoom: 0.5, rotation: 0 };
    animator.animateTo(
      {
        state: target,
        anchor: { world: { x: 300, y: 0 }, screen: { x: 700, y: 300 } },
      },
      viewport,
    );
    run(animator);
    // Settled: a further frame has nothing left to do.
    expect(animator.step(1 / 60, viewport)).toBe(false);
    expect(animator.current).toEqual(target);
  });

  it("re-aims mid-flight without restarting", () => {
    const animator = new CameraAnimator(start);
    animator.animateTo({ state: { ...start, x: 100 } }, viewport);
    animator.step(1 / 60, viewport);
    const midway = animator.current.x;
    animator.animateTo({ state: { ...start, x: 200 } }, viewport);
    animator.step(1 / 60, viewport);
    expect(animator.current.x).toBeGreaterThan(midway);
    run(animator);
    expect(animator.current.x).toBe(200);
  });
});
