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
  knobProps,
} from "docs/lib/live-code";
import { EXAMPLE, example } from "docs/lib/example";
import {
  AgentPreview,
  usePreviewHost,
} from "docs/components/Clover4/PreviewHost";

/**
 * Composing's first example, live (Mat, 2026-10-23: "make this draggable/customizable
 * like the example on homepage", "in an example container like we do on components
 * docs"): a Root with its Body across the top and a header of components over it
 * (Mat, 2026-11-04), its code under it in both flavors, as the homepage's example viewer's
 * editor is. A component moves among the header's by dragging its grip, by the grip's
 * arrow keys, or by pressing the grip and then Move up or Move down, so no move needs a
 * drag (WCAG 2.5.7). The title's element is picked in the code. The demo follows, so the
 * code is always what it shows.
 */

/** The example's resource: the IIIF Cookbook's book, as Composing's examples read. */
/*
 * Northwestern's manuscript notebook of Enochian calls and texts (Mat, 2026-11-04: "use
 * this one … make sure we implement items"): a `paged` Manifest of 138 Canvases, as a
 * page's content would read it: its title and summary across the top (Mat: "move title and
 * summary up above", "make head stretch across"), and under them its Body and Items, its
 * metadata, attribution and rights in a sidebar beside them (Mat: "move rights to under
 * required statement"). The Panel's Tabs were tried in its place and undone (Mat: "na,
 * doesn't work. revert back to the old").
 */
const URL =
  "https://api.dc.library.northwestern.edu/api/v2/works/b52d5d93-a117-43e9-90c7-434fa1212b60?as=iiif";

type PartKey = "header" | "body" | "items" | "title" | "summary";

/*
 * Two groups move (Mat, 2026-11-04: "allow header, body, items to be moved around as
 * well"): the header, Body and Items in the Root, and the title and Summary in the header.
 */
const TOP: PartKey[] = ["header", "body", "items"];
const INNER: PartKey[] = ["title", "summary"];

/*
 * The values to change in the code (Mat, 2026-11-04: "give more props to items and body and
 * summary and metadata"), each component's own, keyed by it, as the title and the Summary
 * both take `as`. Each change shows at once. No `of`: the notebook's Canvases have no
 * summary or metadata of their own, so `of="canvas"` showed nothing (Mat: "remove of"). Items' layouts are the two that stay one row
 * tall, as a grid of 138 pages would run far down the page; its pictures start smaller
 * than its default (Mat: "make items thumbs small"; 10rem, "a bit bigger", before), with
 * no labels (Mat: "can we turn off labels for items").
 */
const TITLE: Knob[] = [
  {
    prop: "as",
    key: "title:as",
    value: "h3",
    options: ["h3", "h4", "p"],
    label: "The title's element",
  },
];

const SUMMARY: Knob[] = [
  {
    prop: "as",
    key: "summary:as",
    value: "p",
    options: ["p", "div"],
    label: "The Summary's element",
  },
];

const BODY: Knob[] = [
  {
    prop: "placeholder",
    key: "body:placeholder",
    value: true,
    label: "The Body's placeholder",
  },
  {
    prop: "controls",
    key: "body:controls",
    value: true,
    label: "The Body's controls",
  },
  {
    prop: "style.height",
    key: "body:height",
    value: 420,
    min: 240,
    max: 720,
    step: 20,
    label: "The Body's height",
  },
];

const ITEMS: Knob[] = [
  {
    prop: "layout",
    key: "items:layout",
    value: "slider",
    options: ["slider", "pager"],
    label: "Items' layout",
  },
  {
    prop: "labels",
    key: "items:labels",
    value: false,
    when: { layout: ["slider"] },
    label: "Items' labels",
  },
  {
    prop: "size",
    key: "items:size",
    value: "large",
    options: ["large", "small"],
    when: { layout: ["pager"] },
    label: "The pager's size",
  },
  {
    prop: "style.--clover-items-height",
    key: "items:height",
    value: 6,
    format: "{}rem",
    min: 4,
    max: 16,
    step: 1,
    when: { layout: ["slider"] },
    label: "Items' picture height",
  },
];

const KNOBS = [...TITLE, ...SUMMARY, ...BODY, ...ITEMS];

const AS = knobId(TITLE[0]);

/** A knob's prop, as the code writes it: its attribute the same word, its value its knob's. */
const attr = (knob: Knob) => ({
  prop: knob.prop,
  attribute: knob.prop,
  knob: knobId(knob),
});

/** A style knob's property, in the element's `style`. */
const styleOf = (knob: Knob) => ({
  prop: "style",
  attribute: "style",
  style: [{ name: knob.prop.slice("style.".length), knob: knobId(knob) }],
});

/** The components that move: each one's code, and its name for assistive technology. */
const PARTS: Record<PartKey, EditorPart> = {
  header: {
    name: "the header",
    // Its children are the title and Summary, in their order (`treeOf`).
    node: { jsx: "header", html: "header", attrs: [], key: "header" },
  },
  body: {
    name: "Body",
    node: {
      jsx: "Clover.Body",
      html: "clover-body",
      attrs: [attr(BODY[0]), attr(BODY[1]), styleOf(BODY[2])],
      key: "body",
    },
  },
  items: {
    name: "Items",
    node: {
      jsx: "Clover.Items",
      html: "clover-items",
      attrs: [
        attr(ITEMS[0]),
        attr(ITEMS[1]),
        attr(ITEMS[2]),
        styleOf(ITEMS[3]),
      ],
      key: "items",
    },
  },
  title: {
    name: "the title's Label",
    node: {
      jsx: "Clover.Label",
      html: "clover-label",
      attrs: [{ prop: "as", attribute: "as", knob: AS }],
      key: "title",
    },
  },
  summary: {
    name: "Summary",
    node: {
      jsx: "Clover.Summary",
      html: "clover-summary",
      attrs: SUMMARY.map(attr),
      key: "summary",
    },
  },
};

const START: PartKey[] = [...TOP, ...INNER];

/** The example's code, each group's components in the order they were moved to. */
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
        ...order
          .filter((key) => TOP.includes(key))
          .map((key) =>
            key === "header"
              ? {
                  ...PARTS.header.node,
                  children: order
                    .filter((each) => INNER.includes(each))
                    .map((each) => PARTS[each].node),
                }
              : PARTS[key].node,
          ),
        {
          jsx: "aside",
          html: "aside",
          // It scrolls in the Body and Items' height, so it takes focus (WCAG 2.1.1).
          attrs: [
            { prop: "aria-label", attribute: "aria-label", value: "Metadata" },
            { prop: "tabIndex", attribute: "tabindex", value: 0 },
          ],
          children: [
            { jsx: "Clover.Metadata", html: "clover-metadata", attrs: [] },
            {
              jsx: "Clover.RequiredStatement",
              html: "clover-required-statement",
              attrs: [],
            },
            { jsx: "Clover.Rights", html: "clover-rights", attrs: [] },
          ],
        },
      ],
    },
  ],
});

/** The demo: the components, as the code writes them, the header's in the reader's order. */
const Demo = dynamic(
  () =>
    import("@nulib/clover").then(
      ({
        Root,
        Body,
        Items,
        Label,
        Summary,
        Metadata,
        RequiredStatement,
        Rights,
      }) => {
        function ComposeDemo({
          order,
          values,
        }: {
          order: PartKey[];
          values: Values;
        }) {
          const top = order.filter((key) => TOP.includes(key));
          const inner = order.filter((key) => INNER.includes(key));
          /*
           * Each row where the code puts it. The sidebar runs beside the Body and Items,
           * and the header across the top or foot, or in the main column between them.
           */
          const rowOf = (key: PartKey) => top.indexOf(key) + 1;
          const [first, last] = [rowOf("body"), rowOf("items")].sort(
            (a, b) => a - b,
          );
          const between = rowOf("header") > first && rowOf("header") < last;
          const placed = (key: PartKey, style?: unknown) =>
            ({
              ...(style as object),
              "--row": rowOf(key),
            }) as React.CSSProperties;
          const body = knobProps(BODY, values);
          const items = knobProps(ITEMS, values);
          const part = (key: PartKey) => {
            switch (key) {
              case "header":
                return (
                  <header
                    key={key}
                    className={compose.header}
                    data-between={between || undefined}
                    style={placed(key)}
                  >
                    {inner.map(part)}
                  </header>
                );
              case "body":
                return (
                  <Body key={key} {...body} style={placed(key, body.style)} />
                );
              case "items":
                return (
                  <Items
                    key={key}
                    {...items}
                    style={placed(key, items.style)}
                  />
                );
              case "title":
                return (
                  <Label
                    key={key}
                    as={values[AS] as "h3" | "h4" | "p"}
                    className={compose.title}
                  />
                );
              case "summary":
                return <Summary key={key} {...knobProps(SUMMARY, values)} />;
            }
          };
          return (
            <Root iiifContent={URL} className={compose.layout}>
              {top.map(part)}
              <aside
                className={compose.aside}
                style={
                  { "--rows": `${first} / ${last + 1}` } as React.CSSProperties
                }
                aria-label="Metadata"
                tabIndex={0}
              >
                <Metadata />
                <RequiredStatement />
                <Rights />
              </aside>
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
