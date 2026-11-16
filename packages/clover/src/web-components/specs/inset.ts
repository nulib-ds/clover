import type { ElementDocs, ElementSpec } from "../spec";

/**
 * `<clover-inset>`: a thumb in a small box, a press on which expands what it is a thumb
 * of, as `<Clover.Inset>` is: the element is the box, its children the thumb (a picture,
 * a `<clover-map navigable="false">`). It needs no root.
 */
export const inset: ElementSpec = {
  tag: "clover-inset",
  kind: "part",
  native: true,
  attributes: {
    label: { prop: "label", type: "string" },
    "label-lang": { prop: "lang", type: "string" },
    "expand-id": { prop: "expandId", type: "string" },
    controls: { prop: "controls", type: "string" },
    expanded: { prop: "expanded", type: "boolean" },
  },
  events: {
    "clover-expand": { prop: "onExpand", detail: [] },
  },
  slots: ["actions"],
};

export const insetDocs: ElementDocs = {
  name: "CloverInsetElement",
  description:
    'A thumb of something larger in a small box, 14rem wide at most, its thumb 10rem tall at most: its children, a picture or a map that is not navigable. A press anywhere on it but a button or link, or its expand button in its top end corner, sends clover-expand; your controls (slot="actions") sit after that button. Expanded, it holds its children as they are, with no box and no buttons, for your styles to lay out. Without a label it is your children alone, with no box and nothing a press does, as its button is how a keyboard makes the same press. Where it sits is yours to say; it is the box, so give it a role and a name (role="group", aria-label) where it needs them.',
  attributes: {
    label: {
      description:
        "What a press does, in words: its expand button's name and Tip (Expand map).",
    },
    "label-lang": {
      description:
        "The language of label, where it is not the page's: on its button alone, never on your thumb, as lang would be.",
    },
    "expand-id": {
      description:
        "Its expand button's id, for focus to follow it as it moves; one of its own by default.",
    },
    controls: {
      description:
        "The id of what it expands, where that is another element (aria-controls on its expand button).",
    },
    expanded: {
      description:
        "Its children as they are, with no box and no buttons, laid out by your styles.",
      default: "false",
    },
  },
  events: {
    "clover-expand": {
      detail: "{}",
      description:
        "A press on it, but on a button or link, or on its expand button: expand what it is a thumb of.",
    },
  },
  slots: {
    actions: {
      description:
        "Your own controls (a Close), moved into its corner after its expand button, and back as it expands.",
    },
  },
};
