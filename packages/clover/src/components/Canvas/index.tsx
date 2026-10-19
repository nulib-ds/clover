import React, { Suspense, lazy } from "react";

import type { CloverCanvasProps } from "./Canvas.types";
import CanvasView from "./CanvasView";
import { CanvasPending } from "./Pending";
import { useOptionalClover } from "../../react/context";

/*
 * Connected mode is loaded only when a Canvas finds itself in a Root, so a standalone
 * Canvas does not carry it. `Clover.Content` imports it directly, so in a Viewer it is
 * already in the bundle and this resolves at once.
 */
const ConnectedCanvas = lazy(() => import("./Connected"));
// What a Canvas loads for itself (`iiifContent`): only for one that is given that.
const LoadedCanvas = lazy(() => import("./LoadedCanvas"));

/**
 * EXPERIMENTAL. Clover's own 2D renderer for images, video and sound, drawn with WebGL2
 * and falling back to Canvas2D.
 *
 * - **Inside a `Root`**, given no `canvases`, `body` or `src`, it shows the Root's current
 *   view and reports back to it: a deep link's region or time, the media element, the end
 *   of playback for auto-advance.
 * - **Standalone** (or given something to draw), it draws exactly what it is handed and
 *   knows nothing of the Manifest around it; given `iiifContent`, it loads that Canvas
 *   itself.
 */
const Canvas: React.FC<CloverCanvasProps> = (props) => {
  const root = useOptionalClover();
  if (props.iiifContent !== undefined && props.canvases === undefined)
    return (
      <Suspense fallback={<CanvasPending />}>
        <LoadedCanvas {...props} />
      </Suspense>
    );
  const handed =
    props.canvases !== undefined ||
    props.body !== undefined ||
    props.src !== undefined;
  return root && !handed ? (
    <Suspense fallback={null}>
      <ConnectedCanvas {...props} />
    </Suspense>
  ) : (
    <CanvasView {...props} />
  );
};

export { canvasRegion, containAspect, toSceneImages } from "./CanvasView";
export type { IIIFCanvas, ViewingDirection } from "./layout";
export type {
  CanvasHandle,
  CloverCanvasOptions,
  CloverCanvasProps,
} from "./Canvas.types";

export default Canvas;
