import { describe, expect, it } from "vitest";

import {
  type CodeTree,
  type Knob,
  codeLines,
  initialValues,
  knobId,
  knobProps,
  remountKey,
  textOf,
} from "./live-code";

const URL =
  "https://clover.iiif.library.northwestern.edu/mocks/paged/manifest.json";

const code = (
  tree: CodeTree,
  knobs: Knob[],
  values = initialValues(knobs),
) => ({
  react: textOf(codeLines(tree, knobs, values, "react")),
  html: textOf(codeLines(tree, knobs, values, "html")),
});

/** A part in a Root, as the Components pages write it. */
const inRoot = (part: Partial<CodeTree["nodes"][number]>, body = false) => ({
  url: URL,
  nodes: [
    {
      jsx: "Clover.Root",
      html: "clover-root",
      attrs: [{ prop: "iiifContent", attribute: "iiif-content", url: true }],
      children: [
        ...(body
          ? [{ jsx: "Clover.Body", html: "clover-body", attrs: [] }]
          : []),
        { jsx: "", html: "", attrs: [], mark: true, ...part },
      ],
    },
  ],
});

describe("codeLines", () => {
  const knobs: Knob[] = [
    { prop: "controls", value: true },
    { prop: "navigator", value: false },
    { prop: "style.height", value: 320, min: 160, max: 560 },
  ];
  const body = inRoot({
    jsx: "Clover.Body",
    html: "clover-body",
    attrs: [
      { prop: "controls", attribute: "controls", knob: "part:controls" },
      { prop: "navigator", attribute: "navigator", knob: "part:navigator" },
      {
        prop: "style",
        attribute: "style",
        style: [{ name: "height", knob: "part:style.height" }],
      },
    ],
  });

  it("writes a part's knobs a prop a line, in React and in HTML", () => {
    expect(code(body, knobs)).toEqual({
      react: [
        "<Clover.Root iiifContent={url}>",
        "  <Clover.Body",
        "    controls={true}",
        "    navigator={false}",
        "    style={{ height: 320 }}",
        "  />",
        "</Clover.Root>",
      ].join("\n"),
      html: [
        "<clover-root",
        `  iiif-content="${URL}">`,
        "  <clover-body",
        '    controls="true"',
        '    navigator="false"',
        '    style="height: 320px">',
        "  </clover-body>",
        "</clover-root>",
      ].join("\n"),
    });
  });

  it("marks the part's lines, and gives each knob's value its own run", () => {
    const lines = codeLines(body, knobs, initialValues(knobs), "html");
    expect(lines.map((line) => Boolean(line.mark))).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    const live = lines.flatMap((line) => line.tokens).filter((t) => t.knob);
    expect(live.map((token) => [token.knob, token.text])).toEqual([
      ["part:controls", "true"],
      ["part:navigator", "false"],
      ["part:style.height", "320"],
    ]);
  });

  it("keeps a line's breaks as the values change", () => {
    const values = { ...initialValues(knobs), "part:style.height": 160 };
    expect(code(body, knobs, values).react.split("\n")).toHaveLength(7);
  });

  it("shows a knob only while the knob its `when` names allows it", () => {
    const items: Knob[] = [
      { prop: "layout", value: "slider", options: ["slider", "grid"] },
      {
        prop: "style.--clover-items-height",
        value: 8,
        format: "{}rem",
        min: 4,
        max: 16,
        when: { layout: ["slider"] },
      },
      {
        prop: "style.--clover-items-size",
        value: 10,
        format: "{}rem",
        min: 4,
        max: 20,
        when: { layout: ["grid"] },
      },
    ];
    const tree = inRoot(
      {
        jsx: "Clover.Items",
        html: "clover-items",
        attrs: [
          { prop: "layout", attribute: "layout", knob: "part:layout" },
          {
            prop: "style",
            attribute: "style",
            style: [
              {
                name: "--clover-items-height",
                knob: "part:style.--clover-items-height",
              },
              {
                name: "--clover-items-size",
                knob: "part:style.--clover-items-size",
              },
            ],
          },
        ],
      },
      true,
    );
    const grid = { ...initialValues(items), "part:layout": "grid" };
    expect(code(tree, items, grid)).toEqual({
      // Measured with the slider's height too, its props keep their lines.
      react: [
        "<Clover.Root iiifContent={url}>",
        "  <Clover.Body />",
        "  <Clover.Items",
        '    layout="grid"',
        '    style={{ "--clover-items-size": "10rem" }}',
        "  />",
        "</Clover.Root>",
      ].join("\n"),
      html: [
        "<clover-root",
        `  iiif-content="${URL}">`,
        "  <clover-body></clover-body>",
        // At its widest, `"slider"`, the line runs past 80 columns.
        "  <clover-items",
        '    layout="grid"',
        '    style="--clover-items-size: 10rem">',
        "  </clover-items>",
        "</clover-root>",
      ].join("\n"),
    });
    expect(knobProps(items, grid)).toEqual({
      layout: "grid",
      style: { "--clover-items-size": "10rem" },
    });
    // A style with nothing to say is not written.
    const pager = { ...initialValues(items), "part:layout": "pager" };
    expect(code(tree, items, pager).react).toContain(
      '<Clover.Items\n    layout="pager"\n  />',
    );
  });

  it("writes a whole module with its imports, its address and its template", () => {
    const knobs: Knob[] = [
      { prop: "defaultSidebarOpen", value: true, remount: true },
      {
        prop: "panelLayout",
        value: "accordion",
        options: ["accordion", "tabs"],
      },
      { prop: "items", value: "slider", options: ["slider", false] },
    ];
    const tree: CodeTree = {
      url: URL,
      imports: [
        'import Viewer from "@nulib/clover";',
        'import { Document } from "@nulib/clover/templates";',
        'import "@nulib/clover/styles.css";',
      ],
      nodes: [
        {
          jsx: "Viewer",
          html: "clover-viewer",
          attrs: [
            { prop: "iiifContent", attribute: "iiif-content", url: true },
            { prop: "template", attribute: "template", template: "Document" },
            {
              prop: "defaultSidebarOpen",
              attribute: "sidebar-open",
              knob: "part:defaultSidebarOpen",
            },
            {
              prop: "panelLayout",
              attribute: "panel-layout",
              knob: "part:panelLayout",
            },
            { prop: "items", attribute: "items", knob: "part:items" },
          ],
        },
      ],
    };
    const values = { ...initialValues(knobs), "part:items": false };
    expect(code(tree, knobs, values)).toEqual({
      react: [
        'import Viewer from "@nulib/clover";',
        'import { Document } from "@nulib/clover/templates";',
        'import "@nulib/clover/styles.css";',
        "",
        "<Viewer",
        `  iiifContent="${URL}"`,
        "  template={Document}",
        "  defaultSidebarOpen={true}",
        '  panelLayout="accordion"',
        "  items={false}",
        "/>;",
      ].join("\n"),
      html: [
        '<script type="module">',
        '  import "@nulib/clover/web-components";',
        "</script>",
        "",
        "<clover-viewer",
        `  iiif-content="${URL}"`,
        '  template="document"',
        '  sidebar-open="true"',
        '  panel-layout="accordion"',
        '  items="false">',
        "</clover-viewer>",
      ].join("\n"),
    });
    const items = codeLines(tree, knobs, values, "react")
      .flatMap((line) => line.tokens)
      .find((token) => token.knob === "part:items");
    expect(items?.choices).toEqual(['"slider"', "{false}"]);
    expect(remountKey(knobs, values)).toBe("true");
  });

  it("writes a template picked in the code as each flavor names it", () => {
    const knobs: Knob[] = [
      {
        prop: "template",
        value: "Document",
        options: ["Default", "Document", "Gallery"],
      },
    ];
    const tree: CodeTree = {
      url: URL,
      nodes: [
        {
          jsx: "Viewer",
          html: "clover-viewer",
          attrs: [
            {
              prop: "template",
              attribute: "template",
              template: "Document",
              knob: "part:template",
            },
          ],
        },
      ],
    };
    expect(code(tree, knobs)).toEqual({
      react: "<Viewer template={Document} />",
      html: '<clover-viewer template="document"></clover-viewer>',
    });
    const [line] = codeLines(tree, knobs, initialValues(knobs), "react");
    expect(line.tokens.find((token) => token.knob)?.choices).toEqual([
      "Default",
      "Document",
      "Gallery",
    ]);
    expect(code(tree, knobs, { "part:template": "Gallery" }).html).toBe(
      '<clover-viewer template="gallery"></clover-viewer>',
    );
  });

  it("carries a movable part's key on every line it writes, in both flavors", () => {
    const tree: CodeTree = {
      url: URL,
      nodes: [
        {
          jsx: "aside",
          html: "aside",
          attrs: [],
          children: [
            {
              jsx: "Clover.Label",
              html: "clover-label",
              attrs: [{ prop: "as", attribute: "as", value: "h3" }],
              key: "title",
            },
            { jsx: "Clover.Next", html: "clover-next", attrs: [], key: "next" },
          ],
        },
      ],
    };
    for (const flavor of ["react", "html"] as const) {
      const lines = codeLines(tree, [], {}, flavor);
      expect(lines.map((line) => line.part)).toEqual([
        undefined,
        "title",
        "next",
        undefined,
      ]);
    }
  });

  it("breaks a lone style too long for its line, a property a line", () => {
    const knobs: Knob[] = [
      {
        prop: "style.gridTemplateColumns",
        value: 3,
        format: "repeat({}, minmax(0, 1fr))",
        min: 1,
        max: 4,
      },
    ];
    const tree = inRoot({
      jsx: "Clover.Metadata",
      html: "clover-metadata",
      attrs: [
        {
          prop: "style",
          attribute: "style",
          style: [
            { name: "display", value: "grid" },
            {
              name: "gridTemplateColumns",
              knob: "part:style.gridTemplateColumns",
            },
          ],
        },
      ],
    });
    expect(code(tree, knobs).react).toBe(
      [
        "<Clover.Root iiifContent={url}>",
        "  <Clover.Metadata",
        "    style={{",
        '      display: "grid",',
        '      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",',
        "    }}",
        "  />",
        "</Clover.Root>",
      ].join("\n"),
    );
  });

  it("writes data and text as each flavor says them", () => {
    const knobs: Knob[] = [
      { prop: "searchQuery", on: "root", value: "Moskau" },
      {
        prop: "format",
        value: "text/html",
        options: ["text/html", "text/plain"],
      },
    ];
    const tree: CodeTree = {
      url: URL,
      nodes: [
        {
          jsx: "Clover.Value",
          html: "clover-value",
          attrs: [
            {
              prop: "value",
              attribute: "value",
              value: { en: ["<i>Then</i>"] },
            },
            { prop: "format", attribute: "format", knob: "part:format" },
            { prop: "q", attribute: "q", knob: knobId(knobs[0]) },
          ],
        },
      ],
    };
    expect(code(tree, knobs)).toEqual({
      react: [
        "<Clover.Value",
        '  value={{ en: ["<i>Then</i>"] }}',
        '  format="text/html"',
        '  q="Moskau"',
        "/>",
      ].join("\n"),
      html: [
        "<clover-value",
        `  value='{"en":["<i>Then</i>"]}'`,
        '  format="text/html"',
        '  q="Moskau">',
        "</clover-value>",
      ].join("\n"),
    });
  });
});
