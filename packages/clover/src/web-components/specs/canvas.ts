import type { ElementDocs, ElementSpec, MethodDocs } from "../spec";

/**
 * The stage's own: the Canvas's handle (`CanvasHandle`, what `onReady` hands a React host),
 * kept as `handle` and sent with `clover-ready` once its view is laid out.
 */
export const READY = {
  "clover-ready": { prop: "onReady", detail: ["handle"], keeps: "handle" },
} as const;

/**
 * `<clover-canvas>`: Clover's renderer for images, video and sound. Alone, it draws what
 * it is given (`iiif-content`, `src`, or Canvases as a property); inside a
 * `<clover-root>`, given nothing, the root's view, as `Canvas` does.
 */
export const canvas: ElementSpec = {
  tag: "clover-canvas",
  kind: "part",
  attributes: {
    "iiif-content": { prop: "iiifContent", type: "string" },
    src: { prop: "src", type: "string" },
    tiled: { prop: "isTiledImage", type: "boolean" },
    label: { prop: "label", type: "string" },
    language: { prop: "language", type: "string" },
    controls: { prop: "controls", type: "boolean" },
    navigator: { prop: "navigator", type: "boolean" },
    placeholder: { prop: "placeholder", type: "boolean" },
    "viewing-direction": {
      prop: "viewingDirection",
      type: [
        "left-to-right",
        "right-to-left",
        "top-to-bottom",
        "bottom-to-top",
      ],
    },
    "animate-annotations": { prop: "animateAnnotations", type: "boolean" },
  },
  properties: [
    "iiifContent",
    "canvases",
    "src",
    "annotations",
    "options",
    "controlButtons",
    "controls",
  ],
  events: {
    ...READY,
    "clover-annotation-select": { prop: "onAnnotationSelect", detail: ["id"] },
    "clover-annotation-active": { prop: "onAnnotationActive", detail: ["id"] },
    "clover-caption-change": { prop: "onCaptionChange", detail: ["caption"] },
    "clover-ended": { prop: "onEnded", detail: [] },
  },
};

const RECT = "CloverRect";
const POINT = "CloverPoint";
const LATER = ["immediate?", "boolean"] as const;

/** The handle's methods, as the types declare `CloverCanvasHandle`. Never loaded by a page. */
export const handleMethodDocs: MethodDocs = {
  home: {
    parameters: [LATER],
    returns: "void",
    description: "Fit the whole view again, as Reset does.",
  },
  zoomBy: {
    parameters: [
      ["factor", "number"],
      ["at?", POINT],
      ["animate?", "boolean"],
    ],
    returns: "void",
    description:
      "Zoom by a factor (2 in, 0.5 out), about a point on the screen if given.",
  },
  panBy: {
    parameters: [
      ["dx", "number"],
      ["dy", "number"],
      ["animate?", "boolean"],
    ],
    returns: "void",
    description: "Move the view, in screen pixels.",
  },
  rotateBy: {
    parameters: [["degrees", "number"]],
    returns: "void",
    description: "Turn the view by an angle, clockwise.",
  },
  setRotation: {
    parameters: [["degrees", "number"], LATER],
    returns: "void",
    description: "Turn the view to an angle, clockwise.",
  },
  getRotation: {
    parameters: [],
    returns: "number",
    description: "The view's angle, in degrees clockwise.",
  },
  fitBounds: {
    parameters: [["bounds", RECT], LATER],
    returns: "void",
    description: "Frame a rectangle, in world units.",
  },
  fitItemRect: {
    parameters: [["index", "number"], ["rect", RECT], LATER],
    returns: "void",
    description:
      "Frame a rectangle in one image's own coordinates, by its place among those shown.",
  },
  fitCanvasRect: {
    parameters: [["canvasId", "string"], ["rect", RECT], LATER],
    returns: "boolean",
    description:
      "Frame a region of a Canvas shown, in its own coordinates (an xywh): false before it is laid out.",
  },
  zoomToAnnotation: {
    parameters: [["id", "string"]],
    returns: "boolean",
    description:
      "Frame an annotation's hotspot and focus it, as picking it does: false while it has none.",
  },
  getBounds: {
    parameters: [],
    returns: RECT,
    description: "The visible rectangle, in world units.",
  },
  getHomeBounds: {
    parameters: [],
    returns: `${RECT} | null`,
    description: "What home fits: the whole view, in world units.",
  },
  getCamera: {
    parameters: [],
    returns: "CloverCamera",
    description: "The camera: where it looks, its zoom and its turn.",
  },
  getCanvasRegion: {
    parameters: [],
    returns: `{ canvasId: string; rect: ${RECT} } | null`,
    description:
      "The visible part of the Canvas filling most of the view, in its own coordinates: what a share link records.",
  },
  itemRectToWorld: {
    parameters: [
      ["index", "number"],
      ["rect", RECT],
    ],
    returns: `${RECT} | null`,
    description: "A rectangle in one image's own coordinates, in world units.",
  },
  worldToScreenPoint: {
    parameters: [["point", POINT]],
    returns: POINT,
    description: "A point in world units, on the screen.",
  },
  screenToWorldPoint: {
    parameters: [["point", POINT]],
    returns: POINT,
    description: "A point on the screen, in world units.",
  },
  on: {
    parameters: [
      ["event", '"open" | "viewport" | "change" | "error" | "backend" | "tap"'],
      ["listener", "(detail?: unknown) => void"],
    ],
    returns: "() => void",
    description:
      "Hear the renderer (viewport: the camera moved; change: new images); returns the way to stop.",
  },
};

/** The handle, as a property, and the event that brings it. */
export const handleDocs = {
  property: {
    type: "CloverCanvasHandle | null",
    readonly: true,
    description:
      "The Canvas's handle once its view is laid out (clover-ready), as onReady hands it in React: the camera and its coordinates (handle.zoomBy(2), handle.home()). Null before.",
  },
  event: {
    detail: "{ handle: CloverCanvasHandle }",
    description:
      "The view is laid out and fitted: its handle is here, and works from now on.",
  },
  controls: {
    type: "boolean | { zoom?: boolean; fullPage?: boolean; rotation?: boolean; reset?: boolean; annotations?: boolean; information?: boolean; [option: string]: unknown } | null",
    description:
      "Which of the stage's controls it shows, as Canvas's controls takes it: false for none, or some ({ rotation: false }), in place of the attribute.",
  },
  controlButtons: {
    type: "CloverControlButtons | null",
    description:
      "The stage's controls, each replaced by a button you make: a function given the control's name, label and Clover's icon, returning the button. Clover keeps it named, keyed and in its state, presses the control with it, and adds its popover.",
  },
};

export const canvasDocs: ElementDocs = {
  name: "CloverCanvasElement",
  description:
    "Clover's renderer for images, video and sound. Alone, it draws what it is given: a IIIF resource by URL (a Manifest gives its first Canvas), image URLs, or Canvases as a property. Inside a clover-root, given nothing, the root's view. As tall as --clover-body-height (60vh) or its own style.",
  attributes: {
    "iiif-content": {
      description:
        "A Canvas, a Manifest (its first Canvas) or a content state, by URL, in any Presentation version.",
    },
    src: {
      description:
        "An image's URL; with tiled, a IIIF Image API service's (its base URI or info.json).",
    },
    tiled: {
      description: "Read src as a IIIF Image API service.",
      default: "false",
    },
    label: {
      description:
        "The viewport's name, for an image given by src. A Canvas names it by its own label.",
    },
    language: { description: "The language to read IIIF text in." },
    controls: {
      description: '"false" leaves out the controls over the stage.',
      default: "true",
    },
    navigator: {
      description: "A small map of the whole image, while zoomed in.",
      default: "false",
    },
    placeholder: {
      description:
        '"false" opens a Canvas straight away, past its placeholderContainer.',
      default: "true",
    },
    "viewing-direction": {
      description:
        "How several Canvases (a spread) are laid out, in reading order.",
      default: "left-to-right",
    },
    "animate-annotations": {
      description:
        "Glide to a picked annotation, rather than frame it in one cut. A reader who asks for reduced motion gets the cut.",
      default: "false",
    },
  },
  properties: {
    handle: handleDocs.property,
    controlButtons: handleDocs.controlButtons,
    controls: handleDocs.controls,
    iiifContent: {
      type: "string | Record<string, unknown> | null",
      description: "What to load and draw, as a URL or a IIIF resource.",
    },
    canvases: {
      type: "Record<string, unknown>[] | null",
      description:
        "Presentation 4 Canvases to draw, one or several shown together (a spread).",
    },
    src: {
      type: "string | string[] | null",
      description: "Image URLs, or image services with tiled.",
    },
    annotations: {
      type: "Array<{ id: string; target: string; label?: string; [key: string]: unknown }> | null",
      description:
        "Annotations to draw as hotspots, with rectangular (xywh) targets in the image's own coordinates.",
    },
    options: {
      type: "{ request?: { credentials?: RequestCredentials; headers?: Record<string, string>; fetch?: typeof fetch }; [key: string]: unknown } | null",
      description:
        "The Canvas's options: the request it loads with (credentials, headers, a fetch of your own), its gestures and more.",
    },
  },
  events: {
    "clover-ready": handleDocs.event,
    "clover-annotation-select": {
      detail: "{ id: string | null }",
      description:
        "The reader picked an annotation, on the stage or in its menu; null when they let it go.",
    },
    "clover-annotation-active": {
      detail: "{ id: string | null }",
      description: "An annotation is hovered or focused; null when none is.",
    },
    "clover-caption-change": {
      detail: "{ caption: { id: string; language?: string } | null }",
      description:
        "The reader chose a caption file in the Captions menu, or Off (null).",
    },
    "clover-ended": {
      detail: "Record<string, never>",
      description: "A recording played to its end.",
    },
  },
};
