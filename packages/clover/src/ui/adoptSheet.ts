/**
 * A part sheet that loads with its part's code rather than in styles.css: a recording's,
 * a Scene's, a map's, a vertical slider's (`lazySheets`, `build/clover-sheets.mjs`). The
 * package's build calls this from the modules that draw what the sheet styles, so the
 * sheet is in the page before anything they draw, and a page that draws none of them
 * loads none of it. Package code calls it only for MapLibre's stylesheet
 * (`components/Map/sheet.ts`), and imports no CSS: the docs and the tests take
 * styles.css whole.
 *
 * Adopted, it comes after every stylesheet of the document, as if imported last, which
 * the part sheets cascade alike in (`build/styles.test.mjs`), and a strict CSP allows it.
 * Where a browser cannot adopt one (Safari before 16.4, Firefox before 101), it is a
 * `<style>` at the end of the head, which a strict CSP refuses: a page for those browsers
 * imports the part sheet itself. A page that imports the sheet too (to have it in a
 * server's HTML) gets the same rules twice, in the same order.
 *
 * A page on base.css (`@nulib/clover/base.css`, `build/tiers.mjs`) has every part's
 * structure already and brings its own look, so none of Clover's part sheets is adopted
 * there: base.css says it is in the page (`--clover-stylesheet: base`). MapLibre's is
 * MapLibre's own, and comes all the same.
 */
const adopted = new Set<string>();

export function adoptSheet(name: string, css: string): void {
  if (typeof document === "undefined" || adopted.has(name)) return;
  adopted.add(name);
  if (
    name != "maplibre" &&
    /base/.test(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--clover-stylesheet",
      ),
    )
  )
    return;
  if (
    "adoptedStyleSheets" in document &&
    "replaceSync" in CSSStyleSheet.prototype
  ) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return;
  }
  const style = document.createElement("style");
  style.dataset.clover = name;
  style.textContent = css;
  document.head.append(style);
}
