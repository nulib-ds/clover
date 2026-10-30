import type {
  IIIFExternalWebResource,
  InternationalString,
} from "@iiif/presentation-3";
import type { ReactNode } from "react";
import type {
  BackendKind,
  BackendPreference,
  CameraState,
  CanvasRendererEvent,
  GestureOptions,
  Point,
  Rect,
} from "../../lib/renderer";
import type { CanvasAnnotation } from "./Annotations";
import type { IIIFCanvas, ViewingDirection } from "./layout";
import type { ControlButtons } from "../../ui/controlButtons";
import type { AnnotationLink } from "../../core/link";
import type { CloverRequest } from "../../core/request";

/** A painting body as `body` takes it: a web resource that may carry a `label`. */
export interface LabeledIIIFExternalWebResource
  extends IIIFExternalWebResource {
  label?: InternationalString;
  region?: string;
}

/** Which controls to show. All are on by default, as in `Image`. */
export interface CanvasControlsConfig {
  zoom?: boolean;
  fullPage?: boolean;
  rotation?: boolean;
  reset?: boolean;
  /**
   * A control listing the `annotations` by their text; picking one zooms to it. Shown
   * only when some annotation can be drawn.
   */
  annotations?: boolean;
  /**
   * An `i` control that slides out the Canvases' `summary` and `metadata` as a caption.
   * Shown only when a Canvas has either.
   */
  information?: boolean;
  /**
   * A map control that shows where the Canvas, else its Manifest, is (its `navPlace`), on a
   * map in a box, as the information is. Shown only when one of them has a place.
   */
  map?: boolean;
}

export interface CloverCanvasOptions {
  /** Which painter to use. `auto` (default) tries WebGL2, then Canvas2D. */
  backend?: BackendPreference;
  /** Pointer, wheel and keyboard behavior. Wheel zoom is off by default. */
  gestures?: Partial<GestureOptions>;
  /** Largest zoom, in CSS pixels per image pixel. Default 1.1. */
  maxZoomPixelRatio?: number;
  /** Smallest zoom, as a fraction of the home zoom. Default 0.9. */
  minZoomImageRatio?: number;
  /** Seconds for an animation to close most of its distance. 0 disables easing. */
  animationTime?: number;
  /**
   * Milliseconds the controls and navigator stay after a mouse (or a pen that hovers)
   * stops moving, as the Player's `hideDelay`. Default 2000; `Infinity` keeps them once
   * shown. A finger, or a pen that does not hover, has no timer: a tap on the picture
   * shows them, and another hides them. Focus that no press brought holds them too.
   */
  hideDelay?: number;
  /** A time-based Canvas's video or sound. */
  /**
   * An animation Canvas (painting annotations at `#t=` times, one per frame): play on
   * arrival, and loop at the end (the reader can turn looping off and on). Inside a `Root`,
   * `auto-advance` and `repeat` behaviors set them, and a Manifest's `auto-advance` moves
   * on when a non-looping animation ends (`onEnded`, as for video). Neither by default; a
   * reader asking for reduced motion is never autoplayed.
   */
  animation?: { autoplay?: boolean; loop?: boolean };
  /**
   * Credentials, headers and a custom `fetch` for every request the Canvas makes:
   * `info.json`, tiles, captions and HLS. A `<video>` or an image without CORS can only
   * send credentials. Inside a `Root`, the Root's `request` is used.
   */
  request?: CloverRequest;
}

/**
 * Imperative control over a mounted `Canvas`, handed to `onReady`. Coordinates are world
 * units — the pixels of the first image — so `getBounds()` is directly an `xywh=` region.
 */
export interface CanvasHandle {
  readonly backendKind: BackendKind;
  /**
   * Whether the view is at home, fitted whole: false once the reader zooms, pans or turns
   * it, true again on `home()`. A resize keeps it, refitting home. Read it on `viewport`.
   */
  readonly atHome: boolean;
  fitBounds(bounds: Rect, immediate?: boolean): void;
  /** Zoom to a rectangle in image `index`'s own coordinates, padded as `Image` pads. */
  fitItemRect(index: number, rect: Rect, immediate?: boolean): void;
  /** A rectangle in image `index`'s own coordinates, in world units. */
  itemRectToWorld(index: number, rect: Rect): Rect | null;
  getBounds(): Rect;
  getHomeBounds(): Rect | null;
  getCamera(): CameraState;
  home(immediate?: boolean): void;
  zoomBy(factor: number, at?: Point, animate?: boolean): void;
  panBy(dx: number, dy: number, animate?: boolean): void;
  /** Degrees, clockwise. */
  setRotation(degrees: number, immediate?: boolean): void;
  getRotation(): number;
  rotateBy(degrees: number): void;
  worldToScreenPoint(point: Point): Point;
  screenToWorldPoint(point: Point): Point;
  on(
    event: CanvasRendererEvent,
    listener: (detail?: unknown) => void,
  ): () => void;
  /**
   * Zoom to an annotation's hotspot, as picking it does, and focus it. False while there
   * is no hotspot for that id (not among `annotations`, or not yet placed).
   */
  zoomToAnnotation(id: string): boolean;
  /**
   * Frame a rectangle in one shown Canvas's own coordinates (an `xywh=` region of it).
   * False while that Canvas is not laid out yet.
   */
  fitCanvasRect(canvasId: string, rect: Rect, immediate?: boolean): boolean;
  /**
   * The visible part of whichever shown Canvas fills most of the view, in its own
   * coordinates: what a content state or a share link records. Null before layout.
   */
  getCanvasRegion(): { canvasId: string; rect: Rect } | null;
}

export interface CloverCanvasProps {
  /**
   * Presentation 4 Canvases (or Timelines) to draw: one, or several shown together (a
   * spread). Each one's painting annotations are composed at their targets. Upgrade
   * Presentation 2 or 3 with `toPresentation4()` first. Inside a `Root`, leave this (and
   * `body` and `src`) out and the Canvas shows the Root's current view.
   */
  canvases?: IIIFCanvas[];
  /**
   * A Canvas to load and draw, on its own, outside any `Root`: a URL or an object, in any
   * Presentation version (upgraded as it loads), fetched with `options.request`. A
   * Manifest gives its first Canvas. Nothing is drawn until it arrives, or if it will
   * not load. Takes precedence over the Root's view, as `canvases` does.
   */
  iiifContent?: string | Record<string, unknown>;
  /** How to lay out several Canvases: in reading order along this direction. */
  viewingDirection?: ViewingDirection;
  /** IIIF painting bodies (Image resources). Takes precedence over `src`. */
  body?: LabeledIIIFExternalWebResource | LabeledIIIFExternalWebResource[];
  /** Plain image URLs — or, with `isTiledImage`, image service URIs. */
  src?: string | string[];
  /** Treat each `src` as a IIIF Image API service (its base URI or `info.json`). */
  isTiledImage?: boolean;
  /** Accessible name for the viewport. */
  label?: InternationalString | string;
  /**
   * What the view is part of, named under its title where a lone recording plays as a
   * player: the Manifest's label, by default, inside a `Root` or given `iiifContent`.
   */
  partOf?: InternationalString | string;
  /**
   * The language to read IIIF text in: labels, Choices, annotations. The reader's, by
   * default; inside a `Root`, the Root's.
   */
  language?: string;
  /** Stable id for this instance. A new id remounts the renderer. */
  instanceId?: string;
  className?: string;
  options?: CloverCanvasOptions;
  /**
   * Show an overview of the whole image with the visible region outlined; press or drag
   * in it to move there. Off by default; never shown for a Canvas of video or sound.
   */
  navigator?: boolean;
  /**
   * Show the control cluster (`true`, the default), none (`false`), or some. Without the
   * zoom and reset controls, one pointer can still zoom back out: at the largest zoom, a
   * click or a double tap goes home. With the click zooms off as well (`gestures`), a
   * pinch is the only zoom left on touch, so give the reader one of your own, through
   * the handle `onReady` passes (`home()`, `zoomBy(0.5)`) (WCAG 2.5.1).
   */
  controls?: boolean | CanvasControlsConfig;
  /** Replace any control with your own component — the `Viewer`'s `controlButtons`. */
  controlButtons?: ControlButtons;
  /**
   * Annotations to draw as hotspots, as `Image` takes them. Only rectangular (`xywh`)
   * targets are drawn; coordinates are the target image's own.
   */
  annotations?: CanvasAnnotation[];
  /**
   * The Manifest's `navPlace`, a GeoJSON FeatureCollection: where it is, which the map
   * control shows where the Canvases shown have none of their own.
   */
  navPlace?: unknown;
  /**
   * The AnnotationPages (each annotation's `pageId`) whose annotations are hidden: none
   * of them is drawn, but the annotations menu still lists them under their page, with
   * its hide toggle, to show them again. Leave it out for the Canvas to keep its own.
   */
  hiddenPages?: string[];
  /**
   * AnnotationPages drawn (while not hidden) but never offered in the annotations menu,
   * as the Annotations list leaves them out: a search's hits, which Search lists, and a
   * still Canvas's OCR, which a search finds in. Leave it out for the Canvas to keep its
   * own OCR out.
   */
  unlistedPages?: string[];
  /** The reader hid AnnotationPages from the picture (`visible` false), or showed them. */
  onPageVisibilityChange?: (pageIds: string[], visible: boolean) => void;
  /** The hovered or focused annotation's id, or null when none is. */
  onAnnotationActive?: (id: string | null) => void;
  /**
   * The picked annotation, controlled. A new id is framed once its hotspot is placed;
   * `null` clears the pick. Leave it out for the Canvas to keep its own.
   */
  selectedAnnotation?: string | null;
  /**
   * Glide to a picked annotation, as the camera eases to anywhere else, rather than
   * framing it at once. Default `false`: an annotation picked on the Canvas, in a list
   * beside it or by a link is framed in one cut, once its view is drawn. A reader who
   * asks for reduced motion gets the cut either way.
   */
  animateAnnotations?: boolean;
  /** An annotation to highlight, as hovering it in a list beside the Canvas does. */
  highlightedAnnotation?: string | null;
  /**
   * A hotspot (or the annotations menu) picked an annotation; `null` when the reader let
   * it go, by a click or tap off it on the Canvas, or Escape.
   */
  onAnnotationSelect?: (id: string | null) => void;
  /**
   * A linking annotation's hotspot pressed (Cookbook 0022), leading to a Canvas or a
   * Manifest: show it. Inside a `Root`, or loading its own (`iiifContent`), the Canvas
   * shows it itself unless you take this; otherwise, without it, the hotspot is picked as
   * any other. A link to a web page is a link, and opens the page in a new tab.
   */
  onAnnotationLink?: (link: AnnotationLink) => void;
  /** Called once, when the first images are laid out and fitted. */
  onReady?: (handle: CanvasHandle) => void;
  /**
   * The id of the Manifest these Canvases are from. When it changes (another of a
   * Collection's members, say) the Canvas is cleared at once, so the last Manifest's
   * images never show beside the next one's while those load. Within one Manifest,
   * moving from Canvas to Canvas keeps the last one drawn until the next is ready, so a
   * page turn never flashes empty.
   */
  manifestId?: string;
  /** The visible world rectangle, at most once per frame while the camera moves. */
  onViewportChange?: (bounds: Rect) => void;
  /**
   * A time-based Canvas's media element once it exists, and `null` when it goes: for a
   * host's own transcript, chapters or `#t=` seeks. Sound plays through a `<video>` too.
   */
  onMediaElement?: (element: HTMLVideoElement | null) => void;
  /**
   * The reader chose a caption track in the Canvas's own Captions menu: the Manifest's
   * caption file (its `id`, the WebVTT's address, and the `language` of its cues), or
   * `null` for Off or a track the media carries itself. For a host's own transcript to
   * follow, as Clover's `Transcript` does.
   */
  onCaptionChange?: (caption: { id: string; language?: string } | null) => void;
  /**
   * Which of the Manifest's caption files to show while captions are on, by its `id`:
   * for a host's own transcript to lead the captions' language as well as follow it
   * (`onCaptionChange`). It changes the track shown, never whether one shows: Off stays
   * off. Inside a `Root` the Canvas takes it from the Root, which Clover's `Transcript`
   * sets.
   */
  caption?: string | null;
  /** Playback reached the end — a host's cue to move to the next Canvas. */
  onEnded?: () => void;
  /**
   * Chapters of the Canvas's video or sound: marked on the seek bar, listed in a menu, and
   * named beside the time. Inside a `Root`, they come from the Manifest's Ranges. `lang`
   * is the language a label is written in, set on it where it shows.
   */
  chapters?: Array<{
    /** Its own id (a Range's), by which `highlightedChapter` names it. */
    id?: string;
    label: string;
    lang?: string;
    start: number;
    end?: number;
    /**
     * A picture of it, over it on the seek bar and under it in the menu while it plays:
     * a URL, shown as it is, or a IIIF image (a Range's `thumbnail`), asked of its
     * service as its `info.json` allows. Inside a `Root`, its Range's `thumbnail`.
     */
    thumbnail?: string | Record<string, unknown>;
  }>;
  /** A chapter (by its `id`) to mark on the seek bar, as hovering it in a list does. */
  highlightedChapter?: string | null;
  /** The chapter under the pointer on the seek bar (its `id`), or null as it leaves. */
  onChapterHighlight?: (id: string | null) => void;
  /**
   * Show a Canvas's `placeholderContainer` first (the default). `false` opens the Canvas
   * straight away, as a host does when a link or content state points into it.
   */
  placeholder?: boolean;
  /** Rendered after the controls in the cluster: a host's own controls. */
  children?: ReactNode;
}
