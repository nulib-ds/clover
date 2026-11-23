import { type PartInfo, catalog } from "docs/lib/compose/catalog";

/**
 * How a layout of Clover's parts fits together, a sentence each, for agents:
 * `llms.txt`'s "Compose a layout" (`docs/lib/agents.ts`) and the agent tools' answers
 * (`suggest.ts`). What sits inside what, and what works alone, are read from the catalog,
 * so a part Clover gains is one these name. Composing says the same to a person, in its
 * own words (`content/docs/composing/index.mdx`, "What goes where").
 */

/** Names as a sentence lists them, each as code: "`A`, `B` and `C`". */
const listed = (parts: readonly PartInfo[]) => {
  const names = parts.map((part) => `\`${part.name}\``);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : names.join("");
};

/** The parts that also work alone, outside a Root, each reading a resource of its own. */
export const partsAlone = () =>
  catalog().parts.filter(
    (part) =>
      !part.needsRoot && part.props.some((prop) => prop.prop === "iiifContent"),
  );

export function composeRules(): string[] {
  const { parts } = catalog();
  const alone = partsAlone();
  // What sits inside what: `Tab` in `Panel`, `SplitPane` and `SplitHandle` in `Split`.
  const holders = new Map<string, PartInfo[]>();
  for (const part of parts)
    for (const holder of part.inside ?? [])
      holders.set(holder, [...(holders.get(holder) ?? []), part]);
  const inside = [...holders].map(
    ([holder, held]) =>
      `${listed(held)} ${held.length > 1 ? "go" : "goes"} inside \`${holder}\``,
  );
  return [
    "`Root` loads the IIIF resource given as `iiifContent` (its address, the resource itself, or a content state) and holds the current view. The other parts of a layout go inside it, at any depth, among the page's own elements (`header`, `aside`, `div`…), which lay them out.",
    "`Body` shows the current view, a Canvas, a Timeline or a Scene, as the resource has it. Its height is `--clover-body-height`, 60vh unless the page sets it, or the Body's own `style`.",
    "`Items` lists the views to move between, and `Panel` shows the resource's sections (About, Contents, Search, Annotations…).",
    `${inside.join("; ")}.`,
    "Each primitive shows one IIIF property, the Manifest's, or the current Canvas's with `of` set to `canvas`: `Label`, `Summary`, `Metadata`, `RequiredStatement`, `Rights` and the rest.",
    `${listed(alone)} also work alone, outside a \`Root\`, each given an \`iiifContent\` of its own.`,
    "In React, import the parts as `* as Clover` from `@nulib/clover`, and the styles once, `@nulib/clover/styles.css`. In HTML, the same layout is `<clover-root>` and its elements (`<clover-label>`, `<clover-body>`…), each prop an attribute in kebab case (`iiif-content`), once the page imports `@nulib/clover/web-components`; the elements bring their own styles.",
  ];
}
