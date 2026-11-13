/*
 * @nulib/clover/canvas: `Canvas` on its own, as `@nulib/clover` exports it, for a bundler
 * that counts a module's re-exports as reached (esbuild's code splitting;
 * `src/viewer/index.ts` says why). It draws alone (`iiifContent`, `src` or `body`) or
 * in a `Root` from `@nulib/clover`, one module graph.
 *
 *   import { Canvas } from "@nulib/clover/canvas";
 */

export { default as Canvas } from "../components/Canvas";
export type {
  CanvasHandle,
  CloverCanvasOptions,
  CloverCanvasProps,
  IIIFCanvas,
} from "../components/Canvas";
export type {
  CanvasControlsConfig,
  LabeledIIIFExternalWebResource,
} from "../components/Canvas/Canvas.types";
export type { ControlButtonProps, ControlButtons } from "../ui/controlButtons";
