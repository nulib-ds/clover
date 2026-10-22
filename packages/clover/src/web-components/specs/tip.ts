import type { ElementDocs, ElementSpec } from "../spec";

/**
 * `<clover-tip>`: the popover Clover's own controls show, for a control of the page's, as
 * `<Clover.Tip>` is. It needs no root: written inside a button, it draws there.
 */
export const tip: ElementSpec = {
  tag: "clover-tip",
  kind: "part",
  attributes: {
    label: { prop: "label", type: "string" },
    lang: { prop: "lang", type: "string" },
    keys: { prop: "keys", type: "string" },
    glyph: { prop: "glyph", type: "string" },
  },
  properties: ["shortcut"],
};

export const tipDocs: ElementDocs = {
  name: "CloverTipElement",
  description:
    "The popover Clover's controls show on hover and on keyboard focus, for a control of your own: written inside your button, it shows there its label and its key. Give the button the same name (aria-label) and the key (aria-keyshortcuts): the popover is hidden from assistive technology, which reads the button. The element itself shows nothing.",
  attributes: {
    label: {
      description:
        "Its words: the name the button's aria-label gives, the same (WCAG 2.5.3).",
    },
    lang: {
      description: "The language of label, where it is not the button's.",
    },
    keys: {
      description:
        "The key the button answers to, as aria-keyshortcuts names it (WAI-ARIA key names: Plus, Shift+R).",
    },
    glyph: {
      description: "The key as the popover shows it (⇧R); keys by default.",
    },
  },
  properties: {
    shortcut: {
      type: "{ keys: string; glyph: string } | null",
      description:
        "The key, as Clover.Tip takes it: in place of keys and glyph.",
    },
  },
};
