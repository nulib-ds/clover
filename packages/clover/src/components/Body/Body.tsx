import React, { Suspense, lazy, useMemo } from "react";

import { type BodyRenderer, paintingBodies, pickRenderer } from "./renderers";
import ConnectedCanvas from "../Canvas/Connected";
import type { CloverCanvasProps } from "../Canvas/Canvas.types";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { useVisibleCanvases } from "../../react/hooks";
import { Loading } from "../../ui/Loading";

/*
 * Presentation 4's other containers, each drawn by its own part, loaded the first time a
 * view of one shows: a page that never shows a Timeline or a Scene carries neither. Until
 * it arrives, the box shows the loading mark along its top, never nothing.
 */
const ConnectedTimeline = lazy(() => import("../Timeline/Connected"));
const ConnectedScene = lazy(() => import("../Scene/Connected"));

export type BodyProps = Omit<
  CloverCanvasProps,
  "canvases" | "body" | "src" | "isTiledImage" | "viewingDirection"
> & {
  /** Props for the wrapping element, which gives the Body its size. */
  style?: React.CSSProperties;
  /** Renderers for this Body only; the Root's (`renderers` on `Root`) otherwise. */
  renderers?: BodyRenderer[];
};

/**
 * The current view of the Root, drawn by the part for its container: `Canvas` (images,
 * video), `Timeline` (sound) or `Scene` (3D), as Presentation 4 names them; or by a
 * renderer of your own that claims the view (by Canvas id, painting format or a test,
 * from `renderers` here or on the `Root`), which goes first. Children become controls in
 * the cluster, or are handed to the renderer.
 *
 * The Body needs a height to draw into. It is set inline, so it holds without the
 * stylesheet, through `--clover-body-height` (default `60vh`): set that property to
 * size it, `100%` to fill a sized parent.
 *
 * While the Root loads (the first Manifest, or the next one chosen) the Body is busy and
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
  // The view's container: a Scene or a Timeline is drawn by its own part.
  const kind =
    canvases.find(({ type }) => type === "Scene" || type === "Timeline")
      ?.type ?? "Canvas";
  const busy = useCloverSelector((state) => state.status === "loading");
  return (
    <div
      aria-busy={busy}
      className={join("clover-body", className)}
      data-renderer={Renderer ? "custom" : kind.toLowerCase()}
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
      ) : kind === "Scene" ? (
        <Suspense fallback={<Loading overlay />}>
          <ConnectedScene {...canvas}>{children}</ConnectedScene>
        </Suspense>
      ) : kind === "Timeline" ? (
        <Suspense fallback={<Loading overlay />}>
          <ConnectedTimeline {...canvas}>{children}</ConnectedTimeline>
        </Suspense>
      ) : (
        <ConnectedCanvas {...canvas}>{children}</ConnectedCanvas>
      )}
      {busy && <Loading overlay />}
    </div>
  );
}
