import type { ElementDocs, ElementSpec } from "../spec";

/** `<clover-content>`: the root's view, drawn. */
export const content: ElementSpec = {
  tag: "clover-content",
  kind: "part",
  needsRoot: true,
  attributes: {
    controls: { prop: "controls", type: "boolean" },
    navigator: { prop: "navigator", type: "boolean" },
  },
};

export const contentDocs: ElementDocs = {
  name: "CloverContentElement",
  description:
    "The view of the clover-root it is in, drawn as Content draws it: images, video and sound. It is the stage's box, its height from --clover-content-height (60vh by default) or its own style.",
  attributes: {
    controls: {
      description: '"false" leaves out the controls over the stage.',
      default: "true",
    },
    navigator: {
      description: "A small map of the whole image, while zoomed in.",
      default: "false",
    },
  },
};
