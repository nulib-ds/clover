import React from "react";

import { Viewer, type ViewerProps } from "../../components/Viewer/Viewer";
import { Default } from "../../templates/default/Default";
import type { HostedProps } from "../host";

/**
 * `<clover-viewer>` (`specs/viewer.ts`): Clover's Viewer, always in its Default template,
 * up front, as the element is one build.
 */
export function ViewerElement({ props }: HostedProps) {
  return (
    <Viewer
      {...(props as Partial<ViewerProps>)}
      template={Default}
      iiifContent={props.iiifContent as ViewerProps["iiifContent"]}
    />
  );
}
