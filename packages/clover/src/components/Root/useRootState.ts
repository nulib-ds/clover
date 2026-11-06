import {
  useCallback,
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
import { cloverI18n } from "../../i18n/config";
import type { CloverContextValue } from "../../react/context";
import { useRootContentState } from "../../react/useContentStateOutput";
import { type BodyRenderer, sameRenderers } from "../Body/renderers";

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
  renderers?: BodyRenderer[];
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

  useRootContentState(clover, onContentStateChange);

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
  /*
   * The language chosen to read IIIF text in (About's languages), until the page gives
   * the Root another `language`, which wins again (React's state adjusted as it renders,
   * so no frame shows the old choice). Until one is chosen, the Root's `language`, else an
   * interface language the visitor chose, else the visitor's (`readerLanguages`). Choosing one
   * moves Clover's interface language with it, where Clover has strings for it (Mat,
   * 2026-11-05: "toggling to `es` … should import the `i18n` language code map for UI"),
   * as choosing an interface language moves the values.
   */
  const [chosen, setChosen] = useState<string>();
  const [chosenUnder, setChosenUnder] = useState(language);
  if (chosenUnder !== language) {
    setChosenUnder(language);
    setChosen(undefined);
  }
  /*
   * Another resource: the language chosen for this one goes, and the interface language
   * it moved goes back to the visitor's (Mat, 2026-11-05: "I toggled to a different
   * resource and the languages set for old resource did not reset"). So does a Root that
   * goes, as a host that mounts one Root a resource (`key`) takes it away: the interface
   * language is the page's, and outlives it. An interface language chosen for itself,
   * one only the site offers, stays: it is the page's.
   */
  const moved = useRef<string | undefined>(undefined);
  const [chosenFor, setChosenFor] = useState(key);
  if (chosenFor !== key) {
    setChosenFor(key);
    setChosen(undefined);
  }
  useEffect(
    () => () => {
      const spoken = moved.current;
      moved.current = undefined;
      if (spoken && cloverI18n.chosenLanguage === spoken)
        void cloverI18n.chooseInterfaceLanguage();
    },
    [key],
  );
  const interfaceChosen = useSyncExternalStore(
    cloverI18n.subscribe,
    () => cloverI18n.chosenLanguage,
    () => cloverI18n.chosenLanguage,
  );
  const reading = chosen ?? language ?? interfaceChosen;
  const chooseLanguage = useCallback((tag: string) => {
    setChosen(tag);
    const spoken = cloverI18n.stringsFor(tag);
    moved.current = spoken;
    if (spoken) void cloverI18n.chooseInterfaceLanguage(spoken);
  }, []);
  // How many of the Root's language toggles are drawn (About's, one per About).
  const [toggles, setToggles] = useState(0);
  const drawsToggle = useCallback(() => {
    setToggles((count) => count + 1);
    return () => setToggles((count) => count - 1);
  }, []);
  const toggleDrawn = toggles > 0;
  const context = useMemo(
    () => ({
      clover,
      language: reading,
      renderers: stableRenderers,
      chooseLanguage,
      toggleDrawn,
      drawsToggle,
    }),
    [
      clover,
      reading,
      stableRenderers,
      chooseLanguage,
      toggleDrawn,
      drawsToggle,
    ],
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
