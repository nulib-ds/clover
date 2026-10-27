import React, { Suspense, lazy } from "react";

import { SceneView, type SceneProps } from "./SceneView";
import { CanvasPending } from "../Body/Pending";
import { useOptionalClover } from "../../react/context";

/*
 * Inside a `Root`, the Root's view, loaded when a Scene finds itself in one (as `Body`
 * loads it for a Scene view); and what a Scene loads for itself (`iiifContent`), for one
 * given that.
 */
const ConnectedScene = lazy(() => import("./Connected"));
const LoadedScene = lazy(() => import("./Loaded"));

/**
 * A IIIF Presentation 4 Scene, drawn in 3D: the glTF models it paints, each
 * where the Scene places it, lit as a neutral room lights them and framed by a default
 * camera, which the reader turns and zooms by pointer, key or control. Its drawing, Clover's
 * own WebGL2 glTF renderer (or three.js, `engine="three"`, once the page registers it from
 * `@nulib/clover/three`), loads only when a Scene first comes near the window.
 *
 * - **Inside a `Root`**, given nothing to draw, it draws the Root's view when that is a
 *   Scene, and nothing otherwise. `Body` draws a Scene view with it.
 * - **Standalone**, it draws the `scene` it is handed; given `iiifContent`, it loads a
 *   Scene itself (a Manifest gives its first).
 */
export function Scene(props: SceneProps) {
  const root = useOptionalClover();
  if (props.iiifContent !== undefined && props.scene === undefined)
    return (
      <Suspense fallback={<CanvasPending />}>
        <LoadedScene {...props} />
      </Suspense>
    );
  if (!props.scene)
    return root ? (
      <Suspense fallback={<CanvasPending />}>
        <ConnectedScene {...props} />
      </Suspense>
    ) : null;
  return <SceneView {...props} />;
}

export type { SceneControlsConfig, SceneProps } from "./SceneView";
export default Scene;
