import { readerLanguages } from "../i18n/reader";

/**
 * IIIF language maps as text: the closest language to the reader's, and that language's
 * tag, so the text can carry a `lang` attribute.
 */
export type LanguageMapLike =
  | string
  | Record<string, string[] | string | undefined>
  | null
  | undefined;

export interface LocalizedValue {
  text: string;
  /** The tag the text is in; undefined for `none` (no language) or plain strings. */
  lang?: string;
}

/** A tag's base language, `pt` of `pt-BR`; none for a tag without a region. */
const baseOf = (tag: string) =>
  tag.indexOf("-") === -1 ? null : tag.slice(0, tag.indexOf("-"));

/**
 * The tag of `tags` to read a language map in, for a reader of `language`, then of
 * `fallbacks`: the language itself, its base, a fallback, a tag whose base is the
 * language, a fallback's base, and else `none` (or `@none`), else the first. IIIF's own
 * rule, as `@iiif/helpers`' `getClosestLanguage` writes it (`value.test.ts` holds the
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

export function localize(
  value: LanguageMapLike,
  language?: string,
  separator = ", ",
): LocalizedValue {
  if (!value) return { text: "" };
  if (typeof value === "string") return { text: value };

  const tags = Object.keys(value).filter((tag) => value[tag]?.length);
  if (!tags.length) return { text: "" };
  const [first, ...rest] = language ? [language] : readerLanguages();
  // Falls back to `none`, then to the first language given, when nothing matches.
  const tag = closestLanguage(first, tags, rest) ?? tags[0];

  const entry = value[tag];
  const text = Array.isArray(entry) ? entry.join(separator) : String(entry);
  return { text, lang: tag === "none" ? undefined : tag };
}

/** A BCP 47 tag's shape: a language, then subtags. */
const TAG = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;

/**
 * The language of the page an external resource is, its `homepage`, `rendering`,
 * `seeAlso` or `partOf` entry's `language` (Presentation 3.0 §3.2: "the language or
 * languages used in the content of this external resource"; Cookbook 0047), for a link's
 * `hreflang`, which holds one: where it gives one tag; none where it gives none or
 * several. Never the label's language, which is only the link's words' (Mat, 2026-10-29).
 */
export function hrefLangOf(resource: unknown): string | undefined {
  const given = (resource as { language?: unknown } | null)?.language;
  const tags = (Array.isArray(given) ? given : [given]).filter(
    (tag): tag is string => typeof tag === "string" && TAG.test(tag),
  );
  return tags.length === 1 ? tags[0] : undefined;
}
