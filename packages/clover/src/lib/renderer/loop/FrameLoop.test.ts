import { FrameLoop } from "./FrameLoop";

function fakeRaf() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  let now = 0;
  return {
    raf: (cb: FrameRequestCallback) => {
      const id = next++;
      queue.set(id, cb);
      return id;
    },
    caf: (id: number) => queue.delete(id),
    pending: () => queue.size,
    flush(ms = 16) {
      now += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((cb) => cb(now));
    },
  };
}

describe("FrameLoop", () => {
  it("coalesces invalidations into a single frame", () => {
    const frames = fakeRaf();
    const tick = vi.fn(() => false);
    const loop = new FrameLoop(tick, frames.raf, frames.caf);
    loop.invalidate();
    loop.invalidate();
    loop.invalidate();
    expect(frames.pending()).toBe(1);
    frames.flush();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(frames.pending()).toBe(0);
  });

  it("keeps ticking while the tick asks for more, then goes idle", () => {
    const frames = fakeRaf();
    let remaining = 3;
    const tick = vi.fn(() => --remaining > 0);
    const loop = new FrameLoop(tick, frames.raf, frames.caf);
    loop.invalidate();
    for (let i = 0; i < 5; i++) frames.flush();
    expect(tick).toHaveBeenCalledTimes(3);
    expect(frames.pending()).toBe(0);
  });

  it("hands the tick elapsed seconds, capped after an idle spell", () => {
    const frames = fakeRaf();
    const dts: number[] = [];
    const loop = new FrameLoop(
      (dt) => {
        dts.push(dt);
        return dts.length < 2;
      },
      frames.raf,
      frames.caf,
    );
    loop.invalidate();
    frames.flush(16);
    frames.flush(1000);
    expect(dts[0]).toBeCloseTo(1 / 60);
    expect(dts[1]).toBe(0.1);
  });

  it("draws at once in place of a frame already asked for", () => {
    const frames = fakeRaf();
    const tick = vi.fn(() => false);
    const loop = new FrameLoop(tick, frames.raf, frames.caf);
    loop.invalidate();
    loop.drawNow();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(frames.pending()).toBe(0);
    frames.flush();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("stops on dispose", () => {
    const frames = fakeRaf();
    const tick = vi.fn(() => true);
    const loop = new FrameLoop(tick, frames.raf, frames.caf);
    loop.invalidate();
    loop.dispose();
    frames.flush();
    loop.invalidate();
    expect(tick).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(0);
  });
});
