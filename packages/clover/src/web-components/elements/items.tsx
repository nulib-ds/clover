import React, { useMemo } from "react";

import { Items, type ItemsProps } from "../../components/Items/Items";
import type { HostedProps } from "../host";
import { loadControls, useLoaded } from "./later";
import { withNodes } from "./nodes";

/**
 * `<clover-items>` (`specs/items.ts`): `Items`, with the element's props, `renderItem`
 * a function of the page's that returns a node, and its arrows the page's own where it
 * gives them (`controlButtons`, whose adapter loads only then).
 */
export function ItemsElement({ props }: HostedProps) {
  const given = useMemo(() => withNodes(props, ["renderItem"]), [props]);
  const { controlButtons, ...rest } = given as Record<string, unknown>;
  const controls = useLoaded(loadControls, Boolean(controlButtons));
  const buttons = useMemo(
    () => controls?.toControlButtons(controlButtons),
    [controls, controlButtons],
  );
  if (controlButtons && !controls) return null;
  return <Items {...(rest as ItemsProps)} controlButtons={buttons} />;
}
