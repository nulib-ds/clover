import type { AnnotationEntry } from "../../core/annotation-sets";
import { directionOf } from "../../core/direction";
import {
  autonym,
  inLanguage,
  languagesOf,
  startingLanguage,
} from "./languages";

const entry = (...languages: Array<string | undefined>) =>
  ({
    bodies: languages.map((language) => ({ value: "words", language })),
  }) as unknown as AnnotationEntry;

describe("an annotation list's languages", () => {
  it("are those its annotations are split across, in the order they come", () => {
    expect(languagesOf([entry("en"), entry("ar"), entry()])).toEqual([
      "en",
      "ar",
    ]);
  });

  it("are none for one language, or where each annotation holds them all", () => {
    expect(languagesOf([entry("en"), entry("en")])).toEqual([]);
    expect(languagesOf([entry("en", "ar"), entry("ar", "en")])).toEqual([]);
    expect(languagesOf([entry("none"), entry()])).toEqual([]);
  });

  it("start on the Root's language, else the reader's, else the first", () => {
    document.documentElement.lang = "en";
    expect(startingLanguage(["en", "ar"], "ar")).toBe("ar");
    expect(startingLanguage(["ar", "en"])).toBe("en");
    expect(startingLanguage(["ar", "fa"], "de")).toBe("ar");
    expect(startingLanguage([])).toBeUndefined();
    // The reader's pick, where the set has it.
    expect(startingLanguage(["en", "ar"], "ar", "en")).toBe("en");
    expect(startingLanguage(["en", "ar"], "ar", "fr")).toBe("ar");
  });

  it("show an annotation in the chosen language, or in none", () => {
    expect(inLanguage(entry("ar"), "ar")).toBe(true);
    expect(inLanguage(entry("en"), "ar")).toBe(false);
    expect(inLanguage(entry(), "ar")).toBe(true);
    expect(inLanguage(entry("en"))).toBe(true);
  });

  it("are named in themselves", () => {
    expect(autonym("ar")).toBe("العربية");
    expect(autonym("en")).toBe("English");
  });
});

describe("a language's direction", () => {
  it("is right to left for those written so, by their script where given", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("he-IL")).toBe("rtl");
    expect(directionOf("ku-Arab")).toBe("rtl");
    expect(directionOf("ug-Latn")).toBeUndefined();
    expect(directionOf("en")).toBeUndefined();
    expect(directionOf("none")).toBeUndefined();
    expect(directionOf()).toBeUndefined();
  });
});
