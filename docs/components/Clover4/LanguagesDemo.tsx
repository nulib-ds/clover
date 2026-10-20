"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";

import { useMock } from "docs/lib/useMock";

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

const pill: React.CSSProperties = {
  padding: "0.25rem 0.75rem",
  borderRadius: "999px",
  border: "1px solid currentColor",
  background: "transparent",
  font: "inherit",
  fontSize: "0.8125rem",
  cursor: "pointer",
};

/* Pressed is a solid fill: white on the accent keeps 4.5:1, and shows by more than hue. */
const pillPressed: React.CSSProperties = {
  background: "var(--accent-9)",
  border: "1px solid var(--accent-9)",
  color: "var(--accent-contrast)",
};

export function LanguagesDemo() {
  const url = useMock("paged/manifest.json");
  const [tag, setTag] = useState("en");
  // Back to the page's language when the reader leaves the page.
  useEffect(
    () => () => {
      void speak(document.documentElement.lang || "en");
    },
    [],
  );
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      <div
        role="group"
        aria-label="Clover's language"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.375rem",
          marginBottom: "1rem",
        }}
      >
        {LANGUAGES.map((language) => (
          <button
            key={language.tag}
            type="button"
            lang={language.tag}
            aria-pressed={language.tag === tag}
            onClick={() => {
              setTag(language.tag);
              void speak(language.tag);
            }}
            style={{
              ...pill,
              ...(language.tag === tag ? pillPressed : undefined),
            }}
          >
            {language.name}
          </button>
        ))}
      </div>
      {url && (
        <Viewer
          iiifContent={url}
          // Under the page's "Languages Clover ships" h2.
          headingLevel={3}
          style={{ ["--clover-content-height" as string]: "420px" }}
        />
      )}
    </div>
  );
}
