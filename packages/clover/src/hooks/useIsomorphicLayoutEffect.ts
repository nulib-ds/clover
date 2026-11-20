import { useEffect, useLayoutEffect } from "react";

/**
 * A layout effect in the browser, an effect on the server (where there is no layout). The
 * templates, which import only what `@nulib/clover` exports, keep their own
 * (`templates/shared/useSlide.ts`).
 */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
