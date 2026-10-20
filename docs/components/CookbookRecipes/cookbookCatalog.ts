import { cookbookRecipes } from "docs/components/CookbookRecipes/cookbookRecipes";
import { featuredItems } from "docs/components/CookbookRecipes/featuredItems";
import { cookbookSections } from "docs/components/CookbookRecipes/cookbookSections";

export type Status = "yes" | "partial" | "no";

export const recipeBase = "https://iiif.io/api/cookbook/recipe/";

/**
 * Recipes Clover handles only in part, or behind an option, with the reason. Everything else
 * takes its status from `supported` in recipes.json, so the table and the playground's picker
 * cannot disagree.
 */
export const partialNotes: Record<string, string> = {
  "0154-geo-extension": "Map tab; set options.map.enabled",
  "0318-navPlace-navDate": "Place on the Map tab; no chronology navigation",
};

const slugOf = (id: string) => id.split("/recipe/")[1].split("/")[0];

const supportedSlugs = new Set(
  cookbookRecipes
    .filter((recipe) => recipe.supported)
    .map((recipe) => slugOf(recipe.id)),
);

const resourceBySlug = new Map(
  cookbookRecipes.map((recipe) => [slugOf(recipe.id), recipe.resource]),
);

/**
 * Every recipe can be opened, supported or not, so the table can show what Clover does
 * with the ones it does not yet handle. Recipes missing from recipes.json follow the
 * Cookbook's `recipe/<slug>/manifest.json` convention, except where a recipe publishes
 * its resource under another name. `null` marks a recipe with no resource to open.
 */
const resourcePaths: Record<string, string | null> = {
  "0010-book-2-viewing-direction": "manifest-rtl.json",
  "0011-book-3-behavior": "manifest-continuous.json",
  "0030-multi-volume": "collection.json",
  "0040-image-rotation-service": "manifest-service.json",
  "0230-navdate": "navdate-collection.json",
  "0608-mvm-3d": "v4/manifest.json",
  "0253-using-transcript-file": "v4/manifest.json",
  "0232-image-thumbnail-canvas": "manifest-image.json",
  "0068-newspaper": "newspaper_title-collection.json",
  "0318-navPlace-navDate": "collection.json",
  "0231-transcript-meta-recipe": null,
};

/*
 * A recipe's resource: where it publishes it under another name, that name first, since
 * recipes.json (3.x's list) gives `manifest.json` for 0010, 0011, 0030, 0040 and 0230,
 * which are not there; then recipes.json; then the Cookbook's convention.
 */
export const resourceFor = (slug: string): string | undefined => {
  if (slug in resourcePaths) {
    const path = resourcePaths[slug];
    return path ? `${recipeBase}${slug}/${path}` : undefined;
  }
  return resourceBySlug.get(slug) ?? `${recipeBase}${slug}/manifest.json`;
};

export const statusFor = (slug: string): Status =>
  slug in partialNotes ? "partial" : supportedSlugs.has(slug) ? "yes" : "no";

const recipes = cookbookSections.flatMap((section) => section.recipes);

/** Worked out once, at load, rather than on every render. */
export const coverage = {
  total: recipes.length,
  yes: recipes.filter((recipe) => statusFor(recipe.slug) === "yes").length,
  partial: recipes.filter((recipe) => statusFor(recipe.slug) === "partial")
    .length,
};

/*
 * Some recipes reuse another's resource (0466 opens 0001's manifest). The recipe the URL
 * belongs to should name it, so that one wins whatever the order; otherwise the first does.
 */
const titleByResource = new Map<string, string>();
for (const recipe of recipes) {
  const resource = resourceFor(recipe.slug);
  if (!resource) continue;
  if (!titleByResource.has(resource) || resource.includes(`/${recipe.slug}/`)) {
    titleByResource.set(resource, recipe.title);
  }
}

// Featured items have no recipe to own their resource, so they are never contested.
for (const featured of featuredItems) {
  titleByResource.set(featured.resource, featured.title);
}

/** The title of a recipe or featured item, from its resource, or `undefined` for anything else. */
export const demoTitleFor = (resource?: string) =>
  resource ? titleByResource.get(resource) : undefined;
