/**
 * What a live example's demo carries, and only its demo, never the code under it. The
 * sample IIIF material it shows (a resource's label, metadata, images) is not what the
 * docs are about (Mat, 2026-10-25: "we want to make sure that the important content
 * retrieved from the page is the documentation for the Clover app and its marketing
 * material -- NOT THE the rich material being using for examples"), but it stays there
 * for everyone, said to be an example (Mat, 2026-10-25: "make sure that the examples are
 * accessible, but that they are accurately described as examples. we want these examples
 * to remain helpful for agents aiding users").
 *
 * - `data-example`: the docs' own mark. The agents' Markdown quotes what it holds under
 *   "Example" (`scripts/build-agent-docs.mjs`), and `llms.txt` says what it means.
 * - `data-nosnippet`: kept out of search engines' snippets (Google reads it on a `div`,
 *   a `span` or a `section` only, so it goes on one of those).
 * - `data-pagefind-ignore="all"`: out of the docs' own search.
 * - Given a `name`, a group so named ("Example"), so a screen reader, and an agent reading
 *   the page's accessibility tree, meets it as an example. Left out where the demo has a
 *   name of its own (the homepage's "Example Viewer") or sits in a named example already,
 *   or is a control (the playground's select).
 *
 * Spread it on the demo's own element: `<div className={styles.preview} {...example("Example")}>`.
 */
export const example = (name?: string) => ({
  "data-example": "",
  "data-nosnippet": "",
  "data-pagefind-ignore": "all",
  ...(name && { role: "group", "aria-label": name }),
});

/** The name an example goes by, for a screen reader and an agent alike. */
export const EXAMPLE = "Example";
