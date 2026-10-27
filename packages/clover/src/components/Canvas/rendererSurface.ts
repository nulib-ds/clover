import type { MakeSurface } from "./surface";
import { CanvasRenderer } from "../../lib/renderer";

/** Clover's renderer as a Canvas's surface: its images, video and camera. */
export const rendererSurface: MakeSurface = (host, options) =>
  new CanvasRenderer(host, options);
