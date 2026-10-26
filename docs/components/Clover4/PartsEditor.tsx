"use client";

import React, { useEffect, useId, useRef, useState } from "react";

import { Control } from "docs/components/Clover4/CodeControl";
import styles from "docs/components/Clover4/PartsEditor.module.css";
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

/**
 * Code whose parts the reader moves and whose values they pick, in both flavors, the
 * docs' editor (Composing's first example, `ComposeExample.tsx`, and Get started's,
 * `StartExample.tsx`). It works as the homepage's example viewer's editor does
 * (`ViewerCode`, `PartsLive.tsx`; Mat, 2026-10-26: "make sure we are defining these the
 * same. lean the way the black one is for functionality"), in the page's own editor
 * colors (`--editor-*`): a part's lines drag as one, by mouse anywhere on them or by touch
 * from the grip, the others stepping aside; a press on them, or focus on the grip, picks
 * the part, and the head offers Move up and Move down for it, so no move needs a drag
 * (WCAG 2.5.7); the grip's arrow keys move it too; Escape lets it go. `children`, given,
 * draws what the code says (the demo), from the order and the values, so the code is
 * always what it shows.
 */
export interface EditorPart {
  /** Its name for assistive technology and in the head: "the title's Label". */
  name: string;
  node: CodeNode;
}

export function PartsEditor<K extends string>({
  parts,
  start,
  knobs,
  treeOf,
  className,
  children,
}: {
  parts: Record<K, EditorPart>;
  start: K[];
  knobs: Knob[];
  treeOf: (order: K[], parts: Record<K, EditorPart>) => CodeTree;
  /** The code's box: under a demo, the example's code (`ViewerDocs.module.css`). */
  className?: string;
  children?: (order: K[], values: Values) => React.ReactNode;
}) {
  const hint = useId();
  const pickedName = useId();
  const [order, setOrder] = useState<K[]>(start);
  const [values, setValues] = useState<Values>(() => initialValues(knobs));
  const [picked, setPicked] = useState<K | null>(null);
  const [said, setSaid] = useState("");
  const [copied, setCopied] = useState<Flavor | null>(null);
  const pickedAt = picked ? order.indexOf(picked) : -1;

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

  // Each flavor's part blocks and grips, by `flavor:part`.
  const blocks = useRef(new Map<string, HTMLElement>());
  const grips = useRef(new Map<string, HTMLButtonElement>());
  const press = useRef<{
    from: number;
    y: number;
    rects: { top: number; height: number }[];
  } | null>(null);
  type Drag = { flavor: Flavor; from: number; to: number; dy: number };
  const [drag, setDrag] = useState<Drag | null>(null);
  // The latest, for the drop, which may come before the last move has rendered.
  const dragged = useRef<Drag | null>(null);
  const show = (next: Drag | null) => {
    dragged.current = next;
    setDrag(next);
  };
  // A grip whose part its arrow keys moved keeps focus as its lines move.
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    if (!refocus.current) return;
    grips.current.get(refocus.current)?.focus();
    refocus.current = null;
  });
  // The click that ends a drag is not a pick.
  const dragEnded = useRef(false);

  const reorder = (from: number, to: number) => {
    const key = order[from];
    setOrder(moved(order, from, to));
    setSaid(`${parts[key].name}, ${to + 1} of ${order.length}`);
  };

  const step = (index: number, by: number, flavor?: Flavor) => {
    const to = index + by;
    if (to < 0 || to >= order.length) return;
    if (flavor) refocus.current = `${flavor}:${order[index]}`;
    reorder(index, to);
  };

  const startDrag = (
    flavor: Flavor,
    index: number,
    event: React.PointerEvent,
  ) => {
    dragEnded.current = false;
    const target = event.target as Element;
    const fromGrip = Boolean(target.closest("[data-grip]"));
    if (event.button !== 0) return;
    // A value is changed, not dragged; by touch, only the grip drags, so the page scrolls.
    if (!fromGrip && target.closest("button, select, input")) return;
    if (!fromGrip && event.pointerType !== "mouse") return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The press goes on uncaptured.
    }
    press.current = {
      from: index,
      y: event.clientY,
      rects: order.map((key) => {
        const rect = blocks.current
          .get(`${flavor}:${key}`)!
          .getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }),
    };
  };

  const moveDrag = (flavor: Flavor, event: React.PointerEvent) => {
    const pressed = press.current;
    if (!pressed) return;
    const dy = event.clientY - pressed.y;
    if (!dragged.current && Math.abs(dy) < 4) return;
    const { top, height } = pressed.rects[pressed.from];
    const middle = top + height / 2 + dy;
    const to = pressed.rects.filter(
      (rect, index) =>
        index !== pressed.from && rect.top + rect.height / 2 < middle,
    ).length;
    show({ flavor, from: pressed.from, to, dy });
  };

  const endDrag = () => {
    const last = dragged.current;
    press.current = null;
    if (last && last.to !== last.from) reorder(last.from, last.to);
    if (last) dragEnded.current = true;
    show(null);
  };

  // A press on a part's lines that moved nothing picks it, or lets it go.
  const pick = (flavor: Flavor, key: K, event: React.MouseEvent) => {
    if (dragEnded.current) {
      dragEnded.current = false;
      return;
    }
    const target = event.target as Element;
    if (target.closest("[data-grip]")) return setPicked(key);
    if (target.closest("button, select, input")) return;
    if (picked === key) return setPicked(null);
    setPicked(key);
    // The keys then move the part picked, not one whose grip had focus.
    grips.current.get(`${flavor}:${key}`)?.focus({ preventScroll: true });
  };

  // While a part is dragged, the others step aside for it.
  const shift = (flavor: Flavor, index: number) => {
    if (!drag || drag.flavor !== flavor) return 0;
    if (index === drag.from) return drag.dy;
    const height = press.current?.rects[drag.from].height ?? 0;
    if (drag.from < drag.to && index > drag.from && index <= drag.to)
      return -height;
    if (drag.to < drag.from && index >= drag.to && index < drag.from)
      return height;
    return 0;
  };

  const tokens = (line: Line) =>
    line.tokens.length === 0
      ? " "
      : line.tokens.map((token, at) => {
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
                onChange={(value: Plain) =>
                  setValues((current) => ({
                    ...current,
                    [token.knob!]: value,
                  }))
                }
              />
            );
          return (
            <span
              key={at}
              style={token.kind ? { color: COLOR[token.kind] } : undefined}
            >
              {token.text}
            </span>
          );
        });

  const code = (flavor: Flavor) => {
    const lines = codeLines(treeOf(order, parts), knobs, values, flavor);
    const text = textOf(lines);
    // The lines before the parts, each part's in turn, and those after.
    const head: Line[] = [];
    const tail: Line[] = [];
    const own: { key: K; lines: Line[] }[] = [];
    for (const line of lines) {
      const key = line.part as K | undefined;
      if (key) {
        const last = own.at(-1);
        if (last?.key === key) last.lines.push(line);
        else own.push({ key, lines: [line] });
      } else (own.length ? tail : head).push(line);
    }
    // Lines are numbered by where they are, not which part they belong to.
    let number = 0;
    const lineOf = (line: Line, key: React.Key, grip?: React.ReactNode) => (
      <span key={key} className={styles.line}>
        <span className={styles.gripCell}>{grip}</span>
        <span className={styles.number} aria-hidden="true">
          {(number += 1)}
        </span>
        <span
          className={styles.text}
          style={{ "--depth": line.depth } as React.CSSProperties}
        >
          {tokens(line)}
        </span>
      </span>
    );
    const language = LANGUAGE[flavor];
    const id = (key: K) => `${flavor}:${key}`;
    return (
      <div
        key={flavor}
        data-code-flavor={flavor === "react" ? "react" : "web-components"}
      >
        <div className={styles.frame}>
          <div className={styles.head}>
            <span>{language.toUpperCase()}</span>
            {picked && (
              <div
                role="group"
                aria-labelledby={`${pickedName}-${flavor}`}
                className={styles.moves}
              >
                <span id={`${pickedName}-${flavor}`} className={styles.picked}>
                  {parts[picked].name}
                </span>
                <button
                  type="button"
                  className={styles.button}
                  aria-disabled={pickedAt <= 0 || undefined}
                  onClick={() => step(pickedAt, -1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className={styles.button}
                  aria-disabled={pickedAt >= order.length - 1 || undefined}
                  onClick={() => step(pickedAt, 1)}
                >
                  Move down
                </button>
              </div>
            )}
            <button
              type="button"
              className={styles.button}
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
          <pre
            className={styles.code}
            data-lang={language}
            data-live-code={text}
            data-dragging={drag?.flavor === flavor || undefined}
          >
            <code>
              {head.map((line, index) => lineOf(line, `head-${index}`))}
              {own.map(({ key, lines: partLines }, index) => (
                <span
                  key={key}
                  ref={(node) => {
                    if (node) blocks.current.set(id(key), node);
                    else blocks.current.delete(id(key));
                  }}
                  className={styles.block}
                  data-dragged={
                    (drag?.flavor === flavor && drag.from === index) ||
                    undefined
                  }
                  data-picked={picked === key || undefined}
                  onClick={(event) => pick(flavor, key, event)}
                  style={{
                    transform: `translateY(${shift(flavor, index)}px)`,
                  }}
                  onPointerDown={(event) => startDrag(flavor, index, event)}
                  onPointerMove={(event) => moveDrag(flavor, event)}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {partLines.map((line, at) =>
                    lineOf(
                      line,
                      at,
                      at === 0 && (
                        <button
                          ref={(node) => {
                            if (node) grips.current.set(id(key), node);
                            else grips.current.delete(id(key));
                          }}
                          type="button"
                          data-grip
                          className={styles.grip}
                          aria-label={`Move ${parts[key].name}`}
                          aria-describedby={hint}
                          onFocus={() => setPicked(key)}
                          onKeyDown={(event) => {
                            const by =
                              event.key === "ArrowUp"
                                ? -1
                                : event.key === "ArrowDown"
                                  ? 1
                                  : 0;
                            if (!by) return;
                            event.preventDefault();
                            step(index, by, flavor);
                          }}
                        >
                          <GripGlyph />
                        </button>
                      ),
                    ),
                  )}
                </span>
              ))}
              {tail.map((line, index) => lineOf(line, `tail-${index}`))}
            </code>
          </pre>
        </div>
      </div>
    );
  };

  return (
    <>
      {children?.(order, values)}
      <div className={className}>
        {(["react", "html"] as const).map(code)}
        <span role="status" className={styles.hidden}>
          {copied ? "Copied the code" : said}
        </span>
        <span id={hint} className={styles.hidden}>
          Arrow up or down moves the part, as Move up and Move down do.
        </span>
      </div>
    </>
  );
}

/** A part moved from one place in the order to another. */
const moved = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** Each run's color, as Nextra's highlighter gives the page's code (`--shiki-editor`). */
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

/** A grip's glyph: two columns of three dots. */
const GripGlyph = () => (
  <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
    {[2, 6, 10].flatMap((y) =>
      [2, 6].map((x) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />
      )),
    )}
  </svg>
);
