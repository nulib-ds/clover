import { basePath } from "docs/lib/router";

/** A IIIF Cookbook recipe, as the curated Collection lists it (`docs/mocks/cookbook/`). */
export interface CatalogRecipe {
  slug: string;
  title: string;
  /** Its resource's address, the member's `id`. */
  resource: string;
  /** What its resource is: a Manifest, or a Collection of them. */
  type: "Manifest" | "Collection";
  thumbnail?: string;
}

/** The curated Collection of the Cookbook's recipes, as the docs publish it. */
export const cookbookCollection = () =>
  new URL(`${basePath}/mocks/cookbook/collection.json`, location.origin).href;

const first = (value: unknown) =>
  (Array.isArray(value) ? value[0] : value) as Record<string, any> | undefined;

/** A member of the Collection as a recipe: its slug from its page's address. */
const recipeOf = (member: Record<string, any>): CatalogRecipe | undefined => {
  const page = first(member.homepage)?.id;
  const slug = typeof page === "string" && /\/recipe\/([^/]+)/.exec(page)?.[1];
  const title = first(member.label?.en ?? member.label?.none);
  if (!slug || typeof title !== "string" || typeof member.id !== "string")
    return undefined;
  return {
    slug,
    title,
    resource: member.id,
    type: member.type === "Collection" ? "Collection" : "Manifest",
    thumbnail: first(member.thumbnail)?.id,
  };
};

/*
 * The recipes, read the first time they are asked for, once a page, for the homepage's
 * Viewing field and its Natural story alike, from the Collection itself, so what it
 * lists is what they list. None, where it cannot be read, and asked again next time.
 */
let read: Promise<CatalogRecipe[]> | undefined;
export const readRecipes = () =>
  (read ??= fetch(cookbookCollection())
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((collection) =>
      ((collection.items ?? []) as Record<string, any>[])
        .map(recipeOf)
        .filter((recipe): recipe is CatalogRecipe => Boolean(recipe)),
    )
    .catch(() => {
      read = undefined;
      return [];
    }));

/** The recipe a resource is: the one whose own folder holds it, else the first. */
export const recipeFor = (
  recipes: CatalogRecipe[] | null,
  resource: string | null,
) =>
  (resource &&
    recipes &&
    (recipes.find(
      (r) => r.resource === resource && resource.includes(`/${r.slug}/`),
    ) ??
      recipes.find((r) => r.resource === resource))) ||
  undefined;
