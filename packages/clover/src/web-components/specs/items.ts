import type { ElementDocs, ElementSpec } from "../spec";

/** `<clover-items>`: thumbnails of a sequence. */
export const items: ElementSpec = {
  tag: "clover-items",
  kind: "part",
  attributes: {
    layout: { prop: "layout", type: ["carousel", "list", "grid", "pager"] },
    of: { prop: "of", type: ["views", "members"] },
    navigation: { prop: "navigation", type: ["id", "homepage"] },
    "iiif-content": { prop: "iiifContent", type: "string" },
    header: { prop: "header", type: "boolean" },
    "heading-level": { prop: "headingLevel", type: "number", min: 2 },
    "thumbnail-size": { prop: "thumbnailSize", type: "number", min: 1 },
    language: { prop: "language", type: "string" },
  },
  properties: ["iiifContent", "items", "request", "renderItem"],
  events: {
    "clover-select": { prop: "onSelect", detail: ["item"], cancelable: true },
  },
};

export const itemsDocs: ElementDocs = {
  name: "CloverItemsElement",
  description:
    "Thumbnails, as Items draws them. Inside a clover-root, its views (or its Collection's members), choosing what it shows; alone, the members or views of what it is given, as links.",
  attributes: {
    layout: {
      description:
        "A scrolling row, a column, a wrapping grid, or a pager: Previous, the position and Next, with no thumbnails.",
      default: "carousel",
    },
    of: {
      description:
        "Inside a root: its views, or the members of the Collection it belongs to.",
      default: "views",
    },
    navigation: {
      description:
        "id chooses what the root shows; homepage links to each item's homepage. By default, id for views and homepage for members or a list.",
    },
    "iiif-content": {
      description:
        "Alone: a Collection (its members) or a Manifest (its views), by URL.",
    },
    header: {
      description:
        'Alone: the resource\'s label, summary and homepage over the items. "false" leaves them out.',
      default: "true",
    },
    "heading-level": {
      description:
        "Alone: the header's title's level, 2 or more, to fit the page's outline.",
      default: "2",
    },
    "thumbnail-size": {
      description: "Pixels to ask for each thumbnail's longer side.",
      default: "200",
    },
    language: {
      description: "Alone: the language to read IIIF text in.",
    },
  },
  properties: {
    iiifContent: {
      type: "string | Record<string, unknown> | null",
      description: "Alone: what to list, as a URL or a IIIF resource.",
    },
    items: {
      type: "unknown[] | null",
      description: "Alone: a list of IIIF resources to show, as they are.",
    },
    request: {
      type: "{ credentials?: RequestCredentials; headers?: Record<string, string>; fetch?: typeof fetch } | null",
      description:
        "Alone: credentials, headers and a fetch of your own. In a root, the root's are used.",
    },
    renderItem: {
      type: "((item: { id: string; label?: string | Record<string, string[]>; summary?: string | Record<string, string[]>; href?: string }, state: { selected: boolean }) => Node | string | null | undefined) | null",
      description:
        "Your own figure for an item, in place of its thumbnail and label: a node or text, which names the item. A new node each time.",
    },
  },
  events: {
    "clover-select": {
      detail:
        "{ item: { id: string; label?: string | Record<string, string[]>; summary?: string | Record<string, string[]>; href?: string } }",
      description:
        "An item was chosen. Cancel it (preventDefault) to keep a link from being followed.",
    },
  },
};
