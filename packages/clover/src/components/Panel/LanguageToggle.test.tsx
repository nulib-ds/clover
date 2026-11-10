import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";

import { initCloverI18n } from "../../i18n";
import { cloverI18n } from "../../i18n/config";

const cloverI18nChosen = () => cloverI18n.chosenLanguage;
import * as Clover from "../../index";

/*
 * About's one language toggle, as Mat set it out on 2026-11-05. Clover's interface
 * language (its control labels, section titles and announcements) is the visitor's where
 * Clover has strings for it, else the site's (the languages configured, then the page's);
 * a resource's text, the visitor's, then the interface's, then the site's, else each
 * value's first. The toggle, after a globe, offers the resource's languages and the
 * interface languages it does not already name, each once, wherever there are two or
 * more. Choosing one the resource has reads it in that language and speaks it too where
 * Clover has strings for it; one only the site offers moves the interface alone.
 */

const map = (zhHant: string, zhCN: string, en: string, ja: string) => ({
  "zh-Hant": [zhHant],
  "zh-CN": [zhCN],
  en: [en],
  ja: [ja],
});

/** Shaped as nulib-ds/clover#321's manifest: every value in four languages. */
const multilingual = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.org/manifest/interface",
  type: "Manifest",
  label: map("感懷帖", "感怀帖", "Reminiscence Post", "感懐帖"),
  metadata: [
    {
      label: map("朝代", "朝代", "Dynasty", "王朝"),
      value: map("東晉", "东晋", "Eastern Jin", "東晋"),
    },
  ],
  items: [
    {
      id: "https://example.org/canvas/interface/1",
      type: "Canvas",
      label: { none: ["1"] },
      width: 100,
      height: 100,
      items: [],
    },
  ],
};

/** A Manifest in German and English only. */
const german = {
  ...multilingual,
  id: "https://example.org/manifest/german",
  label: { de: ["Ein Brief"], en: ["A letter"] },
  metadata: [],
};

/** A Manifest in English and French only. */
const french = {
  ...multilingual,
  id: "https://example.org/manifest/french",
  label: { en: ["A letter"], fr: ["Une lettre"] },
  metadata: [],
};

function visitor(...languages: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
  vi.spyOn(navigator, "language", "get").mockReturnValue(languages[0] ?? "");
}

function draw(
  manifest: Clover.RootProps["iiifContent"],
  props: Partial<Clover.PanelProps> = {},
) {
  return render(
    <Clover.Root iiifContent={manifest}>
      <Clover.Label as="h1" />
      <Clover.Panel layout="accordion" {...props} />
    </Clover.Root>,
  );
}

const title = (name: string) =>
  screen.findByRole("heading", { level: 1, name });

beforeEach(() => {
  document.documentElement.lang = "en";
  initCloverI18n({ languages: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The toggle, by its name in the interface language. */
const toggle = (name = "Language") => screen.findByRole("group", { name });

/** The codes the toggle offers, in order. */
const codes = (group: HTMLElement) =>
  within(group)
    .getAllByRole("radio")
    .map((radio) => radio.closest("label")?.querySelector("span")?.textContent);

describe("About's language toggle", () => {
  it("offers an English visitor each of the resource's languages once, after a globe", async () => {
    visitor("en-US", "en");
    draw(multilingual);
    expect(await title("Reminiscence Post")).toHaveAttribute("lang", "en");
    const group = await toggle();
    expect(codes(group)).toEqual(["ZH-HANT", "ZH-CN", "EN", "JA"]);
    expect(within(group).getByRole("radio", { name: /English/ })).toBeChecked();
    expect(screen.getAllByRole("group", { name: "Language" })).toHaveLength(1);
    expect(document.querySelector(".clover-languages-glyph")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows a Japanese visitor Japanese values and labels", async () => {
    visitor("ja-JP", "ja");
    draw(multilingual);
    expect(await title("感懐帖")).toHaveAttribute("lang", "ja");
    await screen.findByRole("button", { name: "概要" });
    expect(screen.getByText("概要")).toHaveAttribute("lang", "ja");
    const group = await toggle("言語");
    // Japanese is the resource's own, so it is offered once.
    expect(codes(group)).toEqual(["ZH-HANT", "ZH-CN", "EN", "JA"]);
    expect(within(group).getByRole("radio", { name: /日本語/ })).toBeChecked();
  });

  it("speaks a language of the resource's chosen, where Clover has strings for it", async () => {
    visitor("en");
    draw(multilingual);
    const group = await toggle();
    act(() => {
      fireEvent.click(within(group).getByRole("radio", { name: /日本語/ }));
    });
    expect(await title("感懐帖")).toHaveAttribute("lang", "ja");
    expect(await screen.findByRole("button", { name: "概要" })).toBeVisible();
    expect(
      within(await toggle("言語")).getByRole("radio", { name: /日本語/ }),
    ).toBeChecked();
  });

  it("lets a language chosen for one resource go with it, the interface back to the visitor's", async () => {
    visitor("en");
    const { rerender } = draw(multilingual);
    const first = await toggle();
    act(() => {
      fireEvent.click(within(first).getByRole("radio", { name: /日本語/ }));
    });
    expect(await screen.findByRole("button", { name: "概要" })).toBeVisible();
    rerender(
      <Clover.Root iiifContent={french}>
        <Clover.Label as="h1" />
        <Clover.Panel layout="accordion" />
      </Clover.Root>,
    );
    expect(await title("A letter")).toHaveAttribute("lang", "en");
    expect(await screen.findByRole("button", { name: "About" })).toBeVisible();
    expect(cloverI18nChosen()).toBeUndefined();
  });

  it("lets a language chosen go with its Root, where a host mounts one Root a resource", async () => {
    visitor("en");
    const { rerender } = draw(multilingual);
    const first = await toggle();
    act(() => {
      fireEvent.click(within(first).getByRole("radio", { name: /日本語/ }));
    });
    expect(await screen.findByRole("button", { name: "概要" })).toBeVisible();
    rerender(
      <Clover.Root key="french" iiifContent={french}>
        <Clover.Label as="h1" />
        <Clover.Panel layout="accordion" />
      </Clover.Root>,
    );
    expect(await title("A letter")).toHaveAttribute("lang", "en");
    expect(await screen.findByRole("button", { name: "About" })).toBeVisible();
    expect(cloverI18nChosen()).toBeUndefined();
  });

  it("keeps an interface language chosen for itself on another resource", async () => {
    visitor("en");
    initCloverI18n({ languages: ["en", "fi"] });
    const { rerender } = draw(french);
    const first = await toggle();
    act(() => {
      fireEvent.click(within(first).getByRole("radio", { name: /suomi/i }));
    });
    expect(await screen.findByRole("button", { name: "Tiedot" })).toBeVisible();
    rerender(
      <Clover.Root iiifContent={german}>
        <Clover.Label as="h1" />
        <Clover.Panel layout="accordion" />
      </Clover.Root>,
    );
    // The French one put away at once (Mat, 2026-11-06), so this title is the German one.
    expect(
      screen.queryByRole("heading", { level: 1, name: "A letter" }),
    ).toBeNull();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^(Ein Brief|A letter)$/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiedot" })).toBeVisible();
  });

  it("keeps the interface where Clover has no strings for the language chosen", async () => {
    visitor("en");
    draw(german);
    const group = await toggle();
    expect(codes(group)).toEqual(["DE", "EN"]);
    act(() => {
      fireEvent.click(within(group).getByRole("radio", { name: /Deutsch/ }));
    });
    expect(await title("Ein Brief")).toHaveAttribute("lang", "de");
    expect(screen.getByRole("button", { name: "About" })).toBeVisible();
  });

  it("offers a site's languages the resource has none of, which move the interface alone", async () => {
    visitor("en");
    initCloverI18n({ languages: ["en", "fi"] });
    draw(french);
    const group = await toggle();
    expect(codes(group)).toEqual(["EN", "FR", "FI"]);
    act(() => {
      fireEvent.click(within(group).getByRole("radio", { name: /suomi/i }));
    });
    expect(await screen.findByRole("button", { name: "Tiedot" })).toBeVisible();
    // No Finnish in the resource: it reads on in English.
    expect(await title("A letter")).toBeInTheDocument();
    expect(
      within(await toggle("Kieli")).getByRole("radio", { name: /suomi/i }),
    ).toBeChecked();
  });

  it("shows a visitor their own language in the values where Clover has no strings for it", async () => {
    visitor("de-DE", "de");
    draw(german);
    expect(await title("Ein Brief")).toHaveAttribute("lang", "de");
    expect(await screen.findByRole("button", { name: "About" })).toBeVisible();
  });

  it("reads a visitor of Simplified Chinese in Simplified, the interface and the values", async () => {
    visitor("zh-SG");
    draw(multilingual);
    expect(await title("感怀帖")).toHaveAttribute("lang", "zh-CN");
    await screen.findByRole("button", { name: "简介" });
    expect(screen.getByText("简介")).toHaveAttribute("lang", "zh-Hans");
    // zh-CN names Simplified Chinese: offered once.
    expect(codes(await toggle("语言"))).toEqual([
      "ZH-HANT",
      "ZH-CN",
      "EN",
      "JA",
    ]);
  });

  it("leaves either set out: interfaceLanguages={false}, languages={false}", async () => {
    visitor("ja");
    const { unmount } = draw(french, { interfaceLanguages: false });
    expect(codes(await toggle("言語"))).toEqual(["EN", "FR"]);
    unmount();
    draw(french, { languages: false });
    expect(codes(await toggle("言語"))).toEqual(["JA", "EN"]);
  });

  it("folds into the globe's menu as soon as its codes would reach About's title", async () => {
    visitor("en");
    // The title's words end at 300px; the heading's controls start at 250px.
    const box = (left: number, right: number) =>
      ({
        left,
        right,
        width: right - left,
        top: 0,
        bottom: 20,
        height: 20,
        x: left,
        y: 0,
      }) as DOMRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.classList.contains("clover-sections-label"))
          return box(10, 300);
        if (this.classList.contains("clover-sections-actions"))
          return box(250, 400);
        return box(0, 0);
      },
    );
    draw(french);
    const button = await screen.findByRole("button", { name: "EN, Language" });
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
    fireEvent.click(button);
    const menu = await toggle();
    expect(
      within(menu)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(["English", "français"]);
  });

  it("draws its codes where the title has room", async () => {
    visitor("en");
    draw(french);
    expect(codes(await toggle())).toEqual(["EN", "FR"]);
  });

  it("folds past five languages into the globe's menu alone, Escape closing it", async () => {
    visitor("ja");
    initCloverI18n({ languages: ["en", "fr", "fi"] });
    render(
      <Clover.Root iiifContent={multilingual}>
        <Clover.About />
      </Clover.Root>,
    );
    const button = await screen.findByRole("button", { name: "JA, 言語" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    const menu = await toggle("言語");
    expect(
      within(menu)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual([
      "繁體中文",
      "中文（中国）",
      "English",
      "日本語",
      "français",
      "suomi",
    ]);
    const japanese = within(menu).getByRole("radio", { name: "日本語" });
    expect(japanese).toBeChecked();
    japanese.focus();
    fireEvent.keyDown(japanese, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "言語" })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("keeps an annotation set's languages in its own section, unless About offers them all", async () => {
    visitor("en");
    const annotations = (canvas: string) => [
      {
        id: "https://example.org/page/annotated",
        type: "AnnotationPage",
        items: ["ar", "en"].map((language) => ({
          id: `https://example.org/annotation/${language}`,
          type: "Annotation",
          motivation: "commenting",
          body: {
            type: "TextualBody",
            value: language === "ar" ? "نص" : "Text",
            language,
          },
          target: canvas,
        })),
      },
    ];
    const canvas = "https://example.org/canvas/interface/1";
    const annotated = {
      ...multilingual,
      id: "https://example.org/manifest/annotated",
      label: { none: ["A page"] },
      metadata: [],
      items: [{ ...multilingual.items[0], annotations: annotations(canvas) }],
    };
    const { container, unmount } = render(
      <Clover.Root iiifContent={annotated}>
        <Clover.About />
        <Clover.Annotations />
      </Clover.Root>,
    );
    // Only the annotations come in two languages: the choice is theirs, in their section.
    const set = await screen.findByRole("group", { name: "Language" });
    expect(set.closest(".clover-annotations")).not.toBeNull();
    expect(codes(set)).toEqual(["AR", "EN"]);
    expect(set.querySelector(".clover-languages-glyph")).not.toBeNull();
    expect(container.querySelector(".clover-about-languages")).toBeNull();
    act(() => {
      fireEvent.click(within(set).getByRole("radio", { name: /العربية/ }));
    });
    expect((await screen.findAllByText("نص")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Text")).toBeNull();
    // Its own: the rest of the page and the interface keep theirs.
    expect(cloverI18nChosen()).toBeUndefined();
    unmount();
    // About offers both, as the resource describes itself in them: the set follows it.
    render(
      <Clover.Root
        iiifContent={{ ...annotated, label: { ar: ["صفحة"], en: ["A page"] } }}
      >
        <Clover.About />
        <Clover.Annotations />
      </Clover.Root>,
    );
    const about = await screen.findByRole("group", { name: "Language" });
    expect(
      about.closest(".clover-about, .clover-about-actions"),
    ).not.toBeNull();
    expect(screen.getAllByRole("group", { name: "Language" })).toHaveLength(1);
    act(() => {
      fireEvent.click(within(about).getByRole("radio", { name: /العربية/ }));
    });
    expect((await screen.findAllByText("نص")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Text")).toBeNull();
  });

  it("offers the toggle over About, alone", async () => {
    visitor("en");
    render(
      <Clover.Root iiifContent={multilingual}>
        <Clover.About />
      </Clover.Root>,
    );
    expect(codes(await toggle())).toEqual(["ZH-HANT", "ZH-CN", "EN", "JA"]);
  });

  it("offers nothing where there is one language to read in", async () => {
    visitor("en");
    draw({ ...german, label: { en: ["A letter"] } });
    expect(await title("A letter")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
    expect(document.querySelector(".clover-languages-glyph")).toBeNull();
  });
});

describe("Language, the toggle as a part of its own", () => {
  it("offers the resource's languages wherever a layout places it, as About does", async () => {
    visitor("en");
    render(
      <Clover.Root iiifContent={multilingual}>
        <Clover.Label as="h1" />
        <Clover.Language />
      </Clover.Root>,
    );
    expect(codes(await toggle())).toEqual(["ZH-HANT", "ZH-CN", "EN", "JA"]);
    fireEvent.click(screen.getByRole("radio", { name: /日本語/ }));
    expect(await title("感懐帖")).toBeInTheDocument();
  });

  it("menu: folded into the globe and the code in use, however few there are", async () => {
    visitor("en");
    render(
      <Clover.Root iiifContent={multilingual}>
        <Clover.Label as="h1" />
        <Clover.Language menu />
      </Clover.Root>,
    );
    const button = await screen.findByRole("button", { name: "EN, Language" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(button);
    const menu = await toggle();
    expect(
      within(menu)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(["繁體中文", "中文（中国）", "English", "日本語"]);
    fireEvent.click(within(menu).getByRole("radio", { name: "日本語" }));
    expect(await title("感懐帖")).toBeInTheDocument();
  });

  it("interfaceLanguages={false}: the resource's languages alone", async () => {
    visitor("fr");
    initCloverI18n({ languages: ["en"] });
    render(
      <Clover.Root iiifContent={german}>
        <Clover.Language interfaceLanguages={false} />
      </Clover.Root>,
    );
    expect(codes(await toggle("Langue"))).toEqual(["DE", "EN"]);
  });
});
