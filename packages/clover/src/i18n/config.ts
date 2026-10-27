import { en, loaders } from "./locales";
import { readerLanguages } from "./reader";

/**
 * Clover's translations, without a translation library.
 *
 * Clover needs a key lookup with a fallback chain, `{{name}}` interpolation and language
 * detection. i18next did that at about 20 kB gzipped across three packages;
 * this does it in well under one. Languages are still defined the way i18next defines
 * them, so existing `initCloverI18n` calls keep working:
 *
 *     initCloverI18n({
 *       lng: "de",
 *       fallbackLng: ["de", "en"],
 *       resources: { de: { clover: { informationPanelTabsAbout: "Über" } } },
 *     });
 *
 * English ships with Clover. Each other language it ships loads the first time Clover is
 * to speak it, so until it arrives a string shows in English, marked as English by
 * `langOf`, and the readers re-render when it does. `cloverI18n.ready()` waits for it.
 */

export const CLOVER_I18N_NAMESPACE = "clover";

/** `resources[language][namespace][key]` — i18next's resource shape. */
export type CloverI18nResources = Record<
  string,
  Record<string, Record<string, string>>
>;

export interface CloverI18nOptions {
  /**
   * The language to use. When not given: the page's `<html lang>`, then the browser's
   * languages, so Clover speaks the language of the page around it.
   */
  lng?: string;
  /** Languages to try, in order, when a key is missing. English is always last. */
  fallbackLng?: string | readonly string[] | false;
  /** Strings to add or override, merged into what Clover ships. */
  resources?: CloverI18nResources;
}

const resources: CloverI18nResources = {
  en: { [CLOVER_I18N_NAMESPACE]: { ...en } },
};

let language: string | undefined;
let fallbacks: string[] = [];
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  listeners.forEach((listener) => listener());
}

/** `pt-BR` → `pt-BR`, `pt`: a regional tag falls back to its base language. */
function withBase(lng: string): string[] {
  const base = lng.split("-")[0];
  return base && base !== lng ? [lng, base] : [lng];
}

/** Each shipped language's load, once asked for: it settles whether it loads or fails. */
const loading = new Map<string, Promise<void>>();

/** Whether Clover ships strings for `lng` to load (not a name `Object` has, as `toString`). */
const ships = (lng: string) =>
  Object.prototype.hasOwnProperty.call(loaders, lng);

function load(lng: string): Promise<void> {
  let pending = loading.get(lng);
  if (!pending) {
    pending = loaders[lng]().then(
      ({ default: strings }) => {
        // Strings a page gave `initCloverI18n` for this language win over Clover's.
        resources[lng] = {
          ...resources[lng],
          [CLOVER_I18N_NAMESPACE]: {
            ...strings,
            ...resources[lng]?.[CLOVER_I18N_NAMESPACE],
          },
        };
        notify();
      },
      // Unreachable (offline, a blocked chunk): the next language in the chain speaks.
      () => undefined,
    );
    loading.set(lng, pending);
  }
  return pending;
}

/**
 * Load the first shipped language in the chain, the one Clover will speak: each has every
 * string English has, so none after it is read. Languages before it, which a page gave
 * strings of its own, need no load.
 */
function loadFor(chain: string[]): Promise<void> {
  const lng = chain.find((tag) => tag === "en" || ships(tag));
  return lng && lng !== "en" ? load(lng) : Promise.resolve();
}

/** The chain last made, and what it was made from (`lookupChain`). */
let chain: string[] = [];
let madeFrom = "";

/**
 * Every language to look in, in order, ending with English. Made again only when what it
 * is made from changes: the strings or settings (`version`, which `initCloverI18n`,
 * `changeLanguage` and each language's load move), or, with no language set, the page's
 * `<html lang>` and the browser's languages. Every string asks for it, a strip of
 * hundreds of thumbnails one each, so it is read, not rebuilt.
 */
function lookupChain(): string[] {
  const from = language
    ? `${version}`
    : `${version} ${typeof document < "u" ? document.documentElement.lang : ""} ${
        typeof navigator < "u" ? navigator.languages : ""
      }`;
  if (from === madeFrom) return chain;
  madeFrom = from;
  const requested = language ? [language] : readerLanguages();
  chain = [
    ...new Set([...requested, ...fallbacks].flatMap(withBase).concat("en")),
  ];
  // Idempotent, and it settles later, so asking from a render is safe.
  void loadFor(chain);
  return chain;
}

/** One of Clover's strings, and the language it is written in. */
export interface CloverString {
  text: string;
  /** The language the string came from; undefined when no language has the key. */
  lang?: string;
}

/** Whether two language tags name the same language: `pt-BR` and `pt` do. */
export function sameLanguage(a: string, b: string): boolean {
  const base = (tag: string) => tag.split("-")[0].toLowerCase();
  return base(a) === base(b);
}

/**
 * The `lang` an element needs for text in `lang` on a page in `hostLanguage`: the tag
 * where the two differ, else undefined, as the text takes the page's. Until the page's
 * language is known (on the server, before a Clover root mounts), or where the page
 * declares none, it is taken to be the interface language.
 */
export function langWithin(
  lang: string | undefined,
  hostLanguage?: string,
): string | undefined {
  if (!lang) return undefined;
  return sameLanguage(lang, hostLanguage || cloverI18n.resolvedLanguage)
    ? undefined
    : lang;
}

export const cloverI18n = {
  /** The language set, or else the first of the reader's that Clover has strings for. */
  get language(): string {
    return language ?? lookupChain().find((lng) => resources[lng]) ?? "en";
  },

  /**
   * The language Clover's strings are in: the first of the lookup chain that has any. A
   * language set with no strings of its own resolves to the next, English at the last.
   */
  get resolvedLanguage(): string {
    return (
      lookupChain().find(
        (lng) =>
          Object.keys(resources[lng]?.[CLOVER_I18N_NAMESPACE] ?? {}).length > 0,
      ) ?? "en"
    );
  },

  changeLanguage(lng: string) {
    language = lng;
    notify();
  },

  /** A string and the language it came from, which a missing key leaves in another. */
  resolve(
    key: string,
    values?: Record<string, unknown>,
    namespace: string = CLOVER_I18N_NAMESPACE,
  ): CloverString {
    let found: CloverString = { text: key };
    for (const lng of lookupChain()) {
      const value = resources[lng]?.[namespace]?.[key];
      if (value !== undefined) {
        found = { text: value, lang: lng };
        break;
      }
    }
    if (!values) return found;
    return {
      ...found,
      text: found.text.replace(/\{\{(\w+)\}\}/g, (match, name) =>
        name in values ? String(values[name]) : match,
      ),
    };
  },

  t(
    key: string,
    values?: Record<string, unknown>,
    namespace: string = CLOVER_I18N_NAMESPACE,
  ): string {
    return cloverI18n.resolve(key, values, namespace).text;
  },

  /**
   * The language of a key's string where it is not the page's (`hostLanguage`), for the
   * element that shows it, or is named by it, to carry as `lang` (WCAG 3.1.2). Otherwise
   * undefined: the string takes the page's language. Without `hostLanguage`, only a
   * string that fell back to another language than the interface's is marked.
   */
  langOf(
    key: string,
    hostLanguage?: string,
    namespace: string = CLOVER_I18N_NAMESPACE,
  ): string | undefined {
    return langWithin(
      cloverI18n.resolve(key, undefined, namespace).lang,
      hostLanguage,
    );
  },

  /**
   * Settles once the language Clover speaks has loaded, or failed to: for a server render,
   * or a test, that needs the strings in place before it draws.
   *
   *     await initCloverI18n({ lng: "fr" }).ready();
   */
  ready(): Promise<void> {
    return loadFor(lookupChain());
  },

  /** For `useSyncExternalStore`: re-render readers when the language or strings change. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): number {
    return version;
  },
};

export type CloverI18n = typeof cloverI18n;

// Start on the page's language as Clover is imported, before anything draws.
if (typeof document !== "undefined") lookupChain();

/**
 * Set Clover's language and add or override strings. Safe to call more than once: each
 * call merges its `resources` and applies any `lng` or `fallbackLng` it is given.
 */
export function initCloverI18n(options: CloverI18nOptions = {}): CloverI18n {
  for (const [lng, namespaces] of Object.entries(options.resources ?? {})) {
    for (const [namespace, strings] of Object.entries(namespaces ?? {})) {
      resources[lng] ??= {};
      resources[lng][namespace] = {
        ...resources[lng][namespace],
        ...strings,
      };
    }
  }
  if (options.fallbackLng !== undefined) {
    fallbacks =
      options.fallbackLng === false ? [] : [options.fallbackLng].flat();
  }
  if (options.lng) language = options.lng;
  notify();
  return cloverI18n;
}
