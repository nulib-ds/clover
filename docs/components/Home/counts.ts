import docsMenu from "content/docs/_meta";
import primitivesMenu from "content/docs/primitives/_meta";

/*
 * How many parts there are to build with, counted from the docs' Components menu
 * (`content/docs/_meta.ts`), each a page of its own: the components, and the primitives,
 * one per IIIF property (`primitives/_meta.ts`). A part added to the menu is counted.
 */
const menu = Object.entries(docsMenu);
const first = menu.findIndex(([key]) => key === "--components") + 1;
const last = menu.findIndex(
  ([key], index) => index >= first && key.startsWith("--"),
);
const listed = menu
  .slice(first, last < 0 ? undefined : last)
  .filter(
    ([, entry]) => !(typeof entry === "object" && entry && "display" in entry),
  )
  .map(([key]) => key);

/** A menu entry's title: the part's name, as it is written after `Clover.`. */
const titleOf = (entry: unknown) =>
  typeof entry === "string"
    ? entry
    : String((entry as { title?: unknown })?.title ?? "");

export const componentNames = listed
  .filter((key) => key !== "primitives")
  .map((key) => titleOf((docsMenu as Record<string, unknown>)[key]));
export const primitiveNames = Object.values(primitivesMenu).map(titleOf);

export const primitiveCount = primitiveNames.length;
export const componentCount = componentNames.length;
/** Every part a template is made of, components and primitives together. */
export const partCount = componentCount + primitiveCount;
