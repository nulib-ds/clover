// @vitest-environment node
// esbuild, which reads the elements' specs, runs in Node, not jsdom.
import { withCodeFlavors } from "./code-flavors.mjs";

/*
 * The first twin reads the elements' specs, through esbuild: some seconds while the other
 * projects run beside it (the package's tests run twice, on React 19 and 18).
 */
vi.setConfig({ testTimeout: 20_000 });

describe("A page's examples in both flavors", () => {
  it("puts each React fence beside its twin, the frame's resource for {url}", async () => {
    const page = [
      "# Items",
      "",
      "<Example>",
      '<PartDemo part="Items" resource="tagging" />',
      "",
      "```jsx",
      "<Clover.Root iiifContent={url}>",
      "  <Clover.Items />",
      "</Clover.Root>",
      "```",
      "",
      "</Example>",
      "",
    ].join("\n");
    const out = await withCodeFlavors(page);
    expect(out).toContain(`<div data-code-flavor="react">

\`\`\`jsx
<Clover.Root iiifContent={url}>
  <Clover.Items />
</Clover.Root>
\`\`\`

</div>`);
    expect(out).toContain(`<div data-code-flavor="web-components">

\`\`\`html
<clover-root
  iiif-content="https://nulib-ds.github.io/clover/mocks/tagging/manifest.json">
  <clover-items></clover-items>
</clover-root>
\`\`\`

</div>`);
    // The rest of the page as written.
    expect(out.startsWith("# Items\n\n<Example>\n")).toBe(true);
  });

  it("takes a twin written by hand, marks React's alone, and leaves what HTML cannot say", async () => {
    const page = [
      "```jsx",
      "<Clover.Label />",
      "```",
      "",
      "```html twin",
      "<clover-label></clover-label>",
      "```",
      "",
      "```jsx react",
      'import "@nulib/clover/styles.css";',
      "```",
      "",
      "```jsx",
      "const t = Clover.useT();",
      "```",
      "",
    ].join("\n");
    const out = await withCodeFlavors(page);
    expect(out.match(/data-code-flavor="web-components"/g)).toHaveLength(1);
    expect(out).toContain("```html\n<clover-label></clover-label>\n```");
    expect(out).not.toContain("html twin");
    expect(out).toContain(
      '<div data-code-flavor="react">\n\n```jsx react\nimport "@nulib/clover/styles.css";\n```\n\n</div>',
    );
    // Hooks stay React's, shown in both.
    expect(out).toContain("\n```jsx\nconst t = Clover.useT();\n```\n");
  });

  it("shows Clover's names in the prose as each flavor writes them, but in a heading", async () => {
    const page =
      "## `Root`\n\nEach part reads from the nearest `Root`, and `Default` stays.\n";
    const out = await withCodeFlavors(page);
    expect(out).toContain(
      '<span data-code-flavor="react">`Root`</span><span data-code-flavor="web-components">`<clover-root>`</span>, and `Default` stays.',
    );
    expect(out.startsWith("## `Root`\n")).toBe(true);
  });

  it("marks the lines a fence marks in its twin, by part and attribute", async () => {
    const page = [
      "<Example>",
      '<PartDemo part="Items" />',
      "",
      "```jsx {3-5}",
      "<Clover.Root iiifContent={url}>",
      "  <Clover.Body />",
      "  <Clover.Items",
      '    layout="pager"',
      "  />",
      "</Clover.Root>",
      "```",
      "",
      "</Example>",
    ].join("\n");
    const out = await withCodeFlavors(page);
    // React's as written; the twin's Items, its opening tag through its attribute.
    expect(out).toContain("```jsx {3-5}");
    expect(out).toMatch(
      /```html \{4\}\n<clover-root[\s\S]*\n {2}<clover-items layout="pager"><\/clover-items>/,
    );
  });

  it("counts a part used twice in order, and marks a closing tag alone", async () => {
    const page = [
      "```jsx {3,5}",
      "<Clover.Root iiifContent={url}>",
      '  <Clover.Label as="h2" />',
      '  <Clover.Label as="p" />',
      "  <Clover.Body />",
      "</Clover.Root>",
      "```",
    ].join("\n");
    const out = await withCodeFlavors(page);
    const html = out.match(/```html (\{[^}]*\})\n([\s\S]*?)\n```/);
    const lines = html?.[2].split("\n") ?? [];
    expect(html?.[1]).toBe(`{4,6}`);
    expect(lines[3]).toContain('<clover-label as="p">');
    expect(lines[5]).toBe("</clover-root>");
  });

  it("keeps a fence's indent, as in a list", async () => {
    const page = "- Item\n\n  ```jsx\n  <Clover.Label />\n  ```\n";
    const out = await withCodeFlavors(page);
    expect(out).toContain("  ```html\n  <clover-label></clover-label>\n  ```");
  });
});
