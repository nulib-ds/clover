import { descriptionLanguages, startingLanguage } from "./language-choice";

describe("descriptionLanguages", () => {
  it("offers the languages where one of the Manifest's words comes in two or more", () => {
    // Cookbook 0006: every value in English and French.
    expect(
      descriptionLanguages({
        label: { en: ["Whistler's Mother"], fr: ["La Mère de Whistler"] },
        summary: { en: ["A painting."], fr: ["Un tableau."] },
      }),
    ).toEqual(["en", "fr"]);
    // Cookbook 0118: one metadata value in two, the label in one.
    expect(
      descriptionLanguages({
        label: { fr: ["Arrangement en gris et noir no 1"] },
        metadata: [
          {
            label: { en: ["Alternative titles"] },
            value: { en: ["Whistler's Mother"], fr: ["La Mère de Whistler"] },
          },
        ],
      }),
    ).toEqual(["en", "fr"]);
  });

  it("offers none where each value is in one language, or in none", () => {
    expect(
      descriptionLanguages({
        label: { en: ["A letter"] },
        summary: { de: ["Ein Brief"] },
        metadata: [{ label: { none: ["Date"] }, value: { none: ["1849"] } }],
      }),
    ).toEqual([]);
    expect(descriptionLanguages({ label: { none: ["x"], en: ["x"] } })).toEqual(
      [],
    );
    expect(descriptionLanguages(null)).toEqual([]);
  });

  it("reads the required statement, and passes over an empty language", () => {
    expect(
      descriptionLanguages({
        label: { en: ["A letter"], fr: [""] },
        requiredStatement: {
          label: { en: ["Held by"], es: ["Conservado por"] },
          value: { none: ["Example Library"] },
        },
      }),
    ).toEqual(["en", "es"]);
  });
});

describe("startingLanguage", () => {
  it("starts in the Root's language, and keeps the reader's pick", () => {
    expect(startingLanguage(["en", "fr"], "fr")).toBe("fr");
    expect(startingLanguage(["en", "fr"], "fr", "en")).toBe("en");
    expect(startingLanguage(["en", "fr"], undefined, "de")).toBe("en");
    expect(startingLanguage([], "fr")).toBeUndefined();
  });
});
