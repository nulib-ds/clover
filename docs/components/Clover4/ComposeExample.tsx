"use client";

import dynamic from "next/dynamic";
import React from "react";

import compose from "docs/components/Clover4/ComposeExample.module.css";
import {
  type EditorPart,
  PartsEditor,
} from "docs/components/Clover4/PartsEditor";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import {
  type CodeTree,
  type Knob,
  type Values,
  knobId,
} from "docs/lib/live-code";
import { EXAMPLE, example } from "docs/lib/example";
import {
  AgentPreview,
  usePreviewHost,
} from "docs/components/Clover4/PreviewHost";

/**
 * Composing's first example, live (Mat, 2026-10-23: "make this draggable/customizable
 * like the example on homepage", "in an example container like we do on components
 * docs"): a Root with Body and an aside of parts beside it, its code under it in both
 * flavors, as the homepage's example viewer's editor is. The reader moves a part among
 * the aside's: by dragging its grip, by the grip's arrow keys, or by pressing the grip and
 * then Move up or Move down, so no move needs a drag (WCAG 2.5.7). They pick the title's
 * element and what the other Label names in the code. The demo follows, so the code is
 * always what it shows.
 */

/** The example's resource: the IIIF Cookbook's book, as Composing's examples read. */
const URL = "https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json";

type PartKey = "title" | "canvas" | "position" | "previous" | "next";

const KNOBS: Knob[] = [
  {
    prop: "as",
    value: "h3",
    options: ["h3", "h4", "p"],
    label: "The title's element",
  },
  {
    prop: "of",
    value: "canvas",
    options: ["canvas", "manifest"],
    label: "What the other Label names",
  },
];

const AS = knobId(KNOBS[0]);
const OF = knobId(KNOBS[1]);

/** The aside's parts: each one's code, and its name for assistive technology. */
const PARTS: Record<PartKey, EditorPart> = {
  title: {
    name: "the title's Label",
    node: {
      jsx: "Clover.Label",
      html: "clover-label",
      attrs: [{ prop: "as", attribute: "as", knob: AS }],
      key: "title",
    },
  },
  canvas: {
    name: "the other Label",
    node: {
      jsx: "Clover.Label",
      html: "clover-label",
      attrs: [{ prop: "of", attribute: "of", knob: OF }],
      key: "canvas",
    },
  },
  position: {
    name: "Position",
    node: {
      jsx: "Clover.Position",
      html: "clover-position",
      attrs: [],
      key: "position",
    },
  },
  previous: {
    name: "Previous",
    node: {
      jsx: "Clover.Previous",
      html: "clover-previous",
      attrs: [],
      key: "previous",
    },
  },
  next: {
    name: "Next",
    node: { jsx: "Clover.Next", html: "clover-next", attrs: [], key: "next" },
  },
};

const START: PartKey[] = ["title", "canvas", "position", "previous", "next"];

/** The example's code, its aside's parts in the reader's order. */
const treeOf = (order: PartKey[]): CodeTree => ({
  url: URL,
  imports: [
    'import * as Clover from "@nulib/clover";',
    'import "@nulib/clover/styles.css";',
  ],
  nodes: [
    {
      jsx: "Clover.Root",
      html: "clover-root",
      attrs: [
        { prop: "iiifContent", attribute: "iiif-content", url: true },
        { prop: "className", attribute: "class", value: "my-layout" },
      ],
      children: [
        { jsx: "Clover.Body", html: "clover-body", attrs: [] },
        {
          jsx: "aside",
          html: "aside",
          attrs: [],
          children: order.map((key) => PARTS[key].node),
        },
      ],
    },
  ],
});

/** The demo: the parts, as the code writes them, the aside's in the reader's order. */
const Demo = dynamic(
  () =>
    import("@nulib/clover").then(
      ({ Root, Body, Label, Position, Previous, Next }) => {
        function ComposeDemo({
          order,
          values,
        }: {
          order: PartKey[];
          values: Values;
        }) {
          const part = (key: PartKey) => {
            switch (key) {
              case "title":
                return (
                  <Label
                    key={key}
                    as={values[AS] as "h3" | "h4" | "p"}
                    className={compose.title}
                  />
                );
              case "canvas":
                return (
                  <Label
                    key={key}
                    of={values[OF] as "canvas" | "manifest"}
                    className={compose.muted}
                  />
                );
              case "position":
                return <Position key={key} />;
              case "previous":
                return <Previous key={key} />;
              case "next":
                return <Next key={key} />;
            }
          };
          return (
            <Root iiifContent={URL} className={compose.layout}>
              <Body style={{ height: 420 }} />
              <aside className={compose.aside}>{order.map(part)}</aside>
            </Root>
          );
        }
        return ComposeDemo;
      },
    ),
  { ssr: false },
);

export function ComposeExample() {
  const { ref, preview } = usePreviewHost();
  if (preview)
    return (
      <figure ref={ref} className={styles.example}>
        <AgentPreview shown={preview} />
      </figure>
    );
  return (
    <figure ref={ref} className={styles.example}>
      <PartsEditor
        parts={PARTS}
        start={START}
        knobs={KNOBS}
        treeOf={treeOf}
        className={styles.code}
      >
        {(order, values) => (
          <div className={styles.preview} {...example(EXAMPLE)}>
            <Demo order={order} values={values} />
          </div>
        )}
      </PartsEditor>
    </figure>
  );
}
