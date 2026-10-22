import React from "react";

import { Items, type ItemsProps } from "../../components/Items/Items";
import type { HostedProps } from "../host";

/** `<clover-items>` (`specs/items.ts`): `Items`, with the element's props. */
export function ItemsElement({ props }: HostedProps) {
  return <Items {...(props as ItemsProps)} />;
}
