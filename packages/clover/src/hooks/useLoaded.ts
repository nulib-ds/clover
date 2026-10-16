import { useEffect, useState } from "react";

const loaded = new WeakMap<() => Promise<unknown>, unknown>();

/**
 * A module loaded on demand: null until `needed` first holds and the module arrives, then
 * the module, at once, for every component that asks for it after. Ask as soon as it may
 * be needed (a Canvas with annotations, not the press that opens their menu), so it is
 * there before it is used, and what it draws is drawn without a wait.
 *
 * `load` must be one function for the module (a constant, `() => import("./Menu")`): it is
 * what the loaded module is kept under.
 */
export function useLoaded<T>(
  load: () => Promise<T>,
  needed: boolean,
): T | null {
  const [module, setModule] = useState<T | null>(
    () => (loaded.get(load) as T | undefined) ?? null,
  );
  useEffect(() => {
    if (!needed || module) return;
    let live = true;
    load().then(
      (arrived) => {
        loaded.set(load, arrived);
        if (live) setModule(() => arrived);
      },
      // Unreachable (offline, a blocked chunk): what it would draw stays undrawn.
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [load, needed, module]);
  return module;
}
