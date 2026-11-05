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
  // Each part moves among its group: the parts with the same part around them (the
  // header's title and summary; the header, Body and Items around it).
  const around = aroundOf(treeOf(order, parts));
  const groupOf = (key: K) =>
    order.filter((each) => around.get(each) === around.get(key));
  const pickedGroup = picked ? groupOf(picked) : [];
  const pickedAt = picked ? pickedGroup.indexOf(picked) : -1;

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
    key: K;
    group: K[];
    from: number;
    y: number;
    rects: { top: number; height: number }[];
  } | null>(null);
  type Drag = {
    flavor: Flavor;
    key: K;
    group: K[];
    from: number;
    to: number;
    dy: number;
  };
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

  // A part moved to another place in its group, the rest of the order as it was.
  const reorder = (key: K, to: number) => {
    const group = groupOf(key);
    const next = moved(group, group.indexOf(key), to);
    let at = 0;
    setOrder(
      order.map((each) =>
        around.get(each) === around.get(key) ? next[at++] : each,
      ),
    );
    setSaid(`${parts[key].name}, ${to + 1} of ${group.length}`);
  };

  const step = (key: K, by: number, flavor?: Flavor) => {
    const group = groupOf(key);
    const to = group.indexOf(key) + by;
    if (to < 0 || to >= group.length) return;
    if (flavor) refocus.current = `${flavor}:${key}`;
    reorder(key, to);
  };

  const startDrag = (flavor: Flavor, key: K, event: React.PointerEvent) => {
    dragEnded.current = false;
    const target = event.target as Element;
    const fromGrip = Boolean(target.closest("[data-grip]"));
    if (event.button !== 0) return;
    // A value is changed, not dragged; by touch, only the grip drags, so the page scrolls.
    if (!fromGrip && target.closest("button, select, input")) return;
    if (!fromGrip && event.pointerType !== "mouse") return;
    // The innermost part pressed drags, not the part around it.
    event.stopPropagation();
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The press goes on uncaptured.
    }
    const group = groupOf(key);
    press.current = {
      key,
      group,
      from: group.indexOf(key),
      y: event.clientY,
      rects: group.map((each) => {
        const rect = blocks.current
          .get(`${flavor}:${each}`)!
          .getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }),
    };
  };

  const moveDrag = (flavor: Flavor, event: React.PointerEvent) => {
    const pressed = press.current;
    if (!pressed) return;
    event.stopPropagation();
    const dy = event.clientY - pressed.y;
    if (!dragged.current && Math.abs(dy) < 4) return;
    const { top, height } = pressed.rects[pressed.from];
    const middle = top + height / 2 + dy;
    const to = pressed.rects.filter(
      (rect, index) =>
        index !== pressed.from && rect.top + rect.height / 2 < middle,
    ).length;
    show({
      flavor,
      key: pressed.key,
      group: pressed.group,
      from: pressed.from,
      to,
      dy,
    });
  };

  const endDrag = (event: React.PointerEvent) => {
    if (press.current) event.stopPropagation();
    const last = dragged.current;
    press.current = null;
    if (last && last.to !== last.from) reorder(last.key, last.to);
    if (last) dragEnded.current = true;
    show(null);
  };

  // A press on a part's lines that moved nothing picks it, or lets it go.
  const pick = (flavor: Flavor, key: K, event: React.MouseEvent) => {
    // The innermost part pressed is picked, not the part around it.
    event.stopPropagation();
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

  // While a part is dragged, the others in its group step aside for it.
  const shift = (flavor: Flavor, key: K) => {
    if (!drag || drag.flavor !== flavor) return 0;
    const index = drag.group.indexOf(key);
    if (index < 0) return 0;
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
    const grip = (key: K) => (
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
            event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
          if (!by) return;
          event.preventDefault();
          step(key, by, flavor);
        }}
      >
        <GripGlyph />
      </button>
    );
    // A part's lines as one block, its grip on its first, the parts inside it blocks too.
    const block = (key: K, own: Line[], depth: number) => (
      <span
        key={key}
        ref={(node) => {
          if (node) blocks.current.set(id(key), node);
          else blocks.current.delete(id(key));
        }}
        className={styles.block}
        data-dragged={
          (drag?.flavor === flavor && drag.key === key) || undefined
        }
        data-picked={picked === key || undefined}
        onClick={(event) => pick(flavor, key, event)}
        style={{ transform: `translateY(${shift(flavor, key)}px)` }}
        onPointerDown={(event) => startDrag(flavor, key, event)}
        onPointerMove={(event) => moveDrag(flavor, event)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {lineOf(own[0], "grip", grip(key))}
        {linesOf(own.slice(1), depth + 1)}
      </span>
    );
    // Lines in order: each run a part wrote, at this depth, its block.
    const linesOf = (run: Line[], depth: number): React.ReactNode[] => {
      const out: React.ReactNode[] = [];
      for (let at = 0; at < run.length; ) {
        const key = run[at].parts?.[depth] as K | undefined;
        if (!key) {
          out.push(lineOf(run[at], `${depth}-${at}`));
          at += 1;
          continue;
        }
        let end = at;
        while (end < run.length && run[end].parts?.[depth] === key) end += 1;
        out.push(block(key, run.slice(at, end), depth));
        at = end;
      }
      return out;
    };
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
                  onClick={() => step(picked, -1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className={styles.button}
                  aria-disabled={
                    pickedAt >= pickedGroup.length - 1 || undefined
                  }
                  onClick={() => step(picked, 1)}
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
            <code>{linesOf(lines, 0)}</code>
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
          Arrow up or down moves the component, as Move up and Move down do.
        </span>
      </div>
    </>
  );
}

/** Each movable part's own part around it, if any: the parts it moves among share it. */
const aroundOf = (tree: CodeTree) => {
  const map = new Map<string, string | undefined>();
  const walk = (nodes: CodeNode[], parent?: string) =>
    nodes.forEach((node) => {
      if (node.key) map.set(node.key, parent);
      walk(node.children ?? [], node.key ?? parent);
    });
  walk(tree.nodes);
  return map;
};

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
  comment: "var(--editor-faint)",
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
