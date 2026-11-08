"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";

import { ExampleSwitch } from "docs/components/Clover4/ExampleSwitch";
import styles from "docs/components/RacycleTest/RacycleTest.module.css";
import { jsonLines, markedRuns } from "docs/lib/json-lines";
import { FULL_WIDTH } from "docs/lib/full-width";
import { EXAMPLE, example } from "docs/lib/example";
import type { Line, TokenKind } from "docs/lib/live-code";
import { useMock } from "docs/lib/useMock";

/**
 * The Racycle catalog (`docs/mocks/racycle/`), rebuilt one decision at a time (Mat,
 * 2026-11-06): the Viewer over the mock, and under it the JSON it reads, the Manifest's or
 * the current Canvas's, each Annotation in it marked. For `/test/racycle`.
 */

const Viewer = dynamic(
  () =>
    import("@nulib/clover").then(
      (clover) => clover.default as React.ComponentType<any>,
    ),
  { ssr: false },
);

/** Each run's color, as Nextra's highlighter gives the editor's (`--shiki-editor`). */
const COLOR: Partial<Record<TokenKind, string>> = {
  keyword: "var(--editor-keyword)",
  string: "var(--editor-string)",
  punctuation: "var(--editor-punctuation)",
  number: "var(--editor-number)",
  property: "var(--editor-property)",
};

const VIEWS = [
  { key: "manifest", label: "Manifest" },
  { key: "canvas", label: "Current Canvas" },
];

type Json = Record<string, any>;

/**
 * What is marked, in words, beside the tint (1.4.1): how many annotations, and their lines
 * where they are few enough to list. Each marked object says `"type": "Annotation"` too.
 */
function markedNote(lines: Line[]) {
  const runs = markedRuns(lines);
  if (runs.length === 0) return "No annotations.";
  const count = `${runs.length} ${runs.length === 1 ? "annotation" : "annotations"} marked`;
  if (runs.length > 4) return `${count}.`;
  const where = runs
    .map(([from, to]) => (from === to ? `${from}` : `${from}–${to}`))
    .join(", ");
  return `${count}, ${runs.length === 1 && runs[0][0] === runs[0][1] ? "line" : "lines"} ${where}.`;
}

function JsonBlock({ lines, name }: { lines: Line[]; name: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const text = useMemo(
    () =>
      lines
        .map(
          (line) =>
            "  ".repeat(line.depth) +
            line.tokens.map((token) => token.text).join(""),
        )
        .join("\n"),
    [lines],
  );
  return (
    <div className={`docs-code ${styles.json}`}>
      {/* A box that scrolls, so the keyboard reaches all of it (2.1.1), named for what it shows. */}
      <pre
        data-lang="json"
        className={styles.scroll}
        tabIndex={0}
        role="region"
        aria-label={name}
      >
        <code className="nextra-code language-json">
          {lines.map((line, index) => (
            <React.Fragment key={index}>
              {index > 0 && "\n"}
              <span data-highlighted-line={line.mark ? "" : undefined}>
                {"  ".repeat(line.depth)}
                {line.tokens.map((token, at) => (
                  <span
                    key={at}
                    style={
                      token.kind && COLOR[token.kind]
                        ? ({
                            "--shiki-editor": COLOR[token.kind],
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {token.text}
                  </span>
                ))}
              </span>
            </React.Fragment>
          ))}
        </code>
      </pre>
      <button
        type="button"
        className="docs-code-copy"
        onClick={() =>
          navigator.clipboard?.writeText(text).then(
            () => setCopied(true),
            () => undefined,
          )
        }
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span role="status" className="docs-code-status">
        {copied ? "Copied the JSON" : ""}
      </span>
    </div>
  );
}

export default function RacycleTest() {
  const url = useMock("racycle/manifest.json");
  const [manifest, setManifest] = useState<Json | null>(null);
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [view, setView] = useState(0);

  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((response) => response.json())
      .then((json) => live && setManifest(json))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [url]);

  const canvas = useMemo(() => {
    const items: Json[] = manifest?.items ?? [];
    return items.find((each) => each.id === canvasId) ?? items[0] ?? null;
  }, [manifest, canvasId]);

  const shown = VIEWS[view].key === "canvas" ? canvas : manifest;
  const lines = useMemo(() => (shown ? jsonLines(shown) : []), [shown]);
  const name =
    VIEWS[view].key === "canvas"
      ? `Current Canvas JSON${canvas ? `, ${canvasLabel(canvas)}` : ""}`
      : "Manifest JSON";

  return (
    <div className={styles.page}>
      <style>{FULL_WIDTH}</style>
      <h1 className={styles.title}>Racycle catalog (test)</h1>
      <div className={styles.viewer} {...example(EXAMPLE)}>
        {url && (
          <Viewer
            iiifContent={url}
            headingLevel={2}
            onCanvasChange={setCanvasId}
            style={{ ["--clover-body-height" as string]: "32rem" }}
          />
        )}
      </div>
      <section aria-labelledby="racycle-json" className={styles.section}>
        <h2 id="racycle-json" className={styles.subtitle}>
          JSON
        </h2>
        <ExampleSwitch
          id="racycle-json-view"
          label="Resource"
          options={VIEWS}
          chosen={view}
          onChoose={setView}
        />
        {shown && (
          <>
            <p className={styles.note}>
              {VIEWS[view].key === "canvas" && canvas
                ? `${canvasLabel(canvas)}. `
                : ""}
              {markedNote(lines)}
            </p>
            {/* Keyed by what it shows, so each opens at its top. */}
            <JsonBlock key={name} lines={lines} name={name} />
          </>
        )}
      </section>
    </div>
  );
}

/** A Canvas's label as published, in whatever language it gives first. */
function canvasLabel(canvas: Json): string {
  const label = canvas.label ?? {};
  const first = Object.values(label)[0];
  return Array.isArray(first) && first.length ? String(first[0]) : "Canvas";
}
