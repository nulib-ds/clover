import React from "react";

import { Content, type ContentProps } from "../../components/Content/Content";
import type { HostedProps } from "../host";
import { useWatched } from "./nodes";
import { Toggle } from "./toggle";

const FILL = { height: "100%" };

/** The stage's `<clover-panel-toggle>`, which it draws among its controls. */
const toggleOf = (element: Element) =>
  ([...element.children].find(
    (child) => child.localName === "clover-panel-toggle",
  ) as HTMLElement | undefined) ?? null;

/**
 * `<clover-content>` (`specs/content.ts`): the root's view, drawn, as `Content` draws it.
 * The element is the stage's box: it takes its height from `--clover-content-height`
 * (default `60vh`), or from its own `style`, and the stage fills it. A
 * `<clover-panel-toggle>` in it is one of its controls, in the cluster, where `Content`
 * places a child.
 */
export function ContentElement({ hosted, props }: HostedProps) {
  const toggle = useWatched(
    hosted.element,
    () => toggleOf(hosted.element),
    Object.is,
  );
  return (
    <Content {...(props as ContentProps)} style={FILL}>
      {toggle && <Toggle element={toggle} />}
    </Content>
  );
}
