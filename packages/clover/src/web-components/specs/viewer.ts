import type { ElementDocs, ElementSpec } from "../spec";

/** `<clover-viewer>`: the Viewer, in its Default template. */
export const viewer: ElementSpec = {
  tag: "clover-viewer",
  kind: "alone",
  attributes: {
    "iiif-content": { prop: "iiifContent", type: "string" },
    "canvas-id": { prop: "defaultCanvasId", type: "string" },
    // Where it opens, not held there: a reader moves on through the Collection.
    "manifest-id": { prop: "defaultManifestId", type: "string" },
    language: { prop: "language", type: "string" },
    "search-query": { prop: "searchQuery", type: "string" },
    // Past 6 the titles name what they head instead (`ui/heading.ts`).
    "heading-level": { prop: "headingLevel", type: "number", min: 2 },
    items: { prop: "items", type: ["carousel", "list", "grid", "false"] },
    header: { prop: "header", type: "boolean" },
    panel: { prop: "panel", type: "boolean" },
    download: { prop: "download", type: "boolean" },
  },
  properties: ["iiifContent"],
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
    "Clover's Viewer in its Default template: the title over the stage, the thumbnails under it, and the information panel beside them.",
  attributes: {
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
    "heading-level": {
      description:
        "The title's level, 2 or more, to fit the page's outline. The panel's sections are a level below.",
      default: "2",
    },
    items: {
      description:
        'The thumbnails: carousel, list or grid, or "false" for none.',
      default: "carousel",
    },
    header: {
      description: '"false" leaves out the thumbnail and title over the stage.',
      default: "true",
    },
    panel: {
      description: '"false" leaves out the information panel.',
      default: "true",
    },
    download: {
      description: '"false" leaves the downloads out of the panel\'s About.',
      default: "true",
    },
  },
  properties: {
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
