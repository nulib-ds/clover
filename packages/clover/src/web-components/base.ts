import type React from "react";

import type { HostedProps } from "./host";
import { initCloverI18n } from "./i18n";
import type { AttributeSpec, ElementSpec } from "./spec";
import { type ElementAssets, stylesFor } from "./styles";

/** What an element draws, loaded the first time one of its kind connects. */
export type LoadPart = () => Promise<React.ComponentType<HostedProps>>;

/*
 * How the elements are shown, before Clover's own styles: a root and the boxes a layout
 * places are blocks, and the stage takes its height from `--clover-content-height`, as
 * `Content` does, so `style="height: 60vh"` on it sizes it too. A label is no box of its
 * own: what it draws (a heading, or text in a sentence) sits in the page as if written
 * there. In `@layer clover`, so any rule of the page's wins.
 */
const ELEMENT_CSS =
  "@layer clover{clover-root,clover-items,clover-viewer{display:block}" +
  "clover-content{display:block;height:var(--clover-content-height,60vh)}" +
  "clover-label{display:contents}}";

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
 * Define an element (once) from its spec: drawn by the page's host, with what `load`
 * gives, the first time one connects.
 */
export function defineElement(
  spec: ElementSpec,
  load: LoadPart,
  assets: ElementAssets,
) {
  if (typeof customElements === "undefined") return;
  if (customElements.get(spec.tag)) return;
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

    readonly kind = spec.kind;
    readonly needsRoot = Boolean(spec.needsRoot);
    /** Props set as properties: each wins over its attribute. */
    readonly values: Record<string, unknown> = {};
    private props: Record<string, unknown> = {};
    private readonly listeners = new Set<() => void>();
    /** What has been warned of, so a value is warned of once. */
    private readonly warned = new Set<string>();
    /** The part's callbacks, each sending its event from the element. */
    private readonly handlers: Record<string, (...args: unknown[]) => void> =
      Object.fromEntries(
        events.map(([type, event]) => [
          event.prop,
          (...args: unknown[]) => {
            const detail =
              event.detail === "first"
                ? args[0]
                : Object.fromEntries(
                    event.detail.map((name, index) => [name, args[index]]),
                  );
            const sent = new CustomEvent(type, {
              detail,
              bubbles: true,
              composed: true,
              cancelable: Boolean(event.cancelable),
            });
            if (!this.dispatchEvent(sent) && event.cancelable) {
              const last = args[args.length - 1] as {
                preventDefault?: () => void;
              };
              last?.preventDefault?.();
            }
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
      const styles = stylesFor(this.ownerDocument, assets);
      styles.inject("elements", ELEMENT_CSS);
      // What a root holds is watched with it; anything drawn by itself is watched itself.
      const alone =
        this.kind !== "part" || !this.parentElement?.closest("clover-root");
      if (alone) styles.watch(this);
      // Drawn once its code, the host and the stylesheet are here, if still on the page.
      void Promise.all([ready(), styles.ready]).then(() => {
        if (this.isConnected)
          hostModule!.hostOf(this.ownerDocument).connect(this);
      });
    }

    disconnectedCallback() {
      // Moved within the page, it connects again at once; only a removal lets it go.
      queueMicrotask(() => {
        if (this.isConnected) return;
        stylesFor(this.ownerDocument, assets).unwatch(this);
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
     * element can name it otherwise.
     */
    private warnOfAria() {
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

  customElements.define(spec.tag, CloverElement);
}
