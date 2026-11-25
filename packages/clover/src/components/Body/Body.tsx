import React, { Suspense, lazy, useEffect, useMemo, useRef } from "react";

import { BodyAlert } from "./BodyAlert";
import { type BodyRenderer, paintingBodies, pickRenderer } from "./renderers";
import ConnectedCanvas from "../Canvas/Connected";
import type { CloverCanvasProps } from "../Canvas/Canvas.types";
import { rendererSurface } from "../Canvas/rendererSurface";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { useVisibleCanvases } from "../../react/hooks";
import { useRootContentState } from "../../react/useContentStateOutput";
import { Loading } from "../../ui/Loading";
import { CanvasPending } from "./Pending";

/*
 * Presentation 4's other containers, each drawn by its own part, loaded the first time a
 * view of one shows: a page that never shows a Timeline or a Scene carries neither. Until
 * it arrives, the box shows the loading mark along its top, never nothing.
 */
const ConnectedTimeline = lazy(() => import("../Timeline/Connected"));
/** Each Root's Bodies in sight, by its `body` channel, the last told as its box. */
const boxesOf = new WeakMap<object, HTMLElement[]>();
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
 * keeps its size and its background, so nothing moves. Where the Root could not load its
 * resource, the Body says so in its middle: the template's `Status` leaves the alert to
 * it (`error={false}`).
 */
export function Body({
  className,
  style,
  renderers,
  collapseControls,
  onContentStateChange,
  children,
  ...canvas
}: BodyProps) {
  const root = useClover("Body");
  // The Root's view, whatever draws it: Canvas, Timeline, Scene or a renderer of yours.
  useRootContentState(root.clover, onContentStateChange);
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
  /*
   * Its box, told to its Root (`clover.body`): what lies over its view goes in it, in the
   * box its renderer draws in (an `Inset` whose `container` is `"body"`).
   */
  const box = useRef<HTMLDivElement>(null);
  const failed = useCloverSelector((state) =>
    state.status === "error" && !state.manifest ? state.error : null,
  );
  /*
   * What the Root could not load, said in the Body, its code always there: loaded only
   * as loading fails, it would fail too where the network has gone, the very failure it
   * says, and take the Root with it (WCAG 4.1.3). As it comes, focus anywhere in the Root
   * on what goes with the failure (the view, a hotspot, a Panel with nothing left to show)
   * goes to it, so it is never left on the page (2.4.3). Where focus was is read as the
   * render that brings it begins, while all of that is still there.
   */
  const failing = Boolean(failed);
  const wasFailing = useRef(failing);
  const refocus = useRef(false);
  if (wasFailing.current !== failing) {
    wasFailing.current = failing;
    refocus.current =
      failing &&
      Boolean(
        box.current
          ?.closest(".clover-root")
          ?.contains(box.current.ownerDocument.activeElement),
      );
  }
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const own = box.current;
    const { activeElement, body } = own?.ownerDocument ?? document;
    // Focus the reader put somewhere of their own meanwhile stays there.
    if (activeElement && activeElement !== body && activeElement.isConnected)
      return;
    own
      ?.querySelector<HTMLElement>(".clover-body-alert")
      ?.focus({ preventScroll: true });
  }, [failed]);
  useEffect(() => {
    const own = box.current;
    if (!own) return;
    const { body } = root.clover;
    const boxes = boxesOf.get(body) ?? [];
    boxesOf.set(body, boxes);
    boxes.push(own);
    body.emit(own);
    // Gone, the last still there is the Root's, where it has another.
    return () => {
      boxes.splice(boxes.indexOf(own), 1);
      if (body.get() === own) body.emit(boxes[boxes.length - 1] ?? null);
    };
  }, [root.clover]);
  return (
    <div
      ref={box}
      aria-busy={busy}
      className={join("clover-body", className)}
      data-renderer={Renderer ? "custom" : kind.toLowerCase()}
      style={{
        position: "relative",
        height: "var(--clover-body-height, 60vh)",
        ...style,
      }}
    >
      {failed ? (
        <CanvasPending>
          <BodyAlert error={failed} focusable />
        </CanvasPending>
      ) : Renderer ? (
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
        // Canvas's alone: a Timeline's and a Scene's controls are their own (as yet).
        <ConnectedCanvas
          {...canvas}
          collapseControls={collapseControls}
          surface={rendererSurface}
        >
          {children}
        </ConnectedCanvas>
      )}
      {busy && <Loading overlay />}
    </div>
  );
}
