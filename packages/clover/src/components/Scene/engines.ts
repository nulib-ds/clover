import type { EngineOptions, SceneEngine } from "./drawing";

/** A Scene's drawing, loaded the first time a Scene that draws with it comes near. */
export type EngineLoader = () => Promise<{
  createEngine: (host: HTMLElement, options: EngineOptions) => SceneEngine;
}>;

/*
 * The engines a page registers besides Clover's own, by name (`registerThreeEngine`, in
 * `@nulib/clover/three`; `web-components/three.mjs`). Kept on `globalThis`, so every
 * Clover build on the page (React's, the elements', the Viewer element's) sees an engine
 * the page registered once.
 */
const KEY = Symbol.for("@nulib/clover/scene-engines");
const store = globalThis as unknown as Record<
  symbol,
  Map<string, EngineLoader>
>;
const registered = (store[KEY] ??= new Map());

export function registerSceneEngine(name: string, load: EngineLoader): void {
  registered.set(name, load);
}

const clover: EngineLoader = () => import("./cloverEngine");
let warned = false;

/**
 * The engine a Scene asks for, else Clover's own: one the page has not registered draws
 * with Clover's, and the console says so, once.
 */
export function engineFor(name = "clover"): EngineLoader {
  if (name === "clover") return clover;
  const load = registered.get(name);
  if (load) return load;
  if (!warned) {
    warned = true;
    // Short, as every Scene carries it: the Scene page's docs say how to register one.
    console.warn(`Clover: no Scene engine "${name}"; drawing with Clover's.`);
  }
  return clover;
}
