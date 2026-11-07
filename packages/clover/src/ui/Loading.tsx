import React, { useEffect, useLayoutEffect, useRef } from "react";

import { join } from "../lib/classnames";
import { enterPass } from "./loadingPass";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Clover's loading mark: a 3px line in the accent that makes one pass however long the
 * load takes, 61.8% of the way, then 61.8% of what is left, each step a golden ratio
 * slower, and once nothing loads runs to the end and fades. Every mark in one Body
 * continues the same pass (`loadingPass.ts`). Decorative: what loads says so itself
 * (`aria-busy` on the region, a status message to announce it). As an `overlay` it runs
 * along the top edge of its positioned parent and takes no room, so nothing around it
 * moves and the Body keeps its own background.
 */
export function Loading({
  overlay = false,
  className,
}: {
  overlay?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useIsomorphicLayoutEffect(() => {
    const mark = ref.current;
    return mark ? enterPass(mark) : undefined;
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={join("clover-loading", className)}
      data-overlay={overlay || undefined}
    >
      <span />
    </span>
  );
}
