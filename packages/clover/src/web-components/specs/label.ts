import type { ElementDocs, ElementSpec } from "../spec";

/**
 * What `as` may name: text, or a heading for the page's outline (Clover's parts never
 * hard-code a level; WCAG 1.3.1). Not any tag: an attribute that named `script` would
 * write one.
 */
const TAGS = [
  "span",
  "p",
  "div",
  "strong",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
] as const;

/** `<clover-label>`: a resource's label, in the language it is in. */
export const label: ElementSpec = {
  tag: "clover-label",
  kind: "part",
  attributes: {
    of: { prop: "of", type: ["manifest", "canvas"] },
    as: { prop: "as", type: TAGS },
    label: { prop: "label", type: "data" },
  },
  properties: ["label"],
};

export const labelDocs: ElementDocs = {
  name: "CloverLabelElement",
  description:
    "A label, as Label draws it, marked with the language it is in. Inside a clover-root, the Manifest's or the Canvas's; alone, the one it is given. Nothing is drawn while there is none, so a heading is never left empty.",
  attributes: {
    of: {
      description: "Whose label: the Manifest's, or the Canvas in view's.",
      default: "manifest",
    },
    as: {
      description:
        "The element to draw: span, p, div, strong, em, or a heading, h1 to h6, to fit the page's outline.",
      default: "span",
    },
    label: {
      description:
        "A label to show instead: text, or a IIIF language map as JSON. Outside a root, the label to show.",
    },
  },
  properties: {
    label: {
      type: "string | Record<string, string[]> | null",
      description: "A label to show instead, as text or a IIIF language map.",
    },
  },
};
