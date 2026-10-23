import type { Affine } from "../math/affine";
import type { Rect } from "../math/rect";

export type BackendKind = "webgl2" | "canvas2d" | "none";

/** A decoded picture a backend can draw: what `texImage2D` and `drawImage` both accept. */
export type DrawSource =
  | ImageBitmap
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas;

export interface DrawCommand {
  /** Stable identity for the source. A backend caches its upload under this key. */
  key: string;
  source: DrawSource;
  /** The source's pixel size. */
  width: number;
  height: number;
  /** Source pixels → the Body's CSS pixels. */
  transform: Affine;
  /** The part of the source to draw, in source pixels. Defaults to all of it. */
  crop?: Rect;
  opacity: number;
  /**
   * Stretch the right and/or bottom edge by one device pixel. Set on a tile that has a
   * neighbor on that side: two quads that meet exactly can still leave a hairline of
   * background between them once antialiased or rounded, and the neighbor paints over
   * the overlap anyway.
   */
  bleed?: { right: boolean; bottom: boolean };
  /**
   * Bumped when the pixels behind `key` change (a new video frame). A backend that
   * caches uploads re-uploads when it differs from what it last saw.
   */
  version?: number;
}

export type DrawResult =
  | "drawn"
  /** Cross-origin pixels the backend is not allowed to read (WebGL with no CORS). */
  | "tainted"
  /** Nothing to draw yet, or the backend has no context right now. */
  | "skipped";

/**
 * A painter. It owns a `<canvas>` and nothing else: no camera, no scene, no I/O.
 *
 * Every frame is redrawn whole — `begin`, a `draw` per visible item in paint order,
 * `end`. Nothing persists on the surface between frames, so a compositor reading the
 * buffer at any moment sees a complete picture.
 */
export interface Backend {
  readonly kind: BackendKind;
  readonly canvas: HTMLCanvasElement;
  /** True while the GPU context is gone; draws are skipped until it is restored. */
  readonly lost: boolean;
  resize(width: number, height: number, pixelRatio: number): void;
  begin(): void;
  draw(command: DrawCommand): DrawResult;
  end(): void;
  /** Whether `key` can be drawn without first being uploaded. */
  has(key: string): boolean;
  /** Drop any cached upload for `key`. */
  release(key: string): void;
  /** Free the context and everything uploaded to it. */
  dispose(): void;
}

export interface BackendCallbacks {
  /** The context came back; everything must be redrawn (uploads were lost with it). */
  onRestored?: () => void;
  onLost?: () => void;
}

/** A video with no current frame has nothing to upload yet. */
export function hasPixels(source: DrawSource): boolean {
  if (
    typeof HTMLVideoElement !== "undefined" &&
    source instanceof HTMLVideoElement
  ) {
    return source.readyState >= 2 && source.videoWidth > 0;
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    source instanceof HTMLImageElement
  ) {
    return source.complete && source.naturalWidth > 0;
  }
  return true;
}

/**
 * One device pixel, in the source pixels of `command`: the bleed a backend adds to an
 * edge that has a neighbor.
 */
export function bleedInSourcePixels(
  command: DrawCommand,
  pixelRatio: number,
): { x: number; y: number } {
  if (!command.bleed) return { x: 0, y: 0 };
  const m = command.transform;
  const sx = Math.hypot(m.a, m.b) * pixelRatio;
  const sy = Math.hypot(m.c, m.d) * pixelRatio;
  return {
    x: command.bleed.right && sx > 0 ? 1 / sx : 0,
    y: command.bleed.bottom && sy > 0 ? 1 / sy : 0,
  };
}
