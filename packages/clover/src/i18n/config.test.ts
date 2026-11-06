import { act, renderHook } from "@testing-library/react";

/*
 * The translator is module state, as i18next's instance was. Each test gets a fresh copy
 * so a language set in one cannot leak into the next, with the language it starts in
 * loaded.
 *
 * Clover's interface language (its control labels, section titles and announcements)
 * is chosen as Mat set it out on 2026-11-05: the languages configured (`languages`, or
 * `lng` for one), then the page's `<html lang>`, else English; then the visitor's
 * languages, from the browser. The visitor's first that Clover has strings for is the
 * default, else the first configured, and where the two differ both are offered.
 */
async function load() {
  vi.resetModules();
  const config = await import("./config");
  const hook = await import("./useCloverTranslation");
  const languages = await import("./languages");
  await config.cloverI18n.ready();
  return { ...config, ...hook, ...languages };
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
    expect(cloverI18n.interfaceLanguages()).toEqual({
      languages: ["en"],
      chosen: "en",
    });
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

  it("speaks the visitor's language before the page's, offering both", async () => {
    preferLanguages(["fr-FR", "en"]);
    document.documentElement.lang = "es";
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("fr");
    expect(cloverI18n.interfaceLanguages()).toEqual({
      languages: ["fr", "es"],
      chosen: "fr",
    });
  });

  it("offers no choice where the visitor's language is the page's", async () => {
    preferLanguages(["en-US", "en"]);
    document.documentElement.lang = "en";
    const { cloverI18n } = await load();
    expect(cloverI18n.interfaceLanguages()).toEqual({
      languages: ["en"],
      chosen: "en",
    });
  });

  it("speaks the site's where Clover has no strings for the visitor's", async () => {
    preferLanguages(["de-DE", "de"]);
    document.documentElement.lang = "fr";
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("fr");
    expect(cloverI18n.interfaceLanguages().languages).toEqual(["fr"]);
  });

  it("takes a visitor's base language where Clover has no strings for their region", async () => {
    preferLanguages(["fr-CA", "en"]);
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("fr");
    expect(cloverI18n.t("imageZoomIn")).not.toBe("Zoom in");
  });

  it("tries each of the visitor's languages before the site's", async () => {
    preferLanguages(["de-DE", "pt-BR"]);
    document.documentElement.lang = "en";
    const { cloverI18n } = await load();
    expect(cloverI18n.language).toBe("pt");
  });

  it.each([
    ["zh-TW", "zh-Hant", "放大"],
    ["zh-HK", "zh-Hant", "放大"],
    ["zh-Hant", "zh-Hant", "放大"],
    ["zh-CN", "zh-Hans", "放大"],
    ["zh-SG", "zh-Hans", "放大"],
    ["zh", "zh-Hans", "放大"],
    ["ja-JP", "ja", "拡大"],
    ["it-IT", "it", "Ingrandisci"],
    ["it-CH", "it", "Ingrandisci"],
  ])(
    "speaks to a visitor of %s in the strings for its script (%s)",
    async (visitor, speaks, zoomIn) => {
      preferLanguages([visitor]);
      document.documentElement.lang = "en";
      const { cloverI18n } = await load();
      expect(cloverI18n.language).toBe(speaks);
      expect(cloverI18n.t("imageZoomIn")).toBe(zoomIn);
      expect(cloverI18n.interfaceLanguages()).toEqual({
        languages: [speaks, "en"],
        chosen: speaks,
      });
    },
  );

  it("keeps Traditional and Simplified Chinese apart", async () => {
    preferLanguages(["zh-TW"]);
    const traditional = await load();
    expect(traditional.cloverI18n.t("informationPanelClose")).toBe(
      "關閉資訊面板",
    );
    preferLanguages(["zh-CN"]);
    const simplified = await load();
    expect(simplified.cloverI18n.t("informationPanelClose")).toBe(
      "关闭信息面板",
    );
  });

  it("follows the page's language as it changes, where nothing is configured", async () => {
    preferLanguages([]);
    const { cloverI18n } = await load();
    expect(cloverI18n.t("imageZoomIn")).toBe("Zoom in");
    // A page that sets its language late (a router's, say): the next string reads it.
    document.documentElement.lang = "es";
    await cloverI18n.ready();
    expect(cloverI18n.language).toBe("es");
    expect(cloverI18n.t("imageZoomIn")).not.toBe("Zoom in");
  });

  it("offers the languages configured beside the visitor's, over the page's", async () => {
    preferLanguages(["ja"]);
    document.documentElement.lang = "de";
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({ languages: ["fr-FR", "es"] });
    expect(cloverI18n.interfaceLanguages()).toEqual({
      languages: ["ja", "fr", "es"],
      chosen: "ja",
    });
  });

  it("speaks the first language configured to a visitor Clover has no strings for", async () => {
    preferLanguages(["de"]);
    const { cloverI18n, initCloverI18n } = await load();
    await initCloverI18n({ lng: "fr" }).ready();
    expect(cloverI18n.language).toBe("fr");
    // The page's English is the site's too, derived (every test's page declares it).
    expect(cloverI18n.interfaceLanguages().languages).toEqual(["fr", "en"]);
  });

  it("speaks what the visitor chooses, whatever their languages, and the default again on none", async () => {
    preferLanguages(["ja"]);
    document.documentElement.lang = "en";
    const { cloverI18n } = await load();
    expect(cloverI18n.t("imageZoomIn")).toBe("拡大");
    cloverI18n.chooseInterfaceLanguage("en");
    expect(cloverI18n.chosenLanguage).toBe("en");
    expect(cloverI18n.t("imageZoomIn")).toBe("Zoom in");
    expect(cloverI18n.interfaceLanguages()).toEqual({
      languages: ["ja", "en"],
      chosen: "en",
    });
    cloverI18n.chooseInterfaceLanguage();
    expect(cloverI18n.chosenLanguage).toBeUndefined();
    expect(cloverI18n.t("imageZoomIn")).toBe("拡大");
    // i18next's name for it.
    cloverI18n.changeLanguage("en");
    expect(cloverI18n.t("imageZoomIn")).toBe("Zoom in");
  });

  it("keeps a language chosen offered after choosing another, so the choice stays where focus is", async () => {
    preferLanguages(["en"]);
    document.documentElement.lang = "en";
    const { cloverI18n } = await load();
    cloverI18n.chooseInterfaceLanguage("ja");
    expect(cloverI18n.interfaceLanguages().languages).toEqual(["en", "ja"]);
    cloverI18n.chooseInterfaceLanguage("en");
    expect(cloverI18n.interfaceLanguages()).toEqual({
      languages: ["en", "ja"],
      chosen: "en",
    });
    // Reset, the choice is the visitor's and the site's alone again.
    cloverI18n.chooseInterfaceLanguage();
    expect(cloverI18n.interfaceLanguages().languages).toEqual(["en"]);
  });

  it("drops a choice the site no longer offers, and offers what is left", async () => {
    preferLanguages(["en"]);
    document.documentElement.lang = "en";
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({ languages: ["en", "es"] });
    await cloverI18n.chooseInterfaceLanguage("es");
    expect(cloverI18n.t("imageZoomIn")).toBe("Acercar");
    initCloverI18n({ languages: [] });
    expect(cloverI18n.chosenLanguage).toBeUndefined();
    expect(cloverI18n.t("imageZoomIn")).toBe("Zoom in");
    expect(cloverI18n.interfaceLanguages().languages).toEqual(["en"]);
  });

  it("keeps a choice the site still offers when its languages change", async () => {
    preferLanguages(["en"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({ languages: ["en", "fr"] });
    await cloverI18n.chooseInterfaceLanguage("fr");
    initCloverI18n({ languages: ["fr", "fi"] });
    expect(cloverI18n.chosenLanguage).toBe("fr");
  });

  it("leans IIIF text towards the visitor's language, then the interface's, then the page's", async () => {
    preferLanguages(["ja"]);
    document.documentElement.lang = "en";
    const { cloverI18n, readerLanguages } = await load();
    expect(readerLanguages()).toEqual(["ja", "en"]);
    // An interface language the visitor chose comes first, so the values follow it.
    cloverI18n.chooseInterfaceLanguage("en");
    expect(readerLanguages()).toEqual(["en", "ja"]);
  });

  it("takes fallbackLng after the languages it speaks, as documented", async () => {
    preferLanguages(["se"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({
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
    const { cloverI18n, useCloverTranslation } = await load();
    const { result } = renderHook(() => useCloverTranslation(undefined, "fr"));
    act(() => {
      cloverI18n.chooseInterfaceLanguage("fr");
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
    preferLanguages(["fr"]);
    const { cloverI18n, initCloverI18n } = await load();
    await initCloverI18n({
      resources: { fr: { clover: { commonNext: "Après" } } },
    }).ready();
    expect(cloverI18n.t("commonNext")).toBe("Après");
    expect(cloverI18n.t("commonPrevious")).toBe("Précédent");
  });

  it("starts on the visitor's language as it is imported", async () => {
    preferLanguages(["fi"]);
    document.documentElement.lang = "en";
    vi.resetModules();
    const { cloverI18n } = await import("./config");
    await cloverI18n.ready();
    expect(cloverI18n.resolvedLanguage).toBe("fi");
  });

  it("bootstraps a language Clover does not ship, falling back key by key", async () => {
    preferLanguages(["de"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({
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
    preferLanguages(["de"]);
    const { cloverI18n, initCloverI18n } = await load();
    initCloverI18n({
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

  it("resolves a chosen language with no strings of its own to the next one that has some", async () => {
    preferLanguages(["en"]);
    const { cloverI18n } = await load();
    cloverI18n.chooseInterfaceLanguage("de");
    expect(cloverI18n.language).toBe("de");
    expect(cloverI18n.resolvedLanguage).toBe("en");
    // Every string is English, which is the language in use: nothing to mark.
    expect(cloverI18n.langOf("imageZoomIn")).toBeUndefined();
  });

  it("treats a regional tag and its base language as one language", async () => {
    preferLanguages(["pt-BR"]);
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

  it("gives langOf to parts, renewed when the strings change", async () => {
    preferLanguages(["de"]);
    const { useCloverTranslation, initCloverI18n } = await load();
    initCloverI18n({
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

  it("re-renders parts when the language changes", async () => {
    preferLanguages(["en"]);
    const { useCloverTranslation, initCloverI18n, cloverI18n } = await load();
    initCloverI18n({
      resources: { de: { clover: { imageZoomIn: "Vergrößern" } } },
    });
    const { result } = renderHook(() => useCloverTranslation());
    expect(result.current.t("imageZoomIn")).toBe("Zoom in");

    act(() => {
      cloverI18n.chooseInterfaceLanguage("de");
    });
    expect(result.current.t("imageZoomIn")).toBe("Vergrößern");
  });
});
