import React, {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  handleGestures,
  type HandleActions,
  type Limits,
  type PaneSpec,
  type SplitLength,
  cssLength,
  limitsOf,
  neighbors,
  nextStop,
  readSizes,
  toPixels,
  writeSizes,
} from "../../components/Split/splitting";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { Tip } from "../../ui/Tip";
import type { HostedProps } from "../host";

/*
 * `<clover-split>`, `<clover-split-pane>` and `<clover-split-handle>`
 * (`specs/containers.ts`): the Split's own boxes, so a handle's panes are its siblings,
 * as `SplitHandle`'s are, with nothing of Clover's between them. Each takes the classes,
 * attributes and inline styles `Split`, `SplitPane` and `SplitHandle` give their boxes,
 * and the handle runs the same logic (`components/Split/splitting.ts`).
 */

/** The sizes the reader has given a split's panes, remembered under its key. */
class Sizes {
  sizes: Record<string, number>;
  private readonly listeners = new Set<() => void>();

  constructor(private storageKey?: string) {
    this.sizes = readSizes(storageKey);
  }

  keyed(storageKey?: string) {
    if (storageKey === this.storageKey) return;
    this.storageKey = storageKey;
    this.sizes = readSizes(storageKey);
    this.listeners.forEach((listener) => listener());
  }

  set(key: string, px: number | undefined) {
    const next = { ...this.sizes };
    if (px === undefined) delete next[key];
    else next[key] = Math.round(px);
    this.sizes = next;
    writeSizes(this.storageKey, next);
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

const SIZES = new WeakMap<Element, Sizes>();

/** A split's sizes, made with it (the first of its elements to ask makes them). */
function sizesOf(split: HTMLElement): Sizes {
  let sizes = SIZES.get(split);
  if (!sizes) {
    sizes = new Sizes(split.getAttribute("storage-key") ?? undefined);
    SIZES.set(split, sizes);
  }
  return sizes;
}

const NO_SIZES: Record<string, number> = {};
const unsubscribed = () => () => undefined;

/** The split a pane or a handle is in: its parent. */
const splitOf = (element: HTMLElement) =>
  element.parentElement?.localName === "clover-split"
    ? element.parentElement
    : null;

/** A length as an attribute writes it: a bare number is pixels. */
const lengthOf = (value: string | null | undefined): SplitLength | undefined =>
  value == null || value.trim() === ""
    ? undefined
    : /^\d+(\.\d+)?$/.test(value.trim())
      ? Number(value)
      : value.trim();

/** What each pane of a split asks for, by its key, read from its attributes. */
function specsOf(split: HTMLElement): Record<string, PaneSpec> {
  const specs: Record<string, PaneSpec> = {};
  for (const pane of panesOf(split)) {
    specs[pane.dataset.splitKey ?? ""] = {
      size: lengthOf(pane.getAttribute("size")),
      min: lengthOf(pane.getAttribute("min")),
      max: lengthOf(pane.getAttribute("max")),
    };
  }
  return specs;
}

/** A split's panes, in order: its own `<clover-split-pane>` children. */
const panesOf = (split: Element) =>
  [...split.children].filter(
    (child): child is HTMLElement => child.localName === "clover-split-pane",
  );

/** `<clover-split>`: the row, and the sizes its panes share. */
export function SplitElement({ hosted, props }: HostedProps) {
  const element = hosted.element;
  useLayoutEffect(() => {
    element.classList.add("clover-split");
    return () => element.classList.remove("clover-split");
  }, [element]);
  useLayoutEffect(() => {
    sizesOf(element).keyed(props.storageKey as string | undefined);
  }, [element, props.storageKey]);
  return null;
}

/** `<clover-split-pane>`: one side, at its size or the reader's, within its limits. */
export function SplitPaneElement({ hosted, props }: HostedProps) {
  const element = hosted.element;
  const split = splitOf(element);
  const shared = split ? sizesOf(split) : null;
  const sizes = useSyncExternalStore(
    shared?.subscribe ?? unsubscribed,
    () => shared?.sizes ?? NO_SIZES,
    () => shared?.sizes ?? NO_SIZES,
  );
  const size = lengthOf(props.size as string | undefined);
  const min = lengthOf(props.min as string | undefined);
  const max = lengthOf(props.max as string | undefined);
  const name = props.name as string | undefined;
  // Its key: the given name, or its place among the panes.
  const key = name || String(split ? panesOf(split).indexOf(element) : 0);
  const dragged = sizes[key];

  useLayoutEffect(() => {
    element.classList.add("clover-split-pane");
    return () => element.classList.remove("clover-split-pane");
  }, [element]);
  useLayoutEffect(() => {
    element.dataset.splitKey = key;
    element.toggleAttribute("data-sized", size !== undefined);
    // Its minimum holds in the layout as well as while dragging, as `SplitPane`'s does.
    element.style.minWidth = cssLength(min) ?? "0";
    const width = dragged !== undefined ? `${dragged}px` : cssLength(size);
    if (width) element.style.setProperty("--clover-split-size", width);
    else element.style.removeProperty("--clover-split-size");
    const most = cssLength(max);
    if (most) element.style.setProperty("--clover-split-max", most);
    else element.style.removeProperty("--clover-split-max");
  }, [element, key, size, min, max, dragged]);
  return null;
}

/** The names Clover wrote on handles, told apart from a page's own. */
const WRITTEN = new WeakMap<Element, string>();

/**
 * `<clover-split-handle>`: the bar between two panes, a focusable separator carrying the
 * sized pane's share of the width, named by its `aria-label`, or Clover's "Resize panels",
 * in a popover too. Dragged, clicked or moved by keys, as `SplitHandle` is.
 */
export function SplitHandleElement({ hosted }: HostedProps) {
  const element = hosted.element;
  const { t, langOf } = useCloverTranslation();
  // The page's own name, read before Clover writes one of its own.
  const [named] = useState(() => {
    const given = element.getAttribute("aria-label");
    return given !== null && given !== WRITTEN.get(element) ? given : null;
  });
  const label = named ?? t("splitHandle");

  useLayoutEffect(() => {
    element.classList.add("clover-split-handle");
    element.setAttribute("role", "separator");
    element.setAttribute("aria-orientation", "vertical");
    if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
    return () => element.classList.remove("clover-split-handle");
  }, [element]);
  useLayoutEffect(() => {
    if (named) return;
    element.setAttribute("aria-label", label);
    WRITTEN.set(element, label);
    const lang = langOf("splitHandle");
    if (lang) element.setAttribute("lang", lang);
    else element.removeAttribute("lang");
  }, [element, named, label, langOf]);

  const actions = useRef<HandleActions | null>(null);
  useLayoutEffect(() => {
    const split = splitOf(element);
    if (!split) return;
    const shared = sizesOf(split);
    const percent = (px: number) =>
      Math.round((px / (split.clientWidth || 1)) * 100);
    // The separator's value, for assistive technology.
    const value = (now: number, found: Limits) => {
      element.setAttribute("aria-valuenow", String(percent(now)));
      element.setAttribute("aria-valuemin", String(percent(found.min)));
      element.setAttribute("aria-valuemax", String(percent(found.max)));
    };
    const limits = () => limitsOf(element, split, specsOf(split));
    const resize = (px: number) => {
      const found = limits();
      if (!found) return;
      const clamped = Math.min(found.max, Math.max(found.min, px));
      shared.set(found.key, clamped);
      value(clamped, found);
    };
    actions.current = {
      limits,
      resize,
      step: () => {
        const found = limits();
        if (!found) return;
        const own = toPixels(
          specsOf(split)[found.key]?.size,
          split.clientWidth,
        );
        const next = nextStop(found, own, shared.sizes[found.key]);
        if (!next.own) return resize(next.to);
        // Its own size: the reader's is forgotten, so the pane takes its `size` again.
        shared.set(found.key, undefined);
        value(own!, found);
      },
    };
    const update = () => {
      const found = limits();
      if (found) value(found.sized.getBoundingClientRect().width, found);
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(split);
    const unsubscribe = shared.subscribe(() => requestAnimationFrame(update));

    /*
     * Beside a pane the page hides (its panel shut by its toggle), the handle goes too, as
     * `Default` draws none then: a bar that sizes nothing is no stop for the keyboard. It
     * comes back with the pane, never from a `hidden` of the page's own.
     */
    let hid = false;
    const follow = () => {
      const shut = Boolean(neighbors(element).sized?.hidden);
      if (shut && !element.hidden) {
        element.hidden = hid = true;
      } else if (!shut && hid) {
        hid = false;
        element.hidden = false;
      }
    };
    follow();
    const shown = new MutationObserver(follow);
    shown.observe(split, {
      attributes: true,
      subtree: true,
      attributeFilter: ["hidden"],
    });

    const gestures = handleGestures(
      () => element,
      () => actions.current!,
    );
    const listeners: [string, (event: Event) => void][] = [
      ["pointerdown", (event) => gestures.down(event as PointerEvent)],
      ["pointermove", (event) => gestures.move(event as PointerEvent)],
      ["pointerup", (event) => gestures.up(event as PointerEvent)],
      ["pointercancel", (event) => gestures.up(event as PointerEvent)],
      ["click", (event) => gestures.click(event as MouseEvent)],
      ["keydown", (event) => gestures.key(event as KeyboardEvent)],
    ];
    for (const [type, listener] of listeners)
      element.addEventListener(type, listener);
    return () => {
      for (const [type, listener] of listeners)
        element.removeEventListener(type, listener);
      gestures.dispose();
      observer?.disconnect();
      shown.disconnect();
      unsubscribe();
    };
  }, [element]);

  return <Tip label={label} />;
}
