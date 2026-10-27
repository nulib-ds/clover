import type { CloverCanvasOptions } from "./Canvas.types";
import type { CanvasRenderer } from "../../lib/renderer";

/**
 * What `CanvasView` draws on, made on its viewport once that is mounted: Clover's
 * renderer for a Canvas (`rendererSurface`), or a Timeline's, which has nothing to draw
 * and no camera (`Timeline/playerSurface.ts`), so a page that only plays sound never
 * loads the renderer nor holds one of the page's WebGL contexts. Its caller hands
 * `CanvasView` the maker, so the view itself never imports the renderer.
 *
 * The view reads only these from either. Its camera's parts (zoom, rotation and reset,
 * the navigator, hotspots, an animation's frames, the handle `onReady` passes) are the
 * renderer's alone, found by `hasCamera`.
 */
export type CanvasSurface = Pick<
  CanvasRenderer,
  | "host"
  | "isOpen"
  | "on"
  | "setImages"
  | "clear"
  | "setDismiss"
  | "setGestures"
  | "dispose"
>;

export type MakeSurface = (
  host: HTMLElement,
  options?: CloverCanvasOptions,
) => CanvasSurface;

/** Whether the surface is the renderer, with a camera to move and overlays to pin. */
export const hasCamera = (
  surface: CanvasSurface | null,
): surface is CanvasRenderer => Boolean(surface && "overlays" in surface);
