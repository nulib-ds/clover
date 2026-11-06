import { getClosestLanguage } from "@iiif/helpers/i18n";

import {
  baseLanguage,
  closestLanguage,
  languageToRead,
  sameLanguage,
  scriptLanguage,
} from "./languages";

/*
 * Clover's `closestLanguage` is `@iiif/helpers`' `getClosestLanguage` as Clover calls it
 * (Mat, 2026-10-27), with one step added (Mat, 2026-11-05): a tag in the visitor's
 * language and script, before a fallback, so a visitor who reads Simplified Chinese
 * never gets Traditional where both are there. Everywhere else, the same answer for every
 * visitor, fallback and language map here.
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

/** Whether `answer` is in the language and script of the visitor or a fallback. */
const byScript = (
  answer: string | undefined,
  reader: string | undefined,
  fallbacks: string[],
) =>
  !!answer &&
  !!scriptLanguage(answer) &&
  [reader, ...fallbacks].some(
    (tag) => !!tag && scriptLanguage(tag) === scriptLanguage(answer),
  );

describe("closestLanguage", () => {
  it("answers as @iiif/helpers' getClosestLanguage does, but where a script decides", () => {
    for (const tags of TAG_SETS)
      for (const reader of READERS)
        for (const fallbacks of FALLBACKS) {
          const ours = closestLanguage(reader, tags, fallbacks);
          const theirs = getClosestLanguage(reader, tags, fallbacks);
          expect(
            ours === theirs || byScript(ours, reader, fallbacks),
            JSON.stringify({ tags, reader, fallbacks, ours, theirs }),
          ).toBe(true);
        }
  });

  it("takes a tag in the visitor's language and script before a fallback", () => {
    expect(closestLanguage("zh-SG", ["zh-Hant", "zh-CN", "en"], ["en"])).toBe(
      "zh-CN",
    );
    expect(closestLanguage("zh-TW", ["zh-CN", "zh-Hant"])).toBe("zh-Hant");
    expect(closestLanguage("zh-Hans", ["zh-Hant", "zh-CN"])).toBe("zh-CN");
    expect(closestLanguage("zh", ["zh-Hant", "zh-CN"])).toBe("zh-CN");
    expect(closestLanguage("en-US", ["fr", "en-GB"], ["fr"])).toBe("en-GB");
    // Never `none`, which is in no language.
    expect(closestLanguage("de", ["none", "en"])).toBe("none");
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

describe("languageToRead", () => {
  it("reads in a Root's language where one is given, else the reader's", () => {
    expect(languageToRead(["en", "fr"], "fr")).toBe("fr");
    expect(languageToRead(["ar", "en"], "de")).toBe("ar");
    expect(languageToRead(["ar", "none"], "de")).toBe("none");
    expect(languageToRead([], "fr")).toBeUndefined();
    // <html lang="en">, as every test's page declares.
    expect(languageToRead(["fr", "en-GB"])).toBe("en-GB");
  });
});

describe("baseLanguage and sameLanguage", () => {
  it("take a tag's base language as written, and compare them in any case", () => {
    expect(baseLanguage("pt-BR")).toBe("pt");
    expect(baseLanguage("pt")).toBe("pt");
    expect(sameLanguage("pt-BR", "PT")).toBe(true);
    expect(sameLanguage("nb", "nn")).toBe(false);
  });
});
