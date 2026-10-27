import {
  type Backend,
  type DrawCommand,
  type DrawResult,
  bleedInSourcePixels,
  hasPixels,
} from "../backend";

/**
 * The fallback backend, for a browser without WebGL2 or a GPU that keeps losing its
 * context. Canvas is 2D, so this is full-fidelity rather than a degraded mode: every
 * transform the camera produces is an affine `setTransform`.
 *
 * It also draws cross-origin pixels without CORS — the canvas is merely tainted — so it
 * never reports `"tainted"`.
 */
export class Canvas2DBackend implements Backend {
  readonly kind = "canvas2d" as const;
  readonly canvas: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D;
  private pixelRatio = 1;
  /**
   * Sources drawn before. An accelerated 2D canvas uploads a bitmap to the GPU on its
   * first draw, so the renderer's upload budget applies here too.
   */
  private drawn = new Set<string>();

  static create(canvas: HTMLCanvasElement): Canvas2DBackend | null {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d", { alpha: true });
    } catch {
      ctx = null;
    }
    if (!ctx || typeof ctx.drawImage !== "function") return null;
    return new Canvas2DBackend(canvas, ctx);
  }

  private constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  begin(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  draw(command: DrawCommand): DrawResult {
    if (!hasPixels(command.source)) return "skipped";
    const ctx = this.ctx;
    const m = command.transform;
    const r = this.pixelRatio;
    const crop = command.crop ?? {
      x: 0,
      y: 0,
      width: command.width,
      height: command.height,
    };

    const bleed = bleedInSourcePixels(command, r);

    ctx.setTransform(r * m.a, r * m.b, r * m.c, r * m.d, r * m.e, r * m.f);
    ctx.globalAlpha = command.opacity;
    ctx.drawImage(
      command.source as CanvasImageSource,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      crop.x,
      crop.y,
      crop.width + bleed.x,
      crop.height + bleed.y,
    );
    this.drawn.add(command.key);
    return "drawn";
  }

  end(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
  }

  has(key: string): boolean {
    return this.drawn.has(key);
  }

  release(key: string): void {
    // Nothing else is cached: drawImage reads the source each frame.
    this.drawn.delete(key);
  }

  dispose(): void {
    this.drawn.clear();
    // Shrinking the backing store frees its memory immediately.
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
