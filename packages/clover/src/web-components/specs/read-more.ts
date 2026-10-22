import type { ElementDocs, ElementSpec } from "../spec";

/**
 * `<clover-read-more>`: "Read more" for text of the page's own that its CSS cuts short, as
 * `<Clover.ReadMore>` is. It needs no root.
 */
export const readMore: ElementSpec = {
  tag: "clover-read-more",
  kind: "part",
  attributes: {},
};

export const readMoreDocs: ElementDocs = {
  name: "CloverReadMoreElement",
  description:
    'Read more, for text of your own: its one child, clamped by your CSS (a -webkit-line-clamp), gets a button under it once the text runs past its box, which opens it in full (aria-expanded) and cuts it short again. While open, the child carries data-read-more="open", which your clamp should leave alone.',
  attributes: {},
};
