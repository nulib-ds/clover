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
const sheets = new Map<string, { index: number; css: string }>();

/** Every document's registry, each given every sheet. */
const live = new Set<StyleRegistry>();

/**
 * One of Clover's sheets, brought by the code that draws what it styles: the elements'
 * build imports it beside that code (`build/clover-sheets.mjs`), so it is in the page
 * before anything the code draws. It goes into every document with a registry, in its
 * place in the cascade (`index`, its place in `src/styles/clover.css`'s order), and into
 * any document's made later.
 */
export function addSheet(index: number, key: string, css: string) {
  if (sheets.has(key)) return;
  sheets.set(key, { index, css });
  for (const registry of live) registry.place(key, index, css);
}

/**
 * Clover's styles in one document, whichever elements it holds: each sheet injected once,
 * as the code that needs it arrives, and kept in the stylesheet's order, so every rule
 * keeps its place in the one `clover` layer. (Not sublayers: a later sublayer would beat
 * an earlier one's more specific rule.)
 */
export class StyleRegistry {
  private readonly injected = new Set<string>();

  constructor(private readonly doc: Document) {
    live.add(this);
    sheets.forEach(({ index, css }, key) => this.place(key, index, css));
  }

  /** Put a stylesheet in the document once, first in `<head>`: the page's own CSS comes after it. */
  inject(key: string, css: string) {
    if (this.injected.has(key)) return;
    this.injected.add(key);
    this.doc.head.prepend(this.style(key, css));
  }

  /**
   * One of Clover's sheets, in its place among them: after the nearest earlier one in the
   * document, or else before the nearest later one, or else after Clover's other styles,
   * first in `<head>`, so the page's own CSS comes after it.
   */
  place(key: string, index: number, css: string) {
    if (this.injected.has(key)) return;
    this.injected.add(key);
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
  }

  private style(key: string, css: string) {
    const style = this.doc.createElement("style");
    style.dataset.clover = key;
    style.textContent = css;
    return style;
  }
}

const registries = new WeakMap<Document, StyleRegistry>();

/** The document's registry, made the first time any Clover element connects to it. */
export function stylesFor(doc: Document): StyleRegistry {
  let registry = registries.get(doc);
  if (!registry) registries.set(doc, (registry = new StyleRegistry(doc)));
  return registry;
}
