import type { AttributeSpec, ElementDocs, ElementSpec } from "../spec";

/*
 * The property parts: each reads one IIIF property of its root's Manifest, or of the
 * Canvas in view (`of="canvas"`), or shows a `value` it is given, anywhere. A value an
 * attribute can carry is text, a URL, or JSON (a language map, a list of links).
 */

const OF: AttributeSpec = { prop: "of", type: ["manifest", "canvas"] };
const VALUE: AttributeSpec = { prop: "value", type: "data" };
const ofDocs = {
  description: "Whose property: the Manifest's, or the Canvas in view's.",
  default: "manifest",
};

/** A property part's spec: `of`, a `value`, and what else it reads. */
const property = (
  tag: string,
  attributes: Record<string, AttributeSpec> = {},
): ElementSpec => ({
  tag,
  kind: "part",
  attributes: { of: OF, value: VALUE, ...attributes },
  properties: ["value"],
});

/** What the types and the manifest say of a property part. Never loaded by a page. */
const propertyDocs = (
  name: string,
  description: string,
  value: { type: string; description: string },
  attributes: ElementDocs["attributes"] = {},
): ElementDocs => ({
  name,
  description,
  attributes: {
    of: ofDocs,
    value: {
      description: `${value.description}, instead of the root's: as text, a URL or JSON. Outside a root, the one to show.`,
    },
    ...attributes,
  },
  properties: {
    value: {
      type: `${value.type} | null`,
      description: `${value.description}, instead of the root's.`,
    },
  },
});

const LINKS = {
  type: "string | Array<{ id: string; label?: Record<string, string[]>; format?: string }>",
};

export const summary = property("clover-summary", {
  as: { prop: "as", type: ["p", "div", "span"] },
});
export const summaryDocs = /* @__PURE__ */ propertyDocs(
  "CloverSummaryElement",
  "The summary, as sanitized HTML, cut to five lines with Read more under it when it runs longer (--clover-summary-lines).",
  { type: "string | Record<string, string[]>", description: "A summary" },
  { as: { description: "The element to draw.", default: "p" } },
);

export const metadata = property("clover-metadata");
export const metadataDocs = /* @__PURE__ */ propertyDocs(
  "CloverMetadataElement",
  "The metadata, as a description list of labels and their values.",
  {
    type: "Array<{ label: Record<string, string[]>; value: Record<string, string[]> }>",
    description: "Metadata",
  },
);

export const requiredStatement = property("clover-required-statement");
export const requiredStatementDocs = /* @__PURE__ */ propertyDocs(
  "CloverRequiredStatementElement",
  "The required statement: the attribution that must be shown, as a label and its value.",
  {
    type: "{ label: Record<string, string[]>; value: Record<string, string[]> }",
    description: "A required statement",
  },
);

export const rights = property("clover-rights");
export const rightsDocs = /* @__PURE__ */ propertyDocs(
  "CloverRightsElement",
  "The rights: a link to the license or rights statement.",
  { type: "string", description: "A rights URL" },
);

export const id = property("clover-id");
export const idDocs = /* @__PURE__ */ propertyDocs(
  "CloverIdElement",
  "The resource's id: a link to its IIIF JSON.",
  { type: "string", description: "An id" },
);

export const homepage = property("clover-homepage");
export const homepageDocs = /* @__PURE__ */ propertyDocs(
  "CloverHomepageElement",
  "The homepage: the resource's own web page, as a list of links.",
  { ...LINKS, description: "Homepages" },
);

export const rendering = property("clover-rendering");
export const renderingDocs = /* @__PURE__ */ propertyDocs(
  "CloverRenderingElement",
  "The rendering: alternate formats, such as a PDF of the whole object, as a list of links, each with its format.",
  { ...LINKS, description: "Renderings" },
);

export const seeAlso = property("clover-see-also");
export const seeAlsoDocs = /* @__PURE__ */ propertyDocs(
  "CloverSeeAlsoElement",
  "See also: machine-readable descriptions elsewhere, as a list of links.",
  { ...LINKS, description: "Descriptions" },
);

export const partOf = property("clover-part-of");
export const partOfDocs = /* @__PURE__ */ propertyDocs(
  "CloverPartOfElement",
  "Part of: the Collections the resource belongs to, as a list of links.",
  { ...LINKS, description: "Collections" },
);

export const thumbnail = property("clover-thumbnail", {
  size: { prop: "size", type: "number", min: 1 },
  alt: { prop: "alt", type: "string" },
});
export const thumbnailDocs = /* @__PURE__ */ propertyDocs(
  "CloverThumbnailElement",
  "The thumbnail (for a Canvas, its first image), its alt text the resource's label.",
  {
    type: "Record<string, unknown>",
    description: "A resource to picture (a Manifest, Canvas or Collection)",
  },
  {
    size: {
      description: "Pixels to ask for on its longer side.",
      default: "400",
    },
    alt: {
      description:
        'Its alt text instead of the label: "" for a picture beside its label, which says it already.',
    },
  },
);

/** `<clover-value>`: any language map, as text, HTML or Markdown. */
export const value: ElementSpec = {
  tag: "clover-value",
  kind: "part",
  attributes: {
    value: VALUE,
    format: { prop: "format", type: "string" },
    "heading-level": { prop: "headingLevel", type: "number", min: 1 },
    as: { prop: "as", type: ["span", "p", "div"] },
  },
  properties: ["value"],
};

export const valueDocs: ElementDocs = {
  name: "CloverValueElement",
  description:
    "Any IIIF language map in the reader's language, read strictly by its format: text/html as sanitized HTML, text/plain as written, text/markdown as Markdown.",
  attributes: {
    value: {
      description: "What to show: text, or a IIIF language map as JSON.",
    },
    format: {
      description:
        "Its media type: text/html, text/plain or text/markdown. By IIIF's rule without one.",
    },
    "heading-level": {
      description: "With Markdown, the level of its first heading.",
      default: "3",
    },
    as: { description: "The element to draw.", default: "span" },
  },
  properties: {
    value: {
      type: "string | Record<string, string[]> | null",
      description: "What to show.",
    },
  },
};
