/*
 * Where a page went (AGENTS.md: "URLs that moved"): when Clover 4 became the docs' focus,
 * 3.x moved under /docs/3.x, then /docs/deprecated-versions, and 4.x up from /docs/4.x. A
 * 3.x page whose name 4.x now uses (/docs/viewer, /docs/map, /docs/composing) shows the
 * 4.x page instead, which links back to its 3.x version.
 *
 * Read twice: by the 404 page, which sends any moved path on (`Moved.tsx`), and after the
 * build by `scripts/build-moved-pages.mjs`, which writes a page at each moved path a built
 * page answers for, so the old address answers with a redirect rather than a 404 and a
 * search engine carries its links over (2026-11-22). Plain JavaScript, for both.
 */

/**
 * A page that moved: `from` its old path `to` its new one, with a section's anchor where it
 * is a section now. With `under`, the pages under `from` moved alike, each to its place
 * under `to` (`"only"` where `from` is a page still), but those under `except`, which were
 * never there.
 *
 * @typedef {{ from: string; to: string; under?: true | "only"; except?: string }} Move
 */

/** 3.x's pages at their first addresses, before /docs/3.x. */
const EARLIER_NAMES = [
  "image",
  "scroll",
  "slider",
  "homepage",
  "label",
  "metadata",
  "partOf",
  "rendering",
  "requiredStatement",
  "seeAlso",
  "summary",
  "thumbnail",
  "i18n",
];

/** @type {Move[]} */
export const MOVES = [
  // The earlier versions, at a name that holds the next one too (Mat, 2026-10-30).
  { from: "/docs/3.x", to: "/docs/deprecated-versions", under: true },
  {
    from: "/docs/4.x",
    to: "/docs",
    under: true,
    except: "/docs/deprecated-versions",
  },
  ...EARLIER_NAMES.map(
    /** @returns {Move} */
    (name) => ({
      from: `/docs/${name}`,
      to: `/docs/deprecated-versions/${name}`,
      under: true,
    }),
  ),
  /*
   * Clover 4's demo is the homepage now: its playground opens what `?iiif-content=` names,
   * as the demo page did, and iiif.io's recipe pages link to
   * `/docs/viewer/demo?iiif-content=<manifest>`. The query and the hash go along.
   */
  { from: "/docs/viewer/demo", to: "/" },
  // The templates' page, folded into the Viewer's (Mat, 2026-10-21).
  { from: "/docs/viewer/templates", to: "/docs/viewer#templates" },
  // The 3.x Viewer's own pages: content state, search and prefetched content.
  {
    from: "/docs/viewer",
    to: "/docs/deprecated-versions/viewer",
    under: "only",
  },
  // The component's page, from when the Panel was the InformationPanel.
  { from: "/docs/information-panel", to: "/docs/panel" },
  // Pages folded into others: the templates under the Viewer, the element into Get started.
  { from: "/docs/templates", to: "/docs/viewer#templates" },
  {
    from: "/docs/web-component",
    to: "/docs/composing/glossary#structure-of-project",
  },
  // The Technical overview, folded into the Glossary's end (Mat, 2026-11-05).
  {
    from: "/docs/technical",
    to: "/docs/composing/glossary#structure-of-project",
  },
  // The part that draws the view, when it was Content (Mat, 2026-10-22: now Body).
  { from: "/docs/content", to: "/docs/body" },
  /*
   * The Cookbook's recipes, listed on a page of their own until the homepage listed them
   * (its Viewing field and its Natural story; Mat, 2026-10-25).
   */
  { from: "/docs/cookbook", to: "/" },
];

/**
 * The page moved to from `path` (a section's anchor with it, where it is one), or null.
 *
 * @param {string} path
 * @returns {string | null}
 */
export function movedTo(path) {
  const clean = path.replace(/\/+$/, "") || "/";
  for (const move of MOVES) {
    if (clean === move.from && move.under !== "only") return move.to;
    if (move.under && clean.startsWith(`${move.from}/`))
      return `${move.to}${clean.slice(move.from.length)}`;
  }
  return null;
}

/**
 * Each moved path that a built page answers for, and where it goes: for each move, its
 * own path and, with `under`, each page under its new place at its old one. Never a path
 * that is a page itself, which is no longer moved.
 *
 * @param {readonly string[]} routes The built pages' paths: `/docs/items`.
 * @returns {{ from: string; to: string }[]}
 */
export function movedPages(routes) {
  const built = new Set(routes);
  /** @type {Map<string, string>} */
  const found = new Map();
  for (const move of MOVES) {
    const paths = move.under === "only" ? [] : [move.from];
    if (move.under)
      for (const route of routes) {
        const below = route.startsWith(`${move.to}/`);
        const excepted =
          move.except &&
          (route === move.except || route.startsWith(`${move.except}/`));
        if (below && !excepted)
          paths.push(`${move.from}${route.slice(move.to.length)}`);
      }
    for (const from of paths) {
      if (built.has(from) || found.has(from)) continue;
      const to = movedTo(from);
      if (to && built.has(to.split("#")[0])) found.set(from, to);
    }
  }
  return [...found].map(([from, to]) => ({ from, to }));
}
