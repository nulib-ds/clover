import type { CloverRequest } from "../../core/request";
import type { Backend, BackendKind, DrawSource } from "./backends/backend";
import {
  type ContextHolder,
  claimContext,
  returnContext,
} from "./backends/contexts";
import type { DomLayerItem, DomLayers } from "./backends/dom/DomLayers";
import { WebGL2Backend } from "./backends/webgl2/WebGL2Backend";
import {
  type CameraState,
  type ViewportSize,
  anchoredCenter,
  fitCamera,
  sameCamera,
  screenPointToWorld,
  visibleWorldRect,
  worldPointToScreen,
} from "./camera/Camera";
import { CameraAnimator } from "./camera/CameraAnimator";
import {
  DEFAULT_GESTURES,
  GestureController,
  type GestureOptions,
  type GestureTarget,
} from "./input/GestureController";
import { TileCache, type TileWant } from "./io/TileCache";
import { type LoadedImage, loadImage } from "./io/decode";
import { FrameLoop } from "./loop/FrameLoop";
import { uploadBudget } from "./scene/uploadBudget";
import { type Point, apply, compose, rotate, scale } from "./math/affine";
import {
  type Rect,
  clamp,
  rectCenter,
  transformRect,
  union,
} from "./math/rect";
import type { Navigator } from "./overlays/Navigator";
import type { OverlayLayer } from "./overlays/OverlayLayer";
import { planFrame } from "./scene/planFrame";
import {
  type SceneImage,
  type SceneItem,
  MEDIA_KEY_PREFIX,
  itemToWorld,
  layoutItems,
  pixelsToWorld,
  prefetchCoarse,
  resolveItem,
  sameSpec,
} from "./scene/sceneItem";

export type { SceneImage } from "./scene/sceneItem";

export type BackendPreference = "auto" | BackendKind;

export interface CanvasRendererOptions {
  /** Which painter to use. `auto` tries WebGL2, then Canvas2D. */
  backend?: BackendPreference;
  gestures?: Partial<GestureOptions>;
  /** Largest zoom, in CSS pixels per image pixel (OpenSeadragon's `maxZoomPixelRatio`). */
  maxZoomPixelRatio?: number;
  /** Smallest zoom, as a fraction of the home zoom (OpenSeadragon's `minZoomImageRatio`). */
  minZoomImageRatio?: number;
  /**
   * Whether the home view may enlarge the picture past `maxZoomPixelRatio` to fill the
   * viewport. False, home stops at that zoom and centers the picture, smaller than the
   * viewport. Default true.
   */
  upscale?: boolean;
  /** Seconds for an animation to close most of its distance. 0 disables animation. */
  animationTime?: number;
  /**
   * Seconds each animation (zoom, glide, home) takes. Set, the camera eases on a
   * fixed-length spring instead of `animationTime`'s open-ended approach.
   */
  animationDuration?: number;
  /** With `animationDuration`, how much of the movement comes early: higher starts faster. */
  springStiffness?: number;
  /**
   * Hold the image inside its bounds while dragging. Off, a drag may carry it past the
   * edge and it springs back on release.
   */
  constrainDuringPan?: boolean;
  /** Credentials, headers and `fetch` for `info.json` and image requests. */
  request?: CloverRequest;
  /** Decoded tile bytes to keep in memory. */
  byteBudget?: number;
  /**
   * Image requests in flight at once. A server on HTTP/1.1 gets six at a time from the
   * browser whatever this says; the rest wait in the browser's queue, still abortable.
   */
  maxInFlight?: number;
  /** Milliseconds offscreen before its context is released. */
  releaseAfterMs?: number;
}

export type CanvasRendererEvent =
  /** The first set of images is laid out and fitted. Fires once. */
  | "open"
  /** The camera moved. Fires at most once per frame. */
  | "viewport"
  /** A new set of images replaced the previous one. */
  | "change"
  | "error"
  /**
   * Whether nothing the scene paints could be loaded (its detail): every image failed to
   * prepare, or every tile it wanted failed for good. Fires as that changes.
   */
  | "unloadable"
  /** The backend changed (fallback, or a context released and reacquired). */
  | "backend"
  /** A click that is not a zoom, with click-to-zoom turned off. */
  | "tap";

type Listener = (detail?: unknown) => void;

const DEFAULTS = {
  maxZoomPixelRatio: 1.1,
  minZoomImageRatio: 0.9,
  upscale: true,
  animationTime: 0.09,
  animationDuration: undefined as number | undefined,
  springStiffness: 6.5,
  constrainDuringPan: true,
  request: undefined as CloverRequest | undefined,
  byteBudget: 192 * 1024 * 1024,
  maxInFlight: 16,
  releaseAfterMs: 2000,
};

/** Retina is plenty: above 2, fill-rate and memory grow faster than anyone can see. */
const MAX_PIXEL_RATIO = 2;
/** Context losses tolerated before the renderer gives up on WebGL for this instance. */
const MAX_CONTEXT_LOSSES = 3;
/** Padding around an annotation zoomed to, as a fraction of the first item's width. */
const ANNOTATION_PADDING = 0.1;
/** Zooms this close to the limit count as at it: clamping leaves floating-point dust. */
const ZOOM_EPSILON = 1e-6;
/** How far ahead of a frame's own wants a scene still preparing goes (`landingWants`). */
const LANDING_AHEAD = 1e8;

interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSET: Inset = { top: 0, right: 0, bottom: 0, left: 0 };

/*
 * The host's padding, in CSS pixels. The stylesheet sets it (`--clover-canvas-inset`), and
 * the placeholder takes the same, so a still and the picture it hands over to sit alike.
 * Or an element's scroll padding: what of the hotspots' layer the controls cover
 * (`Annotations.css`).
 */
function readInset(
  element: HTMLElement | undefined,
  box: "padding" | "scroll-padding" = "padding",
): Inset {
  if (!element || typeof getComputedStyle !== "function") return NO_INSET;
  const style = getComputedStyle(element);
  const px = (side: string) =>
    parseFloat(style.getPropertyValue(`${box}-${side}`)) || 0;
  return {
    top: px("top"),
    right: px("right"),
    bottom: px("bottom"),
    left: px("left"),
  };
}

const sameInset = (a: Inset, b: Inset) =>
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom &&
  a.left === b.left;

/**
 * Clover's 2D renderer: one camera over a scene of images, each a pyramid of tiles.
 *
 * Every frame is planned (`planFrame`: which tiles to draw, which to fetch), handed to
 * the tile cache, and painted by a backend — with DOM layers for pixels the backend may
 * not read, an overlay layer for annotation hotspots, and an optional navigator.
 *
 * Framework-free — the React `Canvas` component is a thin host around it — so it can be
 * driven, measured and tested on its own.
 */
/** Canvas2D's code, loaded once for the page, the first time a renderer needs it. */
let canvas2d:
  | Promise<typeof import("./backends/canvas2d/Canvas2DBackend")>
  | undefined;

export class CanvasRenderer implements GestureTarget {
  readonly host: HTMLElement;
  /**
   * Annotation hotspots and anything else pinned to a world rectangle: made by the first
   * thing pinned (`overlaysOf`, in the hotspots' chunk), so a Canvas with none never
   * loads it.
   */
  overlays: OverlayLayer | null = null;

  private options: typeof DEFAULTS;
  private backend: Backend | null = null;
  private backendPreference: BackendPreference;
  private contextLosses = 0;
  /** Its place among the page's WebGL contexts (`backends/contexts`). */
  private holder: ContextHolder = {
    hiddenSince: null,
    release: () => this.giveBack(),
  };
  /** In the window, as last seen: only then does it hold a context. */
  private visible = true;
  /**
   * Elements the backend does not draw (`dom` video, pixels WebGL may not read): made,
   * its code loaded, the first time a frame holds one.
   */
  private dom: DomLayers | null = null;
  private domAsked = false;
  /** A canvas waiting for Canvas2D's code, the host's background showing meanwhile. */
  private pending: HTMLCanvasElement | null = null;
  private camera: CameraAnimator;
  private loop: FrameLoop;
  private gestures: GestureController;
  /** The gesture options the renderer was created with; `setGestures` layers on these. */
  private gestureOptions: Partial<GestureOptions> = {};
  private cache: TileCache;
  private navigator: Navigator | null = null;
  /** Counts `attachNavigator` calls, so only the latest one's navigator is made. */
  private navigatorAsked = 0;

  private viewport: ViewportSize = { width: 1, height: 1 };
  /** The host's padding: the space the home view keeps clear around the picture. */
  private inset: Inset = NO_INSET;
  private pixelRatio = 1;
  private items: SceneItem[] = [];
  private worldBounds: Rect | null = null;
  /** Bumped when the scene or its loaded tiles change: the navigator redraws on it. */
  private contentVersion = 0;
  /** Tiles WebGL refused (no CORS): shown as DOM layers from then on. */
  private opaqueUrls = new Set<string>();
  /** Media items' elements, by their one tile's key. Never in the tile cache. */
  private mediaByKey = new Map<string, LoadedImage>();
  private detachMedia: Array<() => void> = [];
  private opened = false;
  /** True until the reader moves the camera; a resize then refits rather than crops. */
  private atHome = true;
  /** A pointer is down. Without `constrainDuringPan`, the center may leave the world. */
  private interacting = false;
  private lastEmitted: CameraState | null = null;
  private generation = 0;
  /**
   * The tiles a scene still preparing will want where it lands, asked for with every
   * frame's, ahead of them, until it replaces the scene on screen (`setImages`).
   */
  private landing: TileWant[] = [];
  private listeners = new Map<CanvasRendererEvent, Set<Listener>>();
  private unloadable = false;

  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  private dprQuery: MediaQueryList | null = null;
  private disposed = false;

  constructor(host: HTMLElement, options: CanvasRendererOptions = {}) {
    this.host = host;
    this.backendPreference = options.backend ?? "auto";
    this.options = {
      ...DEFAULTS,
      ...stripUndefined(options),
    } as typeof DEFAULTS;
    if (prefersReducedMotion()) {
      this.options.animationTime = 0;
      if (this.options.animationDuration !== undefined) {
        this.options.animationDuration = 0;
      }
    }

    const { animationDuration, springStiffness } = this.options;
    this.camera = new CameraAnimator(
      { x: 0, y: 0, zoom: 1, rotation: 0 },
      this.options.animationTime,
      animationDuration === undefined
        ? undefined
        : { duration: animationDuration, stiffness: springStiffness },
    );
    this.loop = new FrameLoop(this.tick);
    this.gestureOptions = stripUndefined(options.gestures ?? {});
    // No glide on release where the system asks for less motion: every move is made at
    // once there, so a glide would jump the image by its whole length. The view stops
    // where the pointer let go.
    if (prefersReducedMotion()) this.gestureOptions.flickMomentum = 0;
    this.gestures = new GestureController(host, this, {
      ...DEFAULT_GESTURES,
      ...this.gestureOptions,
    });
    this.cache = new TileCache({
      load: (url, signal) => this.loadTile(url, signal),
      onSettled: () => {
        this.contentVersion++;
        this.invalidate();
      },
      onEvict: (url) => this.backend?.release(url),
      byteBudget: this.options.byteBudget,
      maxInFlight: this.options.maxInFlight,
    });

    // A context only for a host in view: a page of them must not ask for one each.
    this.visible = inWindow(host);
    if (this.visible) this.acquireBackend();
    else this.holder.hiddenSince = now();
    this.measure();
    this.observe();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  get backendKind(): BackendKind {
    return this.backend?.kind ?? "none";
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Whether the camera is at home: false once the reader zooms, pans or turns it. */
  get isAtHome(): boolean {
    return this.atHome;
  }

  on(event: CanvasRendererEvent, listener: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => set?.delete(listener);
  }

  /**
   * Replace the scene.
   *
   * New items are resolved — `info.json` fetched, coarsest tiles decoded — before they
   * replace the old ones, so a swap never flashes empty. Items whose description is
   * unchanged are kept as they are, and tiles are cached by URL, so swapping between two
   * regions of one image costs nothing at all.
   *
   * The finer tiles do not wait for the coarsest: once every item's size is known, the
   * tiles for the view the new scene will open on are asked for beside them, ahead of the
   * scene being left (`landing`). A page turn then sharpens a round trip sooner.
   */
  async setImages(
    images: SceneImage[],
    {
      world,
      fit = false,
    }: {
      /**
       * The world's extent, when it is more than the images cover — the Canvases they are
       * painted on, which may have bare areas. Home frames this.
       */
      world?: Rect;
      /** Frame the new scene rather than keep the reader's view (a new page). */
      fit?: boolean;
    } = {},
  ): Promise<void> {
    const generation = ++this.generation;
    const previous = new Map(this.items.map((item) => [item.id, item]));
    // A scene asked for before this one is not coming.
    this.landing = [];
    const context = {
      cache: this.cache,
      loadStatic: (url: string) => this.loadTile(url),
      infoOptions: { request: this.options.request },
    };

    const prepared = images.map((spec) => {
      const kept = previous.get(spec.id);
      if (kept && sameSpec(kept.spec, spec)) {
        kept.spec = spec;
        return { item: Promise.resolve(kept), ready: Promise.resolve() };
      }
      const item = resolveItem(spec, context);
      // Its coarsest tiles, as soon as it is resolved, so it draws the moment it is shown.
      const ready = item.then(
        (resolved) => prefetchCoarse(resolved, this.cache),
        () => undefined,
      );
      return { item, ready };
    });

    const results = await Promise.allSettled(prepared.map(({ item }) => item));
    // Superseded by a later call, or torn down while loading.
    if (generation !== this.generation || this.disposed) return;
    this.landing = this.landingWants(
      results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
      world,
      fit || !this.opened,
    );
    this.invalidate();
    await Promise.all(prepared.map(({ ready }) => ready));
    if (generation !== this.generation || this.disposed) return;
    this.landing = [];

    const items = results
      .filter(
        (r): r is PromiseFulfilledResult<SceneItem> => r.status === "fulfilled",
      )
      .map((r) => r.value);
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason);

    this.items = items;
    this.watchMedia(items);
    const laidOut = layoutItems(items);
    this.worldBounds = world
      ? laidOut
        ? union([world, laidOut])
        : world
      : laidOut;
    this.contentVersion++;

    if (errors.length) this.emit("error", errors);
    // Nothing to draw at all where every image failed to prepare (an address that answers
    // with an error, before its size is known).
    this.setUnloadable(images.length > 0 && !items.length && errors.length > 0);

    if (!this.worldBounds) {
      this.invalidate();
      return;
    }

    if (!this.opened) {
      this.opened = true;
      this.home(true);
      this.emit("open");
    } else if (fit) {
      this.home(true);
      this.emit("change");
    } else {
      // Preserve the reader's view across swaps; only re-apply limits.
      this.camera.set(this.constrain(this.camera.current));
      this.emit("change");
    }
    this.invalidate();
  }

  /**
   * Put the scene away at once: from the next frame nothing of it is drawn, and a swap
   * still preparing is dropped. For moving to a different resource, whose pictures should
   * never show beside the last one's while they load; `setImages` then draws the new
   * scene, framed afresh. A swap within one resource keeps the old scene up instead.
   */
  clear(): void {
    this.setUnloadable(false);
    this.generation++;
    this.landing = [];
    this.items = [];
    this.watchMedia([]);
    this.worldBounds = null;
    this.contentVersion++;
    this.invalidate();
  }

  /**
   * Show only some of the scene's images, keeping the others loaded: the frames of an
   * animation. Nothing is prepared, laid out or reported; the next frame draws the change.
   */
  setHidden(ids: Iterable<string>): void {
    const hidden = new Set(ids);
    let changed = false;
    for (const item of this.items) {
      const next = hidden.has(item.id);
      if (Boolean(item.spec.hidden) === next) continue;
      item.spec = { ...item.spec, hidden: next };
      changed = true;
    }
    if (changed) this.invalidate();
  }

  /**
   * Whether an image can be drawn now: it is in the scene and its coarsest level is
   * loaded. An animation waits on this before showing a frame, rather than blink empty.
   */
  isReady(id: string): boolean {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) return false;
    if (item.spec.media) return true;
    const level = item.pyramid.levels[0];
    if (!level) return false;
    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.cols; col++) {
        if (!this.getTile(item.pyramid.tile({ level: 0, col, row }).url)) {
          return false;
        }
      }
    }
    return true;
  }

  /** Frame `bounds` (world units) in the viewport, or in the part of it `inset` leaves. */
  fitBounds(bounds: Rect, immediate = false, inset = NO_INSET): void {
    const target = this.fit(bounds, this.camera.destination.rotation, inset);
    this.atHome = false;
    this.animateTo(
      this.constrain(target, { allowBeyondLimits: true }),
      immediate,
    );
  }

  /**
   * The camera that frames `bounds`, turned by `rotation`, in the part of the viewport
   * `inset` leaves: centered there, off the viewport's center where its sides differ.
   */
  private fit(
    bounds: Rect,
    rotation: number,
    { top, right, bottom, left }: Inset,
    maxZoom = Infinity,
  ): CameraState {
    const { width, height } = this.viewport;
    const fitted = fitCamera(
      bounds,
      {
        width: Math.max(1, width - left - right),
        height: Math.max(1, height - top - bottom),
      },
      rotation,
    );
    const zoom = Math.min(fitted.zoom, maxZoom);
    const center = anchoredCenter(
      rectCenter(bounds),
      { x: (width + left - right) / 2, y: (height + top - bottom) / 2 },
      zoom,
      rotation,
      this.viewport,
    );
    return { ...center, zoom, rotation };
  }

  /**
   * Zoom to a rectangle in item `index`'s own coordinates — an annotation's `xywh` — with
   * OpenSeadragon's padding.
   */
  fitItemRect(index: number, rect: Rect, immediate = false): void {
    const world = this.itemRectToWorld(index, rect);
    if (world) this.fitAnnotation(world, immediate);
  }

  /**
   * Zoom to a world rectangle with OpenSeadragon's annotation padding, clear of the
   * controls over the view (the hotspots' layer's scroll padding, `Annotations.css`).
   */
  fitAnnotation(world: Rect, immediate = false): void {
    const first = this.items[0];
    if (!first) return;
    const pad = first.rect.width * ANNOTATION_PADDING;
    this.fitBounds(
      {
        x: world.x - pad,
        y: world.y - pad,
        width: world.width + pad * 2,
        height: world.height + pad * 2,
      },
      immediate,
      readInset(this.overlays?.container, "scroll-padding"),
    );
  }

  /** The world rectangle currently visible (its bounding box when rotated). */
  getBounds(): Rect {
    return visibleWorldRect(this.camera.current, this.viewport);
  }

  getHomeBounds(): Rect | null {
    return this.worldBounds ? { ...this.worldBounds } : null;
  }

  getCamera(): CameraState {
    return { ...this.camera.current };
  }

  getZoomLimits(): { min: number; max: number; home: number } {
    const home = this.homeCamera()?.zoom ?? 1;
    return {
      home,
      min: home * this.options.minZoomImageRatio,
      max: Math.max(home, this.closestZoom()),
    };
  }

  /**
   * `maxZoomPixelRatio` is CSS pixels per *image* pixel, and world units may differ from
   * those. Measured against the sharpest image in the scene, so an inset photograph
   * denser than the page it sits on can still be zoomed to its own full resolution.
   */
  private closestZoom(items = this.items): number {
    const worldPerPixel = items.length
      ? Math.min(...items.map((item) => pixelsToWorld(item).x))
      : 1;
    return this.options.maxZoomPixelRatio / worldPerPixel;
  }

  home(immediate = false): void {
    const home = this.homeCamera();
    if (!home) return;
    const was = this.atHome;
    this.atHome = true;
    this.animateTo(home, immediate);
    // Already framed as home by hand, the camera doesn't move, so no frame says so.
    if (!was && this.opened) this.emit("viewport");
  }

  /** Zoomed in as far as it goes, or on the way there. */
  atMaxZoom(): boolean {
    return (
      this.camera.destination.zoom >=
      this.getZoomLimits().max * (1 - ZOOM_EPSILON)
    );
  }

  /**
   * Which of zoom in, zoom out and home would change nothing, judged where the camera is
   * heading, as `atMaxZoom` is. Home is `isAtHome` and the same zoom, center and turn, to
   * within half a screen pixel and a thousandth of the zoom: after a zoom in and out by
   * hand the reader is not home, so reset stays, as the Document's sheets (`atHome`)
   * and a resize's refit need it to.
   */
  viewLimits(): { atMax: boolean; atMin: boolean; atHome: boolean } {
    const { zoom, x, y, rotation } = this.camera.destination;
    const { min, max } = this.getZoomLimits();
    // The flag first: `homeCamera` is a fit, which this runs every frame of a move.
    const home = this.atHome ? this.homeCamera() : null;
    return {
      atMax: zoom >= max * (1 - ZOOM_EPSILON),
      atMin: zoom <= min * (1 + ZOOM_EPSILON),
      atHome:
        this.atHome &&
        (!home ||
          (Math.abs(zoom / home.zoom - 1) < 1e-3 &&
            Math.hypot(x - home.x, y - home.y) * zoom < 0.5 &&
            Math.abs(rotation - home.rotation) < 1e-3)),
    };
  }

  zoomBy(factor: number, at?: Point, animate = true): void {
    const base = animate ? this.camera.destination : this.camera.current;
    const screen = at ?? {
      x: this.viewport.width / 2,
      y: this.viewport.height / 2,
    };
    const world = screenPointToWorld(base, this.viewport, screen);
    const { min, max } = this.getZoomLimits();
    const zoom = clamp(base.zoom * factor, min, max);
    const center = anchoredCenter(
      world,
      screen,
      zoom,
      base.rotation,
      this.viewport,
    );
    const target = this.constrain({ ...base, ...center, zoom });
    this.atHome = false;
    if (animate) {
      this.camera.animateTo(
        { state: target, anchor: { world, screen } },
        this.viewport,
      );
    } else {
      this.camera.set(target);
    }
    this.invalidate();
  }

  panBy(dx: number, dy: number, animate = false): void {
    const base = animate ? this.camera.destination : this.camera.current;
    // A screen-space shift, carried back through the camera's rotation and zoom.
    const shift = apply(compose(scale(1 / base.zoom), rotate(-base.rotation)), {
      x: dx,
      y: dy,
    });
    const target = this.constrain({
      ...base,
      x: base.x - shift.x,
      y: base.y - shift.y,
    });
    this.atHome = false;
    if (animate) this.camera.animateTo({ state: target }, this.viewport);
    else this.camera.set(target);
    this.invalidate();
  }

  /** Center the view on a world point. */
  panTo(point: Point, immediate = false): void {
    const base = immediate ? this.camera.current : this.camera.destination;
    this.atHome = false;
    this.animateTo(this.constrain({ ...base, ...point }), immediate);
  }

  rotateBy(degrees: number): void {
    const base = this.camera.destination;
    this.setRotation((base.rotation * 180) / Math.PI + degrees);
  }

  /** Rotate about the viewport center. Degrees, clockwise, like OpenSeadragon. */
  setRotation(degrees: number, immediate = false): void {
    const base = this.camera.destination;
    const rotation = (degrees * Math.PI) / 180;
    this.animateTo(this.constrain({ ...base, rotation }), immediate);
  }

  getRotation(): number {
    return (this.camera.destination.rotation * 180) / Math.PI;
  }

  tap(at: Point): void {
    this.emit("tap", at);
  }

  private dismisser: (() => boolean) | null = null;

  /**
   * What a tap off every control and hotspot puts away first: the handler returns whether
   * it put anything away, and if it did, the tap neither zooms nor is reported.
   */
  setDismiss(handler: (() => boolean) | null): void {
    this.dismisser = handler;
  }

  dismiss(): boolean {
    return this.dismisser?.() ?? false;
  }

  /** Change how pointer, wheel and keyboard drive the camera. */
  setGestures(gestures: Partial<GestureOptions>): void {
    this.gestures.setOptions({
      ...DEFAULT_GESTURES,
      ...this.gestureOptions,
      ...stripUndefined(gestures),
    });
  }

  setInteracting(interacting: boolean): void {
    this.interacting = interacting;
    // A press catches a glide in flight.
    if (interacting) {
      this.camera.stop();
      return;
    }
    if (this.options.constrainDuringPan) return;
    // A drag let past the edge springs back once released.
    const destination = this.camera.destination;
    const settled = this.constrain(destination);
    if (!sameCamera(destination, settled)) this.animateTo(settled, false);
  }

  worldToScreenPoint(point: Point): Point {
    return worldPointToScreen(this.camera.current, this.viewport, point);
  }

  screenToWorldPoint(point: Point): Point {
    return screenPointToWorld(this.camera.current, this.viewport, point);
  }

  /**
   * A rectangle in item `index`'s own coordinates (its declared size — what an
   * annotation's `xywh` targets) → world units.
   */
  itemRectToWorld(index: number, rect: Rect): Rect | null {
    const item = this.items[index];
    if (!item) return null;
    const { contentClip, clip } = item;
    // Turned (Cookbook 0040), its own coordinates are turned with the picture.
    if (item.turn)
      return transformRect(
        compose(
          itemToWorld(item),
          scale(
            clip.width / contentClip.width,
            clip.height / contentClip.height,
          ),
        ),
        rect,
      );
    const kx = item.rect.width / contentClip.width;
    const ky = item.rect.height / contentClip.height;
    return {
      x: item.rect.x + (rect.x - contentClip.x) * kx,
      y: item.rect.y + (rect.y - contentClip.y) * ky,
      width: rect.width * kx,
      height: rect.height * ky,
    };
  }

  /**
   * Show an overview of the scene in `element`. Returns a function that removes it. It is
   * off by default, so its code loads the first time one is asked for, and draws then.
   */
  attachNavigator(element: HTMLElement): () => void {
    this.navigator?.dispose();
    this.navigator = null;
    const asked = ++this.navigatorAsked;
    let navigator: Navigator | null = null;
    let removed = false;
    void import("./overlays/Navigator").then((module) => {
      // Removed, or another asked for since: this one is not wanted.
      if (removed || this.disposed || asked !== this.navigatorAsked) return;
      navigator = new module.Navigator(element, (point, immediate) =>
        this.panTo(point, immediate),
      );
      this.navigator = navigator;
      this.invalidate();
    });
    return () => {
      removed = true;
      navigator?.dispose();
      if (navigator && this.navigator === navigator) this.navigator = null;
    };
  }

  invalidate(): void {
    this.loop.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.loop.dispose();
    this.gestures.dispose();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.dprQuery?.removeEventListener?.("change", this.onPixelRatioChange);
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.navigator?.dispose();
    this.navigator = null;
    this.releaseBackend();
    this.cache.dispose();
    this.dom?.dispose();
    this.overlays?.dispose();
    this.items = [];
    this.detachMedia.forEach((detach) => detach());
    this.mediaByKey.clear();
    this.listeners.clear();
    delete this.host.dataset.backend;
  }

  // ─── Frame ────────────────────────────────────────────────────────────────

  private tick = (dt: number): boolean => {
    if (this.disposed) return false;
    const animating = this.camera.step(dt, this.viewport);
    const camera = this.camera.current;
    // Spread a burst of new tiles over frames rather than uploading them all in one.
    const backend = this.backend;
    const uploads = uploadBudget(this.getTile, (url) =>
      backend ? backend.has(url) : true,
    );

    const plan = planFrame({
      items: this.items,
      camera,
      viewport: this.viewport,
      pixelRatio: this.pixelRatio,
      getTile: uploads.getTile,
      has: this.hasTile,
      wantOverview: Boolean(this.navigator),
      // Fetch for where the camera lands, not for each view on the way.
      destination: animating ? this.camera.destination : undefined,
    });
    const wants = (
      this.landing.length ? [...this.landing, ...plan.wants] : plan.wants
    ).filter((want) => !want.url.startsWith(MEDIA_KEY_PREFIX));
    this.cache.update(wants);
    // Something drawn, or else every tile wanted failed for good: whether it can be shown.
    if (plan.draws.length) this.setUnloadable(false);
    else if (wants.length && wants.every((want) => this.cache.failed(want.url)))
      this.setUnloadable(true);
    this.paint(plan.draws);
    this.overlays?.position(camera, this.viewport);
    this.navigator?.render(
      this.items.filter((item) => !item.spec.hidden),
      this.worldBounds,
      visibleWorldRect(camera, this.viewport),
      this.pixelRatio,
      this.getTile,
      this.contentVersion,
    );

    if (!this.lastEmitted || !sameCamera(this.lastEmitted, camera)) {
      this.lastEmitted = { ...camera };
      if (this.opened) this.emit("viewport");
    }
    // Tiles held back by the upload budget need the next frame too.
    return animating || uploads.deferred;
  };

  private getTile = (url: string) =>
    this.mediaByKey.get(url) ?? this.cache.get(url);

  /** Decoded and in memory, drawn this frame or held back by the upload budget. */
  private hasTile = (url: string) =>
    this.mediaByKey.has(url) || this.cache.has(url);

  /**
   * What a scene still preparing will want once shown, for the view it opens on: framed
   * as home where it will be (`fit`), else where the camera is heading. Its items are
   * laid out as copies, since kept ones are still on screen where they are. Each want
   * goes ahead of the scene on screen, which is being left.
   */
  private landingWants(
    items: SceneItem[],
    world: Rect | undefined,
    fit: boolean,
  ): TileWant[] {
    const placed = items.map((item) => ({ ...item, rect: { ...item.rect } }));
    const laidOut = layoutItems(placed);
    const bounds = world
      ? laidOut
        ? union([world, laidOut])
        : world
      : laidOut;
    if (!bounds) return [];
    const camera = fit
      ? this.homeCamera(bounds, placed)
      : this.camera.destination;
    if (!camera) return [];
    const { wants } = planFrame({
      items: placed,
      camera,
      viewport: this.viewport,
      pixelRatio: this.pixelRatio,
      getTile: (url) => this.cache.get(url),
    });
    return wants.map((want) => ({
      ...want,
      priority: want.priority - LANDING_AHEAD,
    }));
  }

  /**
   * Track the scene's media elements: redraw when one has a new frame to show (it
   * started, seeked, or loaded), and drop the listeners when the scene changes.
   */
  private watchMedia(items: SceneItem[]): void {
    this.detachMedia.forEach((detach) => detach());
    this.detachMedia = [];
    this.mediaByKey.clear();
    for (const item of items) {
      if (!item.media || item.media.kind !== "media") continue;
      const key = item.pyramid.tile({ level: 0, col: 0, row: 0 }).url;
      this.mediaByKey.set(key, item.media);
      const element = item.media.source;
      const redraw = () => this.invalidate();
      const events = ["play", "seeked", "loadeddata", "resize"];
      events.forEach((type) => element.addEventListener(type, redraw));
      this.detachMedia.push(() =>
        events.forEach((type) => element.removeEventListener(type, redraw)),
      );
    }
  }

  private paint(draws: ReturnType<typeof planFrame>["draws"]): void {
    const backend = this.backend;
    const domItems: DomLayerItem[] = [];
    const webgl = backend?.kind === "webgl2";

    backend?.begin();
    for (const draw of draws) {
      const { image } = draw;
      // DOM layers: video, as a `<video>`, whatever the backend, and what WebGL may not read.
      const asDom =
        image.kind === "media" ||
        (image.kind === "element" &&
          webgl &&
          (image.opaque || this.opaqueUrls.has(draw.url)));

      if (!asDom && backend) {
        const result = backend.draw({
          key: draw.url,
          source: image.source as DrawSource,
          width: image.width,
          height: image.height,
          transform: draw.transform,
          crop: draw.crop,
          opacity: 1,
          bleed: draw.bleed,
        });
        if (result !== "tainted" || image.kind === "bitmap") continue;
        // WebGL may not read these pixels. Show the element itself from now on.
        this.opaqueUrls.add(draw.url);
      }

      if (image.kind === "element" || image.kind === "media") {
        domItems.push({
          key: `${draw.item.id}|${draw.url}`,
          element: image.source,
          width: image.width,
          height: image.height,
          transform: draw.transform,
          crop: draw.crop,
          opacity: 1,
        });
      }
    }
    backend?.end();
    if (this.dom) this.dom.sync(domItems);
    else if (domItems.length && !this.domAsked) {
      this.domAsked = true;
      void import("./backends/dom/DomLayers").then(({ DomLayers }) => {
        if (this.disposed) return;
        const dom = new DomLayers(this.host);
        // Over the canvas, under the hotspots.
        if (this.overlays)
          this.host.insertBefore(dom.container, this.overlays.container);
        this.dom = dom;
        this.invalidate();
      });
    }
  }

  private loadTile(url: string, signal?: AbortSignal) {
    return loadImage(url, {
      signal,
      request: this.options.request,
      maxTextureSize:
        this.backend instanceof WebGL2Backend
          ? this.backend.maxTextureSize
          : undefined,
    });
  }

  // ─── Camera helpers ───────────────────────────────────────────────────────

  private animateTo(state: CameraState, immediate: boolean): void {
    this.camera.animateTo({ state }, this.viewport, immediate);
    this.invalidate();
  }

  /**
   * Home is the whole world, upright — Clover's home control also resets rotation. Upright
   * is the whole turn nearest where the camera is heading, so four quarter turns right then
   * home does not spin a full turn back, and three come upright by one more quarter.
   */
  private homeCamera(
    bounds = this.worldBounds,
    items = this.items,
  ): CameraState | null {
    if (!bounds) return null;
    const turn = 2 * Math.PI;
    const upright =
      Math.round(this.camera.destination.rotation / turn) * turn || 0;
    // In the padded area.
    return this.fit(
      bounds,
      upright,
      this.inset,
      this.options.upscale ? Infinity : this.closestZoom(items),
    );
  }

  /**
   * Keep the camera usable: zoom within limits, and the center over the world so the
   * picture cannot be flung out of sight.
   */
  private constrain(
    state: CameraState,
    { allowBeyondLimits = false } = {},
  ): CameraState {
    const bounds = this.worldBounds;
    if (!bounds) return state;
    const { min, max } = this.getZoomLimits();
    const zoom = allowBeyondLimits
      ? clamp(state.zoom, min, Math.max(max, state.zoom))
      : clamp(state.zoom, min, max);
    if (this.interacting && !this.options.constrainDuringPan) {
      return { ...state, zoom };
    }
    return {
      ...state,
      zoom,
      x: clamp(state.x, bounds.x, bounds.x + bounds.width),
      y: clamp(state.y, bounds.y, bounds.y + bounds.height),
    };
  }

  // ─── Backend lifecycle ────────────────────────────────────────────────────

  /** @param webgl false to draw with Canvas2D whatever the preference, as after a loss. */
  private acquireBackend(webgl = true): void {
    if (this.backend || this.pending || this.disposed) return;

    const canvas = document.createElement("canvas");
    canvas.className = "clover-canvas-surface";
    canvas.setAttribute("aria-hidden", "true");
    /*
     * Its geometry inline, not only in the stylesheet: a canvas sized by nothing takes
     * its own pixel buffer as its size, which the renderer sizes from its host — and
     * without the stylesheet the host then grows with it, without end (WebKit).
     */
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      pointerEvents: "none",
    });
    // Under the DOM layer and the hotspots, made before it or after.
    this.host.insertBefore(
      canvas,
      this.dom?.container ?? this.overlays?.container ?? null,
    );

    const tryWebGL =
      webgl &&
      (this.backendPreference === "webgl2" ||
        (this.backendPreference === "auto" &&
          this.contextLosses < MAX_CONTEXT_LOSSES));

    let backend: Backend | null = null;
    // Asked for WebGL2 alone, it is tried past the page's share too.
    if (
      tryWebGL &&
      (claimContext(this.holder) || this.backendPreference === "webgl2")
    ) {
      backend = WebGL2Backend.create(canvas, { onLost: this.onContextLost });
      if (!backend) returnContext(this.holder);
    }
    if (backend) this.install(backend);
    else if (this.backendPreference === "webgl2") this.none(canvas);
    else {
      /*
       * Canvas2D, whose code loads the first time it is needed: a context past the page's
       * share, a lost one, or no WebGL2 at all. Given back or disposed meanwhile, it is
       * not made.
       */
      this.pending = canvas;
      void (canvas2d ??= import("./backends/canvas2d/Canvas2DBackend")).then(
        ({ Canvas2DBackend }) => {
          if (this.pending !== canvas) return;
          this.pending = null;
          const made = Canvas2DBackend.create(canvas);
          if (made) this.install(made);
          else this.none(canvas);
        },
      );
    }
  }

  private none(canvas: HTMLCanvasElement): void {
    canvas.remove();
    this.host.dataset.backend = "none";
  }

  private install(backend: Backend): void {
    this.backend = backend;
    this.host.dataset.backend = backend.kind;
    backend.resize(this.viewport.width, this.viewport.height, this.pixelRatio);

    // Tiles demoted to DOM only because WebGL refused them can go back on the canvas
    // under a backend that will draw them.
    if (backend.kind === "canvas2d") this.opaqueUrls.clear();

    this.emit("backend", backend.kind);
    this.invalidate();
  }

  private releaseBackend(): void {
    returnContext(this.holder);
    this.pending?.remove();
    this.pending = null;
    if (!this.backend) return;
    const canvas = this.backend.canvas;
    this.backend.dispose();
    canvas.remove();
    this.backend = null;
  }

  /** Its context given back, out of view or to make room for one in view. */
  private giveBack(): void {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    this.releaseBackend();
    this.host.dataset.backend = "released";
  }

  /*
   * The browser took the context (too many on the page, a GPU reset). Its canvas goes at
   * once, so the browser's picture of a lost context never shows, only the host's
   * background; Canvas2D draws on from the decoded tiles, nothing refetched, and WebGL is
   * tried again when it next comes into view (a GPU that keeps dropping it, never).
   */
  private onContextLost = () => {
    this.contextLosses += 1;
    this.releaseBackend();
    if (this.visible) this.acquireBackend(false);
    else this.host.dataset.backend = "released";
  };

  // ─── Observation ──────────────────────────────────────────────────────────

  private observe(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.measure(true));
      this.resizeObserver.observe(this.host);
    }

    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        this.setVisible(visible);
      });
      this.intersectionObserver.observe(this.host);
    }

    this.watchPixelRatio();
  }

  /**
   * Browsers cap live WebGL contexts per page and silently kill the oldest beyond it.
   * An instance scrolled out of view gives its context back after a grace period, or at
   * once when one in view needs it (`backends/contexts`), and takes a fresh one on
   * return; decoded tiles stay in memory, so nothing is refetched.
   */
  private setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      this.holder.hiddenSince = null;
      if (this.releaseTimer) clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
      if (!this.backend) this.acquireBackend();
      return;
    }
    this.holder.hiddenSince ??= now();
    if (!this.backend || this.releaseTimer) return;
    this.releaseTimer = setTimeout(
      () => this.giveBack(),
      this.options.releaseAfterMs,
    );
  }

  /**
   * @param now draw at once, for a ResizeObserver: resizing the canvas clears it, and
   *   the observer runs too late in the frame for the next frame to be in time. Without
   *   it, dragging a pane's edge blinks the picture on every step.
   */
  private measure(now = false): void {
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const inset = readInset(this.host);
    const pixelRatio = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      MAX_PIXEL_RATIO,
    );
    if (
      width === this.viewport.width &&
      height === this.viewport.height &&
      pixelRatio === this.pixelRatio &&
      sameInset(inset, this.inset)
    ) {
      return;
    }

    const previous = this.viewport;
    this.viewport = { width, height };
    this.inset = inset;
    this.pixelRatio = pixelRatio;
    this.backend?.resize(width, height, pixelRatio);

    if (this.opened) {
      if (this.atHome) {
        this.home(true);
      } else {
        // Keep the same world width in view as the Body resizes.
        const current = this.camera.current;
        const ratio = width / Math.max(previous.width, 1);
        this.camera.set(
          this.constrain({ ...current, zoom: current.zoom * ratio }),
        );
      }
      // The camera may not have moved, but what it may zoom to and home have.
      this.emit("viewport");
    }
    if (now) this.loop.drawNow();
    else this.invalidate();
  }

  private watchPixelRatio(): void {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    this.dprQuery?.removeEventListener?.("change", this.onPixelRatioChange);
    this.dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`,
    );
    this.dprQuery.addEventListener?.("change", this.onPixelRatioChange);
  }

  private onPixelRatioChange = () => {
    this.measure();
    this.watchPixelRatio();
  };

  private setUnloadable(unloadable: boolean): void {
    if (unloadable === this.unloadable) return;
    this.unloadable = unloadable;
    this.emit("unloadable", unloadable);
  }

  private emit(event: CanvasRendererEvent, detail?: unknown): void {
    this.listeners.get(event)?.forEach((listener) => listener(detail));
  }
}

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/**
 * Whether the host is in the window, its edges included (as a host not yet laid out is,
 * at the origin): where `IntersectionObserver` cannot say, always.
 */
function inWindow(host: HTMLElement): boolean {
  if (
    typeof IntersectionObserver === "undefined" ||
    typeof window === "undefined"
  ) {
    return true;
  }
  const { top, left, width, height } = host.getBoundingClientRect();
  return (
    top + height >= 0 &&
    left + width >= 0 &&
    top <= window.innerHeight &&
    left <= window.innerWidth
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
