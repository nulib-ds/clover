"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useId, useRef, useState } from "react";

import { Choice } from "docs/components/CodeValues";
import compose from "docs/components/Clover4/ComposeExample.module.css";
import live from "docs/components/Clover4/LiveCode.module.css";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import {
  type CodeNode,
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
  textOf,
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
const PARTS: Record<PartKey, { name: string; node: CodeNode }> = {
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

/** A part moved from one place in the order to another. */
const moved = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

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

/** A grip's glyph: two columns of three dots. */
const GripGlyph = () => (
  <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
    {[0, 1].flatMap((column) =>
      [0, 1, 2].map((row) => (
        <circle
          key={`${column}-${row}`}
          cx={2 + column * 4}
          cy={2 + row * 4}
          r="1.1"
          fill="currentColor"
        />
      )),
    )}
  </svg>
);

export function ComposeExample() {
  const hint = useId();
  const { ref, preview } = usePreviewHost();
  const [order, setOrder] = useState<PartKey[]>(START);
  const [values, setValues] = useState<Values>(() => initialValues(KNOBS));
  const [picked, setPicked] = useState<PartKey | null>(null);
  const [dragging, setDragging] = useState<PartKey | null>(null);
  const [said, setSaid] = useState("");
  const [copied, setCopied] = useState<Flavor | null>(null);
  const codes = useRef(new Map<Flavor, HTMLElement>());
  const press = useRef<{ part: PartKey; y: number; moved: boolean } | null>(
    null,
  );
  // A press that dragged is not also a press that picks.
  const dragged = useRef(false);

  useEffect(() => {
    if (!picked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setPicked(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [picked]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const move = (part: PartKey, to: number) => {
    const from = order.indexOf(part);
    if (to < 0 || to >= order.length || to === from) return;
    setOrder(moved(order, from, to));
    setSaid(`${PARTS[part].name}, ${to + 1} of ${order.length}`);
  };

  /** Where each part's lines sit in a flavor's code, from its first to its last. */
  const blocks = (flavor: Flavor) => {
    const code = codes.current.get(flavor);
    return order.map((key) => {
      const lines = code?.querySelectorAll<HTMLElement>(`[data-part="${key}"]`);
      const first = lines?.[0]?.getBoundingClientRect();
      const last = lines?.[lines.length - 1]?.getBoundingClientRect();
      return first && last ? (first.top + last.bottom) / 2 : 0;
    });
  };

  const grip = (part: PartKey, flavor: Flavor) => (
    <button
      type="button"
      className={compose.grip}
      aria-label={`Move ${PARTS[part].name}`}
      aria-describedby={hint}
      aria-pressed={picked === part}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        setPicked((current) => (current === part ? null : part));
      }}
      onKeyDown={(event) => {
        const by =
          event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        if (!by) return;
        event.preventDefault();
        move(part, order.indexOf(part) + by);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current = { part, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const pressed = press.current;
        if (!pressed) return;
        if (!pressed.moved && Math.abs(event.clientY - pressed.y) < 4) return;
        pressed.moved = true;
        setDragging(part);
        // Past the middle of the part above or below, it takes that part's place.
        const middles = blocks(flavor);
        const at = order.indexOf(part);
        if (at > 0 && event.clientY < middles[at - 1]) move(part, at - 1);
        else if (at < order.length - 1 && event.clientY > middles[at + 1])
          move(part, at + 1);
      }}
      onPointerUp={() => {
        dragged.current = Boolean(press.current?.moved);
        press.current = null;
        setDragging(null);
      }}
      onPointerCancel={() => {
        press.current = null;
        setDragging(null);
      }}
    >
      <GripGlyph />
    </button>
  );

  const code = (flavor: Flavor) => {
    const lines: Line[] = codeLines(treeOf(order), KNOBS, values, flavor);
    const text = textOf(lines);
    const language = LANGUAGE[flavor];
    const seen = new Map<string, number>();
    return (
      <div
        key={flavor}
        data-code-flavor={flavor === "react" ? "react" : "web-components"}
      >
        <div className="docs-code">
          <pre
            data-lang={language}
            data-live-code={text}
            ref={(element) => {
              if (element) codes.current.set(flavor, element);
            }}
          >
            <code className={`nextra-code language-${language}`}>
              {lines.map((line, index) => {
                // A part's lines are keyed by the part, so they keep their grip, and its
                // focus, as they move.
                const n = line.part ? (seen.get(line.part) ?? 0) : 0;
                if (line.part) seen.set(line.part, n + 1);
                const key = line.part ? `${line.part}:${n}` : `line:${index}`;
                const part = line.part as PartKey | undefined;
                return (
                  <React.Fragment key={key}>
                    {index > 0 && "\n"}
                    <span
                      data-part={part}
                      data-picked={part && picked === part ? "" : undefined}
                      data-dragging={part && dragging === part ? "" : undefined}
                    >
                      {line.tokens.length === 0 ? " " : "  ".repeat(line.depth)}
                      {part && n === 0 && grip(part, flavor)}
                      {line.tokens.map((token, at) => {
                        const knob = token.knob
                          ? KNOBS.find((each) => knobId(each) === token.knob)
                          : undefined;
                        if (knob?.options)
                          return (
                            <Choice
                              key={at}
                              label={knob.label ?? knob.prop}
                              options={knob.options}
                              value={values[token.knob!]}
                              onChange={(value: Plain) =>
                                setValues((current) => ({
                                  ...current,
                                  [token.knob!]: value,
                                }))
                              }
                              written={(option, i) =>
                                token.choices?.[i] ?? String(option)
                              }
                              className={`${live.value} ${live.choice} ${live.string}`}
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
                );
              })}
            </code>
          </pre>
          <button
            type="button"
            className="docs-code-copy"
            onClick={() =>
              navigator.clipboard?.writeText(text).then(
                () => setCopied(flavor),
                () => undefined,
              )
            }
          >
            {copied === flavor ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    );
  };

  const at = picked ? order.indexOf(picked) : -1;
  if (preview)
    return (
      <figure ref={ref} className={styles.example}>
        <AgentPreview shown={preview} />
      </figure>
    );
  return (
    <figure ref={ref} className={styles.example}>
      <div className={styles.preview} {...example(EXAMPLE)}>
        <Demo order={order} values={values} />
      </div>
      <div className={styles.code}>
        <div className={compose.tools}>
          <p id={hint} className={compose.hint}>
            {picked
              ? `Moving ${PARTS[picked].name}: Move up or Move down, or its arrow keys. Escape lets it go.`
              : "Drag a part by its grip, or press the grip, then Move up or Move down."}
          </p>
          <div className={compose.moves}>
            <button
              type="button"
              disabled={at <= 0}
              onClick={() => picked && move(picked, at - 1)}
            >
              Move up
            </button>
            <button
              type="button"
              disabled={at < 0 || at >= order.length - 1}
              onClick={() => picked && move(picked, at + 1)}
            >
              Move down
            </button>
          </div>
        </div>
        <div className={compose.codes}>
          {(["react", "html"] as const).map(code)}
        </div>
        <span role="status" className={compose.status}>
          {copied ? "Copied the code" : said}
        </span>
      </div>
    </figure>
  );
}
