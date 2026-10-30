import DOMPurify from "dompurify";

/**
 * IIIF's limited HTML, and nothing else: the tags and attributes the Presentation API
 * allows in property values (`a`, `b`, `br`, `i`, `img`, `p`, `small`, `span`, `sub`,
 * `sup`), with `http(s):` and `mailto:` links only. Scripts, event handlers, `style`,
 * `aria-*` and `data-*` attributes, SVG, and `javascript:` or `data:` URLs are removed.
 * `lang` and `dir` are kept, so a value can mark a phrase in another language or
 * direction. An image given no `alt` is given an empty one, so it is not read by its file
 * name.
 *
 * Markdown's output (`{ markdown: true }`) may also hold what `markdownToHtml` writes:
 * lists (`ul`, `ol` with `start`, `li`), headings (`role="heading"` with an
 * `aria-level`, 1 to 6), and past 6 the groups their titles name (a `div` with
 * `role="group"`, `aria-labelledby` its title's id, `clover-md-` and a number). IIIF's
 * HTML never may.
 *
 * DOMPurify is about 9 kB gzip, so this module is only ever imported dynamically (see
 * `ui/Markup.tsx`); `build/bundle.test.mjs` keeps it out of the initial chunk.
 *
 * @see https://iiif.io/api/presentation/3.0/#45-html-markup-in-property-values
 */

const TAGS = ["a", "b", "br", "i", "img", "p", "small", "span", "sub", "sup"];
const ATTRIBUTES = ["href", "alt", "src", "height", "width", "lang", "dir"];
// DOMPurify drops an attribute whose value fails the URI pattern below unless it is
// listed as URI-safe, as these values always would; `href` and `src` are still checked.
const URI_SAFE = ["height", "width", "lang", "dir"];
const URI = /^(?:https?|mailto):/i;

const CONFIG = {
  ALLOWED_TAGS: TAGS,
  ALLOWED_ATTR: ATTRIBUTES,
  ADD_URI_SAFE_ATTR: URI_SAFE,
  ALLOWED_URI_REGEXP: URI,
  // Only the attributes listed: DOMPurify otherwise keeps every `aria-*` and `data-*`.
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
};

const MARKDOWN_CONFIG = {
  ...CONFIG,
  ALLOWED_TAGS: [...TAGS, "ul", "ol", "li", "div"],
  ALLOWED_ATTR: [
    ...ATTRIBUTES,
    "role",
    "aria-level",
    "start",
    "id",
    "aria-labelledby",
  ],
  ADD_URI_SAFE_ATTR: [
    ...URI_SAFE,
    "aria-level",
    "start",
    "id",
    "aria-labelledby",
  ],
};

const GROUP_ID = /^clover-md-\d+$/;

/**
 * Markdown's own attributes: on the elements it writes them on, with the values it
 * writes. Any other is removed.
 */
const MARKDOWN_VALUES: Record<string, Array<[string, RegExp]>> = {
  role: [
    ["P", /^heading$/],
    ["DIV", /^group$/],
  ],
  "aria-level": [["P", /^[1-6]$/]],
  start: [["OL", /^\d+$/]],
  id: [["P", GROUP_ID]],
  "aria-labelledby": [["DIV", GROUP_ID]],
};

/**
 * Tags that make a block of their own, as the browser lays them out. Where one IIIF's HTML
 * does not allow is dropped (its words kept, as DOMPurify keeps them), a space holds its
 * place, so its words never run into the next ("Heading" and "emph" as "Headingemph").
 */
const BLOCKS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

/**
 * What the browser's own repair of a malformed value (Cookbook 0007) and the removals
 * leave behind, tidied: an image whose address was removed (nothing to show), and an
 * empty paragraph (a stray `</p>`, which the parser makes one of, or one that held only
 * that image); space runs a dropped block left, to one, and none at either end. Read in
 * an inert `template`, so nothing in it loads or runs.
 */
function tidy(html: string): string {
  if (!html) return html;
  const box = document.createElement("template");
  box.innerHTML = html;
  for (const image of box.content.querySelectorAll("img:not([src])"))
    image.remove();
  for (const paragraph of box.content.querySelectorAll("p"))
    if (!paragraph.textContent?.trim() && !paragraph.querySelector("img, br"))
      paragraph.remove();
  const walker = document.createTreeWalker(box.content, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    node.nodeValue = node.nodeValue!.replace(/[ \t\n\r\f]{2,}/g, " ");
  return box.innerHTML.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, "");
}

export interface SanitizeOptions {
  /** The HTML is `markdownToHtml`'s: its lists and headings are kept. */
  markdown?: boolean;
}

/*
 * Clover's own DOMPurify, so its hook never reaches the page's: `dompurify` is shared
 * with a page that imports it too, and a hook on that copy would strip the page's own
 * roles and relative links.
 */
let purify: ReturnType<typeof DOMPurify> | null = null;

/** Each link's `title`, as given, while its value is sanitized. */
const titles = new WeakMap<Element, string>();

/**
 * The name an image gives the link it is all of: the link's `title`, else the host it
 * goes to; none where the image is not alone in a link (other words name it) or the link
 * goes nowhere.
 */
function nameOfLink(image: Element): string | undefined {
  const link = image.closest("a");
  if (!link?.getAttribute("href")) return undefined;
  const named =
    link.textContent?.trim() ||
    [...link.querySelectorAll("img")].some((other) =>
      other.getAttribute("alt"),
    );
  if (named) return undefined;
  const title = titles.get(link);
  if (title) return title;
  try {
    const url = new URL(link.getAttribute("href")!);
    // A mail link by its address, any other by its host.
    return (url.protocol === "mailto:" ? url.pathname : url.host) || undefined;
  } catch {
    return undefined;
  }
}

function purifier() {
  if (purify) return purify;
  purify = DOMPurify(window);
  // A link's `title`, kept aside before it is dropped, for an image that names the link.
  purify.addHook("uponSanitizeAttribute", (node, data) => {
    if (
      node.nodeName === "A" &&
      data.attrName === "title" &&
      data.attrValue.trim()
    )
      titles.set(node as Element, data.attrValue.trim());
  });
  // A block about to be dropped, its words kept: a space on each side of them.
  purify.addHook("uponSanitizeElement", (node, data) => {
    if (data.allowedTags[data.tagName] || !BLOCKS.has(data.tagName)) return;
    if (node.nodeType !== 1) return;
    (node as Element).prepend(" ");
    (node as Element).append(" ");
  });
  purify.addHook("afterSanitizeAttributes", (node: Element) => {
    /*
     * An image its publisher gave no text alternative (Cookbook 0007: a license badge
     * beside its link) is marked decorative, `alt=""`, rather than read by its file
     * name: Clover cannot know what it shows (Mat, 2026-10-29). An `alt` given is kept.
     * But an image that is all a link holds names the link (Cookbook 0008: the badge as
     * the license's link), so it is never decorative: it takes the link's `title`, the
     * publisher's own words for it (IIIF allows no `title`, which is dropped), else the
     * host the link goes to, so no link is left without a name (WCAG 2.4.4, 4.1.2).
     */
    if (node.nodeName === "IMG" && !node.hasAttribute("alt"))
      node.setAttribute("alt", nameOfLink(node) ?? "");
    // DOMPurify lets `data:` through on images by default; IIIF text has no use for it.
    for (const name of ["src", "href"]) {
      const value = node.getAttribute?.(name);
      if (value && !URI.test(value.trim())) node.removeAttribute(name);
    }
    for (const [name, allowed] of Object.entries(MARKDOWN_VALUES)) {
      const value = node.getAttribute?.(name);
      if (
        value != null &&
        !allowed.some(
          ([tag, pattern]) => node.nodeName === tag && pattern.test(value),
        )
      )
        node.removeAttribute(name);
    }
  });
  return purify;
}

export function sanitizeHTML(
  html: string,
  { markdown = false }: SanitizeOptions = {},
): string {
  if (typeof window === "undefined") return html;
  return tidy(purifier().sanitize(html, markdown ? MARKDOWN_CONFIG : CONFIG));
}
