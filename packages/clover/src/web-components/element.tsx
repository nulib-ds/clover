import React from "react";
import { type Root as ReactRoot, createRoot } from "react-dom/client";

import { Viewer } from "../components/Viewer/Viewer";
import type { ViewerProps } from "../components/Viewer/Viewer";
import { Default } from "../templates/default/Default";
import { setMapWorkerUrl } from "../core/map-config";
import type { IIIFContent } from "../core/load";
import { initCloverI18n } from "../i18n/config";

/**
 * `<clover-viewer>`: Clover's Viewer as a custom element, for a page with no React of its
 * own. Rendered into the element's light DOM (no shadow root), so the page's CSS still
 * reaches it, as 3.x's element does.
 *
 *   <clover-viewer iiif-content="https://example.org/manifest.json"></clover-viewer>
 *
 * Attributes: `iiif-content`, `canvas-id` (the Canvas to open on), `manifest-id`,
 * `language` (the language to read IIIF text in), `search-query`, `heading-level` (the
 * title's, 2 or more, to fit the page's outline), and `items`, `header`, `panel`,
 * `download` (`"false"` turns one off; `items` also takes `carousel`, `list` or `grid`).
 * The `iiifContent` property takes an object too. Events: `canvaschange`,
 * `manifestchange`, `contentstatechange`, each with its value in `detail`.
 *
 * Clover's own strings follow the page's `<html lang>`, then the reader's browser, as in
 * React. The element is built
 * with its own copy of the translator, so a page sets their language, or adds strings,
 * through it: `initCloverI18n` from the module, or the element's class from a classic
 * script.
 *
 *   customElements.get("clover-viewer").initCloverI18n({ lng: "fr" });
 */

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
   * Clover's stylesheet, injected once per document: whole, or in its runs, in order. A
   * run with `load` is put in its place among them once it arrives, so its rules keep
   * their place in the cascade.
   */
  styles: string | StyleRun[];
  /** MapLibre's stylesheet, injected the first time a map shows. */
  mapStyles?: () => Promise<string>;
  /** Where MapLibre's worker is served from (the build emits it beside the element). */
  mapWorkerUrl?: string;
}

const STRINGS = {
  "iiif-content": "iiifContent",
  "canvas-id": "defaultCanvasId",
  "manifest-id": "manifestId",
  language: "language",
  "search-query": "searchQuery",
} as const;
const SWITCHES = ["header", "panel", "download"] as const;

const injected = new WeakMap<Document, Set<string>>();

/**
 * Put a stylesheet in the document once: first in `<head>`, so the page's own CSS comes
 * after it, or right after the first of `after` (Clover's earlier runs, nearest first)
 * that is there.
 */
function inject(doc: Document, key: string, css: string, after: string[] = []) {
  let done = injected.get(doc);
  if (!done) injected.set(doc, (done = new Set()));
  if (done.has(key)) return;
  done.add(key);
  const style = doc.createElement("style");
  style.dataset.clover = key;
  style.textContent = css;
  const before = after
    .map((earlier) => doc.head.querySelector(`style[data-clover="${earlier}"]`))
    .find(Boolean);
  if (before) before.after(style);
  else doc.head.prepend(style);
}

/** Define `<clover-viewer>` (once), with the assets the build hands it. */
export function defineCloverViewer(assets: ElementAssets): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get("clover-viewer")) return;
  if (assets.mapWorkerUrl) setMapWorkerUrl(assets.mapWorkerUrl);
  const runs: StyleRun[] =
    typeof assets.styles === "string"
      ? [{ key: "clover", css: assets.styles }]
      : assets.styles;
  /** The runs before one, nearest first: where it goes once it arrives. */
  const earlier = (run: StyleRun) =>
    runs
      .slice(0, runs.indexOf(run))
      .reverse()
      .map(({ key }) => key);
  /** What loads with what needs it: the runs only some pages need, and MapLibre's. */
  const deferred = [
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
  const marks = [
    ...new Set(
      deferred.flatMap(({ when }) =>
        [...when.matchAll(/\[([\w-]+)/g)].map((match) => match[1]),
      ),
    ),
  ];

  class CloverViewerElement extends HTMLElement {
    static get observedAttributes() {
      return [...Object.keys(STRINGS), "items", "heading-level", ...SWITCHES];
    }

    /** Set Clover's interface language, or add strings, for every element on the page. */
    static initCloverI18n = initCloverI18n;

    private root: ReactRoot | null = null;
    private content: IIIFContent | null = null;
    private observer: MutationObserver | null = null;

    /** The content to show: a URL, or a IIIF object (which an attribute cannot carry). */
    get iiifContent(): IIIFContent | null {
      return this.content ?? this.getAttribute("iiif-content");
    }
    set iiifContent(value: IIIFContent | null) {
      this.content = value;
      this.update();
    }

    connectedCallback() {
      const doc = this.ownerDocument;
      runs.forEach((run) => {
        if (run.css !== undefined) inject(doc, run.key, run.css, earlier(run));
      });
      this.watchForDeferred();
      this.root ??= createRoot(this);
      this.update();
    }

    disconnectedCallback() {
      // Moved within the page, it reconnects at once; only a removal tears it down.
      queueMicrotask(() => {
        if (this.isConnected) return;
        this.observer?.disconnect();
        this.observer = null;
        this.root?.unmount();
        this.root = null;
      });
    }

    attributeChangedCallback() {
      this.update();
    }

    /** Each deferred stylesheet, the first time what needs it appears in any element. */
    private watchForDeferred() {
      if (this.observer) return;
      const doc = this.ownerDocument;
      const waiting = deferred.filter(
        ({ key }) => !injected.get(doc)?.has(key),
      );
      if (!waiting.length) return;
      const look = () => {
        for (const sheet of [...waiting]) {
          if (!this.querySelector(sheet.when)) continue;
          waiting.splice(waiting.indexOf(sheet), 1);
          void sheet
            .load()
            .then((css) => inject(doc, sheet.key, css, sheet.after));
        }
        if (!waiting.length) this.observer?.disconnect();
      };
      this.observer = new MutationObserver(look);
      this.observer.observe(this, {
        childList: true,
        subtree: true,
        ...(marks.length ? { attributes: true, attributeFilter: marks } : {}),
      });
    }

    private emit(type: string, detail: unknown) {
      this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
    }

    private update() {
      const content = this.iiifContent;
      if (!this.root || !content) return;
      const props: Record<string, unknown> = {};
      for (const [attribute, prop] of Object.entries(STRINGS)) {
        const value = this.getAttribute(attribute);
        if (value) props[prop] = value;
      }
      const items = this.getAttribute("items");
      if (items) props.items = items === "false" ? false : items;
      const level = Number(this.getAttribute("heading-level"));
      // Past 6 the titles name what they head instead (`ui/heading.ts`).
      if (Number.isInteger(level) && level >= 2) props.headingLevel = level;
      for (const name of SWITCHES) {
        if (this.getAttribute(name) === "false") props[name] = false;
      }
      this.root.render(
        <Viewer
          {...(props as Partial<ViewerProps>)}
          // Up front: the element is one build, and always draws Default.
          template={Default}
          iiifContent={content}
          onCanvasChange={(canvasId) => this.emit("canvaschange", { canvasId })}
          onManifestChange={(manifestId) =>
            this.emit("manifestchange", { manifestId })
          }
          onContentStateChange={(state) =>
            this.emit("contentstatechange", state)
          }
        />,
      );
    }
  }

  customElements.define("clover-viewer", CloverViewerElement);
}
