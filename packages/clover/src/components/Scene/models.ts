import { bodiesOf, isPainting } from "../../core/painting";
import { asArray } from "../../lib/asArray";

/**
 * What `Scene` draws: the 3D models a IIIF Presentation 4 Scene paints, each where the
 * Scene places it, and the Scene's own background.
 *
 * Pure, and free of React and of three.js, which loads only once a Scene is drawn.
 *
 * A Scene is a 3D space with no size (Presentation 4): right-handed, `y` up, `x` to the
 * right and `z` toward the viewer, in arbitrary units, its origin at the center. A model
 * is painted at the origin, or at the point a `PointSelector` on its target names, after
 * the transforms (`ScaleTransform`, `RotateTransform`, `TranslateTransform`) on its
 * `SpecificResource`, in the order given.
 */

/** One step in placing a model: a scale, a turn in degrees (x, then y, then z), or a move. */
export interface SceneTransform {
  type: "scale" | "rotate" | "translate";
  x: number;
  y: number;
  z: number;
}

/** A model painted into a Scene. */
export interface SceneModel {
  /** The annotation's id, else the model's: stable for one Scene. */
  id: string;
  /** The model's file. */
  src: string;
  /** Its media type, when the Scene says: `model/gltf-binary`, `model/gltf+json`. */
  format?: string;
  /** The model's own label, when it has one. */
  label?: unknown;
  /** Where its origin goes in the Scene: a `PointSelector`'s `x`, `y` and `z`. */
  position: [number, number, number];
  /** Applied in order, before it is placed. */
  transforms: SceneTransform[];
}

/** The parts of a Presentation 4 Scene this module reads. */
export interface IIIFScene {
  id: string;
  type?: string;
  label?: unknown;
  summary?: unknown;
  metadata?: Array<{ label?: unknown; value?: unknown }>;
  backgroundColor?: string | null;
  items?: Array<{ items?: Array<Record<string, any>> }>;
}

/**
 * The formats Clover draws: glTF 2.0, binary (`.glb`) or JSON (`.gltf`), as the Cookbook's
 * Scenes paint and the IIIF 3D community recommends.
 */
export const MODEL_FORMATS = ["model/gltf-binary", "model/gltf+json"];

const number = (value: unknown, fallback: number) => {
  const read = Number(value);
  return Number.isFinite(read) ? read : fallback;
};

/** Whether Clover can draw a model: glTF, by its format, else by its file's extension. */
export function isDrawable(model: Pick<SceneModel, "src" | "format">): boolean {
  if (model.format) return MODEL_FORMATS.includes(model.format.toLowerCase());
  return /\.(glb|gltf)(\?|#|$)/i.test(model.src);
}

/** A transform's steps, as `SceneTransform`s; anything else is left out. */
function transformsOf(resource: Record<string, any>): SceneTransform[] {
  return asArray(resource.transform).flatMap((raw) => {
    const step = raw as Record<string, any> | null;
    const type =
      step?.type === "ScaleTransform"
        ? "scale"
        : step?.type === "RotateTransform"
          ? "rotate"
          : step?.type === "TranslateTransform"
            ? "translate"
            : null;
    if (!type || !step) return [];
    // A scale leaves an axis it does not name as it was; a turn or a move, unmoved.
    const rest = type === "scale" ? 1 : 0;
    return [
      {
        type,
        x: number(step.x, rest),
        y: number(step.y, rest),
        z: number(step.z, rest),
      },
    ];
  });
}

/** Where a target places what is painted: its `PointSelector`, else the origin. */
function positionOf(target: unknown): [number, number, number] {
  for (const raw of asArray(target)) {
    const each = raw as Record<string, any> | null;
    if (each?.type !== "SpecificResource") continue;
    const point = asArray(each.selector).find(
      (selector) => (selector as Record<string, any>)?.type === "PointSelector",
    ) as Record<string, any> | undefined;
    if (point)
      return [number(point.x, 0), number(point.y, 0), number(point.z, 0)];
  }
  return [0, 0, 0];
}

const read = new WeakMap<object, SceneModel[]>();

/**
 * The models a Scene paints, in painting order: each painting annotation's `Model` body
 * (a `Choice` paints its first item), placed by its target and transformed by its
 * `SpecificResource`. Cameras, lights, audio and Scenes painted into it are not read yet.
 */
export function sceneModels(scene: IIIFScene): SceneModel[] {
  const cached = read.get(scene);
  if (cached) return cached;
  const models: SceneModel[] = [];
  for (const page of scene.items ?? []) {
    for (const annotation of page?.items ?? []) {
      if (!isPainting(annotation)) continue;
      for (let body of bodiesOf(annotation)) {
        if (body?.type === "Choice")
          body = asArray(body.items)[0] as Record<string, any>;
        const specific = body?.type === "SpecificResource" ? body : null;
        const source = specific
          ? typeof specific.source === "string"
            ? { id: specific.source, type: "Model" }
            : specific.source
          : body;
        if (source?.type !== "Model" || typeof source.id !== "string") continue;
        models.push({
          id: String(annotation.id ?? source.id),
          src: source.id,
          ...(typeof source.format === "string"
            ? { format: source.format }
            : {}),
          ...(source.label ? { label: source.label } : {}),
          position: positionOf(annotation.target),
          transforms: specific ? transformsOf(specific) : [],
        });
      }
    }
  }
  read.set(scene, models);
  return models;
}

/** The Scene's `backgroundColor`, when it is a color a page can draw (`#rgb`, `#rrggbb`). */
export function sceneBackground(scene: IIIFScene): string | undefined {
  const color = scene.backgroundColor;
  return typeof color === "string" &&
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)
    ? color
    : undefined;
}
