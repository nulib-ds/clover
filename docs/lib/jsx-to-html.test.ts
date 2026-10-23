import { SPECS } from "../../packages/clover/src/web-components/specs";
import { DEFAULT_URL, jsxToHtml } from "./jsx-to-html.mjs";

const URL = "https://example.org/book.json";
const turn = (code: string, url = URL) =>
  jsxToHtml(code, { specs: SPECS as never, url });

describe("An example's JSX as Clover's elements", () => {
  it("turns each part into its element, each prop into its attribute", () => {
    expect(
      turn(`<Clover.Root iiifContent={url}>
  <Clover.Label as="h2" />
  <Clover.Body />
  <Clover.Items layout="grid" thumbnailSize={200} />
</Clover.Root>`),
    ).toEqual({
      html: `<clover-root iiif-content="${URL}">
  <clover-label as="h2"></clover-label>
  <clover-body></clover-body>
  <clover-items layout="grid" thumbnail-size="200"></clover-items>
</clover-root>`,
    });
  });

  it("leaves out the semicolon that ends the markup as a statement", () => {
    expect(
      turn(`import Viewer from "@nulib/clover";

<Viewer iiifContent={url} />;`).html,
    ).not.toMatch(/;\s*$/);
  });

  it("turns the Viewer, its template and the package's imports into one module script", () => {
    expect(
      turn(`import Viewer from "@nulib/clover";
import { Document } from "@nulib/clover/templates";
import "@nulib/clover/styles.css";

<Viewer iiifContent={url} template={Document} items={false} />`),
    ).toEqual({
      html: `<script type="module">
  import "@nulib/clover/web-components";
</script>

<clover-viewer iiif-content="${URL}" template="document" items="false"></clover-viewer>`,
    });
  });

  it("writes a style object as CSS text, numbers in pixels as React writes them", () => {
    expect(
      turn(
        `<Clover.Body style={{ maxHeight: "20rem", "--clover-body-height": "50vh", width: 300, opacity: 0.5 }} />`,
      ).html,
    ).toBe(
      `<clover-body style="max-height: 20rem; --clover-body-height: 50vh; width: 300px; opacity: 0.5"></clover-body>`,
    );
  });

  it("writes data as JSON, and false, true and text as HTML's attributes do", () => {
    expect(
      turn(
        `<Clover.Metadata value={[{ label: { en: ["Date"] }, value: { en: ["1896"] } }]} />`,
      ).html,
    ).toBe(
      `<clover-metadata value='[{"label":{"en":["Date"]},"value":{"en":["1896"]}}]'></clover-metadata>`,
    );
    expect(turn(`<Clover.Body controls={false} navigator />`).html).toBe(
      `<clover-body controls="false" navigator></clover-body>`,
    );
  });

  it("sets what a property takes from a script, after the markup", () => {
    expect(
      turn(
        `<Clover.Root iiifContent={url} request={{ credentials: "include" }}><Clover.Body /></Clover.Root>`,
      ).html,
    ).toBe(`<clover-root iiif-content="${URL}">
  <clover-body></clover-body>
</clover-root>

<script type="module">
  const root = document.querySelector("clover-root");
  root.request = { credentials: "include" };
</script>`);
  });

  it("keeps the page's markup, and text among elements as React spaces it", () => {
    expect(
      turn(`<Clover.Root iiifContent={url}>
  <p>
    Now showing <Clover.Label of="canvas" />.
  </p>
  {/* A note of the page's own. */}
  <section className="notes" aria-label="Notes"></section>
</Clover.Root>`).html,
    ).toBe(`<clover-root iiif-content="${URL}">
  <p>Now showing <clover-label of="canvas"></clover-label>.</p>
  <section class="notes" aria-label="Notes"></section>
</clover-root>`);
  });

  it("stands {url} in for the Cookbook's book where the frame names no resource", () => {
    expect(
      jsxToHtml(`<Viewer iiifContent={url} />`, { specs: SPECS as never }).html,
    ).toBe(`<clover-viewer iiif-content="${DEFAULT_URL}"></clover-viewer>`);
  });

  it("says why, where HTML cannot say what the JSX does", () => {
    expect(turn(`function Mine() { return <Clover.Label />; }`).reason).toBe(
      "code beside the markup",
    );
    expect(turn(`<MyNotes />`).reason).toMatch(/a component of the page's/);
    expect(
      turn(`<Clover.Items onSelect={(item) => go(item)} />`).reason,
    ).toMatch(/onSelect, a function/);
    expect(turn(`<Clover.Body renderers={renderers} />`).reason).toMatch(
      /not a plain value/,
    );
    expect(
      turn(`<Clover.Transcript aria-label="Transcript" />`).reason,
    ).toMatch(/names the part's own element/);
    expect(turn(`<Clover.Label nonsense="x" />`).reason).toMatch(
      /no attribute or property/,
    );
  });
});
