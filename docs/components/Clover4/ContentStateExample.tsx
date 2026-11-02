"use client";

import type { ContentStateOutput } from "@nulib/clover";
import dynamic from "next/dynamic";
import React, { useId, useState } from "react";
import { encodeContentState } from "docs/components/Clover4/Demos";
import { ExampleSwitch } from "docs/components/Clover4/ExampleSwitch";
import {
  AgentPreview,
  usePreviewHost,
} from "docs/components/Clover4/PreviewHost";
import frame from "docs/components/Clover4/ViewerDocs.module.css";
import { resources } from "docs/components/Playground/playground-config";
import { EXAMPLE, example } from "docs/lib/example";
import { useRouter } from "docs/lib/router";
import { useMock } from "docs/lib/useMock";
import styles from "./ContentStateExample.module.css";

/**
 * What it can show, by the playground's keys, under the switch's names (Mat, 2026-11-01:
 * "Resource type -- Image / Video"): the White catalog's pages, and the 1959 football
 * film in reels ("add option for a video. do the football films example"), so a region
 * and a time both come back.
 */
const SHOWN = [
  { key: "catalog", label: "Image" },
  { key: "film", label: "Video" },
].map(({ key, label }) => ({
  ...resources.find((resource) => resource.key === key)!,
  label,
}));

/**
 * The content state with a note of the page's own, where one is written (Mat,
 * 2026-11-01: "optional … text/plain … carry with the annotation if set"): the
 * annotation's body, plain text, as Digital Collections' shared links carry theirs, and
 * which Clover shows on the Canvas as it opens one.
 */
function withNote(state: ContentStateOutput, note: string): ContentStateOutput {
  if (!note.trim()) return state;
  const json = {
    ...state.json,
    body: { type: "TextualBody", value: note, format: "text/plain" },
  };
  return { json, encoded: encodeContentState(json) };
}

/** A Root over the resource, reporting where it is, its Body and its Items. */
const Shown = dynamic(
  () =>
    import("@nulib/clover").then((clover) => {
      function Shown({
        iiifContent,
        onContentStateChange,
      }: {
        iiifContent: string;
        onContentStateChange: (state: ContentStateOutput) => void;
      }) {
        return (
          <clover.Root
            iiifContent={iiifContent}
            onContentStateChange={onContentStateChange}
            className={styles.root}
          >
            <clover.Body style={{ height: "24rem" }} />
            <clover.Items />
          </clover.Root>
        );
      }
      return Shown;
    }),
  // Its Body's box meanwhile, so nothing under it moves as it arrives.
  { ssr: false, loading: () => <div className={styles.view} /> },
);

/**
 * The Content State page's example (Mat, 2026-11-01): a Root over the catalog or the
 * film, chosen on the switch over its card as every example's is (`ExampleSwitch`),
 * reporting where it is as `onContentStateChange` hands it: the annotation (`json`) and
 * the same encoded for a link (`encoded`), each shown as it comes, and a link that opens
 * it in the homepage's demo (`?iiif-content=`). Under it, the chosen resource's code,
 * which the page gives as children marked `data-option` by the playground's keys, as
 * `OptionsExample` takes them; keep the two in step.
 */
export function ContentStateExample({
  children,
}: {
  children?: React.ReactNode;
}) {
  const id = useId();
  const { basePath } = useRouter();
  const { ref, preview } = usePreviewHost();
  const [chosen, setChosen] = useState(0);
  const resource = SHOWN[chosen];
  const mock = useMock(resource.mock ? resource.resource : "");
  const iiifContent = resource.mock ? mock : resource.resource;
  const [reported, setState] = useState<ContentStateOutput | null>(null);
  const [note, setNote] = useState("");
  const state = reported && withNote(reported, note);
  return (
    <>
      {!preview && (
        <ExampleSwitch
          id={`${id}-resource`}
          label="Resource type"
          options={SHOWN.map(({ key, label }) => ({ key, label }))}
          chosen={chosen}
          onChoose={(index) => {
            setChosen(index);
            setState(null);
          }}
        />
      )}
      <figure ref={ref} className={frame.example}>
        {preview ? (
          <AgentPreview shown={preview} />
        ) : (
          <>
            <div className={frame.preview} {...example(EXAMPLE)}>
              <div className={styles.demo}>
                {iiifContent ? (
                  <Shown
                    key={resource.key}
                    iiifContent={iiifContent}
                    onContentStateChange={setState}
                  />
                ) : (
                  <div className={styles.view} />
                )}
                <div className={styles.note}>
                  <label htmlFor={`${id}-note`} className={styles.name}>
                    Note (optional)
                  </label>
                  <textarea
                    id={`${id}-note`}
                    className={styles.field}
                    rows={2}
                    value={note}
                    aria-describedby={`${id}-note-hint`}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <p id={`${id}-note-hint`} className={styles.hint}>
                    Plain text, carried as the annotation&rsquo;s body.
                  </p>
                </div>
                <div className={styles.forms}>
                  <div>
                    <p id={`${id}-json`} className={styles.name}>
                      As an object (json)
                    </p>
                    <pre
                      className={styles.box}
                      tabIndex={0}
                      role="region"
                      aria-labelledby={`${id}-json`}
                    >
                      {state ? JSON.stringify(state.json, null, 2) : "Loading…"}
                    </pre>
                  </div>
                  <div>
                    <p id={`${id}-encoded`} className={styles.name}>
                      Encoded for a link (encoded)
                    </p>
                    <pre
                      className={`${styles.box} ${styles.encoded}`}
                      tabIndex={0}
                      role="region"
                      aria-labelledby={`${id}-encoded`}
                    >
                      {state ? state.encoded : "Loading…"}
                    </pre>
                  </div>
                </div>
                {state && (
                  // The homepage's demo opens what `?iiif-content=` names, a content state too.
                  <a
                    className={`cta-outline ${styles.open}`}
                    href={`${basePath}/?iiif-content=${state.encoded}`}
                  >
                    Open this content state in the homepage demo
                    <span className="cta-arrow" aria-hidden="true">
                      →
                    </span>
                  </a>
                )}
              </div>
            </div>
            <div className={frame.code}>
              {/*
               * The chosen resource's code shows; the other's is hidden by CSS, not
               * `hidden`, so the page's Markdown keeps both (`data-shown`).
               */}
              {React.Children.map(children, (child) =>
                React.isValidElement<{
                  "data-option"?: string;
                  "data-shown"?: string;
                }>(child) && child.props["data-option"] !== undefined
                  ? React.cloneElement(child, {
                      "data-shown":
                        child.props["data-option"] === resource.key
                          ? ""
                          : undefined,
                    })
                  : child,
              )}
            </div>
          </>
        )}
      </figure>
    </>
  );
}
