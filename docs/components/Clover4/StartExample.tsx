"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useEffect, useId, useRef, useState } from "react";

import { Flavored } from "docs/components/Flavored";
import { LiveCode } from "docs/components/Clover4/LiveCode";
import {
  type EditorPart,
  PartsEditor,
} from "docs/components/Clover4/PartsEditor";
import { Live, type TemplateName } from "docs/components/Clover4/ViewerDocs";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import start from "docs/components/Clover4/StartExample.module.css";
import {
  AgentPreview,
  usePreviewHost,
} from "docs/components/Clover4/PreviewHost";
import { EXAMPLE, example } from "docs/lib/example";
import {
  type CodeTree,
  type Knob,
  type Values,
  knobId,
} from "docs/lib/live-code";

/**
 * Get started's example, in each way's "Add it to a page" step (Mat, 2026-10-26: "bring
 * this to step 2"; and "show a example for the above. in a viewer.
 * allow user to toggle between viewer example and clover root example"): its two ways
 * in, live, one at a time, over Northwestern's record of a street in Corozal, the page's
 * resource throughout. The Viewer's code is as the page's first way writes it; the
 * parts' moves and picks as Composing's first example does (`PartsEditor`). Over the
 * demo, right under the two ways it chooses between, which is shown, drawn as the Viewer
 * page's template switch is (Mat, 2026-10-26: "bring these closer together").
 */

const URL =
  "https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif";

type Way = "viewer" | "parts";

/** A link drawn as the page's Markdown links are (Nextra's own classes). */
const LINK =
  "x:focus-visible:nextra-focus x:text-primary-600 x:underline x:hover:no-underline x:decoration-from-font x:[text-underline-position:from-font]";

const WAYS: {
  value: Way;
  react: string;
  webComponents: string;
  title: string;
  note: React.ReactNode;
}[] = [
  {
    value: "viewer",
    react: "<Viewer />",
    webComponents: "<clover-viewer>",
    title: "Start with the Viewer",
    note: (
      <>
        One component for any IIIF resource, with its panel, keyboard and
        languages built in. See{" "}
        <Link href="/docs/viewer" className={LINK}>
          Viewer
        </Link>{" "}
        for its templates and props.
      </>
    ),
  },
  {
    value: "parts",
    react: "<Clover.Root>",
    webComponents: "<clover-root>",
    title: "Compose with its parts",
    note: (
      <>
        Place them anywhere inside a{" "}
        <Flavored
          react={<code className="nextra-code">Root</code>}
          webComponents={<code className="nextra-code">{"<clover-root>"}</code>}
        />
        , among your own markup; only the parts you use load. See{" "}
        <Link href="/docs/composing" className={LINK}>
          Composing
        </Link>{" "}
        for hooks and layouts.
      </>
    ),
  },
];

/*
 * The Viewer's template, a choice in its code, written out even for Default (Mat,
 * 2026-10-26: "add template choice in viewer examples"), as the Viewer page's first
 * example writes it (`LiveViewerExample`, `LiveExample.tsx`).
 */
const TEMPLATES: TemplateName[] = ["Default", "Document", "Gallery"];

const TEMPLATE: Knob = {
  prop: "template",
  on: "code",
  value: "Default",
  options: TEMPLATES,
  label: "Viewer template",
};

const TEMPLATE_KNOBS: Knob[] = [TEMPLATE];

const viewerTree = (template: TemplateName): CodeTree => ({
  url: URL,
  loaded: true,
  imports: [
    'import Viewer from "@nulib/clover";',
    `import { ${template} } from "@nulib/clover/templates";`,
    'import "@nulib/clover/styles.css";',
    ...(template === "Default"
      ? []
      : ['import "@nulib/clover/templates.css";']),
  ],
  nodes: [
    {
      jsx: "Viewer",
      html: "clover-viewer",
      attrs: [
        { prop: "iiifContent", attribute: "iiif-content", url: true },
        {
          prop: "template",
          attribute: "template",
          template,
          knob: knobId(TEMPLATE),
        },
      ],
    },
  ],
});

const KNOBS: Knob[] = [
  {
    prop: "style.height",
    value: 500,
    min: 240,
    max: 720,
    step: 8,
    label: "The Body's height",
  },
  { prop: "controls", value: true, label: "The Body's controls" },
  {
    prop: "layout",
    value: "slider",
    options: ["slider", "list", "grid", "pager"],
    label: "The thumbnails' layout",
  },
  {
    prop: "style.--clover-summary-lines",
    value: 2,
    min: 1,
    max: 6,
    label: "The Summary's lines",
  },
  /*
   * The thumbnails' size is CSS, as the Items page sizes them: a slider's pictures'
   * height, a grid's columns' width, each written while its layout is chosen
   * (`thumbnailSize` is only the resolution Clover asks for).
   */
  {
    prop: "style.--clover-items-height",
    value: 8,
    format: "{}rem",
    min: 4,
    max: 16,
    when: { layout: ["slider"] },
    label: "The thumbnails' height, in rem",
  },
  {
    prop: "style.--clover-items-size",
    value: 10,
    format: "{}rem",
    min: 4,
    max: 20,
    when: { layout: ["grid"] },
    label: "The thumbnails' column width, in rem",
  },
];

const [HEIGHT, CONTROLS, LAYOUT, LINES, ITEMS_HEIGHT, ITEMS_SIZE] =
  KNOBS.map(knobId);

/*
 * The parts the reader moves (Mat, 2026-10-26): the Body, then under it the Manifest's
 * Label as a title and its Summary cut to two lines as a caption
 * (`--clover-summary-lines`, the reader's to change), then Items.
 */
type PartKey = "label" | "body" | "summary" | "items";

const PARTS: Record<PartKey, EditorPart> = {
  label: {
    name: "Label",
    node: {
      jsx: "Clover.Label",
      html: "clover-label",
      attrs: [{ prop: "as", attribute: "as", value: "h3" }],
      key: "label",
    },
  },
  body: {
    name: "Body",
    node: {
      jsx: "Clover.Body",
      html: "clover-body",
      attrs: [
        { prop: "controls", attribute: "controls", knob: CONTROLS },
        {
          prop: "style",
          attribute: "style",
          style: [{ name: "height", knob: HEIGHT }],
        },
      ],
      key: "body",
    },
  },
  summary: {
    name: "Summary",
    node: {
      jsx: "Clover.Summary",
      html: "clover-summary",
      attrs: [
        {
          prop: "style",
          attribute: "style",
          style: [{ name: "--clover-summary-lines", knob: LINES }],
        },
      ],
      key: "summary",
    },
  },
  items: {
    name: "Items",
    node: {
      jsx: "Clover.Items",
      html: "clover-items",
      attrs: [
        { prop: "layout", attribute: "layout", knob: LAYOUT },
        {
          prop: "style",
          attribute: "style",
          style: [
            { name: "--clover-items-height", knob: ITEMS_HEIGHT },
            { name: "--clover-items-size", knob: ITEMS_SIZE },
          ],
        },
      ],
      key: "items",
    },
  },
};

const START: PartKey[] = ["body", "label", "summary", "items"];

/*
 * Both trees are whole modules in React, imports and all; in HTML the markup alone, as
 * the install steps over them load the elements (`loaded`; Mat, 2026-10-26: "why do we
 * have the import step in multiple spots?").
 */
const partsTree = (
  order: PartKey[],
  parts: Record<PartKey, EditorPart>,
): CodeTree => ({
  url: URL,
  loaded: true,
  imports: [
    'import * as Clover from "@nulib/clover";',
    'import "@nulib/clover/styles.css";',
  ],
  nodes: [
    {
      jsx: "Clover.Root",
      html: "clover-root",
      attrs: [{ prop: "iiifContent", attribute: "iiif-content", url: true }],
      children: order.map((key) => parts[key].node),
    },
  ],
});

/** The parts, as the code writes them, in the reader's order. */
const PartsDemo = dynamic(
  () =>
    import("@nulib/clover").then(({ Root, Body, Label, Items, Summary }) => {
      function StartParts({
        order,
        values,
      }: {
        order: PartKey[];
        values: Values;
      }) {
        const part = (key: PartKey) => {
          switch (key) {
            case "label":
              return <Label key={key} as="h3" className={start.label} />;
            case "body":
              return (
                <Body
                  key={key}
                  controls={values[CONTROLS] as boolean}
                  style={{ height: values[HEIGHT] as number }}
                />
              );
            case "summary":
              return (
                <Summary
                  key={key}
                  style={
                    {
                      "--clover-summary-lines": values[LINES],
                    } as React.CSSProperties
                  }
                />
              );
            case "items":
              return (
                <Items
                  key={key}
                  layout={
                    values[LAYOUT] as "slider" | "list" | "grid" | "pager"
                  }
                  style={
                    {
                      "--clover-items-height": `${values[ITEMS_HEIGHT]}rem`,
                      "--clover-items-size": `${values[ITEMS_SIZE]}rem`,
                    } as React.CSSProperties
                  }
                />
              );
          }
        };
        return (
          <Root iiifContent={URL} className={start.layout}>
            {order.map(part)}
          </Root>
        );
      }
      return StartParts;
    }),
  { ssr: false },
);

export function StartExample() {
  const id = useId();
  const { ref, preview } = usePreviewHost();
  const [way, setWay] = useState<Way>("viewer");
  const [template, setTemplate] = useState<TemplateName>("Default");
  // A template picked in the code: its code is drawn again, so the pick keeps focus.
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    const choices = ref.current?.querySelectorAll<HTMLSelectElement>(
      `select[aria-label="${TEMPLATE.label}"]`,
    );
    // The reader's flavor's, the one shown.
    [...(choices ?? [])].find((choice) => choice.offsetParent)?.focus();
  }, [template, ref]);
  return (
    <div className={start.frame}>
      <p id={`${id}-ask`} className={start.ask}>
        How would you like to start? Pick one to see it here.
      </p>
      <div
        className={start.cards}
        role="radiogroup"
        aria-labelledby={`${id}-ask`}
      >
        {WAYS.map((each) => (
          <div key={each.value} className={start.card}>
            <input
              type="radio"
              name={`${id}-way`}
              value={each.value}
              checked={each.value === way}
              onChange={() => setWay(each.value)}
              aria-labelledby={`${id}-${each.value}`}
              aria-describedby={`${id}-${each.value}-note`}
            />
            <span className={start.dot} aria-hidden="true" />
            <p className={start.name} aria-hidden="true">
              <Flavored react={each.react} webComponents={each.webComponents} />
            </p>
            <span id={`${id}-${each.value}`} className={start.title}>
              {each.title}
            </span>
            <p id={`${id}-${each.value}-note`} className={start.note}>
              {each.note}
            </p>
          </div>
        ))}
      </div>
      <figure ref={ref} className={styles.example}>
        {preview ? (
          <AgentPreview shown={preview} />
        ) : (
          <>
            {way === "viewer" ? (
              <>
                <div className={styles.preview} {...example(EXAMPLE)}>
                  <Live
                    key={template}
                    resource={URL}
                    template={template}
                    headingLevel={4}
                  />
                </div>
                <div className={styles.code}>
                  <LiveCode
                    tree={viewerTree(template)}
                    knobs={TEMPLATE_KNOBS}
                    values={{ [knobId(TEMPLATE)]: template }}
                    onChange={(_, value) => {
                      picked.current = true;
                      setTemplate(value as TemplateName);
                    }}
                  />
                </div>
              </>
            ) : (
              <PartsEditor
                parts={PARTS}
                start={START}
                knobs={KNOBS}
                treeOf={partsTree}
                className={styles.code}
              >
                {(order, values) => (
                  <div className={styles.preview} {...example(EXAMPLE)}>
                    <PartsDemo order={order} values={values} />
                  </div>
                )}
              </PartsEditor>
            )}
          </>
        )}
      </figure>
    </div>
  );
}
