import { createContext, useContext, useRef, useSyncExternalStore } from "react";

import type { ContentRenderer } from "../components/Content/renderers";
import type { Clover, CloverState } from "../core/clover";

/**
 * The Clover a `Root` owns, and the language it reads IIIF text in. The context value is
 * set once per Root (and when `language` changes), so parts never re-render through it:
 * they subscribe to the store for exactly what they read.
 */
export interface CloverContextValue {
  clover: Clover;
  language?: string;
  /** Renderers of the host's own, for `Content` to draw some views with. */
  renderers?: ContentRenderer[];
}

export const CloverContext = createContext<CloverContextValue | null>(null);

/** The Clover of the nearest `Root`, or null outside one. */
export function useOptionalClover(): CloverContextValue | null {
  return useContext(CloverContext);
}

/** The Clover of the nearest `Root`. Throws outside one, naming the part. */
export function useClover(part = "This part"): CloverContextValue {
  const value = useContext(CloverContext);
  if (!value) {
    throw new Error(`${part} must be rendered inside <Clover.Root>.`);
  }
  return value;
}

/**
 * A value derived from the store, re-rendering only when it changes. Selectors should
 * return the same object for the same state (the core's are memoized), or pass `isEqual`.
 */
export function useCloverSelector<Value>(
  selector: (state: CloverState) => Value,
  isEqual: (a: Value, b: Value) => boolean = Object.is,
  part?: string,
): Value {
  const { clover } = useClover(part);
  const cache = useRef<{ value: Value } | null>(null);
  const read = () => {
    const value = selector(clover.store.get());
    if (cache.current && isEqual(cache.current.value, value)) {
      return cache.current.value;
    }
    cache.current = { value };
    return value;
  };
  return useSyncExternalStore(clover.store.subscribe, read, read);
}

const NO_STORE = {
  subscribe: () => () => undefined,
};

/**
 * `useCloverSelector` for parts that also work outside a `Root` (the primitives): there it
 * returns `fallback` and subscribes to nothing.
 */
export function useOptionalCloverSelector<Value>(
  selector: (state: CloverState) => Value,
  fallback: Value,
): Value {
  const context = useContext(CloverContext);
  const store = context?.clover.store;
  const read = () => (store ? selector(store.get()) : fallback);
  return useSyncExternalStore(
    store ? store.subscribe : NO_STORE.subscribe,
    read,
    read,
  );
}
