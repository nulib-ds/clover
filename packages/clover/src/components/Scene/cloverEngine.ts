import type { EngineOptions, SceneEngine } from "./drawing";
import { MODEL_FORMATS, type SceneModel, isDrawable } from "./models";
import { type Bounds, FIELD_OF_VIEW, cameraPosition } from "./orbit";
import { loadGltf } from "../../lib/gltf/load";
import {
  type Mat4,
  identity,
  lookAt,
  multiply,
  perspective,
  rotation,
  scaling,
  translation,
} from "../../lib/gltf/mat4";
import { createModelRenderer } from "../../lib/gltf/renderer";

/**
 * The Scene's drawing, with Clover's own glTF renderer (`lib/gltf/`): the default, loaded
 * the first time a Scene comes near the window. three.js (`engine.ts`) draws instead for a
 * Scene that asks for it (`engine="three"`). It draws on demand, never in a loop.
 */

/** A sharper drawing on a dense screen, at most twice its CSS pixels, to keep it light. */
const MAX_PIXEL_RATIO = 2;

/** A model's place in the Scene: its transforms in order, then moved to its point. */
export function placement({ position, transforms }: SceneModel): Mat4 {
  let matrix = identity();
  for (const { type, x, y, z } of transforms) {
    const step =
      type === "scale"
        ? scaling([x, y, z])
        : type === "translate"
          ? translation([x, y, z])
          : rotation([x, y, z]);
    matrix = multiply(step, matrix);
  }
  return multiply(translation(position), matrix);
}

export function createEngine(
  host: HTMLElement,
  { onLost }: EngineOptions,
): SceneEngine {
  const canvas = document.createElement("canvas");
  // The Body's surface: under the controls, taking no pointer (the viewport takes them).
  canvas.className = "clover-canvas-surface";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: true });
  if (!gl) throw new Error("This browser cannot draw 3D: it offers no WebGL2.");
  const lost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lost);
  host.prepend(canvas);
  const renderer = createModelRenderer(gl);
  let bounds: Bounds = { center: [0, 0, 0], radius: 1 };
  let disposed = false;

  const resize = () => {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.round(host.clientWidth * ratio);
    const height = Math.round(host.clientHeight * ratio);
    if (!width || !height) return;
    canvas.width = width;
    canvas.height = height;
  };
  resize();

  return {
    async load(models: SceneModel[], request) {
      const drawable = models.filter(isDrawable);
      if (!drawable.length) {
        const formats = [
          ...new Set(models.map((model) => model.format ?? model.src)),
        ];
        throw new Error(
          models.length
            ? `Clover draws glTF models (${MODEL_FORMATS.join(", ")}), not ${formats.join(", ")}.`
            : "The Scene paints no model.",
        );
      }
      const assets = await Promise.all(
        drawable.map((model) => loadGltf(model.src, request)),
      );
      if (disposed) return bounds;
      assets.forEach((asset, index) =>
        renderer.add(asset, placement(drawable[index])),
      );
      const box = renderer.bounds();
      if (box) {
        const center = box.min.map(
          (min, axis) => (min + box.max[axis]) / 2,
        ) as Bounds["center"];
        const radius =
          Math.hypot(...box.max.map((max, axis) => max - box.min[axis])) / 2;
        bounds = { center, radius: radius || 1 };
      }
      return bounds;
    },
    draw(orbit) {
      if (disposed || !canvas.width || !canvas.height) return;
      const eye = cameraPosition(orbit, bounds.center);
      // Near and far bracket the models wherever the camera is on its orbit.
      const near = Math.max(
        bounds.radius / 1000,
        orbit.distance - bounds.radius * 2,
      );
      const far = orbit.distance + bounds.radius * 4;
      const projection = perspective(
        (FIELD_OF_VIEW * Math.PI) / 180,
        canvas.width / canvas.height,
        near,
        far,
      );
      renderer.draw(
        multiply(projection, lookAt(eye, bounds.center)),
        eye,
        canvas.width,
        canvas.height,
      );
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lost);
      renderer.dispose();
      // Give the context back now, not whenever the canvas is collected.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
}
