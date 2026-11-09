import type { ElementDocs, ElementSpec } from "../spec";

/**
 * What `as` may name: a heading for the page's outline first (Clover's parts never
 * hard-code a level; WCAG 1.3.1), then a name for something (a `label`, a `figcaption`),
 * then text, `div` last, allowed but not offered (Mat, 2026-11-01: the docs list them in
 * this order). Not any tag: an attribute that named `script` would write one.
 */
const TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "label",
  "figcaption",
  "p",
  "strong",
  "em",
  "div",
] as const;

/** `<clover-label>`: a resource's label, in the language it is in. */
export const label: ElementSpec = {
  tag: "clover-label",
  kind: "part",
  attributes: {
    of: { prop: "of", type: ["manifest", "canvas"] },
    as: { prop: "as", type: TAGS },
    label: { prop: "label", type: "data" },
    keep: { prop: "keep", type: "boolean" },
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
    keep: {
      description:
        "Keep its place while there is no label, as the next Manifest loads: the element stays, holding a non-breaking space hidden from assistive technology, so what follows holds still.",
      default: "false",
    },
  },
  properties: {
    label: {
      type: "string | Record<string, string[]> | null",
      description: "A label to show instead, as text or a IIIF language map.",
    },
  },
};
