import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type Clover,
  type CloverStatus,
  createClover,
} from "../../core/clover";
import type { AnnotationsInput } from "../../core/annotation-collection";
import type { ContentStateOutput } from "../../core/content-state";
import type { IIIFContent } from "../../core/load";
import { type CloverRequest, requestKey } from "../../core/request";
import { selectPosition, selectSequence } from "../../core/selectors";
import { localize } from "../../core/value";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { CloverContext } from "../../react/context";
import { useRootLanguage } from "../../react/language";
import { type ContentRenderer, sameRenderers } from "../Content/renderers";
import { visuallyHidden } from "../../ui/visuallyHidden";

export interface RootProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /**
   * What to show: a URL, a IIIF resource (Presentation 2, 3 or 4: a Manifest, Collection
   * or Canvas), or a content state (JSON or base64url).
   */
  iiifContent: IIIFContent;
  /** The Canvas to show, controlled: moving asks `onCanvasChange` to change it. */
  canvasId?: string;
  /** The Canvas to start on, uncontrolled. A content state or `start` still wins. */
  defaultCanvasId?: string;
  /** The reader moved to a Canvas (the first of the view that shows it). */
  onCanvasChange?: (canvasId: string) => void;
  /**
   * In a Collection, the member Manifest to show, controlled: choosing another asks
   * `onManifestChange` to change it.
   */
  manifestId?: string;
  /** In a Collection, the reader moved (or, controlled, asks to move) to a Manifest. */
  onManifestChange?: (manifestId: string) => void;
  onStatusChange?: (status: CloverStatus, error: Error | null) => void;
  /**
   * A Content Search query to run once the Manifest is shown, and again whenever it
   * changes (3.x's `iiifContentSearchQuery`). The reader can search on from `Search`.
   */
  searchQuery?: string;
  /** Credentials, headers and `fetch` for every request any part makes. */
  request?: CloverRequest;
  /** The language to read IIIF text in. The reader's, by default. */
  language?: string;
  /**
   * Renderers of your own for some views — by Canvas id, painting format, or a test —
   * drawn by every `Content` inside in place of `Canvas` (3.x's `customDisplays`).
   */
  renderers?: ContentRenderer[];
  /**
   * Annotations to show beside the Manifest's own: an AnnotationPage or
   * AnnotationCollection (or a list of them), as URLs or objects.
   */
  annotations?: AnnotationsInput;
  /**
   * Whose referenced annotation pages to fetch: the view's as the reader moves (default),
   * or every Canvas's at once, for a layout that shows them all.
   */
  annotationPages?: "view" | "all";
  /**
   * Where the reader is, as a IIIF content state, whenever it settles: after a move, a
   * pan or zoom, or a pause or seek in media. Debounced, and only when it changed.
   */
  onContentStateChange?: (state: ContentStateOutput) => void;
  /** The element to render. Default `div`. */
  as?: React.ElementType;
  children?: React.ReactNode;
}

/**
 * The root of any Clover composition. It loads `iiifContent`, holds where the reader is,
 * and gives every part inside it the same state. Render parts — `Clover.Content`,
 * `Clover.Label`, `Clover.Items` — anywhere within it, in any layout.
 */
export const Root = forwardRef<HTMLElement, RootProps>(function Root(
  {
    iiifContent,
    canvasId,
    defaultCanvasId,
    onCanvasChange,
    onStatusChange,
    manifestId,
    onManifestChange,
    searchQuery,
    request,
    language,
    renderers,
    annotations,
    annotationPages = "view",
    onContentStateChange,
    as: Tag = "div",
    className,
    children,
    ...rest
  },
  ref,
) {
  /*
   * The page's language, for Clover's strings to be marked where they are in another.
   * The Root carries none of its own: what the host puts in it is in the page's.
   */
  const root = useRootLanguage(ref, rest.lang);
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
  const initial = useRef({ canvasId, defaultCanvasId, manifestId });
  initial.current = { canvasId, defaultCanvasId, manifestId };
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

  return (
    <CloverContext.Provider value={context}>
      <HostLanguageContext.Provider value={root.hostLanguage}>
        <Tag
          ref={root.ref}
          className={join("clover-root", className)}
          data-status={status}
          {...rest}
        >
          {children}
          <Announcer clover={clover} language={language} />
        </Tag>
      </HostLanguageContext.Provider>
    </CloverContext.Provider>
  );
});

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

/**
 * Says where the reader has moved to — the Canvas's label and its position — in a polite
 * live region. Silent on the first view: arriving is not moving.
 */
function Announcer({
  clover,
  language,
}: {
  clover: Clover;
  language?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  // The label keeps its own language; the position is in Clover's.
  const [message, setMessage] = useState<{
    label: string;
    lang?: string;
    position: string;
  } | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let last: string | null = null;
    return clover.store.subscribe(() => {
      const { manifest, canvasId, status } = clover.store.get();
      if (status !== "ready" || canvasId === last) return;
      const first = last === null;
      last = canvasId;
      if (first) return;
      const { canvases, views } = selectSequence(manifest);
      const canvas = canvases.find((item) => item.id === canvasId);
      const label = localize(canvas?.label as any, language);
      const position = tRef.current("canvasPosition", {
        index: selectPosition(manifest, canvasId) + 1,
        total: views.length,
      });
      setMessage({
        label: label.text,
        lang: label.lang,
        position,
      });
    });
  }, [clover, language]);

  // Atomic, so the whole message is read even when only one of its parts changed.
  return (
    <div
      className="clover-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={visuallyHidden}
    >
      {message?.label ? (
        <>
          <span lang={message.lang}>{message.label}</span>,{" "}
        </>
      ) : null}
      {message && (
        <span lang={langOf("canvasPosition")}>{message.position}</span>
      )}
    </div>
  );
}
