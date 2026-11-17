import { useMemo } from "react";

import * as Clover from "../../parts";
import type { PanelSection } from "../../parts";

type Json = Record<string, any>;

/** The Canvases of the view in sight: a page's one, a spread's two. */
export function useViewCanvases(): Json[] {
  const sequence = Clover.useSequence();
  const navigation = Clover.useNavigation();
  return (sequence.views[Math.max(0, navigation.position)] ?? [])
    .map((index) => sequence.canvases[index] as Json | undefined)
    .filter((canvas): canvas is Json => Boolean(canvas));
}

/**
 * Whether a Canvas describes itself: a summary or metadata of its own, as the Canvas's
 * information shows them in the other layouts (`Body/Caption.tsx`).
 */
export const hasInformation = (canvas: Json): boolean =>
  Boolean(canvas.summary) || (canvas.metadata?.length ?? 0) > 0;

const NONE: ReadonlySet<PanelSection> = new Set();

/** Whether a Canvas's loaded annotation pages lay a georeferenced image on it. */
const georeferenced = (canvas: Json): boolean =>
  ([] as Json[])
    .concat(canvas.annotations ?? [])
    .some((page) =>
      ([] as Json[])
        .concat(page?.items ?? [])
        .some((annotation) =>
          ([] as unknown[])
            .concat(annotation?.motivation)
            .includes("georeferencing"),
        ),
    );

/**
 * The toolbar's sections that hold something of the page in sight, its Canvases' own
 * (Mat, 2026-11-10: "if active canvas(es) have anything canvas specific related to
 * information, chapters, annotations, or map, show a small … indicator on the item"):
 * About, where a Canvas describes itself or names its place (`navPlace`, which About
 * lists); Contents, where a recording has chapters (`chaptersOf`); Annotations, where one
 * is listed on it, or, where no Map section shows them, a georeferenced image (Mat,
 * 2026-11-13); and the Map, where a Map section is offered (`mapped`) and the page has
 * anything of its own to map (`canvasHasMapData`), never the Manifest's alone.
 */
export function usePageMarks(
  canvases: Json[],
  mapped = false,
): ReadonlySet<PanelSection> {
  const manifest = Clover.useManifest();
  const listed = Clover.useAnnotationPages({ listed: true });
  const ids = canvases.map((canvas) => canvas.id as string).join(" ");
  return useMemo(() => {
    if (!canvases.length) return NONE;
    const marks = new Set<PanelSection>();
    if (canvases.some((canvas) => hasInformation(canvas) || canvas.navPlace))
      marks.add("about");
    if (
      canvases.some(
        (canvas) =>
          Clover.chaptersOf(manifest, canvas.id, canvas.duration).length > 0,
      )
    )
      marks.add("contents");
    const inView = new Set(canvases.map((canvas) => canvas.id as string));
    if (
      listed.some((set) =>
        set.entries.some((entry) => inView.has(entry.canvasId)),
      )
    )
      marks.add("annotations");
    if (mapped && canvases.some(Clover.canvasHasMapData)) marks.add("map");
    if (!mapped && canvases.some(georeferenced)) marks.add("annotations");
    return marks.size ? marks : NONE;
    // The Canvases by their ids: the view's array is new each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, manifest, listed, mapped]);
}
