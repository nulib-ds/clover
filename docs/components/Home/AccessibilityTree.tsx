import React, { useEffect, useState } from "react";
import styles from "docs/components/Home/Parts.module.css";

/**
 * The example viewer's other side, as an inspector would show it: a few of the WCAG 2.2
 * checks Clover is held to, each measured on the viewer as it is turned over (its names,
 * tab stops, smallest target, lowest contrasts, marked languages, and the reader's motion
 * setting), and under them what assistive technology is given, as an ARIA snapshot (role,
 * name, state) with each control's tab stop. Shown while "Why Clover"'s Accessible story
 * is at the middle of the window (`StoryLines.tsx`). A glimpse for the reader, not an
 * audit (Mat, 2026-10-20: "this is marketing language"): roles come from the markup the
 * plain way (its `role`, else its element), long lists are cut short, and what runs past
 * the card fades out.
 *
 * Hidden from assistive technology itself, which has the viewer.
 */

interface TreeNode {
  role: string;
  name?: string;
  states: string[];
  tab?: number;
  children: TreeNode[];
}

/** Roles whose name is their text, which this view then shows in place of their content. */
const FROM_CONTENT = new Set([
  "button",
  "link",
  "heading",
  "option",
  "tab",
  "menuitem",
  "term",
  "definition",
  "paragraph",
  "switch",
]);

/** The most of one kind of child shown before the rest are counted. */
const SHOWN = 3;
/** The longest name shown in full. */
const LONGEST = 32;

const FOCUSABLE =
  "a[href], button, input, select, textarea, summary, [tabindex]";

function roleOf(element: Element): string | null {
  const explicit = element.getAttribute("role")?.trim().split(/\s+/)[0];
  if (explicit)
    return explicit === "presentation" || explicit === "none" ? null : explicit;
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return "heading";
  switch (tag) {
    case "button":
      return "button";
    case "a":
      return element.hasAttribute("href") ? "link" : null;
    case "img":
      return element.getAttribute("alt") === "" ? null : "img";
    case "ul":
    case "ol":
      return "list";
    case "li":
      return "listitem";
    case "nav":
      return "navigation";
    case "section":
      return element.hasAttribute("aria-label") ||
        element.hasAttribute("aria-labelledby")
        ? "region"
        : null;
    case "figure":
      return "figure";
    case "dt":
      return "term";
    case "dd":
      return "definition";
    case "p":
      return "paragraph";
    case "select":
      return "combobox";
    case "textarea":
      return "textbox";
    case "input": {
      const type = (element as HTMLInputElement).type;
      return type === "checkbox"
        ? "checkbox"
        : type === "radio"
          ? "radio"
          : type === "range"
            ? "slider"
            : type === "search"
              ? "searchbox"
              : "textbox";
    }
    default:
      return null;
  }
}

function hidden(element: Element) {
  if ((element as HTMLElement).hidden) return true;
  if (element.getAttribute("aria-hidden") === "true") return true;
  const style = getComputedStyle(element);
  return style.display === "none" || style.visibility === "hidden";
}

/** The text a reader is given from an element's content. */
function textOf(element: Element | null): string {
  if (!element) return "";
  let text = "";
  const walk = (node: ChildNode) => {
    if (node.nodeType === 3) text += node.textContent;
    else if (node.nodeType === 1) {
      const child = node as Element;
      if (hidden(child)) return;
      if (child.tagName === "IMG")
        text += ` ${child.getAttribute("alt") ?? ""} `;
      child.childNodes.forEach(walk);
    }
  };
  element.childNodes.forEach(walk);
  return text.replace(/\s+/g, " ").trim();
}

function nameOf(element: Element, role: string): string {
  const ids = element.getAttribute("aria-labelledby");
  if (ids)
    return ids
      .split(/\s+/)
      .map((id) => textOf(document.getElementById(id)))
      .join(" ")
      .trim();
  const label = element.getAttribute("aria-label");
  if (label) return label;
  if (role === "img") return element.getAttribute("alt") ?? "";
  if (FROM_CONTENT.has(role)) return textOf(element);
  return element.getAttribute("title") ?? "";
}

function statesOf(element: Element, role: string): string[] {
  const states: string[] = [];
  const level =
    element.getAttribute("aria-level") ??
    (/^H([1-6])$/.exec(element.tagName)?.[1] || null);
  if (role === "heading" && level) states.push(`level=${level}`);
  for (const state of ["selected", "pressed", "checked", "current"]) {
    const value = element.getAttribute(`aria-${state}`);
    if (value && value !== "false") states.push(state);
  }
  const expanded = element.getAttribute("aria-expanded");
  if (expanded) states.push(expanded === "true" ? "expanded" : "collapsed");
  if (
    (element as HTMLButtonElement).disabled ||
    element.getAttribute("aria-disabled") === "true"
  )
    states.push("disabled");
  const lang = element.getAttribute("lang");
  if (lang) states.push(`lang=${lang}`);
  return states;
}

/** The viewer as a tree of what is given to assistive technology. */
function snapshot(root: Element): TreeNode {
  const stops = [...root.querySelectorAll(FOCUSABLE)].filter((element) => {
    const html = element as HTMLElement;
    if (html.tabIndex < 0 || (element as HTMLButtonElement).disabled)
      return false;
    for (
      let node: Element | null = element;
      node && node !== root;
      node = node.parentElement
    )
      if (hidden(node)) return false;
    return true;
  });
  const order = new Map(stops.map((element, index) => [element, index + 1]));

  const visit = (element: Element): TreeNode[] => {
    if (hidden(element)) return [];
    let role = roleOf(element);
    const tab = order.get(element);
    if (!role && tab) role = "generic";
    const children = () => [...element.children].flatMap(visit);
    if (!role) return children();
    return [
      {
        role,
        name: nameOf(element, role) || undefined,
        states: statesOf(element, role),
        tab,
        children: FROM_CONTENT.has(role) ? [] : children(),
      },
    ];
  };
  return {
    role: roleOf(root) ?? "region",
    name: nameOf(root, "region") || undefined,
    states: [],
    children: [...root.children].flatMap(visit),
  };
}

interface Line {
  depth: number;
  node?: TreeNode;
  more?: { count: number; role: string };
}

/** The tree as lines, a long run of one kind of child cut short and counted. */
function linesOf(node: TreeNode, depth = 0, lines: Line[] = []): Line[] {
  lines.push({ depth, node });
  const kinds = new Map<string, number>();
  for (const child of node.children) {
    const seen = (kinds.get(child.role) ?? 0) + 1;
    kinds.set(child.role, seen);
    if (seen <= SHOWN) linesOf(child, depth + 1, lines);
  }
  for (const [role, count] of kinds)
    if (count > SHOWN)
      lines.push({ depth: depth + 1, more: { count: count - SHOWN, role } });
  return lines;
}

/** A CSS color as RGBA, whatever its notation (`oklab()`, `color-mix()`…), by painting it. */
let paint: CanvasRenderingContext2D | null | undefined;
function rgba(color: string): [number, number, number, number] | null {
  if (paint === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    paint = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!paint) return null;
  paint.clearRect(0, 0, 1, 1);
  paint.fillStyle = "#000";
  paint.fillStyle = color;
  paint.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** What an element is seen against: the first ground under it that is mostly opaque. */
function groundOf(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    const value = rgba(color);
    if (value && value[3] > 0.5) return color;
  }
  return getComputedStyle(document.body).backgroundColor || "#fff";
}

const luminance = ([r, g, b]: number[]) => {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

function contrast(foreground: string, background: string): number | null {
  const fg = rgba(foreground);
  const bg = rgba(background);
  if (!fg || !bg) return null;
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Seen on screen: laid out, larger than the 1px a visually hidden name keeps, and not hidden. */
const shown = (element: Element) => {
  const { offsetWidth, offsetHeight } = element as HTMLElement;
  if (offsetWidth <= 1 || offsetHeight <= 1) return false;
  for (let node: Element | null = element; node; node = node.parentElement)
    if (node.getAttribute("aria-hidden") === "true") return false;
  return true;
};

interface Check {
  /** The success criterion. */
  id: string;
  name: string;
  value: string;
  /** What it must meet, if it is a threshold. */
  needs?: string;
  passes: boolean;
}

/** Each check, measured on the viewer as it is now. */
function checksOf(root: Element, tree: TreeNode, stops: number): Check[] {
  const named = (node: TreeNode): number =>
    (node.name ? 1 : 0) + node.children.reduce((n, c) => n + named(c), 0);

  // Targets: what a pointer can press, at its laid-out size (no transform counts).
  const targets = [
    ...root.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, [role=option], [role=slider], [tabindex='0']",
    ),
  ].filter(shown);
  const smallest = targets.reduce<HTMLElement | null>(
    (least, element) =>
      !least ||
      Math.min(element.offsetWidth, element.offsetHeight) <
        Math.min(least.offsetWidth, least.offsetHeight)
        ? element
        : least,
    null,
  );

  // Text: every element with words of its own, against what it sits on.
  const texts = [...root.querySelectorAll("*")].filter(
    (element) =>
      shown(element) &&
      [...element.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent?.trim(),
      ),
  );
  const lowestText = Math.min(
    ...texts.map(
      (element) =>
        contrast(getComputedStyle(element).color, groundOf(element)) ?? 21,
    ),
  );
  // Controls: each button's glyph against its own fill.
  const buttons = [...root.querySelectorAll("button")].filter(shown);
  const lowestControl = Math.min(
    ...buttons.map(
      (button) =>
        contrast(getComputedStyle(button).color, groundOf(button)) ?? 21,
    ),
  );
  const marked = [...root.querySelectorAll("[lang]")].filter(shown);
  const languages = [...new Set(marked.map((e) => e.getAttribute("lang")))];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ratio = (value: number) => `${value.toFixed(1)}:1`;

  return [
    {
      id: "4.1.2",
      name: "Name, role, value",
      value: `${named(tree)} named`,
      passes: true,
    },
    {
      id: "2.4.3",
      name: "Focus order",
      value: `${stops} tab stops, in reading order`,
      passes: stops > 0,
    },
    {
      id: "2.5.8",
      name: "Target size",
      value: smallest
        ? `smallest ${smallest.offsetWidth} × ${smallest.offsetHeight} px`
        : "none",
      needs: "24 × 24",
      passes:
        !smallest ||
        Math.min(smallest.offsetWidth, smallest.offsetHeight) >= 24,
    },
    {
      id: "1.4.3",
      name: "Text contrast",
      value: `lowest ${ratio(lowestText)}`,
      needs: "4.5:1",
      passes: lowestText >= 4.5,
    },
    {
      id: "1.4.11",
      name: "Control contrast",
      value: `lowest ${ratio(lowestControl)}`,
      needs: "3:1",
      passes: lowestControl >= 3,
    },
    {
      id: "3.1.2",
      name: "Language of parts",
      value: marked.length
        ? `${marked.length} marked, ${languages.join(", ")}`
        : "all in the page's",
      passes: true,
    },
    {
      id: "2.3.3",
      name: "Motion",
      value: reduced ? "reduced, as you asked" : "reduced when asked",
      passes: true,
    },
  ];
}

const short = (text: string) =>
  text.length > LONGEST ? `${text.slice(0, LONGEST - 1)}…` : text;

export function AccessibilityTree({
  of,
  shown: turned,
}: {
  of: React.RefObject<HTMLElement | null>;
  shown: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [stops, setStops] = useState(0);
  const [checks, setChecks] = useState<Check[]>([]);
  // Read afresh each time it is turned to, so it is the viewer as it is then.
  useEffect(() => {
    if (!turned || !of.current) return;
    const tree = snapshot(of.current);
    const count = countStops(tree);
    setLines(linesOf(tree));
    setStops(count);
    setChecks(checksOf(of.current, tree, count));
  }, [turned, of]);

  return (
    <div className={styles.viewerBack} data-face-of="back" aria-hidden="true">
      <div className={styles.backHead}>
        <span>Accessibility</span>
        <span className={styles.backStops}>WCAG 2.2 AA</span>
      </div>
      <dl className={styles.backChecks}>
        {checks.map((check) => (
          <div key={check.id} className={styles.backCheck}>
            <dt className={styles.backState}>{check.id}</dt>
            <dd>
              {check.name}{" "}
              <span className={styles.backValue}>{check.value}</span>
              {check.needs && (
                <span className={styles.backState}> of {check.needs}</span>
              )}
            </dd>
            <dd className={styles.backMark}>{check.passes ? "✓" : "✕"}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.backHead}>
        <span>Accessibility tree</span>
        <span className={styles.backStops}>⇥ {stops} tab stops</span>
      </div>
      <div className={styles.backTree}>
        {lines.map((line, index) => (
          <div
            key={index}
            className={styles.backLine}
            style={{ paddingInlineStart: `${line.depth * 1.25}ch` }}
          >
            {line.more ? (
              <span className={styles.backMore}>
                - … {line.more.count} more {line.more.role}
              </span>
            ) : (
              line.node && (
                <>
                  <span className={styles.backText}>
                    <span className={styles.backPunct}>- </span>
                    <span className={styles.backRole}>{line.node.role}</span>
                    {line.node.name && (
                      <span> &quot;{short(line.node.name)}&quot;</span>
                    )}
                    {line.node.states.map((state) => (
                      <span key={state} className={styles.backState}>
                        {" "}
                        [{state}]
                      </span>
                    ))}
                    {line.node.children.length > 0 && (
                      <span className={styles.backPunct}>:</span>
                    )}
                  </span>
                  {line.node.tab && (
                    <span className={styles.backTab}>⇥ {line.node.tab}</span>
                  )}
                </>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function countStops(node: TreeNode): number {
  return (
    (node.tab ? 1 : 0) +
    node.children.reduce((total, child) => total + countStops(child), 0)
  );
}
