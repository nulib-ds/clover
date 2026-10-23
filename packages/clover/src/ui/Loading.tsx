import React from "react";

import { join } from "../lib/classnames";

/**
 * Clover's loading mark: a 3px line in the accent, drawn from start to end over and over,
 * fading in as it goes. Decorative: what loads says so itself (`aria-busy` on the region,
 * a status message to announce it). As an `overlay` it runs along the top edge of its
 * positioned parent and takes no room, so nothing around it moves and the Body keeps its
 * own background.
 */
export function Loading({
  overlay = false,
  className,
}: {
  overlay?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={join("clover-loading", className)}
      data-overlay={overlay || undefined}
    >
      <span />
    </span>
  );
}
