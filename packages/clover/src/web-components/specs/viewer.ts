import type { ElementDocs, ElementSpec } from "../spec";

/** `<clover-viewer>`: the Viewer, in one of its templates, Default unless it names another. */
export const viewer: ElementSpec = {
  tag: "clover-viewer",
  kind: "alone",
  attributes: {
    template: { prop: "template", type: ["default", "document", "gallery"] },
    "iiif-content": { prop: "iiifContent", type: "string" },
    "canvas-id": { prop: "defaultCanvasId", type: "string" },
    // Where it opens, not held there: a reader moves on through the Collection.
    "manifest-id": { prop: "defaultManifestId", type: "string" },
    language: { prop: "language", type: "string" },
    "search-query": { prop: "searchQuery", type: "string" },
    annotations: { prop: "annotations", type: "data" },
    // Past 6 the titles name what they head instead (`ui/heading.ts`).
    "heading-level": { prop: "headingLevel", type: "number", min: 2 },
    items: { prop: "items", type: ["slider", "list", "grid", "false"] },
    header: { prop: "header", type: "boolean" },
    panel: { prop: "panel", type: "boolean" },
    download: { prop: "download", type: "boolean" },
    // The templates' own (`templates/`): each one's, where it has it.
    "panel-open": { prop: "defaultPanelOpen", type: "boolean" },
    "panel-layout": { prop: "panelLayout", type: ["accordion", "tabs"] },
    "sidebar-open": { prop: "defaultSidebarOpen", type: "boolean" },
    "storage-key": { prop: "storageKey", type: "string" },
    fill: { prop: "fill", type: "boolean" },
    size: { prop: "size", type: "string" },
  },
  properties: ["iiifContent", "annotations", "request", "renderers"],
  events: {
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

export const viewerDocs: ElementDocs = {
  name: "CloverViewerElement",
  description:
    "Clover's Viewer, in one of its templates: Default (the title over the Body, the thumbnails under it, the information panel beside them), Document (a PDF reader's pages, thumbnails beside them) or Gallery (a grid, each item opening in a lightbox). Each template loads when used, its styles with it.",
  attributes: {
    template: {
      description:
        "The layout: default, document or gallery. Default's comes with the element; another loads the first time one is shown.",
      default: "default",
    },
    "iiif-content": {
      description: "What to show: a URL, or a content state.",
    },
    "canvas-id": { description: "The Canvas to open on." },
    "manifest-id": {
      description:
        "In a Collection, the Manifest to open first. The reader moves on from it.",
    },
    language: { description: "The language to read IIIF text in." },
    "search-query": {
      description: "A Content Search to run as the Manifest opens.",
    },
    annotations: {
      description:
        "Annotations to show beside the Manifest's own: a URL, or JSON (a list of URLs, or an AnnotationPage).",
    },
    "heading-level": {
      description:
        "The title's level, 2 or more, to fit the page's outline. The panel's sections are a level below.",
      default: "2",
    },
    items: {
      description:
        'Default: the thumbnails, as a slider, list or grid, or "false" for none.',
      default: "slider",
    },
    header: {
      description:
        'Default: "false" leaves out the thumbnail and title over the Body.',
      default: "true",
    },
    panel: {
      description: 'Default: "false" leaves out the information panel.',
      default: "true",
    },
    download: {
      description:
        'Default and Document: "false" leaves the downloads out of the panel\'s About.',
      default: "true",
    },
    "panel-open": {
      description:
        "Default and Document: whether the information panel starts open. Default's opens where it has room; Document's starts shut.",
    },
    "panel-layout": {
      description:
        "Default and Document: the panel's sections as stacked boxes, each opened by its heading, or as tabs.",
      default: "accordion",
    },
    "sidebar-open": {
      description:
        "Document: whether the page thumbnails start shown. Shown on a wide screen, by default.",
    },
    "storage-key": {
      description:
        'Default and Document: where the width the reader gives a pane is remembered (localStorage); "false" forgets it.',
    },
    fill: {
      description:
        "Default: as tall as the box it is in, the Body taking what the header and the thumbnails leave.",
      default: "false",
    },
    size: {
      description: "Gallery: the size of a cell in the grid.",
      default: "10rem",
    },
  },
  properties: {
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
    renderers: {
      type: "CloverRenderer[] | null",
      description:
        "Renderers of yours, for its Body: each claims views (canvasId, format or match) and draws one into a box of its own (render), returning what undoes it.",
    },
    iiifContent: {
      type: "string | Record<string, unknown> | null",
      description:
        "What to show, as the attribute takes it, or a IIIF resource as an object.",
    },
  },
  events: {
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
