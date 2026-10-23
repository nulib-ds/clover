import React, { useEffect, useState } from "react";

import type { IIIFScene } from "./models";
import { SceneView, type SceneProps } from "./SceneView";
import { CanvasPending } from "../Body/Pending";
import { BodyAlert } from "../Body/BodyAlert";
import { loadContent } from "../../core/load";

type View =
  | { state: "loading" }
  | { state: "ready"; scene: IIIFScene; manifest: Record<string, unknown> }
  | { state: "error"; error: Error };

/**
 * A Scene that loads what it draws (`iiifContent`), outside any `Root`, read as a Root
 * reads its content (`loadContent`): a Scene, or a Manifest (the Scene a `start` or
 * content state names, else its first). Until it arrives, the Body's background and the
 * loading mark; if it will not load, an alert with the reason. Loaded on demand, so a
 * Scene handed its Scene never carries it.
 */
export default function LoadedScene({ iiifContent, ...props }: SceneProps) {
  const [view, setView] = useState<View>({ state: "loading" });
  const request = props.options?.request;
  // An object is known by its `id`, as a Root's content is: a new one alike does not reload.
  const key =
    typeof iiifContent === "string"
      ? iiifContent
      : String((iiifContent as Record<string, unknown> | undefined)?.id ?? "");

  useEffect(() => {
    let live = true;
    setView({ state: "loading" });
    (async () => {
      const content = await loadContent(iiifContent!, { request });
      const scenes = (
        (content.manifest.items ?? []) as unknown as IIIFScene[]
      ).filter((item) => item.type === "Scene");
      const wanted = content.target?.canvasId;
      const scene = scenes.find((each) => each.id === wanted) ?? scenes[0];
      if (!scene) throw new Error("It has no Scene to show.");
      if (live)
        setView({
          state: "ready",
          scene,
          manifest: content.manifest as unknown as Record<string, unknown>,
        });
    })().catch((error) => {
      if (live)
        setView({
          state: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        });
    });
    return () => {
      live = false;
    };
    // `key` stands in for the content, whose identity may change on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, request]);

  if (view.state === "ready")
    return (
      <SceneView
        {...props}
        scene={view.scene}
        manifestId={String(view.manifest.id ?? "")}
        // Named as a Root's Scene is: its own label, else its Manifest's.
        label={props.label ?? view.scene.label ?? view.manifest.label}
      />
    );
  if (view.state === "error")
    return (
      <CanvasPending>
        <BodyAlert error={view.error} />
      </CanvasPending>
    );
  return <CanvasPending />;
}
