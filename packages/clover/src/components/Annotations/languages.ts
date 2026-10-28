import type { AnnotationEntry } from "../../core/annotation-sets";

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

/** Whether an entry shows in a language: it is in it, or in none at all. */
export function inLanguage(entry: AnnotationEntry, chosen?: string): boolean {
  if (!chosen) return true;
  const tags = entryLanguages(entry);
  return !tags.length || tags.includes(chosen);
}
