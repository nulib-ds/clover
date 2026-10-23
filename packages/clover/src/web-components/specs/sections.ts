import type { ElementDocs, ElementSpec } from "../spec";

/*
 * The parts that read their root's state: where the reader is, what the Manifest holds,
 * and what Clover is doing. Each draws nothing outside a `<clover-root>` (`needsRoot`),
 * but the map, which can show what it is given.
 */

const headingLevel = {
  "heading-level": { prop: "headingLevel", type: "number", min: 1 },
} as const;
const headingLevelDocs = (what: string) => ({
  "heading-level": {
    description: `The level of ${what}, one under the heading it sits beneath. Past 6, each names what it heads instead.`,
    default: "3",
  },
});
const OF_STEPS = { of: { prop: "of", type: ["views", "members"] } } as const;
const ofStepsDocs = {
  of: {
    description:
      "What it steps through: the root's views, or its Collection's members.",
    default: "views",
  },
};

export const status: ElementSpec = {
  tag: "clover-status",
  kind: "part",
  needsRoot: true,
  attributes: { loading: { prop: "loading", type: ["false"] } },
  slots: ["loading", "error"],
};
export const statusDocs: ElementDocs = {
  name: "CloverStatusElement",
  description:
    "What the root is doing: its loading mark while it loads, announced as Loading…, and why it failed if it did, as an alert. Empty and out of sight once it is ready.",
  attributes: {
    loading: {
      description:
        '"false" shows no loading mark and only announces it, for a layout whose Body shows its own.',
    },
  },
  slots: {
    loading: {
      description:
        "What it shows and announces while loading, in place of the mark: words, as a copy (a span; give it no ids).",
    },
    error: {
      description:
        "What it shows, as an alert, if loading failed, in place of Clover's words: as a copy (give it no ids).",
    },
  },
};

export const position: ElementSpec = {
  tag: "clover-position",
  kind: "part",
  needsRoot: true,
  attributes: { ...OF_STEPS, as: { prop: "as", type: ["span", "p", "div"] } },
};
export const positionDocs: ElementDocs = {
  name: "CloverPositionElement",
  description:
    "Where the reader is, as a count: Item 3 of 12. It keeps the room of its widest count, so nothing beside it moves.",
  attributes: {
    ...ofStepsDocs,
    as: { description: "The element to draw.", default: "span" },
  },
};

export const next: ElementSpec = {
  tag: "clover-next",
  kind: "part",
  needsRoot: true,
  attributes: OF_STEPS,
};
export const nextDocs: ElementDocs = {
  name: "CloverNextElement",
  description:
    "A button to the next view (or member), shown disabled where there is none.",
  attributes: ofStepsDocs,
};

export const previous: ElementSpec = {
  tag: "clover-previous",
  kind: "part",
  needsRoot: true,
  attributes: OF_STEPS,
};
export const previousDocs: ElementDocs = {
  name: "CloverPreviousElement",
  description:
    "A button to the previous view (or member), shown disabled where there is none.",
  attributes: ofStepsDocs,
};

export const download: ElementSpec = {
  tag: "clover-download",
  kind: "part",
  needsRoot: true,
  attributes: headingLevel,
};
export const downloadDocs: ElementDocs = {
  name: "CloverDownloadElement",
  description:
    "The renderings of the page in view and of the Manifest (a PDF, a text, a full-size file), as links in two groups, This page and All pages. Nothing while there are none.",
  attributes: headingLevelDocs("its groups' titles"),
};

export const search: ElementSpec = {
  tag: "clover-search",
  kind: "part",
  needsRoot: true,
  attributes: headingLevel,
};
export const searchDocs: ElementDocs = {
  name: "CloverSearchElement",
  description:
    "A Content Search of the Manifest, where it offers one: a field, and its hits by Canvas, each going to its place.",
  attributes: headingLevelDocs("each Canvas's group of hits"),
};

export const contents: ElementSpec = {
  tag: "clover-contents",
  kind: "part",
  needsRoot: true,
  attributes: {},
};
export const contentsDocs: ElementDocs = {
  name: "CloverContentsElement",
  description:
    "The Manifest's table of contents (its Ranges), as a tree of links to each section, the one in view marked.",
  attributes: {},
};

export const transcript: ElementSpec = {
  tag: "clover-transcript",
  kind: "part",
  needsRoot: true,
  attributes: { follow: { prop: "follow", type: "boolean" } },
};
export const transcriptDocs: ElementDocs = {
  name: "CloverTranscriptElement",
  description:
    "The recording's captions as a transcript, following where it plays, and any plain-text transcript after them. Each cue goes to its time.",
  attributes: {
    follow: {
      description:
        '"false" stops the current cue being kept in view as it plays.',
      default: "true",
    },
  },
};

export const annotations: ElementSpec = {
  tag: "clover-annotations",
  kind: "part",
  needsRoot: true,
  attributes: {
    scope: { prop: "scope", type: ["view", "all"] },
    ...headingLevel,
  },
  properties: ["renderEntry"],
};
export const annotationsDocs: ElementDocs = {
  name: "CloverAnnotationsElement",
  description:
    "The annotations, by layer and then by Canvas: each to pick, which frames it on the Body, with its region pictured.",
  attributes: {
    scope: {
      description: "Every Canvas's annotations, or only the view's.",
      default: "all",
    },
    ...headingLevelDocs("its layers' titles"),
  },
  properties: {
    renderEntry: {
      type: "((entry: { id: string; canvasId: string; annotation: Record<string, unknown> }) => Node | string | null | undefined) | null",
      description:
        "Your own drawing of an annotation's content: a node or text, in place of its bodies. A new node each time.",
    },
  },
};

export const collection: ElementSpec = {
  tag: "clover-collection",
  kind: "part",
  needsRoot: true,
  attributes: headingLevel,
};
export const collectionDocs: ElementDocs = {
  name: "CloverCollectionElement",
  description:
    "The Collection the Manifest was reached through: its label, summary and members, each to open, its homepage and its address.",
  attributes: headingLevelDocs("its titles"),
};

export const collectionSelect: ElementSpec = {
  tag: "clover-collection-select",
  kind: "part",
  needsRoot: true,
  attributes: {},
  events: {
    "clover-change": { prop: "onChange", detail: ["manifestId"] },
  },
};
export const collectionSelectDocs: ElementDocs = {
  name: "CloverCollectionSelectElement",
  description:
    "A menu of the Collection's members, choosing the Manifest shown. A key steps through it and Enter opens the one stepped to.",
  attributes: {},
  events: {
    "clover-change": {
      detail: "{ manifestId: string }",
      description: "A member was chosen, before Clover opens it.",
    },
  },
};

export const about: ElementSpec = {
  tag: "clover-about",
  kind: "part",
  needsRoot: true,
  attributes: {
    "canvas-summary": { prop: "canvasSummary", type: "boolean" },
    download: { prop: "download", type: "boolean" },
    ...headingLevel,
  },
};
export const aboutDocs: ElementDocs = {
  name: "CloverAboutElement",
  description:
    "The information panel's first section, on its own: the summary, metadata, required statement, rights, homepage, see also, downloads and address.",
  attributes: {
    "canvas-summary": {
      description: "Also the Canvas in view's summary, before the resource's.",
      default: "false",
    },
    download: {
      description: '"false" leaves out the downloads.',
      default: "true",
    },
    ...headingLevelDocs("each section's title"),
  },
};

export const map: ElementSpec = {
  tag: "clover-map",
  kind: "part",
  attributes: {
    "iiif-content": { prop: "iiifContent", type: "string" },
    overlay: { prop: "overlay", type: "boolean" },
    "overlay-opacity": { prop: "overlayOpacity", type: "number", min: 0 },
    "style-url": { prop: "styleUrl", type: "string" },
    "scroll-zoom": { prop: "scrollZoom", type: "boolean" },
    language: { prop: "language", type: "string" },
  },
  properties: ["iiifContent", "navPlace", "georeferences", "request"],
  events: { "clover-select": { prop: "onSelect", detail: ["feature"] } },
};
export const mapDocs: ElementDocs = {
  name: "CloverMapElement",
  description:
    "A map: inside a clover-root, its places (navPlace) and the view's georeferenced images; alone, those of the iiif-content it is given. Its places are listed under it as buttons, for the keyboard.",
  attributes: {
    "iiif-content": {
      description: "Alone: a IIIF resource, by URL, to map.",
    },
    overlay: {
      description: '"false" leaves out the georeferenced images.',
      default: "true",
    },
    "overlay-opacity": {
      description: "The georeferenced images' opacity, 0 to 1.",
      default: "0.75",
    },
    "style-url": {
      description: "A MapLibre style URL. Clover's relief basemap by default.",
    },
    "scroll-zoom": {
      description:
        "Zoom with the wheel or a trackpad, which can trap the page's scroll.",
      default: "false",
    },
    language: { description: "Alone: the language to read IIIF text in." },
  },
  properties: {
    iiifContent: {
      type: "string | Record<string, unknown> | null",
      description: "Alone: what to map, by URL or as a IIIF resource.",
    },
    navPlace: {
      type: "Record<string, unknown> | null",
      description: "Alone: GeoJSON to draw, as navPlace is.",
    },
    georeferences: {
      type: "unknown[] | null",
      description: "Alone: Georeference Extension annotations to overlay.",
    },
    request: {
      type: "{ credentials?: RequestCredentials; headers?: Record<string, string>; fetch?: typeof fetch } | null",
      description: "Alone: credentials, headers and a fetch of your own.",
    },
  },
  events: {
    "clover-select": {
      detail:
        "{ feature: { title?: string; canvasId?: string; [key: string]: unknown } }",
      description: "A place was chosen, on the map or in its list.",
    },
  },
};
