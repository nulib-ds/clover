import type React from "react";

import type { HostedProps } from "./host";
import { initCloverI18n } from "./i18n";
import type { AttributeSpec, ElementSpec } from "./spec";
import { stylesFor } from "./styles";

/** What an element draws, loaded the first time one of its kind connects. */
export type LoadPart = () => Promise<React.ComponentType<HostedProps>>;

/*
 * How the elements are shown, before Clover's own styles: a root and the boxes a layout
 * places are blocks, the Split a row, and the Body (`<clover-body>`, or a
 * `<clover-canvas>`, `<clover-timeline>` or `<clover-scene>`) takes its height from
 * `--clover-body-height`, as React's `Body` does, so `style="height: 60vh"` on it sizes
 * it too. A label, and a panel's toggle outside a Body, are no box of their own: what
 * they draw sits in the page as if written there. What an element only reads (a tab, a
 * slot's children), or draws elsewhere (a tip, in its button), is not shown where it is
 * written. Each leaves an element `hidden` hidden, as the browser's own rule does, which
 * an author's rule beats. In `@layer clover`, so any rule of the page's wins.
 */
const ELEMENT_CSS =
  "@layer clover{:is(clover-root,clover-items,clover-viewer,clover-panel,clover-read-more):not([hidden]){display:block}" +
  ":is(clover-body,clover-canvas,clover-timeline,clover-scene):not([hidden]){display:block;height:var(--clover-body-height,60vh)}" +
  "clover-split:not([hidden]){display:flex}" +
  ":is(clover-label,clover-panel-toggle):not([hidden]){display:contents}" +
  "clover-tab,clover-tip,clover-status>[slot]{display:none}}";

/**
 * The host (Preact, and the one tree that draws every element on the page), loaded the
 * first time any element connects: a page's script defines every element, and loads only
 * what it uses.
 */
let host: Promise<typeof import("./host")> | null = null;
let hostModule: typeof import("./host") | null = null;
const loadHost = () =>
  (host ??= import("./host").then((module) => (hostModule = module)));

/** `"false"` as an author might write it: any case, spaces around it. */
const isOff = (value: string) => value.trim().toLowerCase() === "false";

/** An attribute's value as its prop, or `undefined` (with a warning) if it can't be. */
function read(
  value: string | null,
  { type, min }: AttributeSpec,
  complain: (problem: string) => void,
): unknown {
  if (value === null) return undefined;
  if (type === "string") return value;
  if (type === "boolean") return !isOff(value);
  if (type === "number") {
    const number = Number(value);
    if (value.trim() === "" || !Number.isFinite(number)) {
      complain("is not a number");
      return undefined;
    }
    if (min !== undefined && number < min) {
      complain(`is less than ${min}`);
      return undefined;
    }
    return number;
  }
  if (type === "data") {
    // A URL as written; JSON when it opens as JSON does.
    const text = value.trim();
    if (!/^[[{"]/.test(text)) return value;
    try {
      return JSON.parse(text);
    } catch {
      complain("is not JSON");
      return undefined;
    }
  }
  const word = value.trim().toLowerCase();
  if (type.includes(word)) return word === "false" ? false : word;
  complain(`is not ${type.join(", ")}`);
  return undefined;
}

const sameProps = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.is(a[key], b[key]))
  );
};

/**
 * An element that only says something to the element around it (a panel's tab): its
 * attributes are its, and it loads and draws nothing. Its display rule goes in with the
 * others, so it is not shown where it is written.
 */
function defineConfig(spec: ElementSpec) {
  class CloverConfigElement extends HTMLElement {
    static get observedAttributes() {
      return Object.keys(spec.attributes);
    }

    readonly kind = spec.kind;

    connectedCallback() {
      stylesFor(this.ownerDocument).inject("elements", ELEMENT_CSS);
    }
  }
  customElements.define(spec.tag, CloverConfigElement);
}

/**
 * Define an element (once) from its spec: drawn by the page's host, with what `load`
 * gives, the first time one connects.
 */
export function defineElement(spec: ElementSpec, load: LoadPart | undefined) {
  if (typeof customElements === "undefined") return;
  if (customElements.get(spec.tag)) return;
  if (spec.kind === "config" || !load) return defineConfig(spec);
  const kind = spec.kind;
  const properties = spec.properties ?? [];
  const events = Object.entries(spec.events ?? {});
  let Drawn: React.ComponentType<HostedProps> | null = null;
  let loaded: Promise<unknown> | null = null;
  /** Its code and the host, once for every element of the kind. */
  const ready = () =>
    (loaded ??= Promise.all([
      load().then((Component) => (Drawn = Component)),
      loadHost(),
    ]));

  class CloverElement extends HTMLElement {
    static get observedAttributes() {
      return Object.keys(spec.attributes);
    }

    /** Set Clover's interface language, or add strings, for every element on the page. */
    static initCloverI18n = initCloverI18n;

    readonly kind = kind;
    readonly needsRoot = Boolean(spec.needsRoot);
    /** Props set as properties: each wins over its attribute. */
    readonly values: Record<string, unknown> = {};
    /** What its events keep (`keeps`): a Canvas's handle, a root's API. */
    readonly kept: Record<string, unknown> = {};
    private props: Record<string, unknown> = {};
    private readonly listeners = new Set<() => void>();
    /** What has been warned of, so a value is warned of once. */
    readonly warned = new Set<string>();
    /**
     * The part's callbacks, each sending its event from the element, and saying whether
     * the page let it be (false where it canceled it).
     */
    private readonly handlers: Record<string, (...args: unknown[]) => boolean> =
      Object.fromEntries(
        events.map(([type, event]) => [
          event.prop,
          (...args: unknown[]) => {
            // What it keeps goes with its part (null when the part lets it go): no event.
            if (event.keeps) {
              this.kept[event.keeps] = args[0] ?? null;
              if (args[0] == null) return true;
            }
            const detail =
              event.detail === "first"
                ? args[0]
                : Object.fromEntries(
                    event.detail.map((name, index) => [name, args[index]]),
                  );
            // One that keeps something is the element's own, and stays there.
            const sent = new CustomEvent(type, {
              detail,
              bubbles: !event.keeps,
              composed: !event.keeps,
              cancelable: Boolean(event.cancelable),
            });
            const allowed = this.dispatchEvent(sent);
            if (!allowed && event.cancelable) {
              const last = args[args.length - 1] as {
                preventDefault?: () => void;
              };
              last?.preventDefault?.();
            }
            return allowed;
          },
        ]),
      );

    get element(): HTMLElement {
      return this;
    }

    /** What it draws: loaded before it is handed to the host. */
    get Component(): React.ComponentType<HostedProps> {
      return Drawn!;
    }

    getProps = () => this.props;

    subscribe = (listener: () => void) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    };

    connectedCallback() {
      /*
       * Set before the element was defined (its script loads async), a value sits on
       * the element itself and hides the class's accessor: take it, and let the
       * accessor through.
       */
      for (const name of properties) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
        const value = (this as unknown as Record<string, unknown>)[name];
        delete (this as unknown as Record<string, unknown>)[name];
        if (value != null) this.values[name] = value;
      }
      this.update();
      this.warnOfAria();
      stylesFor(this.ownerDocument).inject("elements", ELEMENT_CSS);
      /*
       * Drawn once its code and the host are here, if still on the page. Its sheets came
       * with its code (`addSheet`), so they are in before it draws.
       */
      void ready().then(() => {
        if (this.isConnected)
          hostModule!.hostOf(this.ownerDocument).connect(this);
      });
    }

    disconnectedCallback() {
      // Moved within the page, it connects again at once; only a removal lets it go.
      queueMicrotask(() => {
        if (this.isConnected) return;
        hostModule?.hostOf(this.ownerDocument).disconnect(this);
      });
    }

    attributeChangedCallback() {
      this.update();
    }

    /*
     * The element is a box of the page's, with no role: a name or a role given to it
     * names nothing a reader is told of, and a name on it is not allowed (ARIA 1.2,
     * generic). Clover names what it draws itself; the page's own landmark around an
     * element can name it otherwise. An element that is the part's own box (a Split's
     * handle) is the page's to name.
     */
    private warnOfAria() {
      if (spec.native) return;
      for (const name of ["aria-label", "aria-labelledby", "role"]) {
        if (!this.hasAttribute(name) || this.warned.has(name)) continue;
        this.warned.add(name);
        console.warn(
          `<${spec.tag}>: ${name} names the element, a box no reader is told of; Clover names what it draws itself.`,
        );
      }
    }

    /** Read the props again, and tell the host when they changed. */
    update() {
      const next: Record<string, unknown> = {
        ...this.handlers,
        ...this.values,
      };
      for (const [name, attribute] of Object.entries(spec.attributes)) {
        if (attribute.prop in this.values) continue;
        const raw = this.getAttribute(name);
        const value = read(raw, attribute, (problem) => {
          const said = `${name}=${raw}`;
          if (this.warned.has(said)) return;
          this.warned.add(said);
          console.warn(`<${spec.tag}>: ${name}="${raw}" ${problem}; ignored.`);
        });
        if (value !== undefined) next[attribute.prop] = value;
      }
      if (sameProps(next, this.props)) return;
      this.props = next;
      this.listeners.forEach((listener) => listener());
    }
  }

  for (const name of properties) {
    Object.defineProperty(CloverElement.prototype, name, {
      configurable: true,
      enumerable: true,
      get(this: CloverElement) {
        return name in this.values ? this.values[name] : this.getProps()[name];
      },
      set(this: CloverElement, value: unknown) {
        if (value == null) delete this.values[name];
        else this.values[name] = value;
        this.update();
      },
    });
  }

  // What its events keep, read-only: null until there.
  for (const [, event] of events) {
    if (!event.keeps) continue;
    const name = event.keeps;
    Object.defineProperty(CloverElement.prototype, name, {
      configurable: true,
      enumerable: true,
      get(this: CloverElement) {
        return this.kept[name] ?? null;
      },
    });
  }

  customElements.define(spec.tag, CloverElement);
}
