/** A run of Clover's stylesheet: its CSS, or, for one only some pages need, its loader. */
export interface StyleRun {
  key: string;
  css?: string;
  /** Fetched the first time an element holds a match for `when`. */
  load?: () => Promise<string>;
  /** A selector for what needs the run, in an attribute selector if drawn before it. */
  when?: string;
}

export interface ElementAssets {
  /**
   * Clover's stylesheet, injected once per document: whole, or in its runs, in order, or
   * a loader for them, called the first time an element connects. A run with `load` is
   * put in its place among them once it arrives, so its rules keep their place in the
   * cascade.
   */
  styles: string | StyleRun[] | (() => Promise<StyleRun[]>);
  /** MapLibre's stylesheet, injected the first time a map shows. */
  mapStyles?: () => Promise<string>;
  /** Where MapLibre's worker is served from (the build emits it beside the element). */
  mapWorkerUrl?: string;
}

interface Deferred {
  key: string;
  load: () => Promise<string>;
  when: string;
  after: string[];
}

/**
 * Clover's styles in one document, whichever elements it holds: each run injected once,
 * in order, and the runs only media and maps need loaded the first time an element holds
 * what they style, watched by one observer for the whole document.
 */
export class StyleRegistry {
  /** Resolves once the stylesheet's runs are in the document. */
  readonly ready: Promise<void>;
  private readonly injected = new Set<string>();
  private waiting: Deferred[] = [];
  private marks: string[] = [];
  private observer: MutationObserver | null = null;
  private readonly watched = new Set<Element>();
  private known = false;

  constructor(
    private readonly doc: Document,
    assets: ElementAssets,
  ) {
    const styles = assets.styles;
    this.ready = (
      typeof styles === "function"
        ? styles()
        : Promise.resolve(
            typeof styles === "string"
              ? [{ key: "clover", css: styles }]
              : styles,
          )
    ).then((runs) => this.start(runs, assets));
  }

  private start(runs: StyleRun[], assets: ElementAssets) {
    /** The runs before one, nearest first: where it goes once it arrives. */
    const earlier = (run: StyleRun) =>
      runs
        .slice(0, runs.indexOf(run))
        .reverse()
        .map(({ key }) => key);
    runs.forEach((run) => {
      if (run.css !== undefined) this.inject(run.key, run.css, earlier(run));
    });
    this.waiting = [
      ...runs.flatMap((run) =>
        run.load && run.when
          ? [
              {
                key: run.key,
                load: run.load,
                when: run.when,
                after: earlier(run),
              },
            ]
          : [],
      ),
      ...(assets.mapStyles
        ? [
            {
              key: "maplibre",
              load: assets.mapStyles,
              when: ".clover-geomap",
              after: [],
            },
          ]
        : []),
    ];
    // What is drawn before a run's own code: the attributes its `when` names.
    this.marks = [
      ...new Set(
        this.waiting.flatMap(({ when }) =>
          [...when.matchAll(/\[([\w-]+)/g)].map((match) => match[1]),
        ),
      ),
    ];
    this.known = true;
    // What connected while the runs were on their way.
    [...this.watched].forEach((element) => this.observe(element));
    this.look();
  }

  /**
   * Put a stylesheet in the document once: first in `<head>`, so the page's own CSS comes
   * after it, or right after the first of `after` (Clover's earlier runs, nearest first)
   * that is there.
   */
  inject(key: string, css: string, after: string[] = []) {
    if (this.injected.has(key)) return;
    this.injected.add(key);
    const style = this.doc.createElement("style");
    style.dataset.clover = key;
    style.textContent = css;
    const before = after
      .map((earlier) =>
        this.doc.head.querySelector(`style[data-clover="${earlier}"]`),
      )
      .find(Boolean);
    if (before) before.after(style);
    else this.doc.head.prepend(style);
  }

  /** Watch an element for what the deferred runs style, until every one has loaded. */
  watch(element: Element) {
    if (this.watched.has(element)) return;
    if (this.known && !this.waiting.length) return;
    this.watched.add(element);
    if (!this.known) return;
    this.observe(element);
    this.look();
  }

  /** Stop watching an element that has left the page. */
  unwatch(element: Element) {
    this.watched.delete(element);
  }

  private observe(element: Element) {
    if (!this.waiting.length) return;
    this.observer ??= new MutationObserver(() => this.look());
    this.observer.observe(element, {
      childList: true,
      subtree: true,
      ...(this.marks.length
        ? { attributes: true, attributeFilter: this.marks }
        : {}),
    });
  }

  private look() {
    for (const sheet of [...this.waiting]) {
      const needed = [...this.watched].some(
        (element) => element.isConnected && element.querySelector(sheet.when),
      );
      if (!needed) continue;
      this.waiting.splice(this.waiting.indexOf(sheet), 1);
      void sheet.load().then((css) => this.inject(sheet.key, css, sheet.after));
    }
    if (!this.waiting.length) {
      this.observer?.disconnect();
      this.watched.clear();
    }
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
