/**
 * Manifest-level layout: which Canvases of a sequence are shown together.
 *
 * This is the host's decision — a Viewer stepping through a Manifest — not `Canvas`'s.
 * `Canvas` draws whatever Canvases it is handed; a host uses this to decide what to hand
 * it from the Manifest's `behavior`, and steps through the result itself.
 *
 * @see https://iiif.io/api/presentation/3.0/#behavior
 */

/** The order to lay several Canvases out in, along their reading axis. */
export type ViewingDirection =
  | "left-to-right"
  | "right-to-left"
  | "top-to-bottom"
  | "bottom-to-top";

const DIRECTIONS: ViewingDirection[] = [
  "left-to-right",
  "right-to-left",
  "top-to-bottom",
  "bottom-to-top",
];

/** The spec's default is `left-to-right`. */
export function resolveDirection(declared: unknown): ViewingDirection {
  return DIRECTIONS.includes(declared as ViewingDirection)
    ? (declared as ViewingDirection)
    : "left-to-right";
}

/** The behaviors that arrange a sequence. Other behaviors do not affect layout. */
export type SequenceBehavior =
  | "individuals"
  | "paged"
  | "continuous"
  | "unordered";

/** The Canvases shown together, as indexes into the sequence. */
export type View = number[];

const LAYOUT_BEHAVIORS: SequenceBehavior[] = [
  "individuals",
  "paged",
  "continuous",
  "unordered",
];

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

/**
 * The layout behavior to use: the first recognized layout value, so a `behavior` array
 * may carry values from other sets (`auto-advance`, `hidden`) alongside it. The spec's
 * default is `individuals`.
 */
export function resolveBehavior(declared: unknown): SequenceBehavior {
  const match = asArray(declared).find((value) =>
    LAYOUT_BEHAVIORS.includes(value as SequenceBehavior),
  );
  return (match as SequenceBehavior) ?? "individuals";
}

/**
 * Group a sequence into views.
 *
 * - `individuals` and `unordered`: one Canvas per view.
 * - `continuous`: every Canvas in one view, a single joined object.
 * - `paged`: spreads. The first Canvas stands alone (a cover), as does any Canvas whose
 *   own behavior is `facing-pages` (it is already a spread) or `non-paged` (never
 *   paired); the rest pair up. These are `@iiif/helpers`' `getManifestSequence` rules,
 *   which the Viewer uses, so the two never disagree about what a spread is.
 */
export function groupViews(
  canvases: Array<{ behavior?: unknown }>,
  behavior: SequenceBehavior,
): View[] {
  if (!canvases.length) return [];
  if (behavior === "continuous") return [canvases.map((_, index) => index)];
  if (behavior !== "paged") return canvases.map((_, index) => [index]);

  const views: View[] = [];
  let pending: number[] = [];
  let offset = 0;
  let closeNextPair = false;
  const flush = () => {
    if (pending.length) views.push(pending);
    pending = [];
  };

  canvases.forEach((canvas, index) => {
    const own = asArray(canvas.behavior);
    if (own.includes("non-paged")) {
      if (index === offset) offset++;
      flush();
      views.push([index]);
      return;
    }
    if (index === offset || own.includes("facing-pages")) {
      // A single. A left page waiting for its partner closes with the next page.
      if (pending.length) closeNextPair = true;
      flush();
      views.push([index]);
      return;
    }
    pending.push(index);
    if (closeNextPair) {
      flush();
      closeNextPair = false;
      return;
    }
    if (pending.length > 1) flush();
  });
  flush();
  return views;
}

/** Which view holds a Canvas. */
export function viewOf(views: View[], canvasIndex: number): number {
  const found = views.findIndex((view) => view.includes(canvasIndex));
  return found === -1 ? 0 : found;
}
