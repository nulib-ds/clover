/*
 * How Clover reads a language tag, whose languages it reads in and which of a set to
 * read: the rules every page loads, for Clover's interface language (`config.ts`) and
 * IIIF text (`core/value.ts`) alike. Which way a language is written, and what text in it
 * carries, is `direction.ts`; how the interface's text is marked, `langWithin`
 * (`config.ts`) and `langOf` (`useCloverTranslation.ts`); a container's name,
 * `useContainerName.tsx`; what a language is called, `languageCode.ts` and `autonym.ts`.
 * Each is a module of its own so that a page loads it only with the parts that use it.
 */

/**
 * The visitor's languages, most preferred first, as the browser gives them (it takes them
 * from the operating system, unless the person set their own). None on a server.
 */
export function visitorLanguages(): string[] {
  if (typeof navigator === "undefined") return [];
  return [...(navigator.languages ?? []), navigator.language].filter(Boolean);
}

/** The page's language, its `<html lang>`; none on a server, or where it declares none. */
export function pageLanguage(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.documentElement.lang || undefined;
}

/**
 * Clover's interface language for IIIF text to lean towards: the one chosen (or none),
 * the default, then those configured. The translator (`config.ts`) gives it as it loads, so a page
 * that draws IIIF text and no control (a `Label` alone) never loads the translator.
 */
let interfaceLanguages: () => (string | undefined)[] = () => [];

/** For the translator: where `readerLanguages` finds Clover's interface language. */
export function readInterfaceLanguagesFrom(
  source: () => (string | undefined)[],
) {
  interfaceLanguages = source;
}

/**
 * The languages to read IIIF text in, most preferred first (Mat, 2026-11-05): the
 * visitor's, then Clover's interface language (the default, then the languages
 * configured), then the page's. An interface language the visitor chose comes first,
 * so the values follow it (a Root's own choice, About's languages, wins over both).
 */
export function readerLanguages(): string[] {
  const [chosen, ...rest] = interfaceLanguages();
  return [
    ...new Set(
      [chosen, ...visitorLanguages(), ...rest, pageLanguage()].filter(
        (tag): tag is string => !!tag,
      ),
    ),
  ];
}

/** A tag's base language, as written: `pt` of `pt-BR`, and `pt` of `pt` itself. */
export const baseLanguage = (tag: string) => tag.split("-")[0];

/** Whether two language tags name the same language: `pt-BR` and `pt` do. */
export function sameLanguage(a: string, b: string): boolean {
  return baseLanguage(a).toLowerCase() === baseLanguage(b).toLowerCase();
}

/**
 * A tag's language and the script it is written in, said or likely: `zh-Hant` of `zh-TW`
 * and `zh-HK`, `zh-Hans` of `zh-CN` and `zh`, `ja-Jpan` of `ja`. Clover ships a language
 * written in two scripts as a file for each, so a visitor in Taiwan finds Traditional
 * Chinese, which `zh-TW`'s base, `zh`, would not tell from Simplified. None for a tag
 * the browser cannot read.
 */
export function scriptLanguage(tag: string): string | undefined {
  try {
    const { language, script } = new Intl.Locale(tag).maximize();
    return script && `${language}-${script}`;
  } catch {
    return undefined;
  }
}

/** The tag of `tags` in the same language and script as `tag` (`zh-CN` for `zh-SG`). */
function sameScript(tag: string, tags: string[]): string | undefined {
  const script = scriptLanguage(tag);
  if (!script) return undefined;
  return tags.find(
    (each) =>
      each !== "none" && each !== "@none" && scriptLanguage(each) === script,
  );
}

/** A tag's base language where it has subtags; none for a tag that is its own base. */
const baseOf = (tag: string) => (tag.includes("-") ? baseLanguage(tag) : null);

/**
 * The tag of `tags` to read a language map in, for a visitor of `language`, then of
 * `fallbacks`: the language itself, its base, a tag in its language and script (`zh-CN`
 * for `zh-SG`, never `zh-Hant`), a fallback, a tag whose base is the language, a
 * fallback's base, and else `none` (or `@none`), else the first. IIIF's rule as
 * `@iiif/helpers`' `getClosestLanguage` writes it, with the script added (Mat,
 * 2026-11-05: it had shown Traditional Chinese to a visitor who reads Simplified);
 * `languages.test.ts` holds the two to the same answers everywhere else.
 */
export function closestLanguage(
  language: string | undefined,
  tags: string[],
  fallbacks: string[] = [],
): string | undefined {
  if (!tags.length) return undefined;
  if (tags.length === 1) return tags[0];
  const none = () =>
    tags.includes("none") ? "none" : tags.includes("@none") ? "@none" : tags[0];
  if (!language) return tags.includes("none") ? "none" : tags[0];
  if (tags.includes(language)) return language;
  const base = baseOf(language);
  if (base && tags.includes(base)) return base;
  const script = sameScript(language, tags);
  if (script) return script;
  const fallback = fallbacks.find((tag) => tags.includes(tag));
  if (fallback) return fallback;
  const regional = tags.findIndex((tag) => baseOf(tag) === language);
  if (regional !== -1) return tags[regional];
  for (const tag of fallbacks) {
    const fallbackBase = baseOf(tag);
    if (fallbackBase && tags.includes(fallbackBase)) return fallbackBase;
  }
  return none();
}

/**
 * Of these tags, the one to read: for `language` where one is given (a Root's `language`,
 * or the one chosen), else in the order `readerLanguages` gives, by IIIF's rule
 * (`closestLanguage`), else the first. How any IIIF text is chosen (`localize`), and so an annotation's body
 * and a choice's starting language.
 */
export function languageToRead(
  tags: string[],
  language?: string,
): string | undefined {
  const [first, ...rest] = language ? [language] : readerLanguages();
  return closestLanguage(first, tags, rest) ?? tags[0];
}

/**
 * The language a choice shows: the reader's pick (`picked`) where the set has it, else the
 * one the Root reads IIIF text in (`language`), or else the visitor's, as IIIF text is
 * chosen (`languageToRead`); else the first given. Every choice of language starts by it
 * (About's languages, captions, a painted `Choice`; Mat, 2026-11-05: "all language
 * derived properties ... lean to the end user's language").
 */
export function startingLanguage(
  languages: string[],
  language?: string,
  picked?: string,
): string | undefined {
  if (picked && languages.includes(picked)) return picked;
  if (!languages.length) return undefined;
  const tag = languageToRead(languages, language);
  // `none` is no language to show, as IIIF text in it carries none (`localize`).
  return tag === "none" ? languages[0] : tag;
}
