/**
 * What the build hands the elements. Not stylesheets: each of Clover's sheets loads with
 * the code that draws what it styles, and registers itself (`addSheet`); a page's own CSS,
 * after them, outranks the `clover` layer they are in.
 */
export interface ElementAssets {
  /** Where MapLibre's worker is served from (the build emits it beside the element). */
  mapWorkerUrl?: string;
}

/** Clover's sheets as their code has brought them, by key: each one's place, and CSS. */
const sheets = new Map<
  string,
  { index: number; css: string; unlayered: boolean }
>();

/** Every document's registry, each given every sheet. */
const live = new Set<StyleRegistry>();

/**
 * One of Clover's sheets, brought by the code that draws what it styles: the elements'
 * build imports it beside that code (`build/clover-sheets.mjs`), so it is in the page
 * before anything the code draws. It goes into every document with a registry, in its
 * place in the cascade (`index`, its place in `src/styles/clover.css`'s order), and into
 * any document's made later. `unlayered`: outside the `clover` layer, as MapLibre's ships,
 * and so in a layer of its own where the document adopts it (`adoptable`).
 */
export function addSheet(
  index: number,
  key: string,
  css: string,
  unlayered = false,
) {
  if (sheets.has(key)) return;
  sheets.set(key, { index, css, unlayered });
  for (const registry of live) registry.place(key, index, css, unlayered);
}

/**
 * A sheet outside the `clover` layer (MapLibre's, as it ships), as the document adopts it:
 * in a layer of its own after Clover's, so the page's own rules still outrank it.
 */
const adoptable = (css: string) =>
  `@layer clover,maplibre;@layer maplibre{${css}}`;

/**
 * The nonce a page's Content Security Policy gives the styles Clover writes, where the
 * page names one: on `<meta property="csp-nonce">` (as Vite writes it), else its
 * scripts' own. Empty where it names none.
 */
function cspNonce(doc: Document): string {
  return (
    doc.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce ||
    doc.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ||
    ""
  );
}

/**
 * Clover's styles in one document, whichever elements it holds: each sheet injected once,
 * as the code that needs it arrives, and kept in the stylesheet's order, so every rule
 * keeps its place in the one `clover` layer. (Not sublayers: a later sublayer would beat
 * an earlier one's more specific rule.)
 *
 * Each is a `<style>`, first in `<head>`, so the page's own CSS comes after it, with the
 * page's nonce where it names one (`cspNonce`). Where its Content Security Policy refuses
 * a `<style>` all the same (`style-src` without `'unsafe-inline'`), the document adopts
 * every sheet instead, in the same order, first among its adopted sheets: after the
 * page's own stylesheets, which a page's own layers then follow (a page that wants them
 * over Clover's names `clover` first, `@layer clover;`), and MapLibre's in a layer of its
 * own after Clover's, so the page's rules still outrank it.
 *
 * A page with base.css (`@nulib/clover/base.css`, `build/tiers.mjs`) gets none of
 * Clover's sheets: base.css holds every part's structure, and the page brings its own
 * look. The elements' own display rules (`inject`) and MapLibre's sheet come all the same.
 */
export class StyleRegistry {
  private readonly injected = new Set<string>();
  /** The sheets outside the `clover` layer (`addSheet`'s `unlayered`). */
  private readonly unlayered = new Set<string>();
  private readonly nonce: string;
  /** Clover's sheets, adopted, in their order, once the page's policy refuses a `<style>`. */
  private adopted: { index: number; sheet: CSSStyleSheet }[] | null = null;
  /**
   * Whether the page has base.css, which marks the page's root (`--clover-stylesheet:
   * base`), as `ui/adoptSheet.ts` reads it too. Read once, as the first of Clover's sheets
   * would go in: a page links base.css before the elements' script, which waits for the
   * page's stylesheets, so it is there by then.
   */
  private base?: boolean;

  constructor(private readonly doc: Document) {
    this.nonce = cspNonce(doc);
    live.add(this);
    sheets.forEach(({ index, css, unlayered }, key) =>
      this.place(key, index, css, unlayered),
    );
  }

  /** Put a stylesheet in the document once, first in `<head>`: the page's own CSS comes after it. */
  inject(key: string, css: string) {
    if (this.injected.has(key)) return;
    this.injected.add(key);
    if (this.adopted) return this.adopt(-1, key, css);
    const style = this.style(key, css);
    this.doc.head.prepend(style);
    this.check(style);
  }

  /**
   * One of Clover's sheets, in its place among them: after the nearest earlier one in the
   * document, or else before the nearest later one, or else after Clover's other styles,
   * first in `<head>`, so the page's own CSS comes after it.
   */
  place(key: string, index: number, css: string, unlayered = false) {
    if (this.injected.has(key)) return;
    if (
      !unlayered &&
      (this.base ??= /base/.test(
        getComputedStyle(this.doc.documentElement).getPropertyValue(
          "--clover-stylesheet",
        ),
      ))
    )
      return;
    this.injected.add(key);
    if (unlayered) this.unlayered.add(key);
    if (this.adopted) return this.adopt(index, key, css);
    const style = this.style(key, css);
    style.dataset.cloverIndex = String(index);
    const placed = [
      ...this.doc.head.querySelectorAll<HTMLStyleElement>(
        "style[data-clover-index]",
      ),
    ];
    const earlier = placed
      .filter((each) => Number(each.dataset.cloverIndex) < index)
      .at(-1);
    const later = placed.find(
      (each) => Number(each.dataset.cloverIndex) > index,
    );
    const ours = this.doc.head.querySelectorAll("style[data-clover]");
    if (earlier) earlier.after(style);
    else if (later) later.before(style);
    else if (ours.length) ours[ours.length - 1].after(style);
    else this.doc.head.prepend(style);
    this.check(style);
  }

  private style(key: string, css: string) {
    const style = this.doc.createElement("style");
    style.dataset.clover = key;
    if (this.nonce) style.nonce = this.nonce;
    style.textContent = css;
    return style;
  }

  /**
   * A `<style>` the page's policy refused has no sheet: from then on, every sheet is
   * adopted, those already written first, and the refused `<style>`s go.
   */
  private check(style: HTMLStyleElement) {
    if (style.sheet || !("adoptedStyleSheets" in this.doc)) return;
    this.adopted = [];
    for (const each of this.doc.head.querySelectorAll<HTMLStyleElement>(
      "style[data-clover]",
    )) {
      // The elements' own (`inject`), first, has no index.
      this.adopt(
        Number(each.dataset.cloverIndex ?? -1),
        each.dataset.clover ?? "",
        each.textContent ?? "",
      );
      each.remove();
    }
  }

  private adopt(index: number, key: string, css: string) {
    const view = this.doc.defaultView ?? window;
    const sheet = new view.CSSStyleSheet();
    sheet.replaceSync(this.unlayered.has(key) ? adoptable(css) : css);
    const adopted = this.adopted!;
    const at = adopted.findIndex((each) => each.index > index);
    adopted.splice(at === -1 ? adopted.length : at, 0, { index, sheet });
    const ours = new Set(adopted.map((each) => each.sheet));
    this.doc.adoptedStyleSheets = [
      ...adopted.map((each) => each.sheet),
      ...this.doc.adoptedStyleSheets.filter((each) => !ours.has(each)),
    ];
  }
}

const registries = new WeakMap<Document, StyleRegistry>();

/** The document's registry, made the first time any Clover element connects to it. */
export function stylesFor(doc: Document): StyleRegistry {
  let registry = registries.get(doc);
  if (!registry) registries.set(doc, (registry = new StyleRegistry(doc)));
  return registry;
}
