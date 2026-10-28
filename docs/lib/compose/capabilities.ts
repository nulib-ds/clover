import type { PartDemoResource } from "docs/lib/part-demo-resources";

/**
 * What Clover handles, by what a reader or an agent would ask for ("3D", "captions", "a
 * map"), each with the parts that handle it and a sample to show it on. It is the one
 * table the compose helpers keep by hand (AGENTS.md, "Agent tools (WebMCP)"): nothing
 * else in the code says what a part is for in these words. The IIIF properties each
 * property part reads (`label`, `requiredStatement`) are not here: `catalog.ts` reads
 * them from the parts' specs.
 *
 * It grows with Clover: `catalog.test.ts` fails while a part is in no capability, or a
 * capability names a part or a sample Clover does not have. A new part gets a line here,
 * in an entry it belongs to or a new one; a new format or feature, an entry, with the
 * words a reader would ask for it by.
 */
export interface Capability {
  /** What it is, in one sentence a reader could have asked for. */
  says: string;
  /**
   * Other words a reader asks for it by ("captions" for `transcripts`), besides its own
   * name, lowercase: what `suggest.ts` matches a need against.
   */
  words?: readonly string[];
  /** The parts that handle it, by their names (`Body`), the one to show it with first. */
  parts: readonly string[];
  /**
   * A sample that has it, among the docs' mocks and examples (`part-demo-resources.ts`):
   * where a preview shows it. None for what needs the page's own code (a tooltip).
   */
  resource?: PartDemoResource;
}

export const CAPABILITIES = {
  image: {
    says: "Images, zoomed deep through the IIIF Image API, or as plain files.",
    words: [
      "photo",
      "photograph",
      "picture",
      "deep zoom",
      "zoom",
      "tiles",
      "iiif image api",
    ],
    parts: ["Body", "Canvas"],
    resource: "paged",
  },
  paged: {
    says: "Books: pages one at a time or facing, in any viewing direction.",
    words: [
      "book",
      "pages",
      "page turning",
      "spread",
      "facing pages",
      "viewing direction",
      "right to left",
    ],
    parts: ["Body", "Canvas", "Items"],
    resource: "paged",
  },
  video: {
    says: "Video, with its captions, chapters and annotations on its time.",
    words: ["film", "movie", "moving image"],
    parts: ["Body", "Canvas", "Transcript"],
    resource: "footage",
  },
  audio: {
    says: "Sound on a timeline, with its captions, chapters and the Canvas that accompanies it.",
    words: ["sound", "recording", "music", "podcast", "timeline"],
    parts: ["Body", "Timeline", "Transcript"],
    resource: "audio",
  },
  "3d": {
    says: "3D: glTF models in a IIIF Presentation 4 Scene, turned and zoomed by pointer, key or control.",
    words: ["3d model", "model", "gltf", "glb", "scene", "three dimensional"],
    parts: ["Body", "Scene"],
    resource: "model",
  },
  navigation: {
    says: "Moving between views: thumbnails as a slider, list or grid, or a pager.",
    words: [
      "thumbnails",
      "thumbnail strip",
      "pager",
      "slider",
      "next and previous",
    ],
    parts: ["Items", "Position", "Previous", "Next"],
    resource: "paged",
  },
  annotations: {
    says: "Annotations (commenting, tagging, linking), listed by layer and framed on the Body when picked.",
    words: [
      "annotation",
      "comments",
      "commenting",
      "tags",
      "tagging",
      "notes",
      "hotspots",
      "highlights",
    ],
    parts: ["Annotations", "Body"],
    resource: "tagging",
  },
  transcripts: {
    says: "Captions and plain-text transcripts, following a recording as it plays.",
    words: ["transcript", "captions", "subtitles", "webvtt", "vtt"],
    parts: ["Transcript", "Body"],
    resource: "transcripts",
  },
  search: {
    says: "Content Search: a field, and its hits by Canvas, from the resource's search service.",
    words: [
      "content search",
      "full text search",
      "search inside",
      "find in text",
    ],
    parts: ["Search", "Body"],
    resource: "search",
  },
  contents: {
    says: "A table of contents from the resource's Ranges, the section in view marked.",
    words: [
      "table of contents",
      "toc",
      "ranges",
      "structures",
      "sections",
      "chapters",
    ],
    parts: ["Contents", "Body"],
    resource: "paged",
  },
  collections: {
    says: "Collections: their members to pick, step through or list.",
    words: ["collection", "members", "many manifests"],
    parts: ["Collection", "CollectionSelect", "Items"],
    resource: "collection",
  },
  maps: {
    says: "Maps: a resource's places (navPlace) and its georeferenced images.",
    words: [
      "map",
      "navplace",
      "places",
      "georeference",
      "georeferenced",
      "geolocation",
    ],
    parts: ["Map"],
    resource: "navplace",
  },
  downloads: {
    says: "Downloads: a resource's renderings (a PDF, a text), for the page in view and for all pages.",
    words: ["download", "pdf", "renderings"],
    parts: ["Download", "Rendering"],
    resource: "page-transcript",
  },
  "information-panel": {
    says: "An information panel of sections, as tabs or stacked boxes, shown and hidden by a toggle.",
    words: [
      "information panel",
      "panel",
      "sidebar",
      "tabs",
      "accordion",
      "about",
    ],
    parts: ["Panel", "Tab", "About", "PanelToggle"],
    resource: "paged",
  },
  panes: {
    says: "Panes side by side, the reader resizing them by drag or keyboard.",
    words: ["split", "side by side", "resizable", "columns"],
    parts: ["Split", "SplitPane", "SplitHandle"],
    resource: "paged",
  },
  status: {
    says: "Loading and what went wrong, shown and announced.",
    words: ["loading", "errors", "error"],
    parts: ["Status"],
    resource: "paged",
  },
  text: {
    says: "Any IIIF language map as text, HTML or Markdown, in the reader's language.",
    words: ["language map", "markdown", "html"],
    parts: ["Value"],
  },
  "own-controls": {
    says: "Clover's tooltip and Read more, for controls and text of the page's own.",
    words: ["tooltip", "tip", "read more", "own controls", "custom button"],
    parts: ["Tip", "ReadMore"],
  },
} as const satisfies Record<string, Capability>;

export type CapabilityName = keyof typeof CAPABILITIES;
