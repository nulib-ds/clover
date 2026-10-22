import React from "react";

import { Content, type ContentProps } from "../../components/Content/Content";
import type { HostedProps } from "../host";

const FILL = { height: "100%" };

/**
 * `<clover-content>` (`specs/content.ts`): the root's view, drawn, as `Content` draws it.
 * The element is the stage's box: it takes its height from `--clover-content-height`
 * (default `60vh`), or from its own `style`, and the stage fills it.
 */
export function ContentElement({ props }: HostedProps) {
  return <Content {...(props as ContentProps)} style={FILL} />;
}
