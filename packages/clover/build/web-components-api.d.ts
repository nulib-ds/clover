/*
 * The types the elements' API is written in, for a page without React: `root.clover`, a
 * renderer of the page's, its control buttons, and the geometry a Canvas's handle uses.
 * `build/custom-elements.mjs` puts them at the head of `index.d.mts`, beside the handle it
 * writes from the methods' docs. Structural, and in no way React's: a page of elements
 * needs no React types. Keep them in step with what they describe (`src/core/clover.ts`,
 * `src/web-components/elements/api.ts`, `renderers.tsx`, `controls.tsx`).
 */

export interface CloverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CloverPoint {
  x: number;
  y: number;
}

/** Where the camera looks, its zoom and its turn (degrees, clockwise). */
export interface CloverCamera {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

/** A IIIF resource as Clover holds it: Presentation 4, upgraded as it loaded. */
export type CloverResource = Record<string, unknown> & {
  id: string;
  type: string;
};

export type CloverStatus = "idle" | "loading" | "ready" | "error";

/** What every part draws from (`CloverState` in React). */
export interface CloverState {
  status: CloverStatus;
  error: Error | null;
  /** The Manifest shown. */
  manifest: CloverResource | null;
  /** The Collection it was reached through, if any. */
  collection: CloverResource | null;
  /** The Canvas the reader is on: the first of the view that shows it. */
  canvasId: string | null;
  /** The annotation picked, from a list or its hotspot. */
  annotationId: string | null;
  /** Annotation sets switched off. */
  hiddenSets: string[];
  /**
   * Sets beside the Manifest's own pages: its images' own, the host's (`annotations`),
   * and a content state's note.
   */
  addedSets: CloverAnnotationSet[];
  /** The regions the Manifest's Ranges name, drawn as annotations ("contents"). */
  regions: CloverAnnotationSet | null;
  search: {
    query: string;
    status: CloverStatus;
    hits: Array<{
      id: string;
      canvasId: string;
      match: string;
      before?: string;
      after?: string;
    }>;
  };
}

/** The Canvases Clover can show, in order, grouped into views (each a list of indexes). */
export interface CloverSequence {
  canvases: CloverResource[];
  views: number[][];
  direction:
    | "left-to-right"
    | "right-to-left"
    | "top-to-bottom"
    | "bottom-to-top";
}

/** Moving between views (`useNavigation()`): a spread moves two pages at a time. */
export interface CloverNavigation {
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

export interface CloverAnnotationSet {
  id: string;
  label?: CloverLanguageMap;
  source: "manifest" | "added" | "search" | "contents";
  entries: Array<{
    id: string;
    setId: string;
    canvasId: string;
    motivation: string[];
    /**
     * The annotation as published; an image's own (Cookbook 0326) with its `target`
     * restated on the Canvas.
     */
    annotation: Record<string, unknown>;
    /** An annotation of one image of a `Choice`: drawn while that image is chosen. */
    layer?: { key: string; item: number; image: string };
  }>;
}

/** An entry of the Manifest's table of contents: a Range, as `Contents` draws it. */
export interface CloverContentsEntry {
  id: string;
  label?: CloverLanguageMap;
  /** The first Canvas the Range (or its first descendant) names; none for an empty Range. */
  canvasId?: string;
  /** Every Canvas the Range covers, its own and its descendants'. */
  canvasIds: string[];
  /** The span on that Canvas, for time-based media. */
  time?: { start: number; end?: number };
  /** The region on that Canvas, when the Range names one. */
  region?: { x: number; y: number; w: number; h: number };
  /**
   * Its own Canvases and their regions, in the order the Range reads them, where a
   * region is among them or its pages are out of the Manifest's order (an article's
   * columns, page 2 then page 5); none otherwise.
   */
  parts?: Array<{
    canvasId: string;
    region?: { x: number; y: number; w: number; h: number };
  }>;
  /** A Range of `behavior` `sequence`: an order of its own Canvases, the first the default. */
  sequence?: true;
  /** Its Range's `thumbnail`, the first it gives, as the Manifest writes it. */
  thumbnail?: Record<string, unknown>;
  children: CloverContentsEntry[];
}

/** A IIIF language map, or a plain string. */
export type CloverLanguageMap =
  | string
  | Record<string, string[] | string | undefined>
  | null
  | undefined;

/** A value that changes too often for the state: the viewport, the media element… */
export interface CloverChannel<Value> {
  get(): Value;
  emit(value: Value): void;
  subscribe(listener: (value: Value) => void): () => void;
}

/**
 * `root.clover`: a root's Clover, for a part of your own. What React's hooks read, each a
 * method of the same name (`useNavigation()` is `navigation()`), the state and a way to
 * hear of it, the root's language, and the Clover `useClover()` hands a React part: its
 * store, its actions and its channels.
 */
export interface CloverRootApi {
  /** The state, now. */
  readonly state: CloverState;
  /** Hear of every change of the state; returns the way to stop. */
  subscribe(listener: (state: CloverState) => void): () => void;
  /** The language the root reads IIIF text in, where it is given one. */
  readonly language: string | undefined;
  status(): { status: CloverStatus; error: Error | null };
  manifest(): CloverResource | null;
  sequence(): CloverSequence;
  visibleCanvases(): CloverResource[];
  activeCanvas(): CloverResource | null;
  navigation(): CloverNavigation;
  annotationSets(): CloverAnnotationSet[];
  /** The Manifest's table of contents, as `Contents` draws it; none before it loads. */
  contents(): CloverContentsEntry[];
  /** A language map as text in the root's language, with the tag it is in. */
  localize(value: CloverLanguageMap): { text: string; lang?: string };
  /** One of Clover's own strings, in its language now: `t("commonClose")`. */
  t(key: string, values?: Record<string, unknown>): string;
  /** That string's language where it is not the page's, for the `lang` of what shows it. */
  langOf(key: string): string | undefined;
  /**
   * A popup of yours joined to Clover's, which open one at a time (`useOneOpen`): call it as
   * yours opens, with the way to close it; call what it returns as yours closes.
   */
  oneOpen(close: () => void): () => void;
  readonly store: {
    get(): CloverState;
    set(patch: Partial<CloverState>): void;
    subscribe(listener: () => void): () => void;
  };
  goTo(
    canvasId: string,
    target?: {
      region?: { x: number; y: number; w: number; h: number };
      time?: number;
    },
  ): void;
  goToManifest(id: string, canvasId?: string): Promise<void>;
  openCollection(id: string): Promise<void>;
  next(options?: { autoplay?: boolean; wrap?: boolean }): void;
  previous(): void;
  first(): void;
  last(): void;
  selectAnnotation(id: string | null): void;
  search(query: string): Promise<void>;
  setSetVisible(setId: string, visible: boolean): void;
  loadAnnotations(input: unknown): Promise<void>;
  /** Where the reader is, as a content state. */
  getContentState(): { json: Record<string, unknown>; encoded: string } | null;
  readonly viewport: CloverChannel<{
    canvasId: string;
    region: { x: number; y: number; w: number; h: number };
  } | null>;
  readonly media: CloverChannel<HTMLVideoElement | null>;
  readonly captions: CloverChannel<string | null>;
  readonly highlight: CloverChannel<string | null>;
  readonly chapter: CloverChannel<string | null>;
  /** The annotation asked to be found, each time it is asked for, the selected one again among them. */
  readonly found: CloverChannel<string | null>;
}

/**
 * A renderer of yours, without React: the views it claims, and `render`, which draws one
 * into a box filling the Body and returns what undoes it.
 */
export interface CloverRenderer {
  /** Views showing one of these Canvases… */
  canvasId?: string[];
  /** …or painting a body of one of these formats (`model/gltf-binary`)… */
  format?: string[];
  /** …or any view this says yes to. */
  match?: (view: {
    canvases: CloverResource[];
    bodies: Array<Record<string, unknown>>;
  }) => boolean;
  render(
    container: HTMLElement,
    view: {
      canvases: CloverResource[];
      bodies: Array<Record<string, unknown>>;
      clover: CloverRootApi | null;
    },
  ): void | (() => void);
}

/** What the function for one of the Body's controls is told. */
export interface CloverControl {
  name: keyof CloverControlButtons;
  /** Its name, as its `aria-label` says it. */
  label: string;
  /** Clover's icon for it, to put in your button, kept current. */
  icon: HTMLElement;
}

/** The Body's controls, each replaced by a button you make. */
export interface CloverControlButtons {
  zoomIn?: (control: CloverControl) => Element;
  zoomOut?: (control: CloverControl) => Element;
  fullPage?: (control: CloverControl) => Element;
  rotateRight?: (control: CloverControl) => Element;
  rotateLeft?: (control: CloverControl) => Element;
  reset?: (control: CloverControl) => Element;
  choice?: (control: CloverControl) => Element;
}
