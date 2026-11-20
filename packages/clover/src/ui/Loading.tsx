import React, { useRef } from "react";

import { enterPass } from "./loadingPass";
import { useIsomorphicLayoutEffect } from "../hooks/useIsomorphicLayoutEffect";

/**
 * Clover's loading mark: a 3px line in the accent that makes one pass however long the
 * load takes, 61.8% of the way, then 61.8% of what is left, each step a golden ratio
 * slower, and once nothing loads runs to the end and fades. Every mark in one Body
 * continues the same pass (`loadingPass.ts`). Decorative: what loads says so itself
 * (`aria-busy` on the region, a status message to announce it). As an `overlay` it runs
 * along the top edge of its positioned parent and takes no room, so nothing around it
 * moves and the Body keeps its own background.
 */
export function Loading({ overlay = false }: { overlay?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useIsomorphicLayoutEffect(() => {
    const mark = ref.current;
    return mark ? enterPass(mark) : undefined;
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="clover-loading"
      data-overlay={overlay || undefined}
    >
      <span />
    </span>
  );
}
