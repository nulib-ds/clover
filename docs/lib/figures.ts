import { cookbookSections } from "docs/components/CookbookRecipes/cookbookSections";
import {
  CHECKED,
  progressFor,
} from "docs/components/CookbookRecipes/progress4";
import {
  elementLoads,
  kB,
  partLoads,
  sizes,
  viewerParts,
} from "docs/lib/sizes";

/*
 * The figures the site states about Clover, in one place, each the code's own (AGENTS.md:
 * never write a figure into the copy), for the homepage's stories and for what agents
 * read (`docs/lib/agents.ts`: `llms.txt`, the homepage's structured data), so the two
 * never disagree. The sizes are measured: what a consumer ships, gzipped, as the
 * package's build records it (`packages/clover/build/sizes.json`, from `build/sizes.mjs`).
 * `npm run build:docs` builds the package first, so the published site states the sizes
 * of the commit it was built from; `npm run dev` the last recorded. The parts are the
 * docs' Components menu (`counts.ts`), and the Cookbook's figures its progress record
 * (`progress4.ts`).
 */
export {
  componentCount,
  partCount,
  primitiveCount,
} from "docs/components/Home/counts";

export { elementLoads, kB, partLoads, viewerParts };

/**
 * What a reader's browser loads to its first view, in kB gzipped, for a Canvas, for the
 * Viewer with its Default template, and for pages of web components: each a thing that
 * draws, never the Viewer before its template, which draws nothing on its own (Mat,
 * 2026-10-21), on the plainest resource it reads, an image (Mat, 2026-10-27: "to first
 * view"). React's figures leave out React, and a part's its stylesheet, `styles.css`
 * being every part's (`build/sizes.mjs`).
 */
export const loads = {
  /** A Canvas alone, with an image: its script. */
  canvas: kB(sizes.canvasFirstViewGzip),
  /** The Viewer with its Default template, with an image: its script and styles. */
  defaultTemplate: kB(sizes.defaultTemplateFirstViewGzip),
  /** A page with a `<clover-viewer>`, to first view: the Viewer in its Default template, Preact and the stylesheet. */
  element: kB(sizes.webComponentsGzip),
  /** The web components' script itself: every element defined, none drawn yet. */
  elementsEntry: kB(sizes.elementsEntryGzip),
  /** A page of `<clover-root>` and `<clover-label>` alone, with the stylesheet. */
  labels: kB(sizes.labelPageGzip),
  /** A page with a `<clover-canvas>` alone, once it draws: its renderer loads then. */
  canvasElement: kB(sizes.canvasElementGzip),
  /** A page with a `<clover-viewer>` alone, from its own entry, built whole. */
  viewerEntry: kB(sizes.viewerEntryGzip),
  /** A page with a `<clover-viewer template="document">`: the template and its styles too. */
  documentElement: kB(sizes.documentElementGzip),
};

const recipes = cookbookSections.flatMap((section) => section.recipes);

/** The IIIF Cookbook: its recipes, how many Clover 4 handles, and when that was checked. */
export const cookbook = {
  recipes: recipes.length,
  handled: recipes.filter((recipe) => progressFor(recipe.slug).status === "yes")
    .length,
  inPart: recipes.filter(
    (recipe) => progressFor(recipe.slug).status === "partial",
  ).length,
  checked: new Date(`${CHECKED}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
};
