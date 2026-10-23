import type { ElementDocs, ElementSpec } from "../spec";
import { READY, canvasDocs, handleDocs } from "./canvas";

/** `<clover-body>`: the root's view, drawn. */
export const body: ElementSpec = {
  tag: "clover-body",
  kind: "part",
  needsRoot: true,
  attributes: {
    controls: { prop: "controls", type: "boolean" },
    navigator: { prop: "navigator", type: "boolean" },
    placeholder: { prop: "placeholder", type: "boolean" },
    "animate-annotations": { prop: "animateAnnotations", type: "boolean" },
  },
  properties: ["controls", "options", "controlButtons", "renderers"],
  events: {
    ...READY,
    "clover-annotation-active": { prop: "onAnnotationActive", detail: ["id"] },
    "clover-caption-change": { prop: "onCaptionChange", detail: ["caption"] },
    "clover-ended": { prop: "onEnded", detail: [] },
  },
};

export const bodyDocs: ElementDocs = {
  name: "CloverBodyElement",
  description:
    "The view of the clover-root it is in, drawn as Body draws it: images, video and sound, or a renderer of yours. It is the stage's box, its height from --clover-body-height (60vh by default) or its own style. A clover-panel-toggle, and a button of yours, in it are among its controls.",
  attributes: {
    controls: {
      description: '"false" leaves out the controls over the stage.',
      default: "true",
    },
    navigator: {
      description: "A small map of the whole image, while zoomed in.",
      default: "false",
    },
    placeholder: canvasDocs.attributes.placeholder,
    "animate-annotations": canvasDocs.attributes["animate-annotations"],
  },
  properties: {
    handle: handleDocs.property,
    controlButtons: handleDocs.controlButtons,
    controls: handleDocs.controls,
    options: canvasDocs.properties!.options,
    renderers: {
      type: "CloverRenderer[] | null",
      description:
        "Renderers of yours for this stage only, in place of the root's: each claims views (canvasId, format or match) and draws one into a box of its own (render).",
    },
  },
  events: {
    "clover-ready": handleDocs.event,
    "clover-annotation-active": canvasDocs.events!["clover-annotation-active"],
    "clover-caption-change": canvasDocs.events!["clover-caption-change"],
    "clover-ended": canvasDocs.events!["clover-ended"],
  },
};
