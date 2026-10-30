/*
 * How Clover reads a language tag, whose languages it reads in and which of a set to
 * read: the rules every page loads, for Clover's strings (`config.ts`) and IIIF text
 * (`core/value.ts`) alike. Which way a language is written, and what text in it carries,
 * is `direction.ts`; how Clover's strings are marked, `langWithin` (`config.ts`) and
 * `langOf` (`useCloverTranslation.ts`); a container's name, `useContainerName.tsx`; what
 * a language is called, `languageCode.ts` and `autonym.ts`. Each is a module of its own
 * so that a page loads it only with the parts that use it.
 */

/**
 * The reader's languages, most preferred first: the page's, then the browser's. Clover is
 * a part of its host's page, so it speaks the page's language, and reads IIIF text in it,
 * where it can, and the reader's otherwise.
 */
export function readerLanguages(): string[] {
  const found: string[] = [];
  if (typeof document !== "undefined")
    found.push(document.documentElement.lang);
  if (typeof navigator !== "undefined") {
    found.push(...(navigator.languages ?? []), navigator.language);
  }
  return found.filter(Boolean);
}

/** A tag's base language, as written: `pt` of `pt-BR`, and `pt` of `pt` itself. */
export const baseLanguage = (tag: string) => tag.split("-")[0];

/** Whether two language tags name the same language: `pt-BR` and `pt` do. */
export function sameLanguage(a: string, b: string): boolean {
  return baseLanguage(a).toLowerCase() === baseLanguage(b).toLowerCase();
}

/** A tag's base language where it has subtags; none for a tag that is its own base. */
const baseOf = (tag: string) => (tag.includes("-") ? baseLanguage(tag) : null);

/**
 * The tag of `tags` to read a language map in, for a reader of `language`, then of
 * `fallbacks`: the language itself, its base, a fallback, a tag whose base is the
 * language, a fallback's base, and else `none` (or `@none`), else the first. IIIF's own
 * rule, as `@iiif/helpers`' `getClosestLanguage` writes it (`languages.test.ts` holds the
 * two to the same answers).
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
 * Of these tags, the one to read: for a reader of `language` where one is given (a Root's
 * `language`), else of the reader's own languages, by IIIF's rule (`closestLanguage`),
 * else the first. How any IIIF text is chosen (`localize`), and so an annotation's body
 * and a choice's starting language.
 */
export function languageToRead(
  tags: string[],
  language?: string,
): string | undefined {
  const [first, ...rest] = language ? [language] : readerLanguages();
  return closestLanguage(first, tags, rest) ?? tags[0];
}
