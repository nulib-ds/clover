import { describe, expect, it } from "vitest";

import { DEFAULT_URL, jsxToHtml } from "docs/lib/jsx-to-html.mjs";
import { DEFAULT_RESOURCE, compose } from "./write";
import { SPECS } from "../../../packages/clover/src/web-components/specs";

const URL = "https://example.org/iiif/manifest.json";

/** A layout's code, which must hold. */
function code(input: unknown, flavor: "react" | "html" = "react") {
  const composed = compose(input, flavor);
  if (!composed.ok) throw new Error(JSON.stringify(composed.issues));
  return composed;
}

/**
 * HTML without the breaks the two writers place apart: inside a tag, and between an empty
 * element's tags.
 */
const flat = (html: string) =>
  html.replace(/\s+/g, " ").replace(/ >/g, ">").replace(/> <\//g, "></").trim();

describe("compose", () => {
  it("writes a layout as a whole module, its resource written out", () => {
    const written = code({
      resource: URL,
      parts: [
        { part: "Body" },
        {
          element: "aside",
          props: { className: "side" },
          children: [
            { part: "Label", props: { as: "h2" } },
            { part: "Items", props: { layout: "grid" } },
          ],
        },
      ],
    });
    expect(written.code).toBe(
      [
        'import * as Clover from "@nulib/clover";',
        'import "@nulib/clover/styles.css";',
        "",
        `<Clover.Root iiifContent="${URL}">`,
        "  <Clover.Body />",
        '  <aside className="side">',
        '    <Clover.Label as="h2" />',
        '    <Clover.Items layout="grid" />',
        "  </aside>",
        "</Clover.Root>;",
      ].join("\n"),
    );
    expect(written.install).toBe("npm install @nulib/clover");
    expect(written.parts.map((part) => part.name)).toEqual([
      "Body",
      "Label",
      "Items",
    ]);
    expect(written.parts[2]).toMatchObject({
      docs: expect.stringMatching(/\/docs\/items$/),
      loads: expect.stringMatching(/^\d+\.\d kB$/),
    });
  });

  it("writes the Viewer in a template, with its imports and its styles", () => {
    const written = code({
      resource: URL,
      viewer: { template: "Document", props: { panelLayout: "tabs" } },
    });
    expect(written.code).toBe(
      [
        'import Viewer from "@nulib/clover";',
        'import { Document } from "@nulib/clover/templates";',
        'import "@nulib/clover/styles.css";',
        'import "@nulib/clover/templates.css";',
        "",
        "<Viewer",
        `  iiifContent="${URL}"`,
        "  template={Document}",
        '  panelLayout="tabs"',
        "/>;",
      ].join("\n"),
    );
    expect(written.template).toMatchObject({
      name: "Document",
      loads: expect.stringMatching(/ kB$/),
    });
  });

  it("imports a part from its own entry point, drawn alone", () => {
    expect(
      code({ resource: URL, root: false, parts: [{ part: "Map" }] }).code,
    ).toBe(
      [
        'import { Map } from "@nulib/clover/map";',
        'import "@nulib/clover/styles.css";',
        "",
        `<Map iiifContent="${URL}" />;`,
      ].join("\n"),
    );
  });

  it("writes HTML as the docs turn React into it", () => {
    const layouts = [
      {
        parts: [
          { part: "Body", props: { controls: false } },
          {
            element: "aside",
            props: { style: { width: 320, overflowY: "auto" } },
            children: [{ part: "Items", props: { layout: "list" } }],
          },
        ],
      },
      {
        root: { language: "fr" },
        parts: [
          {
            part: "Panel",
            children: [
              {
                part: "Tab",
                props: { value: "about", label: "About" },
                children: [{ part: "About" }],
              },
            ],
          },
        ],
      },
      { viewer: { template: "Gallery", props: { size: "12rem" } } },
      { viewer: { props: { items: false, headingLevel: 3 } } },
      { root: false, parts: [{ part: "Map", props: { overlayOpacity: 0.5 } }] },
    ];
    for (const layout of layouts) {
      const turned = jsxToHtml(code(layout).code, { specs: SPECS });
      expect(turned.reason).toBeUndefined();
      expect(flat(code(layout, "html").code)).toBe(flat(turned.html!));
    }
  });

  it("reads, with no resource, the book the docs' examples read", () => {
    expect(DEFAULT_RESOURCE).toBe(DEFAULT_URL);
    expect(code({ parts: [{ part: "Label" }] }).code).toContain(DEFAULT_URL);
  });

  it("gives back what is wrong, and no code, for a layout that does not hold", () => {
    const composed = compose({ parts: [{ part: "Itms" }] });
    expect(composed).toEqual({
      ok: false,
      issues: [
        {
          level: "error",
          at: "parts[0].part",
          says: "Clover has no part `Itms`. Did you mean `Items`?",
        },
      ],
    });
  });
});
