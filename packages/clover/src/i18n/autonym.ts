/**
 * A language's name in itself ("العربية", "English", "Français"), for a reader of that
 * language to find it by; the tag where the browser cannot name it. Only a choice of
 * languages names one (`ui/LanguageChoice.tsx`), so it is a module of its own: with
 * `languageCode`, it would load with every player's Captions menu.
 */
export function autonym(tag: string): string {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
