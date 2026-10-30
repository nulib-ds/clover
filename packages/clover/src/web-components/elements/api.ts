import { createContext } from "react";

import {
  selectAnnotationCollection,
  selectAnnotationSets,
} from "../../core/annotation-sets";
import { type Clover, type CloverState, navigationOf } from "../../core/clover";
import { tableOfContents } from "../../core/ranges";
import {
  selectCanvas,
  selectPosition,
  selectSequence,
  selectVisibleCanvases,
} from "../../core/selectors";
import { type LanguageMapLike, localize } from "../../core/value";
import { CLOVER_I18N_NAMESPACE, cloverI18n } from "../../i18n/config";
import { openOne } from "../../ui/useOneOpen";

/**
 * `root.clover`: what a part of your own reads in React, for a page's script. It is the
 * root's Clover itself, as `useClover()` hands a React part (its store, actions and
 * channels), with each of Clover's hooks as a method of the same name (`useNavigation()`
 * is `navigation()`), the state and a way to hear of it, and the root's language.
 *
 *   const { clover } = document.querySelector("clover-root");
 *   clover.subscribe(() => (where.textContent = clover.navigation().position + 1));
 *   clover.next();
 */
export type CloverApi = Clover & ReturnType<typeof own>;

function own(
  clover: Clover,
  language: () => string | undefined,
  hostLanguage: () => string | undefined,
) {
  const state = () => clover.store.get();
  return {
    /** The state, now: what every part draws from. */
    get state(): CloverState {
      return state();
    },
    /** Hear of every change of the state, as a part re-renders; returns the way to stop. */
    subscribe(listener: (state: CloverState) => void) {
      return clover.store.subscribe(() => listener(state()));
    },
    /** The language the root reads IIIF text in, where it is given one. */
    get language() {
      return language();
    },
    // Clover's hooks, each as a method (`hooks.ts`), reading the state now.
    status() {
      const { status, error } = state();
      return { status, error };
    },
    manifest() {
      return state().manifest;
    },
    sequence() {
      return selectSequence(state().manifest);
    },
    visibleCanvases() {
      return selectVisibleCanvases(state().manifest, state().canvasId);
    },
    activeCanvas() {
      return selectCanvas(state().manifest, state().canvasId);
    },
    navigation() {
      const { manifest, canvasId } = state();
      return navigationOf(
        clover,
        selectPosition(manifest, canvasId),
        selectSequence(manifest).views.length,
      );
    },
    annotationSets() {
      return selectAnnotationSets(state().manifest, state().addedSets);
    },
    annotationCollection() {
      return selectAnnotationCollection(state().manifest, state().addedSets);
    },
    /**
     * The Manifest's table of contents (Mat, 2026-10-22), the entries React's
     * `tableOfContents` gives and `Contents` draws: each its `label`, the `canvasId` it
     * goes to, its `time` or `region`, and its `children`. None before the Manifest loads.
     */
    contents() {
      return tableOfContents(state().manifest);
    },
    localize(value: LanguageMapLike) {
      return localize(value, language());
    },
    t(key: string, values?: Record<string, unknown>) {
      return cloverI18n.t(key, values, CLOVER_I18N_NAMESPACE);
    },
    langOf(key: string) {
      return cloverI18n.langOf(key, hostLanguage(), CLOVER_I18N_NAMESPACE);
    },
    /** A popup of the page's joined to Clover's, which open one at a time (`useOneOpen`). */
    oneOpen(close: () => void) {
      return openOne(close);
    },
  };
}

/** The API of a root's Clover: its own, over the Clover it inherits everything else from. */
export function cloverApi(
  clover: Clover,
  language: () => string | undefined,
  hostLanguage: () => string | undefined,
): CloverApi {
  return Object.defineProperties(
    Object.create(clover),
    Object.getOwnPropertyDescriptors(own(clover, language, hostLanguage)),
  ) as CloverApi;
}

/** The nearest root's API, for what the host draws inside it (a renderer of the page's). */
export const CloverApiContext = createContext<CloverApi | null>(null);
