import { hrefLangOf, localize } from "./value";

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

describe("hrefLangOf", () => {
  it("reads one language an external resource gives as its page's (Cookbook 0047)", () => {
    expect(hrefLangOf({ language: ["en"] })).toBe("en");
    expect(hrefLangOf({ language: "pt-BR" })).toBe("pt-BR");
    // Several, none, or none that is a tag: no hreflang, which holds one.
    expect(hrefLangOf({ language: ["en", "fr"] })).toBeUndefined();
    expect(hrefLangOf({})).toBeUndefined();
    expect(hrefLangOf({ language: ["not a tag"] })).toBeUndefined();
    // Never the label's language.
    expect(hrefLangOf({ label: { en: ["Home page"] } })).toBeUndefined();
  });
});
