"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";

import { Control } from "docs/components/Clover4/CodeControl";
import { MapDemo } from "docs/components/Clover4/Demos";
import { PartDemo, type PartName } from "docs/components/Clover4/PartDemo";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import {
  type CodeTree,
  type Flavor,
  type Knob,
  type Line,
  type LiveBeside,
  type Plain,
  type TokenKind,
  type Values,
  codeLines,
  holds,
  initialValues,
  knobId,
  knobProps,
  remountKey,
  textOf,
} from "docs/lib/live-code";
import { type PartDemoResource, RESOURCES } from "docs/lib/part-demo-resources";
import { useMock } from "docs/lib/useMock";
import { EXAMPLE, example } from "docs/lib/example";
import {
  AgentPreview,
  usePreviewHost,
} from "docs/components/Clover4/PreviewHost";

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
  comment: "var(--editor-faint)",
};

const LANGUAGE: Record<Flavor, string> = { react: "jsx", html: "html" };

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
  /*
   * A block that scrolls across (JSX runs past its edge, `code.css`) is reached by the
   * keyboard as Nextra's are, by focus on it, where no value in it takes focus first: an
   * agent's preview has none (WCAG 2.1.1).
   */
  const reachable = lines.some((line) =>
    line.tokens.some((token) => token.knob),
  );
  return (
    <div className="docs-code">
      <pre
        data-lang={language}
        data-live-code={text}
        tabIndex={reachable ? undefined : 0}
      >
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
                        // Keyed by its knob, not its place: a value another takes the place of (a
                        // slider's height, then a grid's width) never keeps the other's draft.
                        key={token.knob}
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

/**
 * An example's live code, in React and as HTML, the reader's flavor shown: one tree for
 * both, or HTML's own (`html`) where the elements say it another way.
 */
export function LiveCode({
  tree,
  html,
  knobs,
  values,
  onChange,
}: {
  tree: CodeTree;
  html?: CodeTree;
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
            lines={codeLines(
              flavor === "html" ? (html ?? tree) : tree,
              knobs,
              values,
              flavor,
            )}
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
 * Code an example writes for itself, as lines of runs (`Line`), in both flavors, the
 * reader's shown, drawn as `LiveCode` draws its code, with no values to change: the i18n
 * page's demo, whose code follows the languages checked and the resource open over it.
 */
export function LiveLines({ react, html }: { react: Line[]; html: Line[] }) {
  return (
    <>
      {(["react", "html"] as const).map((flavor) => (
        <div
          key={flavor}
          data-code-flavor={flavor === "react" ? "react" : "web-components"}
        >
          <Block
            lines={flavor === "react" ? react : html}
            flavor={flavor}
            knobs={[]}
            values={{}}
            onChange={() => undefined}
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
/** A host's Canvases, as the Canvas page's `CanvasRecipe` shows a Manifest's. */
const CanvasRecipe = dynamic(
  () => import("docs/components/Canvas/CanvasRecipe"),
  { ssr: false },
);

export interface LiveDemo {
  /** `recipe`: the host's Canvases (`CanvasRecipe`), its props `recipe`. */
  kind: "part" | "bodyPart" | "map" | "recipe";
  recipe?: React.ComponentProps<typeof CanvasRecipe>;
  part: PartName | keyof typeof BODY_PARTS | "Map";
  /** Its fixed props: those its code writes, and those given to the demo alone. */
  props?: Record<string, unknown>;
  resource: PartDemoResource;
  body?: boolean;
  /** A box of this height around the part, which scrolls. */
  box?: string;
  beside?: LiveBeside;
  /** The height of the box around Canvas, Timeline or Scene. */
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
  const mock = useMock(
    demo.kind === "part" || demo.kind === "recipe" || remote ? "" : path,
  );
  const url = remote ? path : mock;
  if (demo.kind === "recipe" && demo.recipe)
    return <CanvasRecipe {...demo.recipe} {...props} />;
  if (demo.kind === "bodyPart") {
    const BodyPart = BODY_PARTS[demo.part as keyof typeof BODY_PARTS];
    return (
      <div style={{ height: box?.height ?? demo.height ?? 420 }}>
        {url && <BodyPart iiifContent={url} {...props} />}
      </div>
    );
  }
  if (demo.kind === "map") return <MapDemo mock={path} props={props} />;
  const side = demo.beside && holds(demo.beside.when, knobs, values);
  return (
    <PartDemo
      part={demo.part as PartName}
      props={props}
      resource={demo.resource}
      body={demo.body}
      box={(box?.height as string | undefined) ?? demo.box}
      side={side ? demo.beside!.width : undefined}
      height={side ? demo.beside!.height : undefined}
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
  html,
  knobs,
  demo,
}: {
  tree: CodeTree;
  /** HTML's own code, where the elements say the example another way (`LiveCode`). */
  html?: CodeTree;
  knobs: Knob[];
  demo: LiveDemo;
}) {
  const [values, setValues] = useState(() => initialValues(knobs));
  const { ref, preview } = usePreviewHost();
  const set = (id: string, value: Plain) =>
    setValues((current) => ({ ...current, [id]: value }));
  return (
    <figure ref={ref} className={styles.example}>
      {preview ? (
        <AgentPreview shown={preview} />
      ) : (
        <>
          <div className={styles.preview} {...example(EXAMPLE)}>
            <Demo
              key={remountKey(knobs, values)}
              demo={demo}
              knobs={knobs}
              values={values}
            />
          </div>
          <div className={styles.code}>
            <LiveCode
              tree={tree}
              html={html}
              knobs={knobs}
              values={values}
              onChange={set}
            />
          </div>
        </>
      )}
    </figure>
  );
}
