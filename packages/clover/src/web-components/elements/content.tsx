import React, { useMemo } from "react";

import { Content, type ContentProps } from "../../components/Content/Content";
import type { HostedProps } from "../host";
import { loadControls, loadRenderers, useHandle, useLoaded } from "./later";
import { Placed, useWatched } from "./nodes";
import { Toggle } from "./toggle";

const FILL = { height: "100%" };

/** The stage's `<clover-panel-toggle>`, which it draws among its controls. */
const toggleOf = (element: Element) =>
  ([...element.children].find(
    (child) => child.localName === "clover-panel-toggle",
  ) as HTMLElement | undefined) ?? null;

/** A button the page wrote in the stage: one of its controls, after Clover's. */
const isButton = (node: Node) =>
  node instanceof HTMLElement && node.localName === "button";

/**
 * `<clover-content>` (`specs/content.ts`): the root's view, drawn, as `Content` draws it.
 * The element is the stage's box: it takes its height from `--clover-content-height`
 * (default `60vh`), or from its own `style`, and the stage fills it. A
 * `<clover-panel-toggle>` in it is one of its controls, in the cluster, where `Content`
 * places a child, and so is each `<button>` of the page's, after it, as a React host's
 * children are. Its controls can be the page's own (`controlButtons`), and its views
 * drawn by the page's renderers (`renderers`): each adapter loads only for a page that
 * gives them, and the stage waits for it.
 */
export function ContentElement({ hosted, props }: HostedProps) {
  const toggle = useWatched(
    hosted.element,
    () => toggleOf(hosted.element),
    Object.is,
  );
  const { controlButtons, renderers, onReady, ...rest } = props as Record<
    string,
    unknown
  >;
  const controls = useLoaded(loadControls, Boolean(controlButtons));
  const rendering = useLoaded(loadRenderers, Boolean(renderers));
  const buttons = useMemo(
    () => controls?.toControlButtons(controlButtons),
    [controls, controlButtons],
  );
  const adapted = useMemo(
    () => rendering?.toRenderers(renderers),
    [rendering, renderers],
  );
  useHandle(onReady);
  if ((controlButtons && !controls) || (renderers && !rendering)) return null;
  return (
    <Content
      {...(rest as ContentProps)}
      onReady={onReady as ContentProps["onReady"]}
      controlButtons={buttons}
      renderers={adapted}
      style={FILL}
    >
      {toggle && <Toggle element={toggle} />}
      <Placed from={hosted.element} picks={isButton} />
    </Content>
  );
}
