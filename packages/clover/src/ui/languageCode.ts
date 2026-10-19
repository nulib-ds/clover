/**
 * A language's code as Clover shows it beside a name in that language, which a reader may
 * not be able to read: the tag, upper-cased ("EN", "IT", "PT-BR"). None for no language,
 * or IIIF's `none`.
 */
export function languageCode(tag?: string | null): string | undefined {
  if (!tag || tag === "none") return undefined;
  return tag.toUpperCase();
}
