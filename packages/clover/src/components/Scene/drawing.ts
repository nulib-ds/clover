import type { Bounds, Orbit } from "./orbit";
import type { SceneModel } from "./models";
import type { CloverRequest } from "../../core/request";

/*
 * What a Scene's drawing does, whichever draws it: Clover's own (`cloverEngine.ts`, the
 * default) or three.js (`engine.ts`, `engine="three"`). Types alone: nothing of it loads.
 */

export interface SceneEngine {
  /** Load the models and lay them out; their bounding sphere, which the camera turns around. */
  load(models: SceneModel[], request?: CloverRequest): Promise<Bounds>;
  /** Draw the Scene from this place on the orbit. */
  draw(orbit: Orbit): void;
  /** The Body changed size: fit the drawing surface to it. */
  resize(): void;
  /** Free the graphics context and everything loaded into it. */
  dispose(): void;
}

export interface EngineOptions {
  /** The browser took the graphics context away (too many on the page, a GPU reset). */
  onLost: () => void;
}
