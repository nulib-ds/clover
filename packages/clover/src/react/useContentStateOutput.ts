import { useCallback, useEffect, useRef } from "react";

import type { Clover } from "../core/clover";
import type { ContentStateOutput } from "../core/content-state";

/**
 * How often, at most, a place on the move is reported: ten times a second (Mat,
 * 2026-11-01: "the callback is slow", then "even faster … I'd prefer every 100ms"; it
 * waited 300ms after the camera stopped until then, and 150ms that day). A page writing
 * each into its address with `history.replaceState` can meet a browser's cap on that in
 * a long pan (Safari's, 100 calls in its window).
 */
const REPORT_MS = 100;

type OnContentState = ((state: ContentStateOutput) => void) | undefined;

/**
 * Report a content state as it changes (`onContentStateChange`): the part calls the
 * function this returns whenever its place may have moved (the Canvas changes, the
 * camera moves, media pauses or seeks), and `read` is asked once a moment later, at most
 * every `REPORT_MS` while it keeps moving, and always within that of the last change, so
 * the last place is never missed. No polling; nothing fires while it is unchanged, nor
 * without `onChange`. Root, Body, Canvas, Timeline and Scene all report through it.
 */
export function useContentStateOutput(
  read: () => ContentStateOutput | null,
  onChange: OnContentState,
): () => void {
  const latest = useRef({ read, onChange });
  latest.current = { read, onChange };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef("");
  // Let go of one on its way, and forget it, or a remount (Strict Mode's) never reports.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      timer.current = undefined;
    },
    [],
  );
  return useCallback(() => {
    // One report on its way already reads whatever this change brought.
    if (!latest.current.onChange || timer.current !== undefined) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const state = latest.current.read();
      if (!state || state.encoded === last.current) return;
      last.current = state.encoded;
      latest.current.onChange?.(state);
    }, REPORT_MS);
  }, []);
}

/** Calls `changed` as `element` pauses or seeks; returns the way to stop. */
export function watchMedia(
  element: HTMLVideoElement | null,
  changed: () => void,
): () => void {
  element?.addEventListener("pause", changed);
  element?.addEventListener("seeked", changed);
  return () => {
    element?.removeEventListener("pause", changed);
    element?.removeEventListener("seeked", changed);
  };
}

/**
 * A Root's content state (`clover.getContentState()`), reported as it changes: as its
 * Canvas changes, the camera moves, or its media pauses or seeks. For the Root, and for a
 * Body, which reports the Root's view whatever draws it.
 */
export function useRootContentState(clover: Clover, onChange: OnContentState) {
  const changed = useContentStateOutput(
    () => clover.getContentState(),
    onChange,
  );
  const enabled = Boolean(onChange);
  useEffect(() => {
    if (!enabled) return;
    let canvasId = clover.store.get().canvasId;
    const offStore = clover.store.subscribe(() => {
      const next = clover.store.get().canvasId;
      if (next !== canvasId) {
        canvasId = next;
        changed();
      }
    });
    const offViewport = clover.viewport.subscribe(changed);
    let offElement = watchMedia(clover.media.get(), changed);
    const offMedia = clover.media.subscribe((element) => {
      offElement();
      offElement = watchMedia(element, changed);
    });
    changed();
    return () => {
      offStore();
      offViewport();
      offMedia();
      offElement();
    };
  }, [clover, enabled, changed]);
}
