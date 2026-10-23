import React, { Suspense, lazy } from "react";

import type { CloverCanvasProps } from "../Canvas/Canvas.types";
import CanvasView from "../Canvas/CanvasView";
import type { IIIFCanvas } from "../Canvas/layout";
import { CanvasPending } from "../Body/Pending";
import { join } from "../../lib/classnames";
import { useOptionalClover } from "../../react/context";

/*
 * Inside a `Root`, the Root's view: loaded when a Timeline finds itself in one, as
 * `Body` loads it when the view is a Timeline. What a Timeline loads for itself
 * (`iiifContent`) is Canvas's loader, for one that is given that.
 */
const ConnectedTimeline = lazy(() => import("./Connected"));
const LoadedCanvas = lazy(() => import("../Canvas/LoadedCanvas"));

export type TimelineProps = Omit<
  CloverCanvasProps,
  | "canvases"
  | "body"
  | "src"
  | "isTiledImage"
  | "viewingDirection"
  | "navigator"
  | "onViewportChange"
  | "onReady"
  | "animateAnnotations"
> & {
  /**
   * A Presentation 4 Timeline to play: its sound, with what it carries (captions, a
   * transcript, annotations on its time, an accompanying or placeholder Canvas).
   * Upgrade older resources with `toPresentation4()`; a Presentation 3 Canvas of sound
   * alone upgrades to one. Inside a `Root`, leave it out to play the Root's view.
   */
  timeline?: IIIFCanvas;
};

/**
 * A IIIF Presentation 4 Timeline, played: sound, which has a duration and
 * no picture. It is drawn on Canvas's Body, with Canvas's transport, captions, chapters
 * and annotations on its time, and shows the Timeline's accompanying Canvas (or its
 * placeholder) while it plays, as the Viewer has shown sound.
 *
 * - **Inside a `Root`**, given nothing to play, it plays the Root's view when that is a
 *   Timeline, and draws nothing otherwise. `Body` draws a Timeline view with it.
 * - **Standalone**, it plays the `timeline` it is handed; given `iiifContent`, it loads a
 *   Timeline itself (a Manifest gives its first).
 */
export function Timeline({ timeline, className, ...props }: TimelineProps) {
  const root = useOptionalClover();
  const classes = join("clover-timeline", className);
  if (props.iiifContent !== undefined && timeline === undefined)
    return (
      <Suspense fallback={<CanvasPending />}>
        <LoadedCanvas {...props} className={classes} of="Timeline" />
      </Suspense>
    );
  if (!timeline)
    return root ? (
      <Suspense fallback={<CanvasPending />}>
        <ConnectedTimeline {...props} className={className} />
      </Suspense>
    ) : null;
  return (
    <CanvasView
      {...props}
      className={classes}
      canvases={[timeline]}
      navigator={false}
    />
  );
}

export default Timeline;
