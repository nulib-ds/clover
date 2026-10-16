/// <reference types="vite/client" />
import { en, loaders } from ".";

/*
 * Every shipped language has every string English has, so no part falls back to English
 * in the middle of another language (WCAG 3.1.2). A key added to en.json lands in every
 * locale at once.
 */
const english = en as Record<string, string>;
const files = import.meta.glob<Record<string, string>>("./*.json", {
  eager: true,
  import: "default",
});
const others = Object.fromEntries(
  await Promise.all(
    Object.entries(loaders).map(
      async ([lng, load]) => [lng, (await load()).default] as const,
    ),
  ),
);

it("loads every locale file, under its own name", () => {
  expect(Object.keys(files).sort()).toEqual(
    ["en", ...Object.keys(loaders)].sort().map((lng) => `./${lng}.json`),
  );
});

/**
 * Values that are rightly the same as English: format strings, and words the language
 * spells the same way.
 */
const SAME_AS_ENGLISH: Record<string, string[]> = {
  "*": ["controlShortcut"],
  fr: [
    "canvasImage",
    "annotationsImage",
    "collectionLabel",
    "informationPanelTabsAnnotations",
    "informationPanelTabsCollection",
    "playerPause",
    "playerVolume",
  ],
  nb: ["playerPause"],
  nn: ["playerPause"],
  no: ["playerPause"],
  pt: ["playerVolume"],
};

const placeholders = (value: string) =>
  (value.match(/\{\{\w+\}\}/g) ?? []).sort();

describe.each(Object.entries(others))("the %s locale", (lng, strings) => {
  const locale = strings as Record<string, string>;

  it("has every key English has, and no other", () => {
    expect(Object.keys(locale).sort()).toEqual(Object.keys(english).sort());
  });

  it("keeps each string's placeholders", () => {
    for (const key of Object.keys(english)) {
      expect([key, placeholders(locale[key] ?? "")]).toEqual([
        key,
        placeholders(english[key]),
      ]);
    }
  });

  it("translates every string, bar the words it shares with English", () => {
    const allowed = [...SAME_AS_ENGLISH["*"], ...(SAME_AS_ENGLISH[lng] ?? [])];
    const untranslated = Object.keys(english).filter(
      (key) => locale[key] === english[key] && !allowed.includes(key),
    );
    expect(untranslated).toEqual([]);
  });

  it("leaves no string empty", () => {
    expect(Object.keys(locale).filter((key) => !locale[key]?.trim())).toEqual(
      [],
    );
  });
});
