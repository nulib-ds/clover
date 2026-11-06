"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useId, useState } from "react";

import { ExampleChecks } from "docs/components/Clover4/ExampleSwitch";
import { LiveLines } from "docs/components/Clover4/LiveCode";
import { Example } from "docs/components/Clover4/ViewerDocs";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import ResourceField, { OWN } from "docs/components/Playground/ResourceField";
import type { Line, Token, TokenKind } from "docs/lib/live-code";

/**
 * The languages `@nulib/clover` ships, each by its own name, checked as the interface
 * languages a site offers (`initCloverI18n({ languages })`), over one Viewer: with none
 * checked, Clover speaks the visitor's language, or English where it has none of theirs;
 * with some, About's heading offers them beside the visitor's. Over the Viewer, the
 * resource it shows: an address or content state of your own, or one of the example's,
 * each in several languages, so the resource's own choice shows beside the interface's
 * (Mat, 2026-11-05). Under it, the code that configures and draws it, as checked and
 * chosen. The page is in English, so a string in another language carries its `lang`
 * (WCAG 3.1.2). Leaving the page puts back what the page configures, which is nothing.
 */
const LANGUAGES: Array<{ tag: string; name: string }> = [
  { tag: "en", name: "English" },
  { tag: "es", name: "Español" },
  { tag: "fi", name: "Suomi" },
  { tag: "fr", name: "Français" },
  { tag: "ja", name: "日本語" },
  { tag: "nb", name: "Norsk bokmål" },
  { tag: "nn", name: "Norsk nynorsk" },
  { tag: "pt", name: "Português" },
  { tag: "zh-Hans", name: "简体中文" },
  { tag: "zh-Hant", name: "繁體中文" },
];

/**
 * Resources, each by its English label and a few words on its languages: the Cookbook's
 * simplest, in English alone, where the choice is the interface's alone; two more of the
 * IIIF Cookbook's, a Manifest in four from etu.wiki (nulib-ds/clover#321), a
 * Collection in English and Spanish from Canopy's fixtures, and Maktaba's manuscript,
 * whose record is in no language and whose annotations are in Arabic and English.
 */
const RESOURCES = [
  {
    // One language: About offers only the interface's, as your site checks them.
    key: "simple",
    title: "Simplest Image Example (IIIF Presentation v3)",
    description: "Its record in English alone",
    resource:
      "https://iiif.io/api/cookbook/recipe/0001-mvm-image/manifest.json",
  },
  {
    key: "whistler",
    title: "Whistler's Mother",
    description: "Its record in English and French",
    resource:
      "https://iiif.io/api/cookbook/recipe/0006-text-language/manifest.json",
    thumbnail:
      "https://iiif.io/api/image/3.0/example/reference/329817fc8a251a01c393f517d8a17d87-Whistlers_Mother/full/108,96/0/default.jpg",
  },
  {
    key: "koto",
    title: "Koto, chess, calligraphy, and painting",
    description: "Its record and annotations in English and Japanese",
    resource:
      "https://iiif.io/api/cookbook/recipe/0346-multilingual-annotation-body/manifest.json",
    thumbnail:
      "https://iiif.io/api/image/3.0/example/reference/36ca0a3370db128ec984b33d71a1543d-100320001004/full/213,96/0/default.jpg",
  },
  {
    key: "etu",
    title: "Eastern Jin Dynasty Wang Yizhi Reminiscence Post",
    description: "Its record in Chinese, both scripts, English and Japanese",
    resource:
      "https://gsh.etu.wiki/3/manifest/9f823420-8966-11e8-bdaa-13fa45aa92ea",
    // Its first Canvas's, as the Manifest gives none of its own.
    thumbnail:
      "https://gsh.etu.wiki/3/image/bafybeifv2i562mhfkqek5c6ic5ocj77ih3xubkonvrxgupi3wdtg5ufxl4/full/!300,300/0/default.jpg",
  },
  {
    key: "flags",
    title: "Multilingual Demo Collection",
    description: "A Collection in English and Spanish",
    resource:
      "https://nulib-ds.github.io/canopy-fixtures/iiif/presentation/3/i18n/collection.json",
  },
  {
    key: "maktaba",
    title: "The Rushd al-Ghāfil / Guide for the Heedless",
    description: "Its annotations in Arabic and English",
    resource:
      "https://iiif-maktaba.dc.library.northwestern.edu/dc8ff749-adad-42a7-81e0-0eb473ef88a5.json",
    thumbnail:
      "https://images.digital.library.illinois.edu/iiif/2/19870760-96bc-013c-4aba-02d0d7bfd6e4-d/full/!256,256/0/default.jpg",
  },
];

const Viewer = dynamic(
  () => import("@nulib/clover").then((clover) => clover.default),
  { ssr: false },
);

/** The translator, loaded on demand: Clover runs in the browser. */
const translator = () =>
  import("@nulib/clover").then(({ initCloverI18n }) => initCloverI18n());

/** The languages a site offers, as `initCloverI18n({ languages })` sets them. */
const offer = (languages: string[]) =>
  import("@nulib/clover").then(({ initCloverI18n }) =>
    initCloverI18n({ languages }).ready(),
  );

const run =
  (kind?: TokenKind) =>
  (text: string): Token => ({ kind, text });
const [keyword, str, tag, attr, punct, comment, plain] = [
  run("keyword"),
  run("string"),
  run("tag"),
  run("attr"),
  run("punctuation"),
  run("comment"),
  run(),
];
const line = (depth: number, tokens: Token[], mark = false): Line => ({
  depth,
  tokens,
  mark,
});
const blank = line(0, []);

/** `["en", "fi"]`, as both flavors write the languages. */
const listed = (languages: string[]): Token[] => [
  punct("["),
  ...languages.flatMap((each, at) => [
    ...(at ? [punct(", ")] : []),
    str(`"${each}"`),
  ]),
  punct("]"),
];

const configure = (languages: string[]): Token[] => [
  plain("initCloverI18n"),
  punct("({ "),
  plain("languages"),
  punct(": "),
  ...listed(languages),
  punct(" });"),
];

const NONE = "No interface languages defined.";

/** The React that draws the demo: the languages configured, then the Viewer. */
/**
 * What Clover offers besides the languages defined, and why, as comments under them
 * (Mat, 2026-11-05: "add note below this that for this resource other languages will show
 * up and why"): the browser's, the page's and the resource's own.
 */
function derivedLines(
  derived: Record<string, string>,
  depth: number,
  annotated: string[],
): Line[] {
  const tags = Object.keys(derived);
  if (!tags.length && !annotated.length) return [];
  return [
    // A line of its own above, so the note stands apart from the call.
    blank,
    line(depth, [comment("// Clover will show these too:")]),
    ...tags.map((tag) =>
      line(depth, [
        comment(`//   ${tag}, ${derived[tag].replace(/^From /, "from ")}`),
      ]),
    ),
    // An annotation set's languages, offered in its own section (Mat, 2026-11-05).
    ...(annotated.length
      ? [
          line(depth, [
            comment(
              `//   ${joined(annotated)}, in its annotations, from this resource`,
            ),
          ]),
        ]
      : []),
  ];
}

function reactLines(
  languages: string[],
  iiifContent: string,
  derived: Record<string, string>,
  annotated: string[],
): Line[] {
  const some = languages.length > 0;
  return [
    line(0, [
      keyword("import "),
      plain("Viewer"),
      ...(some ? [punct(", { "), plain("initCloverI18n"), punct(" }")] : []),
      keyword(" from "),
      str('"@nulib/clover"'),
      punct(";"),
    ]),
    blank,
    ...(some
      ? [
          line(0, [comment("// Defined interface languages.")]),
          line(0, configure(languages), true),
        ]
      : [line(0, [comment(`// ${NONE}`)])]),
    ...derivedLines(derived, 0, annotated),
    blank,
    line(0, [
      keyword("export default function "),
      plain("Page"),
      punct("() {"),
    ]),
    line(1, [keyword("return "), punct("(")]),
    line(2, [punct("<"), tag("Viewer")]),
    line(3, [attr("iiifContent"), punct("="), str(`"${iiifContent}"`)], true),
    line(2, [punct("/>")]),
    line(1, [punct(");")]),
    line(0, [punct("}")]),
  ];
}

/** The web components' HTML: the elements, the languages configured, the Viewer. */
function htmlLines(
  languages: string[],
  iiifContent: string,
  derived: Record<string, string>,
  annotated: string[],
): Line[] {
  const some = languages.length > 0;
  return [
    line(0, [
      punct("<"),
      tag("script"),
      plain(" "),
      attr("type"),
      punct("="),
      str('"module"'),
      punct(">"),
    ]),
    some
      ? line(1, [
          keyword("import "),
          punct("{ "),
          plain("initCloverI18n"),
          punct(" }"),
          keyword(" from "),
          str('"@nulib/clover/web-components"'),
          punct(";"),
        ])
      : line(1, [
          keyword("import "),
          str('"@nulib/clover/web-components"'),
          punct(";"),
        ]),
    ...(some
      ? [
          line(1, [comment("// Defined interface languages.")]),
          line(1, configure(languages), true),
        ]
      : []),
    ...derivedLines(derived, 1, annotated),
    line(0, [punct("</"), tag("script"), punct(">")]),
    blank,
    ...(some ? [] : [line(0, [comment(`<!-- ${NONE} -->`)])]),
    line(0, [punct("<"), tag("clover-viewer")]),
    line(1, [attr("iiif-content"), punct("="), str(`"${iiifContent}"`)], true),
    line(0, [punct("></"), tag("clover-viewer"), punct(">")]),
  ];
}

/** What a resource describes itself in, as About offers it: maps in two languages or more. */
function describedIn(resource: Record<string, any>): string[] {
  const pairs = [
    ...(Array.isArray(resource.metadata) ? resource.metadata : []),
    resource.requiredStatement,
  ].filter(Boolean);
  const maps = [
    resource.label,
    resource.summary,
    ...pairs.flatMap((pair: any) => [pair?.label, pair?.value]),
  ];
  const tags = maps
    .filter((map) => map && typeof map === "object" && !Array.isArray(map))
    .map((map) =>
      Object.keys(map).filter((tag) => tag !== "none" && tag !== "@none"),
    )
    .filter((each) => each.length > 1);
  return [...new Set(tags.flat())];
}

/**
 * What a resource's annotations come in, one language each, as an annotation set offers
 * them in its section: their textual bodies' languages, where there are two or more. The
 * first few pages of its first Canvases, embedded or referenced (Maktaba's manuscript's).
 */
async function annotatedIn(resource: Record<string, any>): Promise<string[]> {
  const canvases = (Array.isArray(resource.items) ? resource.items : []).slice(
    0,
    3,
  );
  const pages = canvases.flatMap((canvas: any) =>
    Array.isArray(canvas?.annotations) ? canvas.annotations : [],
  );
  const read = await Promise.all(
    pages.slice(0, 4).map(async (page: any) => {
      if (Array.isArray(page?.items)) return page;
      if (typeof page?.id !== "string") return undefined;
      const response = await fetch(page.id).catch(() => undefined);
      return response?.ok ? response.json().catch(() => undefined) : undefined;
    }),
  );
  const tags = read
    .flatMap((page: any) => (Array.isArray(page?.items) ? page.items : []))
    .flatMap((annotation: any) => [annotation?.body].flat())
    .filter((body: any) => body?.type === "TextualBody")
    .map((body: any) => body.language)
    .filter(
      (tag: unknown): tag is string =>
        typeof tag === "string" && tag !== "none",
    );
  const languages = [...new Set(tags)];
  return languages.length > 1 ? languages : [];
}

/** "a", "a and b", "a, b, and c": with the serial comma (Mat, 2026-11-05). */
const joined = (items: string[]) =>
  items.length > 2
    ? `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
    : items.join(" and ");

/**
 * Why Clover offers a language without the site naming it, by the tag it speaks it in
 * (Mat, 2026-11-05: "add a special mark … if it is detected as the users lang, through
 * os, or system, or html tag … if it is `en` for a non `en` users due to there not being
 * any other available option, then state that", and "do the same … if resource has that
 * lang"): the visitor's, from the browser, which takes it from the system; the page's
 * `<html lang>`; the languages the resource describes itself in; and English, where it
 * has none of the visitor's.
 */
function useDetected(resource: string) {
  const [found, setFound] = useState<{
    strings: (tag: string) => string | undefined;
    browser?: string;
    page?: string;
    none: boolean;
  }>();
  useEffect(() => {
    void translator().then((i18n) => {
      const strings = (tag: string) => i18n.stringsFor(tag);
      const visitor = [...(navigator.languages ?? []), navigator.language];
      const browser = visitor.map(strings).find(Boolean);
      const lang = document.documentElement.lang;
      setFound({
        strings,
        browser,
        page: lang ? strings(lang) : undefined,
        none: !browser && visitor.filter(Boolean).length > 0,
      });
    });
  }, []);
  const [described, setDescribed] = useState<string[]>([]);
  const [annotated, setAnnotated] = useState<string[]>([]);
  useEffect(() => {
    setDescribed([]);
    setAnnotated([]);
    if (!/^https?:\/\//.test(resource)) return;
    let gone = false;
    fetch(resource)
      .then((response) => (response.ok ? response.json() : undefined))
      .then(async (json) => {
        if (gone || !json) return;
        setDescribed(describedIn(json));
        const languages = await annotatedIn(json);
        if (!gone) setAnnotated(languages);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [resource]);
  const notes: Record<string, string> = {};
  const pageTag = found?.page;
  if (!found) return { notes, page: pageTag, annotated };
  const why: Record<string, string[]> = {};
  const add = (tag: string | undefined, reason: string) => {
    if (tag) (why[tag] ??= []).push(reason);
  };
  add(found.browser, "your browser");
  // "This HTML page", so it is never taken for the page of docs (Mat, 2026-11-05).
  add(found.page, "this HTML page");
  for (const tag of described) add(found.strings(tag), "this resource");
  for (const [tag, reasons] of Object.entries(why))
    notes[tag] = `From ${joined(reasons)}`;
  if (found.none) {
    const english = "Clover has none of your languages";
    notes.en = notes.en ? `${notes.en}; ${english}` : english;
  }
  return { notes, page: pageTag, annotated };
}

export function LanguagesDemo() {
  // None checked to start (Mat, 2026-11-05): Clover goes by the visitor's language, and
  // English where it has none of theirs.
  const [checked, setChecked] = useState<string[]>([]);
  // One of ours, by key, or `OWN` for an address or content state given.
  const [current, setCurrent] = useState("whistler");
  const [own, setOwn] = useState("");
  const resource =
    current === OWN
      ? own
      : (RESOURCES.find((each) => each.key === current) ?? RESOURCES[0])
          .resource;
  const id = useId();
  const { notes: locked, annotated } = useDetected(resource);
  // What Clover offers besides, for the code's note: the derived, less those defined.
  const derived = Object.fromEntries(
    Object.entries(locked).filter(([tag]) => !checked.includes(tag)),
  );
  // The languages the site defines: those checked, and nothing derived (Mat, 2026-11-05).
  const defined = checked;
  const definedKey = defined.join(" ");
  useEffect(() => {
    void offer(definedKey ? definedKey.split(" ") : []);
  }, [definedKey]);
  // Back to what the page itself configures (nothing), and to the visitor's own
  // language, on leaving it.
  useEffect(
    () => () => {
      void offer([]).then(() =>
        translator().then((i18n) => i18n.chooseInterfaceLanguage()),
      );
    },
    [],
  );
  return (
    <div style={{ marginBottom: "2rem" }}>
      {/* Each language by its own name, in its own language (WCAG 3.1.2). */}
      <ExampleChecks
        id={`${id}-languages`}
        label="Defined interface languages"
        options={LANGUAGES.map((language) => ({
          key: language.tag,
          label: language.name,
          lang: language.tag,
        }))}
        checked={checked}
        locked={locked}
        onChange={setChecked}
      />
      {/* The homepage's select (Mat, 2026-11-05: "it should appear like the homepage select"). */}
      <div className={styles.resourceSelect}>
        <ResourceField
          current={current}
          own={own}
          items={RESOURCES}
          cookbook={false}
          onPick={setCurrent}
          onOwn={(content) => {
            setOwn(content);
            setCurrent(OWN);
          }}
        />
      </div>
      <Example>
        <Viewer
          iiifContent={resource}
          // Under the page's "Languages Clover ships" h2.
          headingLevel={3}
          style={{ ["--clover-body-height" as string]: "420px" }}
        />
        <LiveLines
          react={reactLines(defined, resource, derived, annotated)}
          html={htmlLines(defined, resource, derived, annotated)}
        />
      </Example>
    </div>
  );
}
