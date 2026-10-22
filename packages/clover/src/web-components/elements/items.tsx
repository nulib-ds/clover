import React, { useMemo } from "react";

import { Items, type ItemsProps } from "../../components/Items/Items";
import type { HostedProps } from "../host";
import { withNodes } from "./nodes";

/**
 * `<clover-items>` (`specs/items.ts`): `Items`, with the element's props, and `renderItem`
 * a function of the page's that returns a node.
 */
export function ItemsElement({ props }: HostedProps) {
  const given = useMemo(() => withNodes(props, ["renderItem"]), [props]);
  return <Items {...(given as ItemsProps)} />;
}
