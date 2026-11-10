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

/**
 * The toolbar's sections that hold something of the page in sight, its Canvases' own
 * (Mat, 2026-11-10: "if active canvas(es) have anything canvas specific related to
 * information, chapters, annotations, or map, show a small … indicator on the item"):
 * About, where a Canvas describes itself; Contents, where a recording has chapters
 * (`chaptersOf`); Annotations, where one is listed on it; and the Map, where it has a
 * place of its own (`canvasHasMapData`), never the Manifest's alone.
 */
export function usePageMarks(canvases: Json[]): ReadonlySet<PanelSection> {
  const manifest = Clover.useManifest();
  const listed = Clover.useAnnotationPages({ listed: true });
  const ids = canvases.map((canvas) => canvas.id as string).join(" ");
  return useMemo(() => {
    if (!canvases.length) return NONE;
    const marks = new Set<PanelSection>();
    if (canvases.some(hasInformation)) marks.add("about");
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
    if (canvases.some(Clover.canvasHasMapData)) marks.add("map");
    return marks.size ? marks : NONE;
    // The Canvases by their ids: the view's array is new each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, manifest, listed]);
}
