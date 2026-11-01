"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useId, useState } from "react";

import { useMock } from "docs/lib/useMock";
import { EXAMPLE, example } from "docs/lib/example";
import { ExampleSwitch } from "docs/components/Clover4/ExampleSwitch";

/**
 * The languages `@nulib/clover` ships, each by its own name, switching one Viewer's
 * interface between them (`initCloverI18n`), on the White catalog (a `paged` mock). The
 * page is in English, so a string in another language carries its `lang` (WCAG 3.1.2).
 * Clover's language is the page's, not the demo's: leaving the page puts it back to the
 * page's.
 */
const LANGUAGES: Array<{ tag: string; name: string }> = [
  { tag: "en", name: "English" },
  { tag: "es", name: "Español" },
  { tag: "fi", name: "Suomi" },
  { tag: "fr", name: "Français" },
  { tag: "nb", name: "Norsk bokmål" },
  { tag: "nn", name: "Norsk nynorsk" },
  { tag: "pt", name: "Português" },
];

const Viewer = dynamic(
  () => import("@nulib/clover").then((clover) => clover.default),
  { ssr: false },
);

/** Clover's language, set as a page sets it. Loaded on demand: Clover runs in the browser. */
const speak = (lng: string) =>
  import("@nulib/clover").then(({ initCloverI18n }) => initCloverI18n({ lng }));

export function LanguagesDemo() {
  const url = useMock("paged/manifest.json");
  const [tag, setTag] = useState("en");
  const id = useId();
  // Back to the page's language when the reader leaves the page.
  useEffect(
    () => () => {
      void speak(document.documentElement.lang || "en");
    },
    [],
  );
  return (
    <div style={{ marginBottom: "2rem" }} {...example(EXAMPLE)}>
      {/* Each language by its own name, in its own language (WCAG 3.1.2). */}
      <ExampleSwitch
        id={`${id}-language`}
        label="Clover's language"
        options={LANGUAGES.map((language) => ({
          key: language.tag,
          label: language.name,
          lang: language.tag,
        }))}
        chosen={LANGUAGES.findIndex((language) => language.tag === tag)}
        onChoose={(index) => {
          setTag(LANGUAGES[index].tag);
          void speak(LANGUAGES[index].tag);
        }}
      />
      {url && (
        <Viewer
          iiifContent={url}
          // Under the page's "Languages Clover ships" h2.
          headingLevel={3}
          style={{ ["--clover-body-height" as string]: "420px" }}
        />
      )}
    </div>
  );
}
