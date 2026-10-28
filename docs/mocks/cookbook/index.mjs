/**
 * The IIIF Cookbook's recipes as one IIIF Collection, curated here (Mat, 2026-10-25: "use
 * a IIIF Collection that we can curate"): each recipe a member, by the resource the
 * Cookbook publishes for it (a Manifest, or a Collection of them), in the Cookbook's
 * order, with its title as the Cookbook writes it, its folder's name on iiif.io
 * ("0047-homepage") as its summary, its thumbnail, and its page there as its homepage.
 *
 * What it lists is read from `recipes.json`, written by `npm run build:cookbook` from
 * iiif.io (`scripts/build-cookbook.mjs`: the recipes on the Cookbook's viewer matrix
 * alone, each one's resource read, its type kept and its thumbnail found). What is curated is here: the Collection's own words, and the
 * recipes it leaves out (`LEFT_OUT`, each with why).
 *
 * Static only: `scripts/build-mocks.mjs` writes it to `public/mocks/cookbook/`,
 * published at https://nulib-ds.github.io/clover/mocks/cookbook/collection.json. The
 * homepage reads it twice: its Viewing field lists the members under "IIIF Cookbook
 * recipes", and its Natural story's select (the same field) lists them alone, each
 * opening in the playground's Viewer. Documented at /docs/mocks.
 */
import source from "./recipes.json";

export const PUBLIC_BASE = "https://nulib-ds.github.io/clover/mocks/cookbook";

const COOKBOOK = "https://iiif.io/api/cookbook/";

/**
 * Recipes left out of the Collection, by slug, each with why. A member is its resource, so
 * a resource is listed once, under the recipe it belongs to.
 */
export const LEFT_OUT = {
  "0466-link-for-loading-manifest":
    "Opens 0001's Manifest: the recipe is about the link that loads it, and the Manifest is listed as 0001.",
  "0599-drag-and-drop":
    "Opens 0006's Manifest: the recipe is about dropping it on a viewer, and the Manifest is listed as 0006.",
};

const en = (text) => ({ en: [text] });

/** A thumbnail's format, where its address says it. */
const formatOf = (address) =>
  /\.png$/i.test(address)
    ? "image/png"
    : /\.jpe?g$/i.test(address)
      ? "image/jpeg"
      : undefined;

/** A recipe as a member: what the Collection says of it, the rest in its resource. */
const member = (recipe) => {
  const format = recipe.thumbnail && formatOf(recipe.thumbnail);
  return {
    id: recipe.resource,
    type: recipe.type,
    label: en(recipe.title),
    // Its folder's name on iiif.io (Mat, 2026-10-25: "named like '0047-homepage'"), a
    // name in no language.
    summary: { none: [recipe.slug] },
    ...(recipe.thumbnail && {
      thumbnail: [
        { id: recipe.thumbnail, type: "Image", ...(format && { format }) },
      ],
    }),
    homepage: [
      {
        id: `${COOKBOOK}recipe/${recipe.slug}/`,
        type: "Text",
        label: en(recipe.title),
        format: "text/html",
        language: ["en"],
      },
    ],
  };
};

export const collection = (base) => ({
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: `${base}/collection.json`,
  type: "Collection",
  label: en("IIIF Cookbook recipes"),
  summary: en(
    "Every recipe on the IIIF Cookbook's viewer matrix, each by the resource it is about.",
  ),
  // No `homepage` of its own: the list would show it as "View all" (Mat, 2026-10-25:
  // "we can remove the view all link"), and the story's words link the Cookbook.
  items: source.recipes
    .filter((recipe) => !(recipe.slug in LEFT_OUT))
    .map(member),
});
