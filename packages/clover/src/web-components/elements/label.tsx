import React from "react";

import { Label, type LabelProps } from "../../components/Label/Label";
import type { HostedProps } from "../host";

/** `<clover-label>` (`specs/label.ts`): `Label`, with the element's props. */
export function LabelElement({ props }: HostedProps) {
  return <Label {...(props as LabelProps)} />;
}
