/*
 * Parity (WEB-COMPONENTS.md): every part `@nulib/clover` exports is an element too, or is
 * named here with the reason it is not yet, or not at all. A new part fails this until it
 * has its element, or its reason.
 */
import * as parts from "../../parts";
import { DOCS, SPECS } from ".";

/** Parts whose elements are planned, by the phase that brings them. */
const LATER: Record<string, string> = {};

/** Parts that stay inside the others, never elements of their own. */
const NEVER: Record<string, string> = {
  Tip: "a control's popover, inside the parts",
  ReadMore: "inside Summary, which is an element",
};

const kebab = (name: string) =>
  name.replace(
    /[A-Z]/g,
    (letter, at) => `${at ? "-" : ""}${letter.toLowerCase()}`,
  );

describe("Parity between the parts and the elements", () => {
  it("gives every exported part an element, or a reason", () => {
    const tags = new Set(SPECS.map(({ tag }) => tag));
    const components = Object.keys(parts).filter((name) =>
      /^[A-Z][a-z]/.test(name),
    );
    const missing = components.filter(
      (name) =>
        !tags.has(`clover-${kebab(name)}`) && !LATER[name] && !NEVER[name],
    );
    expect(missing).toEqual([]);
    // And no reason outlives its part.
    for (const name of [...Object.keys(LATER), ...Object.keys(NEVER)]) {
      expect(components).toContain(name);
      expect(tags.has(`clover-${kebab(name)}`)).toBe(false);
    }
  });

  it("describes every element's attributes, properties, events and slots", () => {
    const docs = DOCS();
    for (const spec of SPECS) {
      const doc = docs[spec.tag];
      expect(doc, spec.tag).toBeDefined();
      for (const name of Object.keys(spec.attributes)) {
        expect(
          doc.attributes[name]?.description,
          `${spec.tag} ${name}`,
        ).toBeTruthy();
      }
      for (const name of spec.properties ?? []) {
        expect(
          doc.properties?.[name]?.type,
          `${spec.tag} .${name}`,
        ).toBeTruthy();
      }
      for (const name of Object.keys(spec.events ?? {})) {
        expect(doc.events?.[name]?.detail, `${spec.tag} ${name}`).toBeTruthy();
      }
      for (const name of spec.slots ?? []) {
        expect(
          doc.slots?.[name]?.description,
          `${spec.tag} slot ${name}`,
        ).toBeTruthy();
      }
    }
  });
});
