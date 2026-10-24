import { useSyncExternalStore } from "react";

import { hexToHueSaturation } from "docs/components/Playground/playground-config";
import { fontPresets } from "docs/lib/preview-fonts";

/**
 * Site-level theme overrides: accent color and font family.
 *
 * These are not preview controls. They exist to demonstrate the thing that makes Clover
 * themeable — components read CSS custom properties from whatever contains them — so the
 * values are set on the document root rather than on a wrapper around the preview, and
 * they outlive the playground when a reader navigates into the docs.
 *
 * That means the state cannot live in React alone. It is applied to `documentElement`,
 * persisted, and restored on a cold load of any page by `pages/_app.tsx`.
 *
 * What each override touches:
 *
 *  - **Accent** sets `--accent-9`, the single literal in the docs accent scale. Every
 *    other step is mixed from it in `tokens.css`, and `--clover-color-accent` maps to it,
 *    so this one property retints both the docs' frame and any rendered component. It
 *    also sets `--nextra-primary-hue` / `--nextra-primary-saturation`, which Nextra
 *    composes its own primary colors from in `hsl()` — it takes hue and saturation as
 *    variables and bakes lightness into each utility, so handing it H and S shifts the
 *    whole family while leaving Nextra's light/dark contrast choices intact.
 *  - **Font** sets `--font-sans`, the site's own family, so the whole website changes —
 *    prose, the frame and headings, which follow it through `--font-display`. Clover is
 *    not named anywhere in this: its components inherit their type from whatever contains
 *    them, so retypesetting the page retypesets them for free. That is the demonstration.
 */

const ACCENT_KEY = "clover-docs-accent";
const FONT_KEY = "clover-docs-font";

/*
 * The site's own family, not a Clover property — there is no Clover font property. `html,
 * body` reads this, and `--font-display` is declared as `var(--font-sans)`, so one
 * declaration retypesets prose, headings and the frame alike, and anything inheriting
 * from them.
 */
const FONT_PROPERTIES = ["--font-sans"];

const ACCENT_PROPERTIES = [
  "--accent-9",
  "--nextra-primary-hue",
  "--nextra-primary-saturation",
];

/**
 * The accent may be any hex, not just a preset — the picker allows arbitrary colors. A
 * hex cannot carry a CSS declaration, so validating the shape is the whole guard needed
 * against a poisoned `localStorage` entry.
 */
const isHexColor = (value: string) =>
  /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

/**
 * Only values we published are accepted. A font family becomes a CSS declaration, so
 * matching against the preset list keeps a poisoned `localStorage` entry from turning
 * into arbitrary CSS.
 */
const isKnownFont = (value: string) =>
  fontPresets.some((preset) => preset.value === value && preset.value !== "");

/**
 * Expands `#abc` to `#aabbcc`, leaving anything else alone.
 *
 * Accents are kept in the six-digit form everywhere, because `<input type="color">`
 * accepts only `#rrggbb`. Handing it three digits makes its value invalid, and the
 * control then emits a change of its own — which read as the accent spontaneously
 * resetting while a hex was being typed.
 */
export const normalizeHex = (value: string): string =>
  /^#[0-9a-f]{3}$/i.test(value)
    ? `#${value
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")}`
    : value;

export interface PageTheme {
  accent: string;
  font: string;
}

/** Applies both overrides to the document root, clearing whichever is empty. */
export const applyPageTheme = (theme: Partial<PageTheme>) => {
  if (typeof document === "undefined") return;
  applyTo(document.documentElement, theme);
};

/** Applies both overrides to one element (the root, or a preview's), clearing either if empty. */
const applyTo = (root: HTMLElement, { accent, font }: Partial<PageTheme>) => {
  if (accent !== undefined) {
    if (accent && isHexColor(accent)) {
      const { hue, saturation } = hexToHueSaturation(accent);
      root.style.setProperty("--accent-9", accent);
      root.style.setProperty("--nextra-primary-hue", `${hue}deg`);
      root.style.setProperty("--nextra-primary-saturation", `${saturation}%`);
    } else {
      ACCENT_PROPERTIES.forEach((prop) => root.style.removeProperty(prop));
    }
  }

  if (font !== undefined) {
    if (font && isKnownFont(font)) {
      FONT_PROPERTIES.forEach((prop) => root.style.setProperty(prop, font));
    } else {
      FONT_PROPERTIES.forEach((prop) => root.style.removeProperty(prop));
    }
  }
};

export const storePageTheme = ({ accent, font }: Partial<PageTheme>) => {
  try {
    if (accent !== undefined) {
      if (accent) localStorage.setItem(ACCENT_KEY, accent);
      else localStorage.removeItem(ACCENT_KEY);
    }
    if (font !== undefined) {
      if (font) localStorage.setItem(FONT_KEY, font);
      else localStorage.removeItem(FONT_KEY);
    }
  } catch {
    // Private browsing or a full quota — the choice simply will not persist.
  }
};

export const readStoredPageTheme = (): PageTheme => {
  try {
    const accent = localStorage.getItem(ACCENT_KEY) ?? "";
    const font = localStorage.getItem(FONT_KEY) ?? "";
    return {
      accent: isHexColor(accent) ? normalizeHex(accent) : "",
      font: isKnownFont(font) ? font : "",
    };
  } catch {
    return { accent: "", font: "" };
  }
};

/** Restores whatever was stored. Called once from `_app` on a cold load. */
export const restorePageTheme = () => applyPageTheme(readStoredPageTheme());

/*
 * The current theme, shared by everything that shows or uses it: the settings in the
 * site header, and the playground, whose generated code and share link carry the accent.
 * Read lazily from storage, because `localStorage` does not exist during SSR.
 */
const SERVER_THEME: PageTheme = { accent: "", font: "" };
let current: PageTheme | null = null;
const listeners = new Set<() => void>();

const getPageTheme = (): PageTheme =>
  (current ??=
    typeof window === "undefined" ? SERVER_THEME : readStoredPageTheme());

/*
 * Choices only (`setPageTheme`), not previews: for what records a choice elsewhere, as
 * the playground's share link does, which a preview must never reach.
 */
const choiceListeners = new Set<() => void>();
export const onPageThemeChoice = (listener: () => void) => {
  choiceListeners.add(listener);
  return () => {
    choiceListeners.delete(listener);
  };
};

const subscribePageTheme = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/*
 * A theme shown without being kept: the homepage's Seamless story shows one as it passes
 * (`PartsLive.tsx`). It is applied and announced as a choice is, so the settings show
 * it, but never stored. Ending it puts back what is stored, unless a choice was made
 * meanwhile, which keeps what is shown and ends it.
 *
 * Shown `within` some elements (what is in view), it is set on them alone, each marked
 * `data-page-theme` so its accent's steps are mixed again there (`tokens.css`), and the
 * root is left as it was. A change on the root restyles every element on the page, some
 * 2,400 on the homepage, a frame dropped mid-scroll; on what is in view it looks the
 * same (Mat, 2026-10-21: smooth). Only the accent is so shown: a font would reflow.
 *
 * It goes on, and comes off, a few elements a frame (`step`): the accent's properties
 * are inherited, so an element restyles with all it holds, and all at once the homepage's
 * restyled some 1,500 elements in one frame, which a scroll felt as it began and ended
 * (Mat, 2026-10-24: "sluggish"). A few frames apart, it looks no different.
 */
let previewing = false;
/** What the preview is to be on, and in which accent. */
let wanted: { element: HTMLElement; accent: string }[] = [];
/** What it is on now, and in which accent. */
const shown = new Map<HTMLElement, string>();
let stepping = 0;

/** About as many elements as restyle within a frame's few milliseconds. */
const FRAME_ELEMENTS = 400;

/** What a change on `element` restyles: it and all it holds. */
const weight = (element: HTMLElement) =>
  element.getElementsByTagName("*").length + 1;

const takeOff = (element: HTMLElement) => {
  delete element.dataset.pageTheme;
  ACCENT_PROPERTIES.forEach((prop) => element.style.removeProperty(prop));
  shown.delete(element);
};

/** A frame's share: first off what is no longer wanted, then on what is, in its order. */
const step = () => {
  stepping = 0;
  // Never past the frame's share, but for one element larger than it alone.
  let budget = FRAME_ELEMENTS;
  const fits = (element: HTMLElement) => {
    const cost = weight(element);
    if (cost > budget && budget < FRAME_ELEMENTS) return false;
    budget -= cost;
    return true;
  };
  const wants = new Map(wanted.map((w) => [w.element, w.accent]));
  for (const [element, accent] of [...shown]) {
    if (wants.get(element) === accent) continue;
    if (!fits(element)) break;
    takeOff(element);
  }
  for (const { element, accent } of wanted) {
    if (budget <= 0) break;
    if (shown.get(element) === accent) continue;
    if (!fits(element)) break;
    element.dataset.pageTheme = "";
    applyTo(element, { accent });
    shown.set(element, accent);
  }
  const done =
    [...shown].every(([element, accent]) => wants.get(element) === accent) &&
    wanted.every(({ element, accent }) => shown.get(element) === accent);
  if (!done) stepping = requestAnimationFrame(step);
};

/*
 * Begun a frame late: what asked for it (a story beginning or ending) changes the page
 * in the frame it asks, and the two together would cost that frame both.
 */
const schedule = () => {
  if (!stepping)
    stepping = requestAnimationFrame(() => {
      stepping = requestAnimationFrame(step);
    });
};

/** All of it off at once, for a choice, which the root then shows. */
const endWithin = () => {
  cancelAnimationFrame(stepping);
  stepping = 0;
  wanted = [];
  [...shown.keys()].forEach(takeOff);
};

export const previewPageTheme = (
  next: Partial<PageTheme>,
  elements?: HTMLElement[],
) => {
  previewing = true;
  current = { ...getPageTheme(), ...next };
  if (elements?.length && next.font === undefined && next.accent) {
    const accent = next.accent;
    wanted = elements.map((element) => ({ element, accent }));
    schedule();
  } else applyPageTheme(next);
  listeners.forEach((listener) => listener());
};

export const endPageThemePreview = () => {
  if (!previewing) return;
  previewing = false;
  current = readStoredPageTheme();
  if (wanted.length || shown.size) {
    wanted = [];
    schedule();
  } else applyPageTheme(current);
  listeners.forEach((listener) => listener());
};

/** Change the accent and/or font: applied to the page, remembered, and announced. */
export const setPageTheme = (next: Partial<PageTheme>) => {
  current = { ...getPageTheme(), ...next };
  // A choice over a preview shown within some elements: all of it to the root now.
  if (previewing && (wanted.length || shown.size)) {
    endWithin();
    applyPageTheme(current);
  } else applyPageTheme(next);
  // A choice made over a preview keeps all that is shown, the preview's part too.
  storePageTheme(previewing ? current : next);
  previewing = false;
  listeners.forEach((listener) => listener());
  choiceListeners.forEach((listener) => listener());
};

/** The current accent and font, re-rendering when either changes. */
export const usePageTheme = (): PageTheme =>
  useSyncExternalStore(subscribePageTheme, getPageTheme, () => SERVER_THEME);
