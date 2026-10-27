/**
 * Draws on demand.
 *
 * Nothing runs while the picture is still: `invalidate()` asks for one frame, and the
 * tick keeps the loop alive only by returning true (an animation in flight, a video
 * playing). A still image costs nothing between interactions.
 */
export type FrameTick = (dt: number, now: number) => boolean;

/** Longest step handed to the tick, so a backgrounded tab doesn't jump on return. */
const MAX_DT = 0.1;

export class FrameLoop {
  private handle = 0;
  private last = 0;
  private disposed = false;

  constructor(
    private readonly tick: FrameTick,
    private readonly raf: (cb: FrameRequestCallback) => number = (cb) =>
      requestAnimationFrame(cb),
    private readonly caf: (handle: number) => void = (handle) =>
      cancelAnimationFrame(handle),
  ) {}

  invalidate(): void {
    if (this.disposed || this.handle) return;
    this.handle = this.raf(this.frame);
  }

  /**
   * Draws at once rather than at the next frame, taking the place of a frame already
   * asked for. For a resize: changing a canvas's size clears it, and a ResizeObserver
   * runs after this frame's animation callbacks but before its paint, so a frame left to
   * the next one paints blank.
   */
  drawNow(): void {
    if (this.disposed) return;
    if (this.handle) this.caf(this.handle);
    this.frame(performance.now());
  }

  dispose(): void {
    this.disposed = true;
    if (this.handle) this.caf(this.handle);
    this.handle = 0;
  }

  private frame = (now: number) => {
    this.handle = 0;
    if (this.disposed) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, MAX_DT) : 1 / 60;
    this.last = now;
    const again = this.tick(dt, now);
    if (again) {
      this.invalidate();
    } else {
      // The next frame after an idle spell starts fresh rather than seeing a huge dt.
      this.last = 0;
    }
  };
}
