import { useLayoutEffect } from "react";

export { useLoaded } from "../../hooks/useLoaded";

/*
 * What only some pages use, loaded when one does: the adapters for a page's own control
 * buttons and renderers. A page that gives neither never loads them.
 */
export const loadControls = () => import("./controls");
export const loadRenderers = () => import("./renderers");

/** The Body's handle, let go when the Body is: the element keeps none of a gone view. */
export function useHandle(onReady: unknown) {
  useLayoutEffect(
    () => () => (onReady as ((handle: null) => void) | undefined)?.(null),
    [onReady],
  );
}
