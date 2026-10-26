import { describe, expect, it } from "vitest";

import { checkLayout, closest, layoutSchema } from "./layout";
import { catalog } from "./catalog";

const errors = (input: unknown) =>
  checkLayout(input).issues.filter((issue) => issue.level === "error");
const notes = (input: unknown) =>
  checkLayout(input).issues.filter((issue) => issue.level === "note");

describe("checkLayout", () => {
  it("takes parts in a Root, reading each prop as its code writes it", () => {
    const checked = checkLayout({
      resource: "https://example.org/manifest.json",
      parts: [
        { part: "Clover.Body", props: { controls: "false" } },
        {
          element: "aside",
          props: { className: "side" },
          children: [{ part: "Items", props: { layout: "Grid" } }],
        },
      ],
    });
    expect(checked.ok).toBe(true);
    expect(checked.layout).toEqual({
      resource: "https://example.org/manifest.json",
      parts: [
        { part: "Body", props: { controls: false } },
        {
          element: "aside",
          props: { className: "side" },
          children: [{ part: "Items", props: { layout: "grid" } }],
        },
      ],
    });
  });

  it("reads an attribute's name as its prop's, and says so", () => {
    const checked = checkLayout({
      parts: [{ part: "Annotations", props: { "heading-level": "4" } }],
    });
    expect(checked.layout).toMatchObject({
      parts: [{ props: { headingLevel: 4 } }],
    });
    expect(checked.issues).toEqual([
      expect.objectContaining({
        level: "note",
        at: "parts[0].props.heading-level",
      }),
    ]);
  });

  it("says what a part or prop it does not know might be, and what there is", () => {
    expect(errors({ parts: [{ part: "Lable" }] })[0].says).toMatch(
      /Did you mean `Label`/,
    );
    const [unknown] = errors({
      parts: [{ part: "Items", props: { layot: 1 } }],
    });
    expect(unknown.says).toMatch(/Did you mean `layout`/);
    expect(unknown.says).toMatch(/Its props: .*thumbnailSize/);
  });

  it("checks each value against its type", () => {
    const found = errors({
      parts: [
        {
          part: "Items",
          props: { layout: "carousel", thumbnailSize: 0, header: "yes" },
        },
      ],
    }).map((issue) => issue.says);
    expect(found).toEqual([
      "Items's `layout` is one of slider, list, grid, pager.",
      "Items's `thumbnailSize` is a number, 1 or more.",
      "Items's `header` is true or false.",
    ]);
  });

  it("keeps a part that needs a Root in one, and a Tab in a Panel", () => {
    expect(errors({ root: false, parts: [{ part: "Body" }] })[0].says).toMatch(
      /outside a Root/,
    );
    expect(errors({ parts: [{ part: "Tab" }] })[0].says).toMatch(
      /Tab sits in Panel/,
    );
    expect(
      errors({
        parts: [
          { part: "Panel", children: [{ part: "Tab", props: { value: "a" } }] },
        ],
      }),
    ).toEqual([]);
  });

  it("notes a prop a part reads only alone, or only in a Root, where it is not", () => {
    expect(
      notes({ parts: [{ part: "Items", props: { headingLevel: 3 } }] }),
    ).toEqual([
      expect.objectContaining({
        says: "Items reads `headingLevel` only alone, outside a Root: here it does nothing.",
      }),
    ]);
    expect(
      notes({
        root: false,
        parts: [{ part: "Items", props: { of: "members" } }],
      }),
    ).toEqual([
      expect.objectContaining({
        says: "Items reads `of` only inside a Root: here it does nothing.",
      }),
    ]);
  });

  it("leaves out what only code gives, saying so", () => {
    const checked = checkLayout({
      parts: [{ part: "Items", props: { renderItem: "x" } }],
    });
    expect(checked.ok).toBe(true);
    expect(checked.layout).toEqual({ parts: [{ part: "Items" }] });
    expect(checked.issues[0].says).toMatch(/Left out `renderItem`/);
  });

  it("takes the Root's iiifContent as the layout's resource", () => {
    const checked = checkLayout({
      root: { iiifContent: "https://example.org/m.json", language: "fr" },
      parts: [{ part: "Label" }],
    });
    expect(checked.layout).toEqual({
      resource: "https://example.org/m.json",
      root: { language: "fr" },
      parts: [{ part: "Label" }],
    });
  });

  it("takes the Viewer in a template, its props the template's and the Viewer's", () => {
    expect(
      checkLayout({
        viewer: { template: "document", props: { panelLayout: "tabs" } },
      }).layout,
    ).toEqual({
      viewer: { template: "Document", props: { panelLayout: "tabs" } },
    });
    expect(checkLayout({ viewer: { template: "Default" } }).layout).toEqual({
      viewer: {},
    });
    expect(
      errors({ viewer: { template: "Document", props: { size: "12rem" } } })[0]
        .says,
    ).toBe("`size` is Gallery's: Document does not read it.");
    expect(errors({ viewer: { template: "Carousel" } })[0].says).toMatch(
      /The templates are Default, Document, Gallery/,
    );
  });

  it("says what a layout is when it is not one", () => {
    expect(errors(null)[0].says).toBe("A layout is an object.");
    expect(errors({})[0].says).toMatch(/Give `parts`/);
    expect(errors({ parts: [{ element: "main" }] })[0].says).toMatch(
      /A layout's own elements are div, section/,
    );
    expect(
      errors({
        parts: [{ element: "div", props: { style: "height: 2px" } }],
      })[0].says,
    ).toMatch(/CSS properties, as React writes them/);
  });
});

describe("closest", () => {
  it("finds a name by its case, a part of it, or a few edits", () => {
    expect(closest("label", ["Label", "Items"])).toBe("Label");
    expect(closest("Collection", ["CollectionSelect"])).toBe(
      "CollectionSelect",
    );
    expect(closest("Sumary", ["Summary", "Metadata"])).toBe("Summary");
    expect(closest("Zebra", ["Summary", "Metadata"])).toBeUndefined();
  });
});

describe("layoutSchema", () => {
  it("lists the catalog's parts and templates for a tool's input", () => {
    const schema = layoutSchema();
    expect(schema.$defs.node.properties.part.enum).toEqual(
      catalog().parts.map((part) => part.name),
    );
    expect(schema.properties.viewer.properties.template.enum).toEqual([
      "Default",
      "Document",
      "Gallery",
    ]);
  });
});
