/*
 * The registry keeps Clover's sheets in the stylesheet's order, whatever order their code
 * arrives in: each by its index, before the page's own.
 */
import { StyleRegistry, addSheet } from "./styles";

const keys = (doc: Document) =>
  [...doc.head.querySelectorAll<HTMLElement>("style[data-clover]")].map(
    (style) => style.dataset.clover,
  );

it("puts each sheet in its place, however late its code comes", () => {
  const doc = document.implementation.createHTMLDocument();
  doc.head.innerHTML = `<style id="page">.page{}</style>`;
  new StyleRegistry(doc);
  addSheet(30, "test/c", ".c{}");
  addSheet(10, "test/a", ".a{}");
  addSheet(20, "test/b", ".b{}");
  addSheet(20, "test/b", ".b{}");
  expect(keys(doc)).toEqual(["test/a", "test/b", "test/c"]);
  // Before the page's own CSS, which comes after Clover's.
  expect(doc.head.lastElementChild?.id).toBe("page");

  // A document's registry made later takes every sheet already brought, in order.
  const later = document.implementation.createHTMLDocument();
  new StyleRegistry(later);
  expect(keys(later)).toEqual(["test/a", "test/b", "test/c"]);
});

it("gives each <style> the nonce the page names", () => {
  const doc = document.implementation.createHTMLDocument();
  const meta = doc.createElement("meta");
  meta.setAttribute("property", "csp-nonce");
  meta.nonce = "n0nce";
  doc.head.append(meta);
  new StyleRegistry(doc);
  const styles = [...doc.head.querySelectorAll("style[data-clover]")];
  expect(styles.length).toBeGreaterThan(0);
  for (const style of styles)
    expect((style as HTMLStyleElement).nonce).toBe("n0nce");
});

/*
 * Where a page's Content Security Policy refuses a `<style>` (it gets no sheet), every
 * sheet is adopted instead, in the same order, first among the page's adopted sheets, and
 * MapLibre's in a layer of its own after Clover's.
 */
it("adopts every sheet, in order, where the page's policy refuses a <style>", () => {
  class Sheet {
    css = "";
    replaceSync(css: string) {
      this.css = css;
    }
  }
  const doc = document.implementation.createHTMLDocument();
  const pages = new Sheet();
  Object.defineProperty(doc, "adoptedStyleSheets", {
    value: [pages],
    writable: true,
  });
  vi.stubGlobal("CSSStyleSheet", Sheet);
  const sheet = Object.getOwnPropertyDescriptor(
    HTMLStyleElement.prototype,
    "sheet",
  );
  Object.defineProperty(HTMLStyleElement.prototype, "sheet", {
    configurable: true,
    get: () => null,
  });
  onTestFinished(() => {
    if (sheet)
      Object.defineProperty(HTMLStyleElement.prototype, "sheet", sheet);
    vi.unstubAllGlobals();
  });
  const registry = new StyleRegistry(doc);
  registry.inject("elements", ".elements{}");
  addSheet(0, "maplibre", ".maplibregl-map{}", true);
  addSheet(25, "test/between", ".between{}");
  expect(doc.head.querySelectorAll("style")).toHaveLength(0);
  const adopted = (doc as unknown as { adoptedStyleSheets: Sheet[] })
    .adoptedStyleSheets;
  expect(adopted.map((each) => each.css)).toEqual([
    ".elements{}",
    "@layer clover,maplibre;@layer maplibre{.maplibregl-map{}}",
    ".a{}",
    ".b{}",
    ".between{}",
    ".c{}",
    "",
  ]);
  expect(adopted.at(-1)).toBe(pages);
});
