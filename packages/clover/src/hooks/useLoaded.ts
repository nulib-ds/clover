import { useEffect, useState } from "react";

const loaded = new WeakMap<() => Promise<unknown>, unknown>();

/**
 * A module loaded on demand: null until `needed` first holds and the module arrives, then
 * the module, at once, for every component that asks for it after. Ask as soon as it may
 * be needed (a Canvas with a Choice, not the press that opens its menu), so it is there
 * before it is used, and what it draws is drawn without a wait. A menu only its control
 * opens may ask as the control is pointed at, focused or pressed (`Button`'s
 * `onPrepare`), where asking sooner would load it on every page that never opens it: the
 * annotations menu (Mat, 2026-11-20).
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
