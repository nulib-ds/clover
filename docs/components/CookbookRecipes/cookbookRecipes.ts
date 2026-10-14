import cookbookRecipesJson from "docs/fixtures/iiif-cookbook/recipes.json";

export type CookbookRecipeCategory =
  | "Basic"
  | "IIIF Properties"
  | "Structuring Resources"
  | "Image"
  | "Audio/Visual"
  | "Annotation"
  | "Content State";

export interface CookbookRecipe {
  title: string;
  id: string;
  resource: string;
  supported: boolean;
  category: CookbookRecipeCategory[];
}

/**
 * The Cookbook recipes Clover has a manifest for, and whether it handles each one.
 * `supported` is the single source for the coverage table and for the playground's picker.
 */
export const cookbookRecipes = cookbookRecipesJson as CookbookRecipe[];
