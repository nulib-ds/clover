import type { ElementDocs, ElementSpec } from "../spec";

/*
 * The containers: the information panel and its tabs, the toggle that shows and hides it,
 * and the Split, its panes and the handles between them. The Split's three are the boxes
 * themselves (`native`): its logic runs on the elements, as each one's siblings and
 * children, which a box of Clover's between them would part.
 */

export const panel: ElementSpec = {
  tag: "clover-panel",
  kind: "part",
  needsRoot: true,
  attributes: {
    layout: { prop: "layout", type: ["tabs", "accordion"] },
    value: { prop: "value", type: "string" },
    "heading-level": { prop: "headingLevel", type: "number", min: 1 },
    download: { prop: "download", type: "boolean" },
    languages: { prop: "languages", type: "boolean" },
    closable: { prop: "closable", type: "boolean" },
    "close-on-escape": { prop: "closeOnEscape", type: "boolean" },
    as: { prop: "as", type: ["aside", "div"] },
  },
  events: {
    "clover-value-change": { prop: "onValueChange", detail: ["value"] },
    "clover-close": { prop: "onClose", detail: [], cancelable: true },
  },
};
export const panelDocs: ElementDocs = {
  name: "CloverPanelElement",
  description:
    "The information panel of the clover-root it is in, in tabs or stacked boxes: the sections Clover has data for (About, Contents, Search, a Map, the Transcript, Annotations, the Collection), or its clover-tab children, in their order.",
  attributes: {
    layout: {
      description:
        "A row of tabs, one section shown at a time, or the sections stacked as boxes, each opened by its heading.",
      default: "tabs",
    },
    value: {
      description:
        "The tab shown first, by its value; changed later, it shows that tab. The first, by default.",
    },
    "heading-level": {
      description:
        "The level of the boxes' headings (accordion), one under the heading the panel sits beneath; its sections' own headings go a level below.",
      default: "3",
    },
    download: {
      description:
        'About\'s heading offers the downloads, by a Download button that lists them; "false" leaves them out.',
      default: "true",
    },
    languages: {
      description:
        'Where what the resource says of itself comes in several languages, About\'s heading offers them, and the whole clover-root reads in the one chosen. "false" leaves the choice out.',
      default: "true",
    },
    closable: {
      description:
        "A close button in the panel. Closing hands focus back to the control that opens it and hides what that control shows (or the panel itself).",
      default: "false",
    },
    "close-on-escape": {
      description:
        "For a panel over the page: Escape inside it closes it too, and its close button sits at its inner edge.",
      default: "false",
    },
    as: {
      description: "The element to draw: a complementary landmark, or a box.",
      default: "aside",
    },
  },
  events: {
    "clover-value-change": {
      detail: "{ value: string }",
      description: "The reader chose a tab, or opened a box.",
    },
    "clover-close": {
      detail: "Record<string, never>",
      description:
        "The reader closed the panel. Cancel it (preventDefault) to keep it shown.",
    },
  },
};

export const tab: ElementSpec = {
  tag: "clover-tab",
  kind: "config",
  attributes: {
    value: { prop: "value", type: "string" },
    label: { prop: "label", type: "string" },
  },
  slots: ["label"],
};
export const tabDocs: ElementDocs = {
  name: "CloverTabElement",
  description:
    "One tab of the clover-panel it is in: its label, and what it holds, which the panel shows in its section, moved there when the section first opens. It draws nothing itself.",
  attributes: {
    value: {
      description: "What the tab is called by, for the panel's value.",
    },
    label: { description: "What the tab says." },
  },
  slots: {
    label: {
      description:
        "Markup for what the tab says, instead of the label attribute: shown as a copy, so give it no ids.",
    },
  },
};

export const panelToggle: ElementSpec = {
  tag: "clover-panel-toggle",
  kind: "part",
  attributes: { controls: { prop: "controls", type: "string" } },
  events: {
    "clover-open-change": {
      prop: "onOpenChange",
      detail: ["open"],
      cancelable: true,
    },
  },
};
export const panelToggleDocs: ElementDocs = {
  name: "CloverPanelToggleElement",
  description:
    "A button that shows and hides an element, the information panel's or any, by its id: open while it is not hidden. In a clover-body, it is one of the Body's controls; elsewhere, a button where it is.",
  attributes: {
    controls: {
      description: "The id of what it shows and hides.",
    },
  },
  events: {
    "clover-open-change": {
      detail: "{ open: boolean }",
      description:
        "The reader pressed it, to show (open) or hide what it controls. Cancel it (preventDefault) to leave that as it is.",
    },
  },
};

export const split: ElementSpec = {
  tag: "clover-split",
  kind: "part",
  native: true,
  attributes: { "storage-key": { prop: "storageKey", type: "string" } },
};
export const splitDocs: ElementDocs = {
  name: "CloverSplitElement",
  description:
    "Panes side by side, its clover-split-pane children, divided by clover-split-handle bars the reader drags, clicks or moves by keyboard to share the width.",
  attributes: {
    "storage-key": {
      description:
        "Remember the sizes the reader chooses in localStorage under this key, so the layout opens at them next time.",
    },
  },
};

export const splitPane: ElementSpec = {
  tag: "clover-split-pane",
  kind: "part",
  native: true,
  attributes: {
    size: { prop: "size", type: "string" },
    min: { prop: "min", type: "string" },
    max: { prop: "max", type: "string" },
    name: { prop: "name", type: "string" },
  },
};
export const splitPaneDocs: ElementDocs = {
  name: "CloverSplitPaneElement",
  description:
    "One side of a clover-split. One pane beside each handle has a size; the other takes the width that is left.",
  attributes: {
    size: {
      description:
        "Its width to start with: pixels, or a length in px, rem or % of the split.",
    },
    min: { description: "The narrowest it may be." },
    max: { description: "The widest a handle may make it." },
    name: {
      description:
        "The name its size is remembered under (with the split's storage-key). Its place among the panes, by default.",
    },
  },
};

export const splitHandle: ElementSpec = {
  tag: "clover-split-handle",
  kind: "part",
  native: true,
  attributes: {},
};
export const splitHandleDocs: ElementDocs = {
  name: "CloverSplitHandleElement",
  description:
    "The bar between two clover-split-panes, a focusable separator with a grip at its middle: drag it; click or tap it to step the pane through its narrowest, own and widest widths; or move it with the arrow keys, Home and End. Named Resize panels, or by its aria-label.",
  attributes: {},
};
