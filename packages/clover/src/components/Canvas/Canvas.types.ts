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
}

export interface CloverCanvasOptions {
  /** Which painter to use. `auto` (default) tries WebGL2, then Canvas2D. */
  backend?: BackendPreference;
  /** Pointer, wheel and keyboard behaviour. Wheel zoom is off by default. */
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
  media?: {
    /**
     * How video reaches the screen. `dom` (the default) places a real `<video>` with the
     * camera's transform, so the browser composites it and PiP, AirPlay and HDR keep
     * working. `texture` draws each frame into the canvas with the images, which needs CORS
     * on the media.
     */
    presentation?: "dom" | "texture";
  };
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
  /** The hovered or focused annotation's id, or null when none is. */
  onAnnotationActive?: (id: string | null) => void;
  /**
   * The picked annotation, controlled. A new id is framed once its hotspot is placed;
   * `null` clears the pick. Leave it out for the Canvas to keep its own.
   */
  selectedAnnotation?: string | null;
  /** An annotation to highlight, as hovering it in a list beside the Canvas does. */
  highlightedAnnotation?: string | null;
  /** A hotspot (or the annotations menu) picked an annotation. */
  onAnnotationSelect?: (id: string) => void;
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
  /** Playback reached the end — a host's cue to move to the next Canvas. */
  onEnded?: () => void;
  /**
   * Chapters of the Canvas's video or sound: marked on the seek bar, listed in a menu, and
   * named beside the time. Inside a `Root`, they come from the Manifest's Ranges. `lang`
   * is the language a label is written in, set on it where it shows.
   */
  chapters?: Array<{
    label: string;
    lang?: string;
    start: number;
    end?: number;
  }>;
  /**
   * Show a Canvas's `placeholderContainer` first (the default). `false` opens the Canvas
   * straight away, as a host does when a link or content state points into it.
   */
  placeholder?: boolean;
  /** Rendered after the controls in the cluster: a host's own controls. */
  children?: ReactNode;
}
