/**
 * Languages written right to left, by their primary subtag (Arabic, Aramaic, Sorani,
 * Dhivehi, Persian, Hebrew, Kashmiri, Pashto, Sindhi, Syriac, Uyghur, Urdu, Yiddish), and
 * scripts written so, by their script subtag (Adlam, Arabic, Hebrew, N'Ko, Hanifi Rohingya,
 * Syriac, Thaana). As patterns, not lists, as every value Clover shows reads it.
 */
const RTL_LANGUAGE = /^(ar|arc|ckb|dv|fa|he|iw|ks|ps|sd|syr|ug|ur|yi)$/;
const RTL_SCRIPT = /^(adlm|arab|hebr|nkoo|rohg|syrc|thaa)$/;

/**
 * The direction text in a language is written, for its element's `dir`: `rtl` for a
 * language or script written right to left (Arabic, Hebrew, Persian, Urdu…), else nothing,
 * so it takes the page's. A script subtag decides over the language's (`ku-Arab` is right
 * to left, `ug-Latn` is not).
 */
export function directionOf(lang?: string | null): "rtl" | undefined {
  if (!lang) return undefined;
  const [primary, ...subtags] = lang.toLowerCase().split(/[-_]/);
  const script = subtags.find((subtag) => subtag.length === 4);
  return (script ? RTL_SCRIPT.test(script) : RTL_LANGUAGE.test(primary))
    ? "rtl"
    : undefined;
}
