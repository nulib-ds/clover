// @vitest-environment node
// esbuild, which reads the elements' specs, runs in Node, not jsdom.
import { readSpecs } from "../../packages/clover/build/custom-elements.mjs";
import { namesOf, webNameOf } from "./inline-names.mjs";

/* The specs' first read is some seconds while the other projects run beside it. */
vi.setConfig({ testTimeout: 20_000 });

let names: ReturnType<typeof namesOf>;
beforeAll(async () => {
  names = namesOf((await readSpecs()).SPECS);
});

describe("Clover's names in prose, as web components write them", () => {
  it("writes a part as its element, however React writes it", () => {
    for (const written of [
      "Root",
      "<Root>",
      "Clover.Root",
      "<Clover.Root />",
      "</Clover.Root>",
    ])
      expect(webNameOf(written, names)).toBe("<clover-root>");
    expect(webNameOf("SeeAlso", names)).toBe("<clover-see-also>");
    expect(webNameOf("Viewer", names)).toBe("<clover-viewer>");
  });

  it("writes a prop as its attribute or property, and a callback as its event", () => {
    expect(webNameOf("iiifContent", names)).toBe("iiif-content");
    expect(webNameOf("headingLevel={3}", names)).toBe('heading-level="3"');
    expect(webNameOf('layout="grid"', names)).toBeNull();
    expect(webNameOf("renderValue", names)).toBe(".renderValue");
    expect(webNameOf("onCanvasChange", names)).toBe("clover-canvas-change");
  });

  it("writes a hook as the root's API, and JSX as the element's HTML", () => {
    expect(webNameOf("useNavigation()", names)).toBe(
      "root.clover.navigation()",
    );
    expect(webNameOf("useClover()", names)).toBe("root.clover");
    expect(webNameOf("tableOfContents", names)).toBe("root.clover.contents()");
    expect(webNameOf('<Clover.Items layout="pager" />', names)).toBe(
      '<clover-items layout="pager"></clover-items>',
    );
  });

  it("leaves what the elements have no word for, or write the same", () => {
    for (const written of [
      "Default",
      "Document",
      "Clover",
      "useUniqueId",
      "@nulib/clover",
      "template",
      "options.informationPanel",
      "Manifest",
    ])
      expect(webNameOf(written, names)).toBeNull();
  });
});
