import DOMPurify from "dompurify";

/**
 * IIIF's limited HTML, and nothing else: the tags and attributes the Presentation API
 * allows in property values (`a`, `b`, `br`, `i`, `img`, `p`, `small`, `span`, `sub`,
 * `sup`), with `http(s):` and `mailto:` links only. Scripts, event handlers, `style`,
 * `aria-*` and `data-*` attributes, SVG, and `javascript:` or `data:` URLs are removed.
 * `lang` and `dir` are kept, so a value can mark a phrase in another language or
 * direction.
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

function purifier() {
  if (purify) return purify;
  purify = DOMPurify(window);
  purify.addHook("afterSanitizeAttributes", (node: Element) => {
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
  return purifier().sanitize(html, markdown ? MARKDOWN_CONFIG : CONFIG);
}
