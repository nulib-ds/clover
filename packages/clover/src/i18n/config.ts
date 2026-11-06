import { en, loaders } from "./locales";
import {
  baseLanguage,
  pageLanguage,
  readInterfaceLanguagesFrom,
  sameLanguage,
  scriptLanguage,
  visitorLanguages,
} from "./languages";

/**
 * Clover's interface language: the language of its control labels ("Zoom in"), section
 * titles ("About") and announcements ("Item 2 of 17"), without a translation library.
 *
 * Clover needs a key lookup with a fallback chain, `{{name}}` interpolation and language
 * detection. i18next did that at about 20 kB gzipped across three packages;
 * this does it in well under one. Languages are still defined the way i18next defines
 * them, so existing `initCloverI18n` calls keep working:
 *
 *     initCloverI18n({
 *       languages: ["de"],
 *       fallbackLng: ["de", "en"],
 *       resources: { de: { clover: { informationPanelTabsAbout: "Über" } } },
 *     });
 *
 * Which it speaks (Mat, 2026-11-05): the languages configured (`languages`, or `lng` for
 * one), then the page's `<html lang>` (Mat, 2026-11-05: derived, as the visitor's is),
 * else English; then the visitor's languages, from
 * the browser. The visitor's first that Clover has strings for is the default, else the
 * first configured; where the two differ, `interfaceLanguages()` offers both, and
 * `chooseInterfaceLanguage` takes the visitor's choice.
 *
 * English ships with Clover. Each other language it ships loads the first time Clover is
 * to speak it, so until it arrives a string shows in English, marked as English by
 * `langOf`, and the parts re-render when it does. `cloverI18n.ready()` waits for it.
 */

export const CLOVER_I18N_NAMESPACE = "clover";

/** `resources[language][namespace][key]` — i18next's resource shape. */
export type CloverI18nResources = Record<
  string,
  Record<string, Record<string, string>>
>;

export interface CloverI18nOptions {
  /**
   * The languages your site offers Clover's interface in, most preferred first. A
   * visitor whose own language Clover has strings for sees theirs, with these offered
   * beside it, with the page's `<html lang>`; any other visitor sees the first of these.
   * When not given, the page's
   * `<html lang>`, else English.
   */
  languages?: string | readonly string[];
  /** One language to offer, as `languages: [lng]` does. */
  lng?: string;
  /** Languages to try, in order, when a key is missing. English is always last. */
  fallbackLng?: string | readonly string[] | false;
  /** Strings to add or override, merged into what Clover ships. */
  resources?: CloverI18nResources;
}

const resources: CloverI18nResources = {
  en: { [CLOVER_I18N_NAMESPACE]: { ...en } },
};

/** The languages configured (`languages`, `lng`), in order. */
let configured: string[] = [];
/** The interface language the visitor chose (`chooseInterfaceLanguage`), if any. */
let chosen: string | undefined;
/**
 * Every interface language chosen since the choice was last reset: each stays offered, so
 * the choice never loses the radio focus is on as another is chosen (WCAG 2.4.3).
 */
let picked: string[] = [];
let fallbacks: string[] = [];
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  listeners.forEach((listener) => listener());
}

/**
 * `pt-BR` → `pt-BR`, `pt-Latn`, `pt`: a tag falls back to its language in its script, then
 * to its base language. So `zh-TW` reads `zh-Hant`, and `zh-CN` and `zh` read `zh-Hans`.
 */
function withBase(lng: string): string[] {
  return [lng, scriptLanguage(lng), baseLanguage(lng)].filter(
    (tag): tag is string => !!tag,
  );
}

/** Whether Clover has strings for exactly this tag: shipped, or given by the page. */
const has = (tag: string) => tag === "en" || ships(tag) || !!resources[tag];

/** The tag Clover speaks for a visitor of `lng`: `zh-Hant` for `zh-TW`, `en` for `en-US`. */
const speaks = (lng: string) => withBase(lng).find(has);

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
/** The language the visitor sees first, unless they chose another: the default. */
let byDefault = "en";

/**
 * The site's languages: those configured, then the page's `<html lang>`, derived as the
 * visitor's is (Mat, 2026-11-05: "the others are derived elsewhere"); English comes last
 * anyway.
 */
function offered(): string[] {
  const page = pageLanguage();
  return [...new Set([...configured, ...(page ? [page] : [])])];
}

/**
 * Every language to look in, in order, ending with English: the one the visitor chose,
 * else the default (the visitor's first that Clover has strings for, else the first
 * configured), then `fallbackLng`, for a key it lacks, then the languages configured
 * (and the page's). Made again only when what it is made
 * from changes: the strings or settings (`version`, which `initCloverI18n`,
 * `chooseInterfaceLanguage` and each language's load move), the page's `<html lang>` and
 * the browser's languages. Every string asks for it, a strip of hundreds of thumbnails
 * one each, so it is read, not rebuilt.
 */
function lookupChain(): string[] {
  const from = `${version} ${typeof document < "u" ? document.documentElement.lang : ""} ${
    typeof navigator < "u" ? navigator.languages : ""
  }`;
  if (from === madeFrom) return chain;
  madeFrom = from;
  const set = offered();
  const visitor = visitorLanguages().map(speaks).find(Boolean);
  byDefault = visitor ?? set.map(speaks).find(Boolean) ?? "en";
  chain = [
    ...new Set(
      [chosen ?? byDefault, ...fallbacks, ...set]
        .filter((tag): tag is string => !!tag)
        .flatMap(withBase)
        .concat("en"),
    ),
  ];
  // Idempotent, and it settles later, so asking from a render is safe.
  void loadFor(chain);
  return chain;
}

/**
 * The interface languages to offer the visitor, each as the tag Clover has strings for:
 * the default, then the languages configured and the page's, then any chosen since the
 * choice was reset. One where they agree.
 */
function offeredLanguages(): string[] {
  lookupChain();
  return [
    ...new Set(
      [byDefault, ...offered().map(speaks), ...picked.map(speaks)].filter(
        (tag): tag is string => !!tag,
      ),
    ),
  ];
}

// IIIF text leans towards the interface language: the one chosen, the default, then those
// configured (`readerLanguages`, `languages.ts`).
readInterfaceLanguagesFrom(() => {
  lookupChain();
  return [chosen, byDefault, ...offered()];
});

/** One of Clover's interface strings, and the language it is written in. */
export interface CloverString {
  text: string;
  /** The language the string came from; undefined when no language has the key. */
  lang?: string;
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
  /**
   * Clover's interface language: the one the visitor chose, else the first of the chain
   * whose strings have loaded.
   */
  get language(): string {
    return chosen ?? lookupChain().find((lng) => resources[lng]) ?? "en";
  },

  /** The interface language the visitor chose, if they chose one. */
  get chosenLanguage(): string | undefined {
    return chosen;
  },

  /**
   * The tag Clover has strings for that speaks `lng` (`zh-Hans` for `zh-CN`, `en` for
   * `en-US`), shipped or given by the page; none where it has no strings for it.
   */
  stringsFor(lng: string): string | undefined {
    return speaks(lng);
  },

  /**
   * The interface languages to offer, and the one in use (`chosen`): the default (the
   * visitor's, where Clover has strings for it), then the languages configured, each as
   * the tag Clover has strings for. A choice is worth offering only where there are two
   * or more.
   */
  interfaceLanguages(): { languages: string[]; chosen: string } {
    const languages = offeredLanguages();
    return { languages, chosen: (chosen && speaks(chosen)) || byDefault };
  },

  /**
   * Speak `lng` whatever the visitor's languages, as their choice of interface language;
   * none goes back to the default. Settles once its strings have loaded, or failed to.
   *
   *     await cloverI18n.chooseInterfaceLanguage("fr");
   */
  chooseInterfaceLanguage(lng?: string): Promise<void> {
    chosen = lng || undefined;
    picked = chosen ? [...new Set([...picked, chosen])] : [];
    notify();
    return loadFor(lookupChain());
  },

  /**
   * The language Clover's interface strings are in: the first of the lookup chain that has any. A
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

  /** As `chooseInterfaceLanguage` does: i18next's name for it. */
  changeLanguage(lng: string): Promise<void> {
    return cloverI18n.chooseInterfaceLanguage(lng);
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
   *     await initCloverI18n({ languages: ["fr"] }).ready();
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
 * Configure Clover's interface language (`languages`, or `lng` for one) and add or
 * override strings. Safe to call more than once: each call merges its `resources` and
 * applies any `languages`, `lng` or `fallbackLng` it is given. A visitor whose language
 * Clover has strings for still sees theirs first, with yours offered beside it; to speak
 * one language whatever the visitor's, `chooseInterfaceLanguage`.
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
  const before = configured.join();
  if (options.languages !== undefined) {
    configured = [options.languages].flat().filter(Boolean);
  } else if (options.lng) {
    configured = [options.lng];
  }
  /*
   * New languages for the site: what was chosen before is offered only where they or the
   * visitor's own still name it (Mat, 2026-11-05: "toggling languages off does not remove
   * them as options"), and an interface language chosen that they do not goes back to the
   * visitor's.
   */
  if (configured.join() !== before) {
    picked = [];
    const kept = [...visitorLanguages(), ...offered()].map(speaks);
    if (chosen && !kept.includes(speaks(chosen))) chosen = undefined;
  }
  notify();
  return cloverI18n;
}
