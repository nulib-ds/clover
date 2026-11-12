import type { ElementDocs, ElementSpec } from "../spec";

/** `<clover-viewer>`: the Viewer, in one of its templates, Default unless it names another. */
export const viewer: ElementSpec = {
  tag: "clover-viewer",
  kind: "alone",
  attributes: {
    template: { prop: "template", type: ["default", "document", "gallery"] },
    "iiif-content": { prop: "iiifContent", type: "string" },
    "canvas-id": { prop: "defaultCanvasId", type: "string" },
    // Where it opens, not held there: the view moves on through the Collection.
    "manifest-id": { prop: "defaultManifestId", type: "string" },
    language: { prop: "language", type: "string" },
    "high-contrast": { prop: "highContrast", type: "boolean" },
    "search-query": { prop: "searchQuery", type: "string" },
    annotations: { prop: "annotations", type: "data" },
    // Past 6 the titles name what they head instead (`ui/heading.ts`).
    "heading-level": { prop: "headingLevel", type: "number", min: 2 },
    items: {
      prop: "items",
      type: ["slider", "list", "grid", "masonry", "false"],
    },
    "single-item": { prop: "singleItem", type: "boolean" },
    header: { prop: "header", type: "boolean" },
    panel: { prop: "panel", type: "boolean" },
    download: { prop: "download", type: "boolean" },
    languages: { prop: "languages", type: "boolean" },
    "interface-languages": { prop: "interfaceLanguages", type: "boolean" },
    // The templates' own (`templates/`): each one's, where it has it.
    "panel-open": { prop: "defaultPanelOpen", type: "boolean" },
    "panel-layout": { prop: "panelLayout", type: ["accordion", "tabs"] },
    "panel-sections": { prop: "panelSections", type: "data" },
    "panel-labels": { prop: "panelLabels", type: "data" },
    "sidebar-open": { prop: "defaultSidebarOpen", type: "boolean" },
    "storage-key": { prop: "storageKey", type: "string" },
    fill: { prop: "fill", type: "boolean" },
    "collapse-controls": { prop: "collapseControls", type: ["auto", "always"] },
    size: { prop: "size", type: "string" },
    height: { prop: "height", type: "string" },
    gap: { prop: "gap", type: "string" },
    secondary: { prop: "secondary", type: ["summary", "navDate", "none"] },
    summary: { prop: "summary", type: "boolean" },
    "lightbox-items": { prop: "lightboxItems", type: ["slider", "pager"] },
  },
  properties: [
    "iiifContent",
    "annotations",
    "request",
    "renderers",
    "canvasOptions",
  ],
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
    "clover-search-change": { prop: "onSearchChange", detail: ["query"] },
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
        "In a Collection, the Manifest to open first. The others stay reachable from it.",
    },
    language: { description: "The language to read IIIF text in." },
    "high-contrast": {
      description:
        "Clover's higher-contrast mode, for what is inside: the accent kept to rings, outlines and marks, never under words or a glyph, where the controls' dark fill takes its place, edged in the accent. On wherever the system asks for more contrast, too.",
      default: "false",
    },
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
        "Default and Gallery: Default's thumbnails, as a slider, list or grid, or \"false\" for none; Gallery's grid, as grid (its default) or masonry.",
      default: "slider",
    },
    "single-item": {
      description:
        "Default and Document: the thumbnails where the resource has one view too, which Document shows by default and Default does not; \"false\" leaves Document's out. Gallery's grid always shows them.",
      default: "false",
    },
    header: {
      description:
        'Default: "false" leaves out the title and provider over the Body.',
      default: "true",
    },
    panel: {
      description:
        "Default and Gallery: \"false\" leaves out the information panel, Default's beside its Body, the Gallery's beside its lightbox's view.",
      default: "true",
    },
    download: {
      description:
        "Default, Document and Gallery: \"false\" leaves out the downloads: Default's and the Gallery's from a Download button beside its panel's About heading, Document's from a Download button in its toolbar (its About offers none).",
      default: "true",
    },
    languages: {
      description:
        "Default, Document and Gallery: where what the resource says of itself comes in several languages, the panel's About heading offers them (Document's toolbar, as a globe), and the whole Viewer reads in the one chosen. \"false\" leaves the choice out.",
      default: "true",
    },
    "interface-languages": {
      description:
        "Default, Document and Gallery: the panel's language toggle, beside its About heading (Document's globe, in its toolbar), also offers Clover's interface languages (its control labels, section titles and announcements) that the resource has none of: the visitor's and the site's, where they differ. \"false\" leaves them out.",
      default: "true",
    },
    "panel-open": {
      description:
        "Default, Document and Gallery: whether the information panel starts open beside the page (the Gallery's, beside its lightbox's view). Default's and the Gallery's do, by default; Document's aside, on About, starts shut. Where it would slide over the page (a phone), it starts shut.",
    },
    "panel-layout": {
      description:
        "Default and Gallery: the panel's sections as stacked boxes, each opened by its heading, or as tabs. Document opens each alone in its aside.",
      default: "accordion",
    },
    "panel-sections": {
      description:
        'Default, Document and Gallery: which of the panel\'s sections it may have (Document\'s toolbar\'s buttons), as a JSON array: ["contents","search","transcript","annotations"] leaves out About and the rest. Each still shows only where the resource has data for it, and there is no panel where none of them does.',
      default: "every section",
    },
    "panel-labels": {
      description:
        "Default, Document and Gallery: what a panel section's tab or heading says (Document's button and aside), in place of its word in Clover's interface language, as JSON by the section's value: {\"annotations\": \"Chapters\"}, or a word by language tag to say it in several (clover-panel's labels).",
    },
    "sidebar-open": {
      description:
        "Document: whether the page thumbnails start shown beside the page. By default, where the resource has several pages; a single page's starts put away. Where they would float over the page (a phone), they start put away.",
    },
    "storage-key": {
      description:
        'Default, Document and Gallery: where the width chosen for a pane is remembered (localStorage); "false" forgets it.',
    },
    fill: {
      description:
        "Default: as tall as the box it is in, the Body taking what the header and the thumbnails leave.",
      default: "false",
    },
    "collapse-controls": {
      description:
        "Default, Document and Gallery: when the Body's view controls (zoom, the turns, reset, full screen) collapse behind one button, the Gallery's in its lightbox: auto, only where the row cannot hold them all; always, wherever there are any, leaving the media more room. Document's view controls are its own, behind its magnifier: there, it is the Body's others (Choice, a Canvas's information).",
      default: "auto",
    },
    size: {
      description: "Gallery: the size of a cell in the grid.",
      default: "10rem",
    },
    height: {
      description:
        "Gallery: its height, auto (growing with its grid) or a CSS length, the grid scrolling under the header.",
      default: "auto",
    },
    gap: {
      description:
        "Gallery: the space between the grid's cells, a CSS length. Its inset unless set.",
    },
    secondary: {
      description:
        "Gallery: the line under each cell's label, where it has one: summary, navDate or none.",
      default: "summary",
    },
    summary: {
      description:
        'Gallery: the resource\'s summary under the title, cut to two lines with Read more under it where it runs longer; "false" leaves it out.',
      default: "true",
    },
    "lightbox-items": {
      description:
        "Gallery: how its lightbox moves on from the view it shows: a short strip of thumbnails (slider), or a pager, Previous, the position and Next.",
      default: "slider",
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
    canvasOptions: {
      type: "CloverCanvasOptions | null",
      description:
        "Default, Document and Gallery: the Body's Canvas options (its gestures, zoom limits and motion), the Gallery's in its lightbox.",
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
      description: "The current Canvas changed.",
    },
    "clover-manifest-change": {
      detail: "{ manifestId: string }",
      description: "In a Collection, another Manifest opened.",
    },
    "clover-status-change": {
      detail: '{ status: "loading" | "ready" | "error"; error: Error | null }',
      description: "What it was given is loading, has loaded, or failed to.",
    },
    "clover-content-state-change": {
      detail: "{ json: Record<string, unknown>; encoded: string }",
      description:
        "The current view, as a IIIF content state, as it changes: at most every 100ms while it moves, and always its last place.",
    },
    "clover-search-change": {
      detail: "{ query: string }",
      description:
        'The search\'s query changed: a search run, from search-query or the Search field, and "" as it is cleared or another Manifest opens.',
    },
  },
};
