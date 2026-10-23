import type { Container, Manifest } from "./presentation";
import {
  type View,
  type ViewingDirection,
  groupViews,
  resolveBehavior,
  resolveDirection,
  viewOf,
} from "./sequence";
import type { Target } from "./content-state";
import { parseAnnotationTarget } from "./annotations";

/**
 * Derived data, read from the Presentation 4 Manifest the store holds. Each result is
 * memoized on the Manifest object, which is replaced (never mutated) when something in it
 * changes — a referenced annotation page arriving, say — so an unchanged Manifest returns
 * the very same arrays, and React parts that selected them do not re-render.
 */

export type { ViewingDirection };

export interface Sequence {
  /** The Canvases, Timelines and Scenes Clover can show, in order. */
  canvases: Container[];
  views: View[];
  direction: ViewingDirection;
}

const sequences = new WeakMap<Manifest, Sequence>();
const EMPTY: Sequence = { canvases: [], views: [], direction: "left-to-right" };

export function selectSequence(manifest: Manifest | null): Sequence {
  if (!manifest) return EMPTY;
  let sequence = sequences.get(manifest);
  if (!sequence) {
    const canvases = (
      (manifest.items ?? []) as Array<{ type?: string }>
    ).filter(
      // `Body` draws each with its own part: `Canvas`, `Timeline` or `Scene`.
      (item) =>
        item?.type === "Canvas" ||
        item?.type === "Timeline" ||
        item?.type === "Scene",
    ) as Container[];
    sequence = {
      canvases,
      views: groupViews(
        canvases as Array<{ behavior?: unknown }>,
        resolveBehavior((manifest as { behavior?: unknown }).behavior),
      ),
      direction: resolveDirection(
        (manifest as { viewingDirection?: unknown }).viewingDirection,
      ),
    };
    sequences.set(manifest, sequence);
  }
  return sequence;
}

/** The index of the view holding a Canvas; 0 when it is not in the Manifest. */
export function selectPosition(
  manifest: Manifest | null,
  canvasId: string | null,
): number {
  const { canvases, views } = selectSequence(manifest);
  const index = canvases.findIndex((canvas) => canvas.id === canvasId);
  return index === -1 ? 0 : viewOf(views, index);
}

const visible = new WeakMap<Manifest, Map<number, Container[]>>();
const NONE: Container[] = [];

/** The Canvases of the view holding `canvasId`, the same array while nothing changes. */
export function selectVisibleCanvases(
  manifest: Manifest | null,
  canvasId: string | null,
): Container[] {
  if (!manifest) return NONE;
  const position = selectPosition(manifest, canvasId);
  let byView = visible.get(manifest);
  if (!byView) visible.set(manifest, (byView = new Map()));
  let canvases = byView.get(position);
  if (!canvases) {
    const sequence = selectSequence(manifest);
    canvases = (sequence.views[position] ?? []).map(
      (index) => sequence.canvases[index],
    );
    byView.set(position, canvases);
  }
  return canvases;
}

/** The first Canvas of a view. */
export function canvasOfView(
  manifest: Manifest | null,
  view: number,
): string | null {
  const { canvases, views } = selectSequence(manifest);
  const index = views[view]?.[0];
  return index === undefined ? null : (canvases[index]?.id ?? null);
}

/**
 * Where a Manifest asks to begin: its `start` Canvas (a reference, or a SpecificResource
 * whose selector adds a region or time).
 */
export function selectStart(manifest: Manifest | null): Target | null {
  const start = (manifest as { start?: unknown } | null)?.start;
  if (!start) return null;
  const parsed = parseAnnotationTarget(start as any);
  if (!parsed.id) return null;
  const target: Target = { canvasId: parsed.id };
  if (parsed.rect) target.region = parsed.rect;
  const time = parsed.t ? Number(parsed.t.split(",")[0]) : NaN;
  if (Number.isFinite(time)) target.time = time;
  return target;
}

/** Whether a resource's `behavior` includes a value. */
export const hasBehavior = (resource: unknown, value: string) => {
  const behavior = (resource as { behavior?: unknown } | null)?.behavior;
  return Array.isArray(behavior)
    ? behavior.includes(value)
    : behavior === value;
};

/** The first Collection a Manifest says it is `partOf`. */
export const partOfCollection = (manifest: unknown) =>
  (
    ((manifest as { partOf?: unknown } | null)?.partOf ?? []) as Array<{
      id?: string;
      type?: string;
      label?: unknown;
    }>
  ).find((part) => part?.id && part.type === "Collection");
