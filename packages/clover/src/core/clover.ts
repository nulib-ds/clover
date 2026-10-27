import {
  type AnnotationSet,
  findEntry,
  manifestOfAnnotation,
  selectDrawnSets,
  selectHiddenSets,
  readPage,
} from "./annotation-sets";
import type { AnnotationsInput } from "./annotation-collection";
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
  selectCanvas,
  selectSequence,
  selectStart,
  selectVisibleCanvases,
} from "./selectors";
import {
  SEARCH_SET_ID,
  type SearchHit,
  searchServiceOf,
} from "./search-service";
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
  /**
   * Sets that start hidden (a still Canvas's OCR, `startsHidden`) switched on. What is
   * drawn is `selectHiddenSets`'s.
   */
  shownSets: string[];
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
  /**
   * The caption file the reader chose in a Canvas's own Captions menu, by its `id` (the
   * WebVTT's address): `null` until they choose, or for Off. A transcript follows it.
   */
  captions: Channel<string | null>;
  /** The annotation hovered or focused, in a list or on the Canvas. */
  highlight: Channel<string | null>;
  /** The chapter (its Range's id) under the pointer on a seek bar, or in `Contents`. */
  chapter: Channel<string | null>;
  readonly request: CloverRequest | undefined;
  setRequest(request: CloverRequest | undefined): void;
  /** Load content. `canvasId` wins over everything; `defaultCanvasId` over `start`. */
  load(content: IIIFContent, initial?: Initial): Promise<void>;
  goTo(canvasId: string, target?: Omit<Target, "canvasId">): void;
  /**
   * Show another member of the Collection: a Manifest (fetched if only referenced), or a
   * nested Collection, which is entered as `load` would.
   */
  goToManifest(id: string, canvasId?: string): Promise<void>;
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
  /**
   * Pick an annotation (null to clear). On another Canvas, go there first; in a hidden
   * set, show the set.
   */
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
  /**
   * Fetch every Canvas's referenced annotation pages while held, whatever
   * `setAnnotationPages` says: for a listing of all of them (`Annotations`'
   * `scope="all"`). Returns the release.
   */
  holdAllAnnotationPages(): () => void;
  /** Abandon any load in flight. The instance stays usable. */
  dispose(): void;
}

export interface Navigation {
  /** Zero-based index of the current view. */
  position: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  previous(): void;
  next(): void;
  first(): void;
  last(): void;
  goTo(canvasId: string): void;
}

/**
 * Moving between views from where the reader is: `useNavigation()`'s, and a root
 * element's `navigation()`. Steps by view, so a spread moves two pages at a time.
 */
export function navigationOf(
  clover: Clover,
  position: number,
  total: number,
): Navigation {
  return {
    position,
    total,
    hasPrevious: position > 0,
    hasNext: position + 1 < total,
    previous: () => clover.previous(),
    next: () => clover.next(),
    first: () => clover.first(),
    last: () => clover.last(),
    goTo: (canvasId: string) => clover.goTo(canvasId),
  };
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
  shownSets: [],
  addedSets: [],
  search: NO_SEARCH,
};

export function createClover(options: CloverOptions = {}): Clover {
  const store = createStore<CloverState>(INITIAL);
  const viewport = createChannel<ViewportState | null>(null);
  const media = createChannel<HTMLVideoElement | null>(null);
  const captions = createChannel<string | null>(null);
  const highlight = createChannel<string | null>(null);
  const chapter = createChannel<string | null>(null);
  let annotating: AbortController | null = null;
  let searching: AbortController | null = null;
  /*
   * The added sets: the host's (`annotations`), and a content state's note. Each changes
   * without the other, so the store holds the two together.
   */
  let hostSets: AnnotationSet[] = [];
  let stateSets: AnnotationSet[] = [];
  /** One of those to pick once a host that holds the Manifest moves to it. */
  let pending: string | null = null;
  const added = () =>
    hostSets.length || stateSets.length
      ? [...hostSets, ...stateSets]
      : INITIAL.addedSets;
  let request = options.request;
  let loading: AbortController | null = null;
  /** Referenced pages already asked for, so each is fetched once. */
  const requested = new Set<string>();
  let pageScope: "view" | "all" = "view";
  /** Listings of every annotation shown now, each holding every page wanted. */
  let allHeld = 0;

  /** Fetch the referenced annotation pages of the Canvases now shown. */
  const embedVisiblePages = () => {
    const { manifest, canvasId } = store.get();
    if (!manifest) return;
    const signal = loading?.signal;
    for (const [canvas, list, pageId] of referencedPages(
      pageScope === "all" || allHeld > 0
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
    /** An annotation of the content's own (`stateSets`) to pick, on the Canvas opened. */
    pick?: string | null,
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
    /*
     * The content's own annotation to pick (a content state's note, the first of the
     * annotations given as the content), on the Canvas it opens on, so it names itself
     * there and in the list. The link then opens its Canvas (past any placeholder) and
     * the pick frames it once the spread is drawn, as a pick from the list does: one move
     * into it, not a cut to its region and a second move to the note.
     */
    const picked =
      pick && findEntry(stateSets, pick)?.canvasId === canvasId ? pick : null;
    const arrival =
      target && picked ? { ...target, region: undefined } : target;
    store.set({
      status: "ready",
      search: NO_SEARCH,
      manifest,
      collection,
      canvasId,
      target: arrival && arrival.canvasId === canvasId ? arrival : null,
      addedSets: added(),
      annotationId: picked,
    });
    if (canvasId && canvasId !== initial.canvasId) {
      options.onCanvasChange?.(canvasId);
    }
  };

  /** Show or hide a set: the reader's choice, over where it starts. */
  const setVisible = (setId: string, visible: boolean) =>
    store.set((state) => {
      const hidden = state.hiddenSets.filter((id) => id !== setId);
      const shown = state.shownSets.filter((id) => id !== setId);
      return visible
        ? { hiddenSets: hidden, shownSets: [...shown, setId] }
        : { hiddenSets: [...hidden, setId], shownSets: shown };
    });

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
      /*
       * The content's own annotations: a content state's note, as a set of its own, or the
       * annotations given as the content. They stay through moves to the other Manifests
       * they name, until the next content.
       */
      const note = loaded.annotation;
      const noted = note
        ? readPage({ items: [note] }, `${note.id}#content-state`)
        : [];
      stateSets = noted.length
        ? [{ id: `${note!.id}#content-state`, source: "added", entries: noted }]
        : (loaded.annotationSets ?? []);
      const pick = pending ?? noted[0]?.id ?? loaded.pick;
      pending = null;
      arrive(
        loaded.manifest,
        loaded.collection ?? null,
        loaded.target,
        initial,
        pick,
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

  /**
   * Open another Manifest, to pick one of the content's own annotations there (`show`
   * picks it, at its Canvas), or ask a host that holds the Manifest to.
   */
  const openAnnotation = (manifestId: string, id: string) => {
    pending = id;
    if (options.isManifestControlled?.()) {
      options.onManifestChange?.(manifestId);
      return;
    }
    void show({ id: manifestId, type: "Manifest" }).then(
      (shown) => shown && options.onManifestChange?.(manifestId),
    );
  };

  /** Show a Collection member (at `canvasId`, where it has it); true once it is shown. */
  const show = async (
    member: Record<string, any>,
    canvasId?: string,
  ): Promise<boolean> => {
    if (member.type === "Collection") {
      await load(member.id);
      return store.get().status === "ready";
    }
    const { collection } = store.get();
    const signal = begin();
    // A pick waiting on this move (a host that holds the Manifest made it): its Canvas.
    const pick = pending;
    pending = null;
    const waiting = pick ? findEntry(stateSets, pick) : null;
    try {
      const next = await loadManifest(member, { request, signal });
      if (signal.aborted) return false;
      arrive(
        next,
        collection,
        waiting
          ? { canvasId: waiting.canvasId }
          : canvasId
            ? { canvasId }
            : undefined,
        {},
        pick,
      );
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
    captions,
    highlight,
    chapter,
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
    async goToManifest(id, canvasId) {
      if (isShown(id)) return;
      const member = memberOf(id);
      // Entering a nested Collection is not a choice of Manifest to ask the host about.
      if (member.type !== "Collection" && options.isManifestControlled?.()) {
        options.onManifestChange?.(id);
        return;
      }
      if (await show(member, canvasId)) {
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
      /*
       * One of a hidden page, chosen, shows its page again, so what was chosen is drawn
       * (Mat, 2026-10-26: "clicking a hidden annotation should unhide the annotation
       * page"). Search's hits are the Panel's to show.
       */
      const { hiddenSets, shownSets } = store.get();
      if (
        entry.setId !== SEARCH_SET_ID &&
        selectHiddenSets(manifest, addedSets, hiddenSets, shownSets).includes(
          entry.setId,
        )
      )
        setVisible(entry.setId, true);
      // On a Canvas not in view: go there; the Canvas frames it once laid out. One this
      // Manifest does not have stays picked, with nowhere to go.
      const shown = selectVisibleCanvases(manifest, canvasId).some(
        (canvas) => canvas.id === entry.canvasId,
      );
      const exists = selectCanvas(manifest, entry.canvasId) !== null;
      if (!shown && exists) navigate(entry.canvasId, null);
      // On a Canvas of another Manifest it names (`partOf`): open that one there.
      const elsewhere = exists
        ? undefined
        : manifestOfAnnotation(entry.annotation);
      if (elsewhere) openAnnotation(elsewhere, entry.id);
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
      store.set((state) => ({
        search: { ...state.search, query: q, status: "loading" },
      }));
      try {
        // Asking and reading a service, and the rest of this, load with the first search.
        const { searchInto } = await import("./search");
        await searchInto(store, service, q, request, controller.signal);
      } catch {
        // The search's own code would not load.
        store.set({
          search: { query: q, status: "error", hits: [], set: null },
        });
      }
    },
    setSetVisible(setId, visible) {
      setVisible(setId, visible);
    },
    async loadAnnotations(input) {
      annotating?.abort();
      if (!input) {
        hostSets = [];
        store.set({ addedSets: added() });
        return;
      }
      const controller = new AbortController();
      annotating = controller;
      try {
        // Read only for a Root given annotations of the host's own, as few are.
        const { loadAnnotationSets } = await import("./annotation-collection");
        const sets = await loadAnnotationSets(input, {
          request,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        hostSets = sets;
        store.set({ addedSets: added() });
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
    holdAllAnnotationPages() {
      allHeld++;
      embedVisiblePages();
      let held = true;
      return () => {
        if (held) allHeld--;
        held = false;
      };
    },
    dispose() {
      loading?.abort();
      annotating?.abort();
      searching?.abort();
    },
  };
}
