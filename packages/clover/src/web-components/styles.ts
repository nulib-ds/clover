/** A stylesheet handed to the elements whole: its key, and its CSS. */
export interface StyleRun {
  key: string;
  css: string;
}

export interface ElementAssets {
  /**
   * Stylesheets injected once per document, first, before Clover's own sheets: whole, or
   * in runs, in order, or a loader for them, called the first time an element connects.
   * The build hands none: each of Clover's sheets loads with the code that draws what it
   * styles, and registers itself (`addSheet`). A test hands its own.
   */
  styles?: string | StyleRun[] | (() => Promise<StyleRun[]>);
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
  /** Resolves once the stylesheets handed in whole are in the document. */
  readonly ready: Promise<void>;
  private readonly injected = new Set<string>();

  constructor(
    private readonly doc: Document,
    assets: ElementAssets,
  ) {
    const styles = assets.styles ?? [];
    this.ready = (
      typeof styles === "function"
        ? styles()
        : Promise.resolve(
            typeof styles === "string"
              ? [{ key: "clover", css: styles }]
              : styles,
          )
    ).then((runs) => {
      // In order, each after the one before it, the first first in `<head>`.
      runs.forEach((run, at) =>
        this.inject(
          run.key,
          run.css,
          runs
            .slice(0, at)
            .reverse()
            .map(({ key }) => key),
        ),
      );
    });
    live.add(this);
    sheets.forEach(({ index, css }, key) => this.place(key, index, css));
  }

  /**
   * Put a stylesheet in the document once: first in `<head>`, so the page's own CSS comes
   * after it, or right after the first of `after` (Clover's earlier styles, nearest first)
   * that is there.
   */
  inject(key: string, css: string, after: string[] = []) {
    if (this.injected.has(key)) return;
    this.injected.add(key);
    const style = this.style(key, css);
    const before = after
      .map((earlier) =>
        this.doc.head.querySelector(`style[data-clover="${earlier}"]`),
      )
      .find(Boolean);
    if (before) before.after(style);
    else this.doc.head.prepend(style);
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

/**
 * The document's registry, made the first time any Clover element connects to it, with
 * the assets of the first build to define one (every element comes from one build).
 */
export function stylesFor(doc: Document, assets: ElementAssets): StyleRegistry {
  let registry = registries.get(doc);
  if (!registry)
    registries.set(doc, (registry = new StyleRegistry(doc, assets)));
  return registry;
}
