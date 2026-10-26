import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import docsMenu from "content/docs/_meta";
import primitivesMenu from "content/docs/primitives/_meta";
import { RESOURCES } from "docs/lib/part-demo-resources";
import { CAPABILITIES } from "./capabilities";
import {
  attributeFor,
  capabilities,
  catalog,
  findPart,
  findTemplate,
  partName,
  templateDescriptions,
  templatesOf,
} from "./catalog";
import { SPECS } from "../../../packages/clover/src/web-components/specs";

/*
 * The catalog reads Clover's specs, menus and sizes, so it grows as Clover does. These
 * tests are what keeps the few tables it holds by hand in step: each fails, saying what
 * to add, when Clover gains a part, a template or a page the tables do not know.
 */

const root = path.resolve(__dirname, "../../..");
const source = (file: string) =>
  readFileSync(path.join(root, "packages/clover/src", file), "utf8");

/** A route's page in `content/`: `/docs/items` is `items.mdx` or `items/index.mdx`. */
const pageExists = (route: string) => {
  const file = path.join(root, "content", route.split("#")[0]);
  return existsSync(`${file}.mdx`) || existsSync(path.join(file, "index.mdx"));
};

type Entry = string | { title?: string; type?: string };
const titleOf = (entry: Entry) =>
  typeof entry === "string" ? entry : (entry.title ?? "");

describe("catalog", () => {
  const { parts, templates, viewer, root: rootProps } = catalog();

  it("has a part for every element but the Viewer and the Root", () => {
    expect(parts.map((part) => part.tag).sort()).toEqual(
      SPECS.map((spec) => spec.tag)
        .filter((tag) => tag !== "clover-viewer" && tag !== "clover-root")
        .sort(),
    );
  });

  it("names each part as its entry point exports it", () => {
    const entries: Record<string, string> = {
      "@nulib/clover": source("parts.ts"),
      "@nulib/clover/map": source("map/index.ts"),
    };
    for (const part of parts) {
      // A new entry point gets its source here.
      expect(entries[part.from], part.from).toBeDefined();
      expect(entries[part.from], `${part.name} from ${part.from}`).toMatch(
        new RegExp(
          `\\b(as )?${part.name}\\b[^;]*from|export \\{[^}]*\\b${part.name}\\b`,
        ),
      );
    }
  });

  it("links each part to a page that exists (a new part without a page of its own goes in DOCUMENTED_ON)", () => {
    for (const part of parts) {
      expect(part.docs, part.name).not.toBe("");
      expect(pageExists(part.docs), `${part.name}: ${part.docs}`).toBe(true);
    }
  });

  it("knows every part the docs' Components and Primitives menus list", () => {
    const listed = [
      ...Object.entries(docsMenu as Record<string, Entry>)
        .filter(([key, entry]) => {
          const at = Object.keys(docsMenu).indexOf(key);
          const components = Object.keys(docsMenu).indexOf("--components");
          const after = Object.keys(docsMenu).findIndex(
            (each, index) => index > components && each.startsWith("--"),
          );
          return (
            at > components &&
            at < after &&
            key !== "primitives" &&
            titleOf(entry)
          );
        })
        .map(([, entry]) => titleOf(entry)),
      ...Object.values(primitivesMenu as Record<string, Entry>).map(titleOf),
    ];
    for (const name of listed) expect(findPart(name), name).toBeDefined();
  });

  it("says what each part handles (a new part gets a line in capabilities.ts)", () => {
    for (const part of parts)
      expect(part.capabilities, part.name).not.toHaveLength(0);
  });

  it("gives each property part the IIIF property it reads", () => {
    expect(findPart("RequiredStatement")?.capabilities).toContain(
      "requiredStatement",
    );
    expect(findPart("PartOf")?.capabilities).toContain("partOf");
    expect(findPart("Label")?.capabilities).toEqual(["label"]);
    expect(capabilities().seeAlso.parts).toEqual(["SeeAlso"]);
  });

  it("says where each part only the part around it reads must sit", () => {
    for (const spec of SPECS.filter((each) => each.kind === "config"))
      expect(findPart(partName(spec.tag))?.inside, spec.tag).toBeDefined();
    expect(findPart("Tab")?.inside).toEqual(["Panel"]);
  });

  it("reads each prop from its element's spec", () => {
    const items = findPart("Items")!;
    expect(items.jsx).toBe("Clover.Items");
    expect(items.props.find((prop) => prop.prop === "layout")).toMatchObject({
      attribute: "layout",
      type: ["slider", "list", "grid", "pager"],
      default: "slider",
    });
    expect(items.codeProps).toContain("renderItem");
    expect(findPart("Map")).toMatchObject({
      jsx: "Map",
      from: "@nulib/clover/map",
    });
    expect(rootProps.map((prop) => prop.prop)).toContain("iiifContent");
  });

  it("finds a part by any name its code gives it", () => {
    expect(findPart("Clover.SeeAlso")?.tag).toBe("clover-see-also");
    expect(findPart("clover-split-pane")?.name).toBe("SplitPane");
    expect(findPart("Nothing")).toBeUndefined();
  });

  it("reads the templates from the Viewer's spec, each with its own props", () => {
    expect(templates.map((template) => template.name)).toEqual([
      "Default",
      "Document",
      "Gallery",
    ]);
    for (const template of templates) {
      expect(template.description, template.name).not.toBe("");
      expect(template.loads, template.name).toBeDefined();
    }
    expect(findTemplate("gallery")?.props.map((prop) => prop.prop)).toEqual([
      "size",
    ]);
    expect(findTemplate("Document")?.props.map((prop) => prop.prop)).toContain(
      "defaultSidebarOpen",
    );
    // The Viewer's own: every template reads them.
    expect(viewer.map((prop) => prop.prop)).toContain("headingLevel");
    expect(viewer.map((prop) => prop.prop)).not.toContain("size");
  });

  it("reads a template prop's templates from its description, and only templates", () => {
    const names = ["Default", "Document", "Gallery"];
    expect(templatesOf("Default and Document: whether …", names)).toEqual([
      "Default",
      "Document",
    ]);
    expect(templatesOf("Gallery: the size of a cell.", names)).toEqual([
      "Gallery",
    ]);
    expect(templatesOf("Alone: the header's title.", names)).toBeUndefined();
    expect(templatesOf("The title's level.", names)).toBeUndefined();
    expect(
      templateDescriptions("Default (a), Document (b) or Gallery (c).", names),
    ).toEqual({ Default: "a", Document: "b", Gallery: "c" });
  });

  it("finds the attribute an element reads a prop from", () => {
    expect(attributeFor("clover-items", "headingLevel")).toBe("heading-level");
    expect(attributeFor("clover-root", "defaultCanvasId")).toBe("canvas-id");
    expect(attributeFor("clover-items", "nothing")).toBeUndefined();
  });
});

describe("capabilities", () => {
  it("names only parts Clover has, and samples the docs have", () => {
    for (const [name, capability] of Object.entries(CAPABILITIES)) {
      for (const part of capability.parts)
        expect(findPart(part), `${name}: ${part}`).toBeDefined();
      if ("resource" in capability)
        expect(RESOURCES, name).toHaveProperty(capability.resource);
    }
  });
});
