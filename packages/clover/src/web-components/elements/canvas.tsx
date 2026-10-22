import React, { useMemo } from "react";

import Canvas from "../../components/Canvas";
import type { CloverCanvasProps } from "../../components/Canvas/Canvas.types";
import type { HostedProps } from "../host";
import { loadControls, useHandle, useLoaded } from "./later";

/**
 * `<clover-canvas>` (`specs/canvas.ts`): the Canvas, alone or in a root's view, as `Canvas`
 * draws it, its controls the page's own where it gives them (`controlButtons`, whose
 * adapter loads only then, the Canvas waiting for it), and its handle kept on the element
 * while it is drawn.
 */
export function CanvasElement({ props }: HostedProps) {
  const { controlButtons, onReady, ...rest } = props as Record<string, unknown>;
  const controls = useLoaded(loadControls, Boolean(controlButtons));
  const buttons = useMemo(
    () => controls?.toControlButtons(controlButtons),
    [controls, controlButtons],
  );
  useHandle(onReady);
  if (controlButtons && !controls) return null;
  return (
    <Canvas
      {...(rest as CloverCanvasProps)}
      onReady={onReady as CloverCanvasProps["onReady"]}
      controlButtons={buttons}
    />
  );
}
