import type { ElementDocs, ElementSpec } from "../spec";

/** `<clover-root>`: a `Root` whose element is the page's own. */
export const root: ElementSpec = {
  tag: "clover-root",
  kind: "root",
  attributes: {
    "iiif-content": { prop: "iiifContent", type: "string" },
    "canvas-id": { prop: "canvasId", type: "string" },
    "manifest-id": { prop: "manifestId", type: "string" },
    language: { prop: "language", type: "string" },
    "search-query": { prop: "searchQuery", type: "string" },
    annotations: { prop: "annotations", type: "data" },
    "annotation-pages": { prop: "annotationPages", type: ["view", "all"] },
    lang: { prop: "lang", type: "string" },
  },
  properties: ["iiifContent", "annotations", "request", "renderers"],
  events: {
    "clover-ready": { prop: "onReady", detail: ["clover"], keeps: "clover" },
    "clover-canvas-change": { prop: "onCanvasChange", detail: ["canvasId"] },
    "clover-manifest-change": {
      prop: "onManifestChange",
      detail: ["manifestId"],
    },
    "clover-status-change": {
      prop: "onStatusChange",
      detail: ["status", "error"],
    },
    "clover-content-state-change": {
      prop: "onContentStateChange",
      detail: "first",
    },
  },
};

export const rootDocs: ElementDocs = {
  name: "CloverRootElement",
  description:
    "The root of a layout of your own: it loads what it is given, holds where the reader is, and gives every part inside it the same state. The page's markup inside it stays as written.",
  attributes: {
    "iiif-content": {
      description:
        "What to show: a URL to a Manifest, Collection or Canvas, or a content state.",
    },
    "canvas-id": {
      description:
        "The Canvas to open on. Changed later, it moves the reader there.",
    },
    "manifest-id": {
      description:
        "In a Collection, the Manifest to open first. Changed later, it moves the reader there.",
    },
    language: {
      description:
        "The language to read IIIF text in. The page's, then the reader's, by default.",
    },
    "search-query": {
      description:
        "A Content Search to run once the Manifest shows, and whenever it changes.",
    },
    annotations: {
      description:
        "Annotations to show beside the Manifest's own: a URL, or JSON (a list of URLs, or an AnnotationPage).",
    },
    "annotation-pages": {
      description:
        "Whose referenced annotation pages to fetch: the view's as the reader moves, or every Canvas's at once.",
      default: "view",
    },
    lang: {
      description:
        "The language of what is inside, as anywhere in HTML. Clover marks its own words where they differ.",
    },
  },
  properties: {
    clover: {
      type: "CloverRootApi | null",
      readonly: true,
      description:
        "Its Clover, for a part of your own, once it has loaded (clover-ready): what React's hooks read, as methods of the same name (navigation(), visibleCanvases()…), its state and subscribe, its actions and channels, and its language. Null before.",
    },
    renderers: {
      type: "CloverRenderer[] | null",
      description:
        "Renderers of yours, for every clover-body in it: each claims views (canvasId, format or match) and draws one into a box of its own (render), returning what undoes it.",
    },
    iiifContent: {
      type: "string | Record<string, unknown> | null",
      description:
        "What to show, as the attribute takes it, or a IIIF resource as an object.",
    },
    annotations: {
      type: "string | Record<string, unknown> | Array<string | Record<string, unknown>> | null",
      description:
        "Annotations to show beside the Manifest's own, as URLs or objects.",
    },
    request: {
      type: "{ credentials?: RequestCredentials; headers?: Record<string, string>; fetch?: typeof fetch } | null",
      description:
        "Credentials, headers and a fetch of your own, for every request.",
    },
  },
  events: {
    "clover-ready": {
      detail: "{ clover: CloverRootApi }",
      description:
        "It has loaded what it was given: its Clover is there (clover), for a part of your own.",
    },
    "clover-canvas-change": {
      detail: "{ canvasId: string }",
      description: "The reader moved to a Canvas.",
    },
    "clover-manifest-change": {
      detail: "{ manifestId: string }",
      description: "In a Collection, the reader moved to another Manifest.",
    },
    "clover-status-change": {
      detail: '{ status: "loading" | "ready" | "error"; error: Error | null }',
      description: "What it was given is loading, has loaded, or failed to.",
    },
    "clover-content-state-change": {
      detail: "{ json: Record<string, unknown>; encoded: string }",
      description:
        "Where the reader is, as a IIIF content state, each time it settles.",
    },
  },
};
