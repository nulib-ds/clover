import React, { useEffect, useMemo } from "react";

import type { IIIFScene } from "./models";
import { SceneView, type SceneProps } from "./SceneView";
import { useClover, useCloverSelector } from "../../react/context";
import { useManifest, useVisibleCanvases } from "../../react/hooks";

/**
 * A `Scene` inside a `Root`: the Root's view, when it is a Scene, named by its label (else
 * the Manifest's), read in the Root's language, fetched with the Root's request settings.
 * Nothing for any other view. Loaded on demand, by a `Scene` in a Root and by `Body` for
 * a Scene view, so a page that never shows one never carries it.
 */
export default function ConnectedScene({
  label,
  language,
  options,
  ...props
}: Omit<SceneProps, "scene" | "iiifContent" | "manifestId">) {
  const context = useClover("Scene");
  const { clover } = context;
  const view = useVisibleCanvases();
  const scene = view.find((container) => container.type === "Scene") as
    | IIIFScene
    | undefined;
  const manifest = useManifest();
  // "loading" while the next Manifest loads: the last one's models go at once.
  const manifestId = useCloverSelector((state) =>
    state.status === "loading" ? "loading" : (state.manifest?.id ?? ""),
  );
  /*
   * A deep link into the Scene (a content state, a Manifest's `start`) has brought the
   * reader to it, and has nothing more in it to apply yet: no camera, no time.
   */
  const target = useCloverSelector((state) => state.target);
  useEffect(() => {
    if (target && scene && target.canvasId === scene.id) clover.consumeTarget();
  }, [target, scene, clover]);
  // The Root's request settings, unless the Scene is given its own.
  const request = options?.request ?? clover.request;
  const connected = useMemo(
    () => ({ ...options, request }),
    [options, request],
  );
  if (!scene) return null;
  return (
    <SceneView
      {...props}
      scene={scene}
      manifestId={manifestId}
      label={label ?? scene.label ?? manifest?.label}
      language={language ?? context.language}
      options={connected}
    />
  );
}
