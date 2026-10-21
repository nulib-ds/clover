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
 *    so this one property retints both the docs chrome and any rendered component. It
 *    also sets `--nextra-primary-hue` / `--nextra-primary-saturation`, which Nextra
 *    composes its own primary colors from in `hsl()` — it takes hue and saturation as
 *    variables and bakes lightness into each utility, so handing it H and S shifts the
 *    whole family while leaving Nextra's light/dark contrast choices intact.
 *  - **Font** sets `--font-sans`, the site's own family, so the whole website changes —
 *    prose, chrome and headings, which follow it through `--font-display`. Clover is not
 *    named anywhere in this: its components inherit their type from whatever contains them,
 *    so retypesetting the page retypesets them for free. That is the demonstration.
 */

const ACCENT_KEY = "clover-docs-accent";
const FONT_KEY = "clover-docs-font";

/*
 * The site's own family, not a Clover property — there is no Clover font property. `html,
 * body` reads this, and `--font-display` is declared as `var(--font-sans)`, so one
 * declaration retypesets prose, headings and chrome alike, and anything inheriting from
 * them.
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
export const applyPageTheme = ({ accent, font }: Partial<PageTheme>) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

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
 * A theme shown without being kept: the homepage's Yours story shows one as it passes
 * (`PartsLive.tsx`). It is applied and announced as a choice is, so the settings show
 * it, but never stored. Ending it puts back what is stored, unless a choice was made
 * meanwhile, which keeps what is shown and ends it.
 */
let previewing = false;

export const previewPageTheme = (next: Partial<PageTheme>) => {
  previewing = true;
  current = { ...getPageTheme(), ...next };
  applyPageTheme(next);
  listeners.forEach((listener) => listener());
};

export const endPageThemePreview = () => {
  if (!previewing) return;
  previewing = false;
  current = readStoredPageTheme();
  applyPageTheme(current);
  listeners.forEach((listener) => listener());
};

/** Change the accent and/or font: applied to the page, remembered, and announced. */
export const setPageTheme = (next: Partial<PageTheme>) => {
  current = { ...getPageTheme(), ...next };
  applyPageTheme(next);
  // A choice made over a preview keeps all that is shown, the preview's part too.
  storePageTheme(previewing ? current : next);
  previewing = false;
  listeners.forEach((listener) => listener());
  choiceListeners.forEach((listener) => listener());
};

/** The current accent and font, re-rendering when either changes. */
export const usePageTheme = (): PageTheme =>
  useSyncExternalStore(subscribePageTheme, getPageTheme, () => SERVER_THEME);
