import {
  Box3,
  Euler,
  Group,
  type Material,
  type Mesh,
  NeutralToneMapping,
  type Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Sphere,
  type Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { EngineOptions, SceneEngine } from "./drawing";
import { sendsCredentials } from "../../core/request";
import { type Bounds, FIELD_OF_VIEW, cameraPosition } from "./orbit";
import { MODEL_FORMATS, type SceneModel, isDrawable } from "./models";

/**
 * The Scene's optional drawing, with three.js (`engine="three"`; Clover's own,
 * `cloverEngine.ts`, is the default): the one module that imports three.js, loaded only
 * for a Scene that asks for it, the first time one comes near the window, so no other page
 * carries it. For what Clover's does not draw yet: compressed models, animations, glTF's
 * material extensions.
 *
 * It draws on demand, never in a loop: once the models arrive, and each time the camera
 * moves or the Body changes size. At rest it does nothing. glTF 2.0 is drawn with
 * three.js's loader: its materials (metal and roughness), textures, node hierarchy and
 * every attribute; models compressed with Draco or Meshopt, or with KTX2 textures, need
 * decoders it does not carry yet, and fail with the loader's own words.
 *
 * With no light in the Scene (none are read yet), the models are lit as a neutral room
 * lights them (`RoomEnvironment`), as model viewers light theirs; the camera is the
 * Scene's default, which `orbit.ts` places.
 */

/** A sharper drawing on a dense screen, at most twice its CSS pixels, to keep it light. */
const MAX_PIXEL_RATIO = 2;

/**
 * A three.js renderer drawing into `host` (the Body's viewport), behind everything the
 * Body puts over it, on a clear ground: the viewport's color (the Scene's
 * `backgroundColor`, or the Body's) shows through. Throws where the browser offers no
 * WebGL.
 */
export function createEngine(
  host: HTMLElement,
  { onLost }: EngineOptions,
): SceneEngine {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(
    Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO),
  );
  // Khronos's neutral tone mapping: a model's colors as its maker saw them in a viewer.
  renderer.toneMapping = NeutralToneMapping;
  const canvas = renderer.domElement;
  // The Body's surface: under the controls, taking no pointer (the viewport takes them).
  canvas.className = "clover-canvas-surface";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  const lost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lost);
  host.prepend(canvas);

  const scene = new Scene();
  // The room is drawn once into the light it gives, then let go.
  const environment = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = environment.fromScene(room, 0.04).texture;
  room.dispose();
  environment.dispose();

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 1000);
  const root = new Group();
  scene.add(root);
  let bounds: Bounds = { center: [0, 0, 0], radius: 1 };
  let disposed = false;

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();

  return {
    async load(models, request) {
      const loader = new GLTFLoader();
      if (sendsCredentials(request)) loader.setWithCredentials(true);
      if (request?.headers) loader.setRequestHeader(request.headers);
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
      const loaded = await Promise.all(
        drawable.map((model) => loader.loadAsync(model.src)),
      );
      if (disposed) return bounds;
      loaded.forEach((gltf, index) => {
        root.add(place(gltf.scene, drawable[index]));
      });
      // From every point placed, not each mesh's box turned, which bounds far more.
      const box = new Box3().setFromObject(root, true);
      if (!box.isEmpty()) {
        const sphere = box.getBoundingSphere(new Sphere());
        bounds = {
          center: sphere.center.toArray() as [number, number, number],
          radius: sphere.radius || 1,
        };
      }
      return bounds;
    },
    draw(orbit) {
      if (disposed) return;
      const [x, y, z] = cameraPosition(orbit, bounds.center);
      camera.position.set(x, y, z);
      // Near and far bracket the models wherever the camera is on its orbit.
      camera.near = Math.max(
        bounds.radius / 1000,
        orbit.distance - bounds.radius * 2,
      );
      camera.far = orbit.distance + bounds.radius * 4;
      camera.updateProjectionMatrix();
      camera.lookAt(new Vector3(...bounds.center));
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lost);
      root.traverse((object) => release(object));
      scene.environment?.dispose();
      renderer.dispose();
      // Give the context back now, not whenever the canvas is collected.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/**
 * A model, placed as the Scene says: its transforms in the order given, each around what
 * came before, then moved to its point. A turn is about the Scene's own axes, `x` first,
 * then `y`, then `z` (Presentation 4), which is three.js's `ZYX`.
 */
function place(
  model: Object3D,
  { position, transforms }: SceneModel,
): Object3D {
  let node = model;
  for (const step of transforms) {
    const group = new Group();
    group.add(node);
    if (step.type === "scale") group.scale.set(step.x, step.y, step.z);
    else if (step.type === "translate")
      group.position.set(step.x, step.y, step.z);
    else
      group.rotation.copy(
        new Euler(
          (step.x * Math.PI) / 180,
          (step.y * Math.PI) / 180,
          (step.z * Math.PI) / 180,
          "ZYX",
        ),
      );
    node = group;
  }
  const placed = new Group();
  placed.position.set(...position);
  placed.add(node);
  return placed;
}

/** What one object holds on the graphics card: its geometry, materials and their textures. */
function release(object: Object3D) {
  const mesh = object as Partial<Mesh>;
  mesh.geometry?.dispose();
  const materials = [mesh.material ?? []].flat() as Material[];
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
    }
    material.dispose();
  }
}
