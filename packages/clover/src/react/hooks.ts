import { useMemo } from "react";

import {
  type AnnotationCollection,
  type AnnotationSet,
  selectAnnotationCollection,
  selectAnnotationSets,
} from "../core/annotation-sets";
import {
  type CloverStatus,
  type Navigation,
  navigationOf,
} from "../core/clover";
import type { Container, Manifest } from "../core/presentation";
import {
  type Sequence,
  selectCanvas,
  selectPosition,
  selectSequence,
  selectVisibleCanvases,
} from "../core/selectors";
import {
  type LanguageMapLike,
  type LocalizedValue,
  localize,
} from "../core/value";
import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { useClover, useCloverSelector } from "./context";

/**
 * Hooks for building parts of your own. Each reads one slice of the nearest `Root`'s
 * state and re-renders only when that slice changes.
 */

/** Loading, ready or error, and the error. */
export function useStatus(): { status: CloverStatus; error: Error | null } {
  const status = useCloverSelector((state) => state.status);
  const error = useCloverSelector((state) => state.error);
  return useMemo(() => ({ status, error }), [status, error]);
}

/** The Manifest shown, in Presentation 4; null until loaded. */
export function useManifest(): Manifest | null {
  return useCloverSelector((state) => state.manifest);
}

/** The Canvases, Timelines and Scenes, their grouping into views, and the reading direction. */
export function useSequence(): Sequence {
  return useCloverSelector((state) => selectSequence(state.manifest));
}

/** The Canvases of the current view: one, or a spread. */
export function useVisibleCanvases(): Container[] {
  return useCloverSelector((state) =>
    selectVisibleCanvases(state.manifest, state.canvasId),
  );
}

/** The Canvas the reader is on (the first of the current view). */
export function useActiveCanvas(): Container | null {
  return useCloverSelector((state) =>
    selectCanvas(state.manifest, state.canvasId),
  );
}

export type { Navigation };

/** Moving between views. Steps by view, so a spread moves two pages at a time. */
export function useNavigation(): Navigation {
  const { clover } = useClover("useNavigation");
  const position = useCloverSelector((state) =>
    selectPosition(state.manifest, state.canvasId),
  );
  const total = useCloverSelector(
    (state) => selectSequence(state.manifest).views.length,
  );
  return useMemo(
    () => navigationOf(clover, position, total),
    [clover, position, total],
  );
}

/**
 * Annotations walked as one whole: the AnnotationPage or AnnotationCollection given as
 * the content, else the AnnotationCollection the Manifest's annotation pages are part of
 * (Cookbook 0309). Its `id`, `type`, `label`, `total`, `pages` and its annotations so far
 * (`entries`); null where there are none. `Items of="annotations"` walks them.
 */
export function useAnnotationCollection(): AnnotationCollection | null {
  return useCloverSelector((state) =>
    selectAnnotationCollection(state.manifest, state.addedSets),
  );
}

/** Every annotation set: the Manifest's own (fetched so far) and any the host added. */
export function useAnnotationSets(): AnnotationSet[] {
  return useCloverSelector((state) =>
    selectAnnotationSets(state.manifest, state.addedSets),
  );
}

/** A IIIF language map as text in the Root's language, with the tag it is in. */
export function useLocalized(value: LanguageMapLike): LocalizedValue {
  const { language } = useClover("useLocalized");
  return useMemo(() => localize(value, language), [value, language]);
}

/** Clover's interface strings in the current language: `t("commonClose")`. */
export function useT(): (
  key: string,
  values?: Record<string, unknown>,
) => string {
  return useCloverTranslation().t;
}

/**
 * The language of one of Clover's strings where it is not the page's (a French reader on
 * an English page, or a key that fell back to English), for the element that shows it, or
 * is named by it, to carry as `lang` (WCAG 3.1.2). Undefined otherwise: the string takes
 * the page's language. The page's is the nearest `lang` around the Root.
 *
 * ```jsx
 * const t = Clover.useT();
 * const langOf = Clover.useLangOf();
 * <button aria-label={t("commonClose")} lang={langOf("commonClose")} />
 * ```
 */
export function useLangOf(): (key: string) => string | undefined {
  return useCloverTranslation().langOf;
}
