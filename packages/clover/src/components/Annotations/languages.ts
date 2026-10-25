import type { AnnotationEntry } from "../../core/annotation-sets";
import { localize } from "../../core/value";

/** The languages an entry's text is in, as its bodies give them (never `none`). */
export function entryLanguages(entry: AnnotationEntry): string[] {
  const tags = entry.bodies
    .filter((body) => !body.image && body.value?.trim())
    .map((body) => body.language)
    .filter((tag): tag is string => Boolean(tag) && tag !== "none");
  return [...new Set(tags)];
}

/**
 * The languages to choose among in a list of annotations: where the same words are given
 * as separate annotations, one per language (a transcription and its translation), the
 * languages they are in, in the order they first come. None where there is one language,
 * or where every annotation already holds all of them, its bodies' own choice.
 */
export function languagesOf(entries: AnnotationEntry[]): string[] {
  const each = entries.map(entryLanguages);
  const all = [...new Set(each.flat())];
  if (all.length < 2) return [];
  const split = each.some(
    (tags) => tags.length && all.some((tag) => !tags.includes(tag)),
  );
  return split ? all : [];
}

/**
 * The language a choice starts on: the one the Root reads IIIF text in (`language`), or
 * else the reader's, as IIIF text is chosen (`localize`); else the first given.
 */
export function startingLanguage(
  languages: string[],
  language?: string,
): string | undefined {
  if (!languages.length) return undefined;
  const map = Object.fromEntries(languages.map((tag) => [tag, [tag]]));
  return localize(map, language).lang ?? languages[0];
}

/** Whether an entry shows in a language: it is in it, or in none at all. */
export function inLanguage(entry: AnnotationEntry, chosen?: string): boolean {
  if (!chosen) return true;
  const tags = entryLanguages(entry);
  return !tags.length || tags.includes(chosen);
}

/**
 * A language's name in itself ("العربية", "English", "Français"), for a reader of that
 * language to find it by; the tag where the browser cannot name it.
 */
export function autonym(tag: string): string {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
