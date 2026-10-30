import { act, renderHook } from "@testing-library/react";

/*
 * The translator is module state, as i18next's instance was. Each test gets a fresh copy
 * so a language set in one cannot leak into the next, with the language it starts in
 * loaded.
 */
async function load() {
  vi.resetModules();
  const config = await import("./config");
  const hook = await import("./useCloverTranslation");
  await config.cloverI18n.ready();
  return { ...config, ...hook };
}

function preferLanguages(languages: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
  vi.spyOn(navigator, "language", "get").mockReturnValue(languages[0] ?? "");
}

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = "";
});

describe("Clover i18n", () => {
  it("speaks English by default", async () => {
    preferLanguages([]);
    const { cloverI18n } = await load();
    expect(cloverI18n.t("imageViewerOpen")).toBe("Open image viewer");
    expect(cloverI18n.language).toBe("en");
  });

  it("interpolates values, and leaves a placeholder without one alone", async () => {
    preferLanguages([]);
    const { cloverI18n } = await load();
    expect(cloverI18n.t("canvasPosition", { index: 2, total: 4 })).toBe(
      "Item 2 of 4",
    );
    expect(cloverI18n.t("canvasPosition", { index: 2 })).toBe(
      "Item 2 of {{total}}",
    );
  });

  it("returns the key itself when nothing matches", async () => {
    const { cloverI18n } = await load();
    expect(cloverI18n.t("noSuchKey")).toBe("noSuchKey");
  });

  it("speaks the page's language before the browser's", async () => {
    preferLanguages(["fr-FR", "en"]);
    document.documentElement.lang = "es";
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("es");
  });

  it("takes the browser's where Clover has no strings for the page's", async () => {
    preferLanguages(["fr-FR"]);
    document.documentElement.lang = "de";
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("fr");
  });

  it("detects the reader's language from the browser on a page that declares none", async () => {
    preferLanguages(["fr-CA", "en"]);
    document.documentElement.lang = "";
    const { cloverI18n } = await load();
    // fr-CA has no strings of its own; its base language does.
    expect(cloverI18n.language).toBe("fr");
    expect(cloverI18n.t("imageZoomIn")).not.toBe("Zoom in");
  });

  it("tries each preferred language before falling back to English", async () => {
    preferLanguages(["de-DE", "pt-BR"]);
    document.documentElement.lang = "";
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("pt");
  });

  it("follows the page's language as it changes, though the chain is kept between strings", async () => {
    preferLanguages([]);
    document.documentElement.lang = "";
    const { cloverI18n } = await load();
    expect(cloverI18n.t("imageZoomIn")).toBe("Zoom in");
    // A page that sets its language late (a router's, say): the next string reads it.
    document.documentElement.lang = "es";
    await cloverI18n.ready();
    expect(cloverI18n.language).toBe("es");
    expect(cloverI18n.t("imageZoomIn")).not.toBe("Zoom in");
  });

  it("uses the page's language when the browser offers none", async () => {
    preferLanguages([]);
    document.documentElement.lang = "es";
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("es");
  });

  it("takes an explicit lng and fallbackLng, as documented", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({
      lng: "se",
      fallbackLng: ["nb", "en"],
      resources: { se: { clover: { imageZoomIn: "Lagat" } } },
    });
    await cloverI18n.ready();
    expect(cloverI18n.language).toBe("se");
    expect(cloverI18n.t("imageZoomIn")).toBe("Lagat");
    // Northern Sami has no "imageViewerOpen": Bokmål answers before English does.
    expect(cloverI18n.t("imageViewerOpen")).toBe("Åpne bildeviseren");
    expect(cloverI18n.t("noSuchKey")).toBe("noSuchKey");
  });

  it("speaks English, marked so, until a shipped language arrives", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n, useCloverTranslation } = await load();
    const { result } = renderHook(() => useCloverTranslation(undefined, "fr"));
    act(() => {
      initCloverI18n({ lng: "fr" });
    });
    expect(cloverI18n.resolve("commonNext")).toEqual({
      text: "Next",
      lang: "en",
    });
    expect(result.current.langOf("commonNext")).toBe("en");

    await act(() => cloverI18n.ready());
    expect(result.current.t("commonNext")).toBe("Suivant");
    expect(result.current.langOf("commonNext")).toBeUndefined();
  });

  it("keeps a page's own strings for a shipped language over Clover's", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n } = await load();
    await initCloverI18n({
      lng: "fr",
      resources: { fr: { clover: { commonNext: "Après" } } },
    }).ready();
    expect(cloverI18n.t("commonNext")).toBe("Après");
    expect(cloverI18n.t("commonPrevious")).toBe("Précédent");
  });

  it("starts on the page's language as it is imported", async () => {
    preferLanguages(["en"]);
    document.documentElement.lang = "fi";
    vi.resetModules();
    const { cloverI18n } = await import("./config");
    await cloverI18n.ready();
    expect(cloverI18n.resolvedLanguage).toBe("fi");
  });

  it("bootstraps a language Clover does not ship, falling back key by key", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({
      lng: "de",
      fallbackLng: ["de", "en"],
      resources: { de: { clover: { informationPanelTabsAbout: "Über" } } },
    });
    expect(cloverI18n.t("informationPanelTabsAbout")).toBe("Über");
    expect(cloverI18n.t("imageZoomIn")).toBe("Zoom in");
  });

  it("merges overrides into a shipped language on a later call", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n();
    initCloverI18n({
      resources: { en: { clover: { imageZoomIn: "Closer" } } },
    });
    expect(cloverI18n.t("imageZoomIn")).toBe("Closer");
    expect(cloverI18n.t("imageZoomOut")).toBe("Zoom out");
  });

  it("reports the language each string came from", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({
      lng: "de",
      resources: { de: { clover: { informationPanelTabsAbout: "Über" } } },
    });
    expect(cloverI18n.resolvedLanguage).toBe("de");
    expect(cloverI18n.resolve("informationPanelTabsAbout")).toEqual({
      text: "Über",
      lang: "de",
    });
    // A key German lacks falls back to English, and says so.
    expect(
      cloverI18n.resolve("canvasPosition", { index: 1, total: 2 }),
    ).toEqual({ text: "Item 1 of 2", lang: "en" });
    expect(cloverI18n.langOf("canvasPosition")).toBe("en");
    expect(cloverI18n.langOf("informationPanelTabsAbout")).toBeUndefined();
    expect(cloverI18n.resolve("noSuchKey")).toEqual({ text: "noSuchKey" });
  });

  it("resolves a language with no strings of its own to the next one that has some", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({ lng: "de" });
    expect(cloverI18n.language).toBe("de");
    expect(cloverI18n.resolvedLanguage).toBe("en");
    // Every string is English, which is the language in use: nothing to mark.
    expect(cloverI18n.langOf("imageZoomIn")).toBeUndefined();
  });

  it("treats a regional tag and its base language as one language", async () => {
    preferLanguages(["pt-BR"]);
    document.documentElement.lang = "";
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({
      resources: { "pt-BR": { clover: { download: "Baixar" } } },
    });
    expect(cloverI18n.resolvedLanguage).toBe("pt-BR");
    expect(cloverI18n.resolve("readMore")).toEqual({
      text: "Ler mais",
      lang: "pt",
    });
    expect(cloverI18n.langOf("readMore")).toBeUndefined();
  });

  it("marks a string against the page's language, where it is known", async () => {
    preferLanguages(["fr"]);
    document.documentElement.lang = "";
    const { cloverI18n, langWithin } = await load();
    expect(cloverI18n.resolvedLanguage).toBe("fr");
    // On an English page every French string says so; on a French one, none does.
    expect(cloverI18n.langOf("commonNext", "en")).toBe("fr");
    expect(cloverI18n.langOf("commonNext", "fr-CA")).toBeUndefined();
    // Not known (before a root mounts, or a page that declares none): taken to be the
    // interface language.
    expect(cloverI18n.langOf("commonNext", "")).toBeUndefined();
    expect(langWithin("de", "")).toBe("de");
    expect(langWithin("de", "de-AT")).toBeUndefined();
    expect(langWithin(undefined, "en")).toBeUndefined();
  });

  it("gives langOf to readers, renewed when the strings change", async () => {
    preferLanguages(["en"]);
    const { useCloverTranslation, initCloverI18n } = await load();
    initCloverI18n({
      lng: "de",
      resources: { de: { clover: { imageZoomIn: "Vergrößern" } } },
    });
    const { result } = renderHook(() => useCloverTranslation());
    expect(result.current.langOf("imageZoomIn")).toBeUndefined();
    expect(result.current.langOf("imageZoomOut")).toBe("en");

    act(() => {
      initCloverI18n({
        resources: { de: { clover: { imageZoomOut: "Verkleinern" } } },
      });
    });
    expect(result.current.langOf("imageZoomOut")).toBeUndefined();
  });

  it("re-renders readers when the language changes", async () => {
    preferLanguages(["en"]);
    const { useCloverTranslation, initCloverI18n } = await load();
    initCloverI18n({
      resources: { de: { clover: { imageZoomIn: "Vergrößern" } } },
    });
    const { result } = renderHook(() => useCloverTranslation());
    expect(result.current.t("imageZoomIn")).toBe("Zoom in");

    act(() => {
      initCloverI18n({ lng: "de" });
    });
    expect(result.current.t("imageZoomIn")).toBe("Vergrößern");
  });
});
