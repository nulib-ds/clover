import React, { useMemo } from "react";

import type { HostedProps } from "../host";
import { withNodes } from "./nodes";

/**
 * An element that draws a part as it is, with the element's props: for every part that
 * needs nothing more of its element (`define.ts`). It loads with the part's own module,
 * never in the entry, which holds no Preact. `nodes` names the part's function props a
 * page writes as functions that return a node (`renderValue`).
 */
export function drawn(
  // The parts' props differ; each element's spec gives what its part takes.
  Part: React.ComponentType<any>,
  nodes: readonly string[] = [],
): React.ComponentType<HostedProps> {
  return function Drawn({ props }: HostedProps) {
    const given = useMemo(() => withNodes(props, nodes), [props]);
    return <Part {...given} />;
  };
}
