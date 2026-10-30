import { languageToRead } from "../i18n/languages";

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

export function localize(
  value: LanguageMapLike,
  language?: string,
  separator = ", ",
): LocalizedValue {
  if (!value) return { text: "" };
  if (typeof value === "string") return { text: value };

  const tags = Object.keys(value).filter((tag) => value[tag]?.length);
  if (!tags.length) return { text: "" };
  // Falls back to `none`, then to the first language given, when nothing matches.
  const tag = languageToRead(tags, language)!;

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
