import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type Clover,
  type CloverStatus,
  type Initial,
  createClover,
} from "../../core/clover";
import type { AnnotationsInput } from "../../core/annotation-collection";
import type { ContentStateOutput } from "../../core/content-state";
import type { IIIFContent } from "../../core/load";
import { type CloverRequest, requestKey } from "../../core/request";
import type { CloverContextValue } from "../../react/context";
import { type ContentRenderer, sameRenderers } from "../Content/renderers";

/** What a Root is given about its content: every prop but its element's. */
export interface RootStateOptions {
  iiifContent: IIIFContent;
  canvasId?: string;
  defaultCanvasId?: string;
  onCanvasChange?: (canvasId: string) => void;
  manifestId?: string;
  defaultManifestId?: string;
  onManifestChange?: (manifestId: string) => void;
  onStatusChange?: (status: CloverStatus, error: Error | null) => void;
  searchQuery?: string;
  request?: CloverRequest;
  language?: string;
  renderers?: ContentRenderer[];
  annotations?: AnnotationsInput;
  annotationPages?: "view" | "all";
  onContentStateChange?: (state: ContentStateOutput) => void;
}

/**
 * What a Root holds, apart from any element: its Clover, the effects that keep it in step
 * with what it is given, and the context its parts read. `Root` adds its element and
 * the live region; `<clover-root>` (`web-components/elements/root.tsx`) is an element
 * already, and adds the live region alone. Given a Root's props whole, it hands back
 * the context (its Clover in it), the status, and the rest of the props (its element's),
 * so each name is written once, and no more names than that: every Root's page loads it.
 */
export function useRootState<Props extends RootStateOptions>({
  iiifContent,
  canvasId,
  defaultCanvasId,
  onCanvasChange,
  onStatusChange,
  manifestId,
  defaultManifestId,
  onManifestChange,
  searchQuery,
  request,
  language,
  renderers,
  annotations,
  annotationPages = "view",
  onContentStateChange,
  ...rest
}: Props): [
  context: CloverContextValue,
  status: CloverStatus,
  rest: Omit<Props, keyof RootStateOptions>,
] {
  const controlled = canvasId !== undefined;
  const manifestControlled = manifestId !== undefined;
  const latest = useRef({
    controlled,
    manifestControlled,
    onCanvasChange,
    onStatusChange,
    onManifestChange,
  });
  latest.current = {
    controlled,
    manifestControlled,
    onCanvasChange,
    onStatusChange,
    onManifestChange,
  };

  const [clover] = useState<Clover>(() =>
    createClover({
      request,
      onCanvasChange: (id) => latest.current.onCanvasChange?.(id),
      onManifestChange: (id) => latest.current.onManifestChange?.(id),
      isControlled: () => latest.current.controlled,
      isManifestControlled: () => latest.current.manifestControlled,
    }),
  );
  clover.setRequest(request);

  // Load when the content (or how to request it) changes; a newer load replaces an older.
  const initial = useRef<Initial>({});
  initial.current = {
    canvasId,
    defaultCanvasId,
    manifestId: manifestId ?? defaultManifestId,
  };
  const requestSettings = requestKey(request);
  const content = useRef(iiifContent);
  content.current = iiifContent;
  const key = contentKey(iiifContent);
  useEffect(() => {
    void clover.load(content.current, initial.current);
    return () => clover.dispose();
  }, [clover, key, requestSettings]);

  // A controlled host's Canvas.
  useEffect(() => {
    if (controlled) clover.syncCanvas(canvasId ?? null);
  }, [clover, controlled, canvasId]);

  const [status, setStatus] = useState<CloverStatus>(clover.store.get().status);
  useEffect(() => {
    let last = clover.store.get().status;
    return clover.store.subscribe(() => {
      const { status: next, error } = clover.store.get();
      if (next === last) return;
      last = next;
      setStatus(next);
      latest.current.onStatusChange?.(next, error);
    });
  }, [clover]);

  // Added annotations: reloaded when what identifies them changes.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const annotationsKey = annotationsInputKey(annotations);
  useEffect(() => {
    void clover.loadAnnotations(annotationsRef.current ?? null);
  }, [clover, annotationsKey, requestSettings]);

  useEffect(() => {
    clover.setAnnotationPages(annotationPages);
  }, [clover, annotationPages]);

  useContentStateOutput(clover, onContentStateChange);

  // A controlled host's Manifest, once the Collection has loaded.
  useEffect(() => {
    if (manifestControlled && status === "ready") {
      void clover.syncManifest(manifestId ?? null);
    }
  }, [clover, manifestControlled, manifestId, status]);

  // The host's query, on each Manifest it opens.
  const manifestShown = useCloverStoreValue(clover, (state) =>
    state.status === "ready" ? (state.manifest?.id ?? null) : null,
  );
  useEffect(() => {
    if (searchQuery && manifestShown) void clover.search(searchQuery);
  }, [clover, searchQuery, manifestShown]);

  // An inline list is a new array each render: keep the last while it says the same.
  const kept = useRef(renderers);
  if (!sameRenderers(kept.current, renderers)) kept.current = renderers;
  const stableRenderers = kept.current;
  const context = useMemo(
    () => ({ clover, language, renderers: stableRenderers }),
    [clover, language, stableRenderers],
  );
  return [context, status, rest];
}

/** One value of the store, outside the context the Root itself provides. */
function useCloverStoreValue<T>(
  clover: Clover,
  select: (state: ReturnType<Clover["store"]["get"]>) => T,
): T {
  return useSyncExternalStore(
    clover.store.subscribe,
    () => select(clover.store.get()),
    () => select(clover.store.get()),
  );
}

/** What identifies added annotations: URLs as they are, objects by id. */
function annotationsInputKey(input: AnnotationsInput | undefined): string {
  const items = Array.isArray(input) ? input : input ? [input] : [];
  return JSON.stringify(
    items.map((item) =>
      typeof item === "string"
        ? item
        : ((item as { id?: string })?.id ?? "object"),
    ),
  );
}

/** How long the reader's place must hold still before it is reported. */
const SETTLE_MS = 300;

/**
 * Report the content state when it settles: after the Canvas changes, the camera stops,
 * or media pauses or seeks. One debounce, not polling; nothing fires while unchanged.
 */
function useContentStateOutput(
  clover: Clover,
  onChange: ((state: ContentStateOutput) => void) | undefined,
) {
  const latest = useRef(onChange);
  latest.current = onChange;
  const enabled = Boolean(onChange);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const state = clover.getContentState();
        if (!state || state.encoded === last) return;
        last = state.encoded;
        latest.current?.(state);
      }, SETTLE_MS);
    };
    let canvasId = clover.store.get().canvasId;
    const offStore = clover.store.subscribe(() => {
      const next = clover.store.get().canvasId;
      if (next !== canvasId) {
        canvasId = next;
        settle();
      }
    });
    const offViewport = clover.viewport.subscribe(settle);
    let element: HTMLVideoElement | null = null;
    const watch = (next: HTMLVideoElement | null) => {
      element?.removeEventListener("pause", settle);
      element?.removeEventListener("seeked", settle);
      element = next;
      element?.addEventListener("pause", settle);
      element?.addEventListener("seeked", settle);
    };
    watch(clover.media.get());
    const offMedia = clover.media.subscribe(watch);
    settle();
    return () => {
      clearTimeout(timer);
      offStore();
      offViewport();
      offMedia();
      watch(null);
    };
  }, [clover, enabled]);
}

/**
 * What identifies the content: a string as it is, an object by its id. An object written
 * inline is a new object on every render, and must not reload each time.
 */
function contentKey(content: IIIFContent): unknown {
  if (typeof content === "string") return content;
  return (
    (content as { id?: unknown }).id ??
    (content as { "@id"?: unknown })["@id"] ??
    content
  );
}
