import {
  type AnnotationSet,
  findEntry,
  selectDrawnSets,
} from "./annotation-sets";
import {
  type AnnotationsInput,
  loadAnnotationSets,
} from "./annotation-collection";
import {
  type ContentStateOutput,
  type Target,
  buildContentState,
} from "./content-state";
import {
  type IIIFContent,
  fetchResource,
  loadContent,
  loadManifest,
} from "./load";
import { embedPage, fetchPage, referencedPages } from "./pages";
import type { Collection, Manifest } from "./presentation";
import type { CloverRequest } from "./request";
import {
  canvasOfView,
  selectPosition,
  selectSequence,
  selectStart,
  selectVisibleCanvases,
} from "./selectors";
import { search } from "./search";
import { type SearchHit, searchServiceOf } from "./search-service";
import { type Channel, type Store, createChannel, createStore } from "./store";

/**
 * One Clover: what a `Root` owns. Framework-free, so it can be tested — and driven —
 * without React.
 *
 * The store holds only what parts render from. Everything that changes per frame (the
 * viewport) or per tick (media time) goes through channels, so panning or playback
 * re-renders nothing that has not asked to hear about it.
 */

export type CloverStatus = "idle" | "loading" | "ready" | "error";

export interface CloverState {
  status: CloverStatus;
  error: Error | null;
  /** The Manifest shown, in Presentation 4. */
  manifest: Manifest | null;
  /** The Collection it was reached through, if any. */
  collection: Collection | null;
  /** The Canvas the reader is on: the first of the view that shows it. */
  canvasId: string | null;
  /** Where to go once the view is drawn: a region, a time. Consumed once applied. */
  target: Target | null;
  /** The annotation picked, from a list or its hotspot; the Canvas frames it. */
  annotationId: string | null;
  /** Annotation sets switched off: their hotspots are not drawn. */
  hiddenSets: string[];
  /** Sets the host added through `annotations`, beside the Manifest's own. */
  addedSets: AnnotationSet[];
  /** A Content Search of the Manifest: its query, progress and hits. */
  search: SearchState;
}

export interface SearchState {
  query: string;
  status: "idle" | "loading" | "ready" | "error";
  hits: SearchHit[];
  /** The hits as a set the Canvas draws; null until there are any. */
  set: AnnotationSet | null;
}

export interface ViewportState {
  /** The visible region, in the coordinates of the Canvas holding most of the view. */
  canvasId: string;
  region: { x: number; y: number; w: number; h: number };
}

export interface CloverOptions {
  request?: CloverRequest;
  /**
   * Called with the Canvas the reader moves to. When `isControlled()` is true the store
   * is not changed: the host decides, and hands the id back through `syncCanvas`.
   */
  onCanvasChange?: (canvasId: string) => void;
  isControlled?: () => boolean;
  /**
   * Called with the Manifest the reader moves to within a Collection. When
   * `isManifestControlled()` is true nothing moves: the host decides, and hands the id
   * back through `syncManifest`.
   */
  onManifestChange?: (manifestId: string) => void;
  isManifestControlled?: () => boolean;
}

export interface Clover {
  store: Store<CloverState>;
  viewport: Channel<ViewportState | null>;
  media: Channel<HTMLVideoElement | null>;
  /** The annotation hovered or focused, in a list or on the Canvas. */
  highlight: Channel<string | null>;
  readonly request: CloverRequest | undefined;
  setRequest(request: CloverRequest | undefined): void;
  /** Load content. `canvasId` wins over everything; `defaultCanvasId` over `start`. */
  load(content: IIIFContent, initial?: Initial): Promise<void>;
  goTo(canvasId: string, target?: Omit<Target, "canvasId">): void;
  /**
   * Show another member of the Collection: a Manifest (fetched if only referenced), or a
   * nested Collection, which is entered as `load` would.
   */
  goToManifest(id: string): Promise<void>;
  /** A controlled host's Manifest, shown without asking it again. */
  syncManifest(id: string | null): Promise<void>;
  /**
   * Show a Collection the Manifest is part of (its `partOf`) beside it: the Collection's
   * members become a choice, while the Manifest and the reader's place stay as they are.
   * Nothing changes if it will not load, or the reader has moved on meanwhile. The
   * information panel calls it when its Collection section first opens.
   */
  openCollection(id: string): Promise<void>;
  next(options?: { autoplay?: boolean; wrap?: boolean }): void;
  previous(): void;
  first(): void;
  last(): void;
  /** Mark the pending target applied, so it is not applied again. */
  consumeTarget(): void;
  /** A controlled host's Canvas, applied without asking it again. */
  syncCanvas(canvasId: string | null): void;
  /** Pick an annotation (null to clear). On another Canvas, go there first. */
  selectAnnotation(id: string | null): void;
  /**
   * Search the Manifest through its Content Search service (1 or 2). The hits are listed
   * in `state.search` and drawn on the Canvas; an empty query clears them.
   */
  search(query: string): Promise<void>;
  /** Show or hide a set's hotspots. */
  setSetVisible(setId: string, visible: boolean): void;
  /** Add annotations beside the Manifest's: pages, collections, or a list of either. */
  loadAnnotations(input: AnnotationsInput | null): Promise<void>;
  /** Where the reader is, as a content state: the Canvas and its region or time. */
  getContentState(): ContentStateOutput | null;
  /**
   * Whose referenced annotation pages to fetch: the view's (default, as the reader moves)
   * or every Canvas's (a page listing all of them).
   */
  setAnnotationPages(scope: "view" | "all"): void;
  /** Abandon any load in flight. The instance stays usable. */
  dispose(): void;
}

/** Where to open: the host's Canvas, its default, and in a Collection its Manifest. */
export interface Initial {
  canvasId?: string | null;
  defaultCanvasId?: string | null;
  manifestId?: string | null;
}

const NO_SEARCH: SearchState = {
  query: "",
  status: "idle",
  hits: [],
  set: null,
};

const INITIAL: CloverState = {
  status: "idle",
  error: null,
  manifest: null,
  collection: null,
  canvasId: null,
  target: null,
  annotationId: null,
  hiddenSets: [],
  addedSets: [],
  search: NO_SEARCH,
};

export function createClover(options: CloverOptions = {}): Clover {
  const store = createStore<CloverState>(INITIAL);
  const viewport = createChannel<ViewportState | null>(null);
  const media = createChannel<HTMLVideoElement | null>(null);
  const highlight = createChannel<string | null>(null);
  let annotating: AbortController | null = null;
  let searching: AbortController | null = null;
  let request = options.request;
  let loading: AbortController | null = null;
  /** Referenced pages already asked for, so each is fetched once. */
  const requested = new Set<string>();
  let pageScope: "view" | "all" = "view";

  /** Fetch the referenced annotation pages of the Canvases now shown. */
  const embedVisiblePages = () => {
    const { manifest, canvasId } = store.get();
    if (!manifest) return;
    const signal = loading?.signal;
    for (const [canvas, list, pageId] of referencedPages(
      pageScope === "all"
        ? selectSequence(manifest).canvases
        : selectVisibleCanvases(manifest, canvasId),
    )) {
      if (requested.has(pageId)) continue;
      requested.add(pageId);
      fetchPage(pageId, canvas, request, signal)
        .then((page) => {
          if (signal?.aborted) return;
          store.set((state) =>
            state.manifest
              ? { manifest: embedPage(state.manifest, canvas, list, page) }
              : {},
          );
        })
        // A page that will not load leaves its Canvas as it is; it may be asked again.
        .catch(() => requested.delete(pageId));
    }
  };
  // Lives as long as the store; never unsubscribed, so a remount (React's StrictMode)
  // keeps it.
  store.subscribe(embedVisiblePages);

  /**
   * Show a Manifest, at the Canvas these choose, in this order: the host's Canvas, a
   * content state's, the default, the Manifest's `start`, its first.
   */
  const arrive = (
    manifest: Manifest,
    collection: Collection | null,
    deepLink: Target | undefined,
    initial: Initial,
  ) => {
    const { canvases } = selectSequence(manifest);
    const has = (id?: string | null) =>
      Boolean(id) && canvases.some((canvas) => canvas.id === id);
    const start = selectStart(manifest);
    const target = has(deepLink?.canvasId)
      ? deepLink!
      : has(start?.canvasId)
        ? start
        : null;
    const canvasId = has(initial.canvasId)
      ? initial.canvasId!
      : (target?.canvasId ??
        (has(initial.defaultCanvasId) ? initial.defaultCanvasId! : null) ??
        canvases[0]?.id ??
        null);
    // A search belongs to the Manifest it searched.
    searching?.abort();
    store.set({
      status: "ready",
      search: NO_SEARCH,
      manifest,
      collection,
      canvasId,
      target: target && target.canvasId === canvasId ? target : null,
    });
    if (canvasId && canvasId !== initial.canvasId) {
      options.onCanvasChange?.(canvasId);
    }
  };

  /** Move to a Canvas, or ask a controlled host to. */
  const navigate = (canvasId: string | null, target: Target | null) => {
    if (!canvasId) return;
    if (options.isControlled?.()) {
      if (target) store.set({ target });
      options.onCanvasChange?.(canvasId);
      return;
    }
    const changed = store.get().canvasId !== canvasId;
    store.set({ canvasId, target });
    if (changed) options.onCanvasChange?.(canvasId);
  };

  const stepTo = (view: number, autoplay = false) => {
    const { manifest } = store.get();
    const canvasId = canvasOfView(manifest, view);
    navigate(canvasId, canvasId && autoplay ? { canvasId, autoplay } : null);
  };
  const position = () => {
    const { manifest, canvasId } = store.get();
    return {
      at: selectPosition(manifest, canvasId),
      total: selectSequence(manifest).views.length,
    };
  };

  /** Begin a load, abandoning any in flight. */
  const begin = () => {
    loading?.abort();
    const controller = new AbortController();
    loading = controller;
    requested.clear();
    store.set({ status: "loading", error: null, annotationId: null });
    return controller.signal;
  };
  const fail = (error: unknown) =>
    store.set({
      status: "error",
      error: error instanceof Error ? error : new Error(String(error)),
    });

  async function load(content: IIIFContent, initial: Initial = {}) {
    const signal = begin();
    try {
      const loaded = await loadContent(content, {
        request,
        signal,
        manifestId: initial.manifestId ?? undefined,
      });
      if (signal.aborted) return;
      arrive(
        loaded.manifest,
        loaded.collection ?? null,
        loaded.target,
        initial,
      );
    } catch (error) {
      if (!signal.aborted) fail(error);
    }
  }

  /** Whether `id` is what is shown: the Manifest, or the Collection just entered. */
  const isShown = (id: string) => {
    const { manifest, collection } = store.get();
    return manifest?.id === id || collection?.id === id;
  };
  const memberOf = (id: string): Record<string, any> =>
    ((store.get().collection?.items ?? []) as Array<Record<string, any>>).find(
      (item) => item.id === id,
    ) ?? { id, type: "Manifest" };

  /** Show a Collection member; true once it is shown. */
  const show = async (member: Record<string, any>): Promise<boolean> => {
    if (member.type === "Collection") {
      await load(member.id);
      return store.get().status === "ready";
    }
    const { collection } = store.get();
    const signal = begin();
    try {
      const next = await loadManifest(member, { request, signal });
      if (signal.aborted) return false;
      arrive(next, collection, undefined, {});
      return true;
    } catch (error) {
      if (!signal.aborted) fail(error);
      return false;
    }
  };

  return {
    store,
    viewport,
    media,
    highlight,
    get request() {
      return request;
    },
    setRequest(next) {
      request = next;
    },

    load,
    async openCollection(id) {
      const shown = store.get().manifest;
      if (!shown || store.get().collection?.id === id) return;
      try {
        const collection = await fetchResource(id, { request });
        if (collection.type !== "Collection") return;
        if (store.get().manifest !== shown) return;
        store.set({ collection: collection as Collection });
      } catch {
        // A Collection that will not load leaves the Manifest as it was.
      }
    },
    async goToManifest(id) {
      if (isShown(id)) return;
      const member = memberOf(id);
      // Entering a nested Collection is not a choice of Manifest to ask the host about.
      if (member.type !== "Collection" && options.isManifestControlled?.()) {
        options.onManifestChange?.(id);
        return;
      }
      if (await show(member)) {
        options.onManifestChange?.(store.get().manifest!.id);
      }
    },
    async syncManifest(id) {
      if (!id || isShown(id) || store.get().status !== "ready") return;
      await show(memberOf(id));
    },
    goTo(canvasId, target) {
      navigate(canvasId, target ? { ...target, canvasId } : null);
    },
    next({ autoplay = false, wrap = false } = {}) {
      const { at, total } = position();
      if (at + 1 < total) stepTo(at + 1, autoplay);
      else if (wrap && total > 1) stepTo(0, autoplay);
    },
    previous() {
      const { at } = position();
      if (at > 0) stepTo(at - 1);
    },
    first() {
      stepTo(0);
    },
    last() {
      stepTo(position().total - 1);
    },
    consumeTarget() {
      store.set({ target: null });
    },
    syncCanvas(canvasId) {
      if (canvasId) store.set({ canvasId });
    },
    selectAnnotation(id) {
      const { manifest, addedSets, canvasId, search } = store.get();
      const entry = findEntry(
        selectDrawnSets(manifest, addedSets, search.set),
        id,
      );
      store.set({ annotationId: entry ? id : null });
      if (!entry) return;
      // On a Canvas not in view: go there; the Canvas frames it once laid out. One this
      // Manifest does not have stays picked, with nowhere to go.
      const shown = selectVisibleCanvases(manifest, canvasId).some(
        (canvas) => canvas.id === entry.canvasId,
      );
      const exists = selectSequence(manifest).canvases.some(
        (canvas) => canvas.id === entry.canvasId,
      );
      if (!shown && exists) navigate(entry.canvasId, null);
    },
    async search(query) {
      searching?.abort();
      const service = searchServiceOf(store.get().manifest);
      const q = query.trim();
      if (!q || !service) {
        searching = null;
        store.set({ search: NO_SEARCH, annotationId: null });
        return;
      }
      const controller = new AbortController();
      searching = controller;
      // Embedding a fetched annotation page replaces the Manifest object, not the Manifest.
      const manifestId = store.get().manifest?.id;
      store.set((state) => ({
        search: { ...state.search, query: q, status: "loading" },
      }));
      try {
        const results = await search(service, q, {
          request,
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          store.get().manifest?.id !== manifestId
        ) {
          return;
        }
        store.set({
          search: {
            query: q,
            status: "ready",
            hits: results.hits,
            set: results.set,
          },
        });
      } catch {
        if (controller.signal.aborted) return;
        store.set({
          search: { query: q, status: "error", hits: [], set: null },
        });
      }
    },
    setSetVisible(setId, visible) {
      store.set((state) => {
        const hidden = state.hiddenSets.filter((id) => id !== setId);
        return { hiddenSets: visible ? hidden : [...hidden, setId] };
      });
    },
    async loadAnnotations(input) {
      annotating?.abort();
      if (!input) {
        store.set({ addedSets: INITIAL.addedSets });
        return;
      }
      const controller = new AbortController();
      annotating = controller;
      try {
        const sets = await loadAnnotationSets(input, {
          request,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) store.set({ addedSets: sets });
      } catch {
        // Annotations that will not load leave the Manifest's own in place.
      }
    },
    getContentState() {
      const { manifest, canvasId } = store.get();
      if (!manifest || !canvasId) return null;
      const view = viewport.get();
      const element = media.get();
      const time =
        element && element.currentTime > 0 ? element.currentTime : null;
      // The visible region names the Canvas filling most of a spread. One left over from
      // the previous view, before the new one reports, is ignored.
      const current =
        view &&
        selectVisibleCanvases(manifest, canvasId).some(
          (canvas) => canvas.id === view.canvasId,
        );
      const onView = current && !time ? view : null;
      return buildContentState({
        manifestId: manifest.id,
        canvasId: onView?.canvasId ?? canvasId,
        region: onView?.region,
        time,
      });
    },
    setAnnotationPages(scope) {
      if (scope === pageScope) return;
      pageScope = scope;
      embedVisiblePages();
    },
    dispose() {
      loading?.abort();
      annotating?.abort();
      searching?.abort();
    },
  };
}
