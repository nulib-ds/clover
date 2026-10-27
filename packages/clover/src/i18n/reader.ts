/**
 * The reader's languages, most preferred first: the page's, then the browser's. Clover is
 * a part of its host's page, so it speaks the page's language, and reads IIIF text in it,
 * where it can, and the reader's otherwise. One reading, for Clover's strings
 * (`config.ts`) and IIIF text (`core/value.ts`).
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
