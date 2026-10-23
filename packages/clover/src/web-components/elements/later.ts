import { useEffect, useLayoutEffect, useState } from "react";

/*
 * What only some pages use, loaded when one does: the adapters for a page's own control
 * buttons and renderers. A page that gives neither never loads them.
 */
export const loadControls = () => import("./controls");
export const loadRenderers = () => import("./renderers");

const LOADED = new Map<() => Promise<unknown>, unknown>();

/**
 * A module, loaded once for the page the first time `wanted` is true; null until it is
 * here. What needs it waits for it, so nothing is drawn one way and then another.
 */
export function useLoaded<T>(
  load: () => Promise<T>,
  wanted: boolean,
): T | null {
  const [module, setModule] = useState<T | null>(
    () => (LOADED.get(load) as T | undefined) ?? null,
  );
  useEffect(() => {
    if (!wanted || module) return;
    let current = true;
    void load().then((loaded) => {
      LOADED.set(load, loaded);
      if (current) setModule(loaded);
    });
    return () => {
      current = false;
    };
  }, [load, wanted, module]);
  return module;
}

/** The Body's handle, let go when the Body is: the element keeps none of a gone view. */
export function useHandle(onReady: unknown) {
  useLayoutEffect(
    () => () => (onReady as ((handle: null) => void) | undefined)?.(null),
    [onReady],
  );
}
