import { directionOf, languageProps } from "./direction";

describe("languageProps", () => {
  it("gives a language its direction where it is written right to left", () => {
    expect(languageProps("ar")).toEqual({ lang: "ar", dir: "rtl" });
    expect(languageProps("ku-Arab")).toEqual({ lang: "ku-Arab", dir: "rtl" });
    expect(languageProps("ja")).toEqual({ lang: "ja", dir: undefined });
    expect(directionOf("en")).toBeUndefined();
  });

  it("gives nothing without a language", () => {
    expect(languageProps(undefined)).toEqual({});
    expect(languageProps("")).toEqual({});
  });
});
