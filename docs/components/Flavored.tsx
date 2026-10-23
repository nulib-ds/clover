import React from "react";

/**
 * Something the docs say in each of their flavors, React and web components (the header's
 * switch, `CodeSwitch.tsx`): both are in the page, and its CSS shows the reader's
 * (`data-code-flavor`, `layout.css`), as it shows an example's code. No re-render and no
 * flash when the reader switches, and both are there for agents and pages read without
 * scripts. The hidden one is out of the accessibility tree (`display: none`).
 */
export function Flavored({
  react,
  webComponents,
}: {
  react: React.ReactNode;
  webComponents: React.ReactNode;
}) {
  return (
    <>
      <span data-code-flavor="react">{react}</span>
      <span data-code-flavor="web-components">{webComponents}</span>
    </>
  );
}

/** A part's element, by its name: `SeeAlso` is `clover-see-also`. */
export const elementTag = (name: string) =>
  `clover-${name.replace(/[A-Z]/g, (letter, at) => `${at ? "-" : ""}${letter.toLowerCase()}`)}`;

/** The parts imported on their own, not from `Clover`: `Map`, from `@nulib/clover/map`. */
const OWN_IMPORT = new Set(["Map"]);

/** A part's name as the reader's code writes it: `<Clover.Label />`, or `<clover-label>`. */
export function PartName({ name }: { name: string }) {
  return (
    <Flavored
      react={OWN_IMPORT.has(name) ? `<${name} />` : `<Clover.${name} />`}
      webComponents={`<${elementTag(name)}>`}
    />
  );
}
