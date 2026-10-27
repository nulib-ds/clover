import type { ElementDocs, ElementSpec } from "../spec";

/*
 * Presentation 4's other containers, beside `<clover-canvas>`: a Timeline (sound) and a
 * Scene (3D). Each alone draws what it is given; inside a `<clover-root>`, given
 * nothing, the root's view when it is one of its kind, as `Timeline` and `Scene` do.
 */

/** `<clover-timeline>`: a Timeline, played through Canvas. */
export const timeline: ElementSpec = {
  tag: "clover-timeline",
  kind: "part",
  attributes: {
    "iiif-content": { prop: "iiifContent", type: "string" },
    label: { prop: "label", type: "string" },
    language: { prop: "language", type: "string" },
    controls: { prop: "controls", type: "boolean" },
    placeholder: { prop: "placeholder", type: "boolean" },
  },
  properties: ["iiifContent", "timeline", "annotations", "options", "controls"],
  events: {
    "clover-caption-change": { prop: "onCaptionChange", detail: ["caption"] },
    "clover-ended": { prop: "onEnded", detail: [] },
  },
};

export const timelineDocs: ElementDocs = {
  name: "CloverTimelineElement",
  description:
    "A IIIF Presentation 4 Timeline (sound), played through Canvas, with its transport, captions, chapters and annotations on its time, and its accompanying or placeholder Canvas while it plays. Alone, it plays what it is given; inside a clover-root, given nothing, the root's view when that is a Timeline. As tall as --clover-body-height (60vh) or its own style.",
  attributes: {
    "iiif-content": {
      description:
        "A Timeline, or a Manifest (its first Timeline), by URL, in any Presentation version.",
    },
    label: {
      description: "The Body's name. A Timeline names it by its own label.",
    },
    language: { description: "The language to read IIIF text in." },
    controls: {
      description:
        '"false" leaves out the controls over the Body; the transport stays.',
      default: "true",
    },
    placeholder: {
      description:
        '"false" opens a Timeline straight away, past its placeholderContainer.',
      default: "true",
    },
  },
  properties: {
    iiifContent: {
      type: "string | Record<string, unknown> | null",
      description: "What to load and play, as a URL or a IIIF resource.",
    },
    timeline: {
      type: "Record<string, unknown> | null",
      description: "A Presentation 4 Timeline to play.",
    },
    annotations: {
      type: "Record<string, unknown>[] | null",
      description:
        "Annotations on its time, each shown as a cue while its stretch plays, as Canvas's annotations property takes them.",
    },
    options: {
      type: "Record<string, unknown> | null",
      description:
        "As Canvas's options: request (credentials, headers) and hideDelay among them.",
    },
    controls: {
      type: "boolean | { information?: boolean; annotations?: boolean; [option: string]: unknown } | null",
      description:
        "Which of the Body's controls it shows, as Canvas's controls takes it, in place of the attribute.",
    },
  },
  events: {
    "clover-caption-change": {
      detail: "{ caption: { id: string; language?: string } | null }",
      description:
        "The reader chose a caption file in the Body's Captions menu, or Off (null).",
    },
    "clover-ended": {
      detail: "Record<string, never>",
      description: "Playback reached the end.",
    },
  },
};

/** `<clover-scene>`: a Scene, in 3D. */
export const scene: ElementSpec = {
  tag: "clover-scene",
  kind: "part",
  attributes: {
    "iiif-content": { prop: "iiifContent", type: "string" },
    label: { prop: "label", type: "string" },
    language: { prop: "language", type: "string" },
    controls: { prop: "controls", type: "boolean" },
    engine: { prop: "engine", type: ["clover", "three"] },
  },
  properties: ["iiifContent", "scene", "options", "controls"],
};

export const sceneDocs: ElementDocs = {
  name: "CloverSceneElement",
  description:
    "A IIIF Presentation 4 Scene, drawn in 3D: the glTF models it paints, lit and framed, turned and zoomed by pointer, key or control. Its 3D library loads only when one is drawn. Alone, it draws what it is given; inside a clover-root, given nothing, the root's view when that is a Scene. As tall as --clover-body-height (60vh) or its own style.",
  attributes: {
    "iiif-content": {
      description:
        "A Scene, or a Manifest (its first Scene), by URL, in any Presentation version.",
    },
    label: {
      description: "The view's name. A Scene names it by its own label.",
    },
    language: { description: "The language to read IIIF text in." },
    controls: {
      description: '"false" leaves out the controls over the Body.',
      default: "true",
    },
    engine: {
      description:
        'What draws the models: Clover\'s own WebGL2 renderer ("clover"), or three.js ("three"), once the page loads web-components/three.mjs, for what Clover\'s does not draw yet (glTF\'s material extensions, skins and morph targets at rest, sparse accessors).',
      default: "clover",
    },
  },
  properties: {
    iiifContent: {
      type: "string | Record<string, unknown> | null",
      description: "What to load and draw, as a URL or a IIIF resource.",
    },
    scene: {
      type: "Record<string, unknown> | null",
      description: "A Presentation 4 Scene to draw.",
    },
    options: {
      type: "{ request?: Record<string, unknown>; hideDelay?: number } | null",
      description:
        "request: credentials and headers for the Scene and its models; hideDelay: how long the controls stay after a mouse stops, in milliseconds.",
    },
    controls: {
      type: "boolean | { zoom?: boolean; fullPage?: boolean; rotation?: boolean; reset?: boolean; information?: boolean } | null",
      description:
        "Which of the Body's controls it shows: false for none, or some ({ rotation: false }), in place of the attribute.",
    },
  },
};
