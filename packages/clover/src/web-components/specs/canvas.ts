import type { ElementDocs, ElementSpec } from "../spec";

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
  properties: ["iiifContent", "canvases", "src", "annotations", "options"],
  events: {
    "clover-annotation-select": { prop: "onAnnotationSelect", detail: ["id"] },
    "clover-annotation-active": { prop: "onAnnotationActive", detail: ["id"] },
    "clover-caption-change": { prop: "onCaptionChange", detail: ["caption"] },
    "clover-ended": { prop: "onEnded", detail: [] },
  },
};

export const canvasDocs: ElementDocs = {
  name: "CloverCanvasElement",
  description:
    "Clover's renderer for images, video and sound. Alone, it draws what it is given: a IIIF resource by URL (a Manifest gives its first Canvas), image URLs, or Canvases as a property. Inside a clover-root, given nothing, the root's view. As tall as --clover-content-height (60vh) or its own style.",
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
