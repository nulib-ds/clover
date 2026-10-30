import { useCallback, useEffect, useState } from "react";

import {
  type AnnotationPageRef,
  findEntry,
  selectManifestSets,
} from "../core/annotation-sets";
import { selectVisibleCanvases } from "../core/selectors";
import { useClover, useCloverSelector } from "./context";

/**
 * Annotation pages loaded as the reader reaches them, never all at once (Mat, 2026-10-29:
 * "we don't want to load all"): in order from the first, up to the furthest the reader is
 * on (the view's Canvases, the picked annotation's page) or has reached (`reachNext`, as
 * a list's end comes into view, or a step goes past the last loaded). `loaded` is how many
 * lead the run of fetched pages, what a list shows in order; `more`, whether any follow.
 */
export function usePagesReached(pages: AnnotationPageRef[]): {
  loaded: number;
  more: boolean;
  reachNext: () => void;
} {
  const { clover } = useClover("Annotations");
  const pickedPage = useCloverSelector((state) =>
    state.annotationId
      ? findEntry(selectManifestSets(state.manifest), state.annotationId)?.setId
      : undefined,
  );
  const visible = useCloverSelector((state) =>
    selectVisibleCanvases(state.manifest, state.canvasId),
  );
  const [reached, setReached] = useState(0);
  const run = pages.findIndex((page) => !page.fetched);
  const loaded = run === -1 ? pages.length : run;
  const viewPage = pages.reduce(
    (last, page, index) =>
      visible.some((canvas) => canvas.id === page.canvasId) ? index : last,
    -1,
  );
  const upTo = Math.max(
    reached,
    pages.findIndex((page) => page.id === pickedPage),
    viewPage,
    0,
  );
  useEffect(() => {
    const missing = pages
      .slice(0, upTo + 1)
      .filter((page) => !page.fetched)
      .map((page) => page.id);
    if (missing.length) clover.fetchAnnotationPages(missing);
  }, [clover, pages, upTo]);
  const reachNext = useCallback(
    () => setReached((was) => Math.max(was, loaded)),
    [loaded],
  );
  return { loaded, more: loaded < pages.length, reachNext };
}
