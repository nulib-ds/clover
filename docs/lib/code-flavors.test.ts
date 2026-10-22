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

  it("keeps a fence's indent, as in a list", async () => {
    const page = "- Item\n\n  ```jsx\n  <Clover.Label />\n  ```\n";
    const out = await withCodeFlavors(page);
    expect(out).toContain("  ```html\n  <clover-label></clover-label>\n  ```");
  });
});
