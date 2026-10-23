import React, { useContext, useLayoutEffect, useRef } from "react";

import type {
  BodyRenderer,
  BodyRendererProps,
} from "../../components/Body/renderers";
import { type CloverApi, CloverApiContext } from "./api";

/**
 * A renderer of the page's, without React: what it claims, as `BodyRenderer` says it
 * (`canvasId`, `format`, `match`), and `render`, which draws the view into a box of its
 * own and returns what undoes it. `view.clover` is the root's API, as `root.clover` is.
 *
 *   root.renderers = [{
 *     format: ["model/gltf-binary"],
 *     render(container, { bodies }) {
 *       const viewer = showModel(container, bodies[0].id);
 *       return () => viewer.dispose();
 *     },
 *   }];
 */
export interface PageRenderer {
  canvasId?: string[];
  format?: string[];
  match?: BodyRenderer["match"];
  render: (
    container: HTMLElement,
    view: Omit<BodyRendererProps, "children"> & { clover: CloverApi | null },
  ) => void | (() => void);
}

/*
 * Each of the page's renderers as the one React renderer, for as long as the page keeps
 * it: the same component each time, so the Root's `sameRenderers` sees no change.
 */
const ADAPTED = new WeakMap<PageRenderer, BodyRenderer>();

function adapted(renderer: PageRenderer): BodyRenderer {
  let known = ADAPTED.get(renderer);
  if (!known) {
    const { render } = renderer;
    known = {
      canvasId: renderer.canvasId,
      format: renderer.format,
      match: renderer.match,
      component: (props) => <Rendered {...props} render={render} />,
    };
    ADAPTED.set(renderer, known);
  }
  return known;
}

/** The page's renderers, as `Root` and `Body` take them; undefined for none. */
export function toRenderers(value: unknown): BodyRenderer[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter(
      (item): item is PageRenderer =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as PageRenderer).render === "function",
    )
    .map(adapted);
}

/**
 * A view, drawn by the page's `render` in a box filling the stage, and drawn again when
 * the view changes, after what the last drawing returned undoes it. The stage's controls
 * stay over it, in the cluster, where the Canvas has them.
 */
function Rendered({
  render,
  canvases,
  bodies,
  children,
}: BodyRendererProps & { render: PageRenderer["render"] }) {
  const box = useRef<HTMLDivElement>(null);
  const clover = useContext(CloverApiContext);
  useLayoutEffect(() => {
    const container = box.current;
    if (!container) return;
    const undo = render(container, { canvases, bodies, clover });
    return () => {
      if (typeof undo === "function") undo();
      container.replaceChildren();
    };
  }, [render, canvases, bodies, clover]);
  return (
    <>
      <div
        ref={box}
        className="clover-body-renderer"
        style={{ position: "absolute", inset: 0 }}
      />
      {children && <div className="clover-canvas-controls">{children}</div>}
    </>
  );
}
