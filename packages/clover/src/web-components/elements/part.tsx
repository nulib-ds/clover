import React from "react";

import type { HostedProps } from "../host";

/**
 * An element that draws a part as it is, with the element's props: for every part that
 * needs nothing more of its element (`define.ts`). It loads with the part's own module,
 * never in the entry, which holds no Preact.
 */
export function drawn(
  // The parts' props differ; each element's spec gives what its part takes.
  Part: React.ComponentType<any>,
): React.ComponentType<HostedProps> {
  return function Drawn({ props }: HostedProps) {
    return <Part {...props} />;
  };
}
