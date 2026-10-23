"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";

import { Choice, Scrub, Switch, Text } from "docs/components/CodeValues";
import { MapDemo } from "docs/components/Clover4/Demos";
import { PartDemo, type PartName } from "docs/components/Clover4/PartDemo";
import live from "docs/components/Clover4/LiveCode.module.css";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import {
  type CodeTree,
  type Flavor,
  type Knob,
  type Line,
  type Plain,
  type TokenKind,
  type Values,
  codeLines,
  initialValues,
  knobId,
  knobProps,
  remountKey,
  textOf,
} from "docs/lib/live-code";
import { type PartDemoResource, RESOURCES } from "docs/lib/part-demo-resources";
import { useMock } from "docs/lib/useMock";

/**
 * A live example's code (`docs/lib/live-code.ts`), as the homepage's editor is live (Mat,
 * 2026-10-22): drawn as every code block on the site is (`docs-code`,
 * `docs/styles/code.css`: its language over it, Copy, its lines numbered, the part's own
 * marked), in both flavors, the reader's shown (`data-code-flavor`), each knob's value a
 * control in its run. A number is typed, stepped or dragged, a `true` switches, a word is
 * picked from a menu, text is typed; each is named by its element and prop (`label`).
 * Drawn on the server too, as the example opens, so the page's HTML holds its code, and
 * its Markdown takes it from `data-live-code` (`scripts/build-agent-docs.mjs`).
 */

/** Each run's color in the editor, as Nextra's highlighter gives it (`--shiki-editor`). */
const COLOR: Record<TokenKind, string> = {
  keyword: "var(--editor-keyword)",
  string: "var(--editor-string)",
  tag: "var(--editor-tag)",
  attr: "var(--editor-attr)",
  punctuation: "var(--editor-punctuation)",
  number: "var(--editor-number)",
  property: "var(--editor-property)",
};

const LANGUAGE: Record<Flavor, string> = { react: "jsx", html: "html" };

/** A knob's value, as the control its kind is. */
function Control({
  knob,
  value,
  choices,
  kind,
  onChange,
}: {
  knob: Knob;
  value: Plain;
  choices?: string[];
  kind?: TokenKind;
  onChange: (value: Plain) => void;
}) {
  const label = knob.label ?? knob.prop;
  const color = kind === "string" ? live.string : live.number;
  if (knob.options)
    return (
      <Choice
        label={label}
        options={knob.options}
        value={value}
        onChange={onChange}
        written={(option, index) => choices?.[index] ?? String(option)}
        className={`${live.value} ${live.choice} ${color}`}
      />
    );
  if (typeof value === "boolean")
    return (
      <Switch
        label={label}
        value={value}
        onChange={onChange}
        className={`${live.value} ${live.number}`}
      />
    );
  if (typeof value === "number") {
    const min = knob.min ?? 0;
    const max = knob.max ?? 100;
    const step = knob.step ?? 1;
    return (
      <Scrub
        label={label}
        min={min}
        max={max}
        step={step}
        // A pixel a pixel, or across its range in some 200, whichever is slower.
        rate={Math.min(1, (max - min) / step / 200)}
        value={value}
        onChange={onChange}
        className={`${live.value} ${live.scrub} ${live.number}`}
        // As wide as its value, so the code round it reads as written (`"8rem"`).
        style={{ width: `${Math.max(String(value).length, 1)}ch` }}
      />
    );
  }
  return (
    <Text
      label={label}
      value={value}
      onChange={onChange}
      className={`${live.value} ${live.text} ${live.string}`}
    />
  );
}

/** One flavor's code, as a code block of the site's, its knobs live. */
function Block({
  lines,
  flavor,
  knobs,
  values,
  onChange,
}: {
  lines: Line[];
  flavor: Flavor;
  knobs: Knob[];
  values: Values;
  onChange: (id: string, value: Plain) => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const text = textOf(lines);
  const language = LANGUAGE[flavor];
  return (
    <div className="docs-code">
      <pre data-lang={language} data-live-code={text}>
        <code className={`nextra-code language-${language}`}>
          {lines.map((line, index) => (
            <React.Fragment key={index}>
              {index > 0 && "\n"}
              <span data-highlighted-line={line.mark ? "" : undefined}>
                {line.tokens.length === 0 ? " " : "  ".repeat(line.depth)}
                {line.tokens.map((token, at) => {
                  const knob = token.knob
                    ? knobs.find((each) => knobId(each) === token.knob)
                    : undefined;
                  if (knob)
                    return (
                      <Control
                        key={at}
                        knob={knob}
                        value={values[token.knob!]}
                        choices={token.choices}
                        kind={token.kind}
                        onChange={(value) => onChange(token.knob!, value)}
                      />
                    );
                  return (
                    <span
                      key={at}
                      style={
                        token.kind
                          ? ({
                              "--shiki-editor": COLOR[token.kind],
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {token.text}
                    </span>
                  );
                })}
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
        {copied ? "Copied the code" : ""}
      </span>
    </div>
  );
}

/** An example's live code, in React and as HTML, the reader's flavor shown. */
export function LiveCode({
  tree,
  knobs,
  values,
  onChange,
}: {
  tree: CodeTree;
  knobs: Knob[];
  values: Values;
  onChange: (id: string, value: Plain) => void;
}) {
  return (
    <>
      {(["react", "html"] as const).map((flavor) => (
        <div
          key={flavor}
          data-code-flavor={flavor === "react" ? "react" : "web-components"}
        >
          <Block
            lines={codeLines(tree, knobs, values, flavor)}
            flavor={flavor}
            knobs={knobs}
            values={values}
            onChange={onChange}
          />
        </div>
      ))}
    </>
  );
}

/**
 * The parts Body draws with, Canvas, Timeline and Scene, which a live example shows alone,
 * each loading what it draws (`iiifContent`).
 */
const BODY_PARTS = {
  Canvas: dynamic(
    () => import("@nulib/clover").then((clover) => clover.Canvas),
    { ssr: false },
  ),
  Timeline: dynamic(
    () => import("@nulib/clover").then((clover) => clover.Timeline),
    { ssr: false },
  ),
  Scene: dynamic(() => import("@nulib/clover").then((clover) => clover.Scene), {
    ssr: false,
  }),
};

/**
 * What a live example draws: a part in a `Root` (`PartDemo`), or one of `BODY_PARTS` or
 * `Map` alone.
 */
export interface LiveDemo {
  kind: "part" | "bodyPart" | "map";
  part: PartName | keyof typeof BODY_PARTS | "Map";
  /** Its fixed props: those its code writes, and those given to the demo alone. */
  props?: Record<string, unknown>;
  resource: PartDemoResource;
  body?: boolean;
  /** A box of this height round the part, which scrolls. */
  box?: string;
  /** The height of the box round Canvas, Timeline or Scene. */
  height?: number;
}

function Demo({
  demo,
  knobs,
  values,
}: {
  demo: LiveDemo;
  knobs: Knob[];
  values: Values;
}) {
  const fixed = demo.props ?? {};
  const own = knobProps(knobs, values);
  // A style of the demo's own (a box's), with the knobs' laid over it.
  const style =
    fixed.style || own.style
      ? { ...(fixed.style as object), ...(own.style as object) }
      : undefined;
  const props = { ...fixed, ...own, ...(style && { style }) };
  const box = knobProps(knobs, values, "box").style as
    | Record<string, string | number>
    | undefined;
  const path: string = RESOURCES[demo.resource];
  // A mock is this site's; an address of its own (a Cookbook recipe's) is as it is.
  const remote = /^https?:/.test(path);
  const mock = useMock(demo.kind === "part" || remote ? "" : path);
  const url = remote ? path : mock;
  if (demo.kind === "bodyPart") {
    const BodyPart = BODY_PARTS[demo.part as keyof typeof BODY_PARTS];
    return (
      <div style={{ height: box?.height ?? demo.height ?? 420 }}>
        {url && <BodyPart iiifContent={url} {...props} />}
      </div>
    );
  }
  if (demo.kind === "map") return <MapDemo mock={path} props={props} />;
  return (
    <PartDemo
      part={demo.part as PartName}
      props={props}
      resource={demo.resource}
      body={demo.body}
      box={(box?.height as string | undefined) ?? demo.box}
      rootProps={knobProps(knobs, values, "root")}
    />
  );
}

/**
 * A component page's first example (`LiveExample.tsx`'s `LivePart`): the demo and its
 * live code under it, on the examples' card (`Example`). A knob read only as the part
 * mounts draws the demo again.
 */
export function LiveFrame({
  tree,
  knobs,
  demo,
}: {
  tree: CodeTree;
  knobs: Knob[];
  demo: LiveDemo;
}) {
  const [values, setValues] = useState(() => initialValues(knobs));
  const set = (id: string, value: Plain) =>
    setValues((current) => ({ ...current, [id]: value }));
  return (
    <figure className={styles.example}>
      <div className={styles.preview}>
        <Demo
          key={remountKey(knobs, values)}
          demo={demo}
          knobs={knobs}
          values={values}
        />
      </div>
      <div className={styles.code}>
        <LiveCode tree={tree} knobs={knobs} values={values} onChange={set} />
      </div>
    </figure>
  );
}
