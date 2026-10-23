import React, { useMemo } from "react";

import { type BodyRenderer, paintingBodies, pickRenderer } from "./renderers";
import ConnectedCanvas from "../Canvas/Connected";
import type { CloverCanvasProps } from "../Canvas/Canvas.types";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { useVisibleCanvases } from "../../react/hooks";
import { Loading } from "../../ui/Loading";

export type BodyProps = Omit<
  CloverCanvasProps,
  "canvases" | "body" | "src" | "isTiledImage" | "viewingDirection"
> & {
  /** Props for the wrapping element, which sizes the stage. */
  style?: React.CSSProperties;
  /** Renderers for this stage only; the Root's (`renderers` on `Root`) otherwise. */
  renderers?: BodyRenderer[];
};

/**
 * The current view of the Root, drawn: by `Canvas` (images, video, sound), or by a
 * renderer of your own that claims the view (by Canvas id, painting format or a test,
 * from `renderers` here or on the `Root`). A future Presentation 4 `Scene` will draw here
 * too. Children become controls in the cluster, or are handed to the renderer.
 *
 * The stage needs a height to draw into. It is set inline, so it holds without the
 * stylesheet, through `--clover-body-height` (default `60vh`): set that property to
 * size it, `100%` to fill a sized parent.
 *
 * While the Root loads (the first Manifest, or the next one chosen) the stage is busy and
 * shows Clover's loading mark, a line along its top edge, over what it still shows; it
 * keeps its size and its background, so nothing moves.
 */
export function Body({
  className,
  style,
  renderers,
  children,
  ...canvas
}: BodyProps) {
  const root = useClover("Body");
  const canvases = useVisibleCanvases();
  const bodies = useMemo(() => paintingBodies(canvases), [canvases]);
  const renderer = pickRenderer(renderers ?? root.renderers, {
    canvases,
    bodies,
  });
  const Renderer = renderer?.component;
  const busy = useCloverSelector((state) => state.status === "loading");
  return (
    <div
      aria-busy={busy}
      className={join("clover-body", className)}
      data-renderer={Renderer ? "custom" : "canvas"}
      style={{
        position: "relative",
        height: "var(--clover-body-height, 60vh)",
        ...style,
      }}
    >
      {Renderer ? (
        <Renderer canvases={canvases} bodies={bodies}>
          {children}
        </Renderer>
      ) : (
        <ConnectedCanvas {...canvas}>{children}</ConnectedCanvas>
      )}
      {busy && <Loading overlay />}
    </div>
  );
}
