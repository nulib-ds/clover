import { getClosestLanguage } from "@iiif/helpers/i18n";

import { closestLanguage, localize } from "./value";

/*
 * Clover's `closestLanguage` is `@iiif/helpers`' `getClosestLanguage` as Clover calls it
 * (`DRY.md` decision 10): the same answer for every reader, fallback and language map
 * here, so which language a IIIF value shows in, and so its `lang`, never changes.
 */
const TAG_SETS = [
  [],
  ["en"],
  ["none"],
  ["en", "fr"],
  ["fr", "en"],
  ["en-GB", "fr"],
  ["en", "en-GB", "en-US"],
  ["fr-CA", "fr", "de"],
  ["pt-BR", "es"],
  ["pt", "pt-BR"],
  ["de", "none"],
  ["@none", "ar"],
  ["ar", "fa", "none"],
  ["zh-Hans", "zh-Hant", "ja"],
  ["nb", "nn", "no"],
  ["es-419", "en-US"],
];
const READERS = [
  undefined,
  "",
  "en",
  "en-US",
  "en-GB",
  "fr",
  "fr-CA",
  "pt",
  "pt-BR",
  "de-AT",
  "ar",
  "zh",
  "zh-Hant",
  "no",
  "es",
];
const FALLBACKS = [[], ["fr"], ["de-DE", "en"], ["pt-PT"], ["en-US", "es-MX"]];

describe("closestLanguage", () => {
  it("answers as @iiif/helpers' getClosestLanguage does, for every case here", () => {
    for (const tags of TAG_SETS)
      for (const reader of READERS)
        for (const fallbacks of FALLBACKS)
          expect(
            closestLanguage(reader, tags, fallbacks),
            JSON.stringify({ tags, reader, fallbacks }),
          ).toBe(getClosestLanguage(reader, tags, fallbacks));
  });

  it("prefers the language, its base, a fallback, then a regional tag, then none", () => {
    expect(closestLanguage("fr-CA", ["en", "fr-CA", "fr"])).toBe("fr-CA");
    expect(closestLanguage("pt-BR", ["en", "pt"])).toBe("pt");
    expect(closestLanguage("de", ["en", "fr"], ["fr"])).toBe("fr");
    expect(closestLanguage("en", ["fr", "en-GB"])).toBe("en-GB");
    expect(closestLanguage("ja", ["fr", "none"])).toBe("none");
    expect(closestLanguage("ja", ["fr", "de"])).toBe("fr");
  });
});

describe("localize", () => {
  it("reads a language map in the reader's language, carrying its tag", () => {
    expect(localize({ en: ["Book"], fr: ["Livre"] }, "fr")).toEqual({
      text: "Livre",
      lang: "fr",
    });
    // `none` carries no tag: the text takes the page's language.
    expect(localize({ none: ["1896"] }, "fr")).toEqual({ text: "1896" });
  });
});
