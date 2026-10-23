import React, { useMemo } from "react";

import { Body, type BodyProps } from "../../components/Body/Body";
import type { HostedProps } from "../host";
import { loadControls, loadRenderers, useHandle, useLoaded } from "./later";
import { Placed, useWatched } from "./nodes";
import { Toggle } from "./toggle";

const FILL = { height: "100%" };

/** The Body's `<clover-panel-toggle>`, which it draws among its controls. */
const toggleOf = (element: Element) =>
  ([...element.children].find(
    (child) => child.localName === "clover-panel-toggle",
  ) as HTMLElement | undefined) ?? null;

/** A button the page wrote in the Body: one of its controls, after Clover's. */
const isButton = (node: Node) =>
  node instanceof HTMLElement && node.localName === "button";

/**
 * `<clover-body>` (`specs/body.ts`): the root's view, drawn, as `Body` draws it.
 * The element is the Body's box: it takes its height from `--clover-body-height`
 * (default `60vh`), or from its own `style`, and what it draws fills it. A
 * `<clover-panel-toggle>` in it is one of its controls, in the cluster, where `Body`
 * places a child, and so is each `<button>` of the page's, after it, as a React host's
 * children are. Its controls can be the page's own (`controlButtons`), and its views
 * drawn by the page's renderers (`renderers`): each adapter loads only for a page that
 * gives them, and the Body waits for it.
 */
export function BodyElement({ hosted, props }: HostedProps) {
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
    <Body
      {...(rest as BodyProps)}
      onReady={onReady as BodyProps["onReady"]}
      controlButtons={buttons}
      renderers={adapted}
      style={FILL}
    >
      {toggle && <Toggle element={toggle} />}
      <Placed from={hosted.element} picks={isButton} />
    </Body>
  );
}
