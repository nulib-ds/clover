import React, { useEffect, useState } from "react";
import styles from "docs/components/Home/Parts.module.css";

/**
 * The example viewer's other side, as an inspector would show it: WCAG 2.2 checks Clover
 * is held to, each measured on the viewer as it is turned over, by topic in the order Mat
 * set (2026-10-22): names and ARIA, the keyboard, targets, contrast and text size,
 * captions, language, motion. Under them, what assistive technology is given, as an ARIA
 * snapshot (role, name, state) with each control's tab stop. Shown while "Why Clover"'s Accessible story
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

/** What Tab reaches in the viewer, in the order it reaches them. */
function tabStopsOf(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => {
      if (element.tabIndex < 0 || (element as HTMLButtonElement).disabled)
        return false;
      for (
        let node: Element | null = element;
        node && node !== root;
        node = node.parentElement
      )
        if (hidden(node)) return false;
      return true;
    },
  );
}

/** The viewer as a tree of what is given to assistive technology. */
function snapshot(root: Element, stops: HTMLElement[]): TreeNode {
  const order = new Map<Element, number>(
    stops.map((element, index) => [element, index + 1]),
  );

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
const painted = new Map<string, [number, number, number, number] | null>();
function rgba(color: string): [number, number, number, number] | null {
  if (painted.has(color)) return painted.get(color)!;
  const value = paintOnce(color);
  painted.set(color, value);
  return value;
}

function paintOnce(color: string): [number, number, number, number] | null {
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

/** Whether each stop follows the last as one reads: never wholly above it, nor before it on its line. */
function inReadingOrder(stops: Element[], rtl: boolean): boolean {
  const boxes = stops.map((stop) => stop.getBoundingClientRect());
  return boxes.every((box, index) => {
    const last = boxes[index - 1];
    if (!last) return true;
    if (box.bottom <= last.top) return false;
    const line = box.top < last.bottom && box.bottom > last.top;
    return !(line && (rtl ? box.left >= last.right : box.right <= last.left));
  });
}

/** ARIA's attributes that name other elements by id. */
const REFERENCES = [
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-activedescendant",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
];

/** What a reader can press, choose or set. */
const CONTROLS =
  "button, a[href], input, select, textarea, summary, [role=button], [role=link], [role=option], [role=tab], [role=menuitem], [role=slider], [role=checkbox], [role=radio], [role=switch], [role=treeitem]";

/** Widgets whose controls share one tab stop, and are moved among by arrow keys. */
const COMPOSITE =
  "[role=listbox], [role=tablist], [role=radiogroup], [role=menu], [role=menubar], [role=tree], [role=grid], [role=toolbar]";

const LIVE =
  "[role=status], [role=alert], [role=log], [aria-live]:not([aria-live=off])";

/** Clover's text sizes, every one its text takes (`styles/scale.css`). */
const TEXT_SIZES = ["xs", "s", "m", "l"].map((step) => `--clover-text-${step}`);

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

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
function checksOf(
  root: Element,
  tree: TreeNode,
  stops: HTMLElement[],
): Check[] {
  const named = (node: TreeNode): number =>
    (node.name ? 1 : 0) + node.children.reduce((n, c) => n + named(c), 0);
  const all = [root, ...root.querySelectorAll("*")];
  const rtl = getComputedStyle(root).direction === "rtl";

  // ARIA: every id an attribute names is on the page.
  const references = all.flatMap((element) =>
    REFERENCES.flatMap(
      (name) => element.getAttribute(name)?.split(/\s+/).filter(Boolean) ?? [],
    ),
  );
  const broken = references.filter((id) => !document.getElementById(id));

  // Images: each described, or marked as decoration for assistive technology to pass by.
  const images = [...root.querySelectorAll("img, svg, [role=img]")].filter(
    (element) => {
      if (element.parentElement?.closest("svg")) return false;
      const { width, height } = element.getBoundingClientRect();
      return width > 1 && height > 1;
    },
  );
  const decorative = images.filter(
    (element) =>
      element.closest('[aria-hidden="true"]') ||
      element.getAttribute("alt") === "" ||
      /^(presentation|none)$/.test(element.getAttribute("role") ?? ""),
  );
  const described = images.filter(
    (element) =>
      !decorative.includes(element) &&
      Boolean(
        nameOf(element, "img") ||
          element.querySelector(":scope > title")?.textContent?.trim(),
      ),
  );
  const unnamed = images.length - decorative.length - described.length;

  // Live regions: the viewer's own, and its Root's, which says where the reader moved.
  const owner = root.closest(".clover-root");
  const live = [
    ...root.querySelectorAll(LIVE),
    ...[...(owner?.children ?? [])].filter((child) => child.matches(LIVE)),
  ];
  const politeness = [
    ...new Set(
      live.map(
        (element) =>
          element.getAttribute("aria-live") ??
          (element.getAttribute("role") === "alert" ? "assertive" : "polite"),
      ),
    ),
  ];

  // The keyboard: every control that does something a tab stop, or in a widget that has one.
  const controls = [...root.querySelectorAll<HTMLElement>(CONTROLS)].filter(
    (element) =>
      shown(element) &&
      !hidden(element) &&
      !(element as HTMLButtonElement).disabled &&
      element.getAttribute("aria-disabled") !== "true",
  );
  const reached = new Set<Element>(stops);
  const unreached = controls.filter((element) => {
    if (reached.has(element)) return false;
    const widget = element.closest(COMPOSITE);
    return !(
      widget &&
      root.contains(widget) &&
      stops.some((stop) => widget === stop || widget.contains(stop))
    );
  });
  // Shortcuts: the keys typed alone (no modifier), which a Canvas takes only while it,
  // or a control of its own, has focus (`ui/Tip.tsx`).
  const keys = [
    ...new Set(
      [...root.querySelectorAll("[aria-keyshortcuts]")].flatMap(
        (element) =>
          element.getAttribute("aria-keyshortcuts")?.split(/\s+/) ?? [],
      ),
    ),
  ].filter((key) => key && !/.\+./.test(key));

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
  // Color: the selection told apart by more than its color, against one not chosen.
  const selected = root.querySelector(
    '[role="option"][aria-selected="true"], [role="tab"][aria-selected="true"]',
  );
  const unselected = selected
    ?.closest("[role=listbox], [role=tablist]")
    ?.querySelector(
      '[role="option"]:not([aria-selected="true"], :hover), [role="tab"]:not([aria-selected="true"], :hover)',
    );
  const lettering = (element: Element) => {
    const text =
      [element, ...element.querySelectorAll("*")].find(
        (node) =>
          shown(node) &&
          [...node.childNodes].some(
            (child) => child.nodeType === 3 && child.textContent?.trim(),
          ),
      ) ?? element;
    const { fontWeight, textDecorationLine } = getComputedStyle(text);
    return { fontWeight, textDecorationLine };
  };
  // A ring, an outline or a shadow, that one shows and the other does not: a shape.
  const rings = (element: Element) =>
    [element, ...element.querySelectorAll("*")].filter((node) => {
      const style = getComputedStyle(node);
      return (
        (style.outlineStyle !== "none" &&
          parseFloat(style.outlineWidth) > 0 &&
          (rgba(style.outlineColor)?.[3] ?? 0) > 0) ||
        style.boxShadow !== "none"
      );
    }).length;
  const cue =
    selected && unselected
      ? (() => {
          const [one, other] = [lettering(selected), lettering(unselected)];
          if (one.fontWeight !== other.fontWeight) return "in bold";
          if (one.textDecorationLine !== other.textDecorationLine)
            return "underlined";
          if (rings(selected) > rings(unselected)) return "ringed";
          return null;
        })()
      : undefined;

  // Text sizes: Clover's, as the viewer has them, each in the reader's own unit.
  const sizes = TEXT_SIZES.map((name) =>
    getComputedStyle(root).getPropertyValue(name).trim(),
  ).filter(Boolean);
  const fixed = sizes.filter((size) => !/^[\d.]+rem$/.test(size));

  // Captions: the WebVTT tracks Clover gives a recording (`media/useMediaElement.ts`).
  const media = [...root.querySelectorAll<HTMLMediaElement>("video, audio")];
  const tracks = media
    .flatMap((element) => [...element.querySelectorAll("track")])
    .filter((track) => track.kind === "captions" || track.kind === "subtitles");
  const trackLanguages = [
    ...new Set(tracks.map((track) => track.srclang).filter(Boolean)),
  ];
  const video = media.some((element) => element.tagName === "VIDEO");

  const marked = [...root.querySelectorAll("[lang]")].filter(shown);
  const languages = [...new Set(marked.map((e) => e.getAttribute("lang")))];
  // The page's language, which the viewer keeps rather than one of its own.
  const page = document.documentElement.lang;
  const keeps = root.closest("[lang]") === document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Moving on its own: a recording that plays itself, or a loop with no end, other than
  // what is shown while loading (`aria-busy`).
  const moving =
    media.filter((element) => element.autoplay).length +
    (typeof root.getAnimations === "function"
      ? root
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getComputedTiming().iterations === Infinity &&
              !(animation.effect as KeyframeEffect).target?.closest(
                '[aria-busy="true"]',
              ),
          ).length
      : 0);
  const ratio = (value: number) => `${value.toFixed(1)}:1`;
  const ordered = inReadingOrder(stops, rtl);

  return [
    {
      id: "4.1.2",
      name: "Name, role, value",
      value: `${named(tree)} named`,
      passes: true,
    },
    {
      id: "1.1.1",
      name: "Images",
      value: `${described.length} described, ${decorative.length} decorative${unnamed ? `, ${unnamed} unnamed` : ""}`,
      passes: unnamed === 0,
    },
    {
      id: "1.3.1",
      name: "Relationships",
      value: references.length
        ? broken.length
          ? `${broken.length} of ${plural(references.length, "ARIA reference")} broken`
          : `${plural(references.length, "ARIA reference")}, all found`
        : "none needed",
      passes: broken.length === 0,
    },
    {
      id: "4.1.3",
      name: "Status messages",
      value: live.length
        ? `${plural(live.length, "live region")}, ${politeness.join(" and ")}`
        : "no live region",
      passes: live.length > 0,
    },
    {
      id: "2.4.3",
      name: "Focus order",
      value: `${plural(stops.length, "tab stop")}, ${ordered ? "in" : "out of"} reading order`,
      passes: stops.length > 0 && ordered,
    },
    {
      id: "2.1.1",
      name: "Keyboard",
      value: unreached.length
        ? `${unreached.length} of ${plural(controls.length, "control")} out of reach`
        : `${plural(controls.length, "control")}, all reachable`,
      passes: unreached.length === 0,
    },
    {
      id: "2.1.4",
      name: "Key shortcuts",
      value: keys.length
        ? `${plural(keys.length, "key")}, only while focused`
        : "none here",
      passes: true,
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
      id: "1.4.1",
      name: "Use of color",
      value:
        cue === undefined
          ? "no selection here"
          : cue
            ? `selection ${cue}, not color alone`
            : "selection by color alone",
      passes: cue !== null,
    },
    {
      id: "1.4.4",
      name: "Resize text",
      value: sizes.length
        ? fixed.length
          ? `${fixed.length} of ${plural(sizes.length, "size")} fixed`
          : `${plural(sizes.length, "size")}, all in rem`
        : "the page's own",
      passes: fixed.length === 0,
    },
    {
      id: "1.2.2",
      name: "Captions",
      value: tracks.length
        ? `${plural(tracks.length, "WebVTT track")}${trackLanguages.length ? `, ${trackLanguages.join(", ")}` : ""}`
        : video
          ? "none given"
          : media.length
            ? "no video here"
            : "no recording here",
      passes: tracks.length > 0 || !video,
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
      id: "3.1.1",
      name: "Language of page",
      value: page ? `follows the page's, ${page}` : "the page names none",
      passes: Boolean(page) && keeps,
    },
    {
      id: "2.3.3",
      name: "Motion",
      value: reduced ? "reduced, as you asked" : "reduced when asked",
      passes: true,
    },
    {
      id: "2.2.2",
      name: "Pause, stop, hide",
      value: moving
        ? `${plural(moving, "thing")} moving on its own`
        : "nothing moves on its own",
      passes: moving === 0,
    },
  ];
}

const short = (text: string) =>
  text.length > LONGEST ? `${text.slice(0, LONGEST - 1)}…` : text;

/*
 * Drawn again only when it is shown or put away: the viewer around it redraws as the
 * reader points at its parts, and this, the larger, need not.
 */
export const AccessibilityTree = React.memo(function AccessibilityTree({
  of,
  shown: turned,
}: {
  of: React.RefObject<HTMLElement | null>;
  shown: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [stops, setStops] = useState(0);
  const [checks, setChecks] = useState<Check[]>([]);
  /*
   * Read from the viewer while the page is idle: soon after it loads, so it is ready
   * before the reader reaches the story that shows it, and again each time it is shown,
   * so it is the viewer as it is then. Never in the middle of a frame the reader scrolls.
   */
  useEffect(() => {
    const read = () => {
      if (!of.current) return;
      const stops = tabStopsOf(of.current);
      const tree = snapshot(of.current, stops);
      setLines(linesOf(tree));
      setStops(stops.length);
      setChecks(checksOf(of.current, tree, stops));
    };
    if (!("requestIdleCallback" in window)) {
      const timer = setTimeout(read, turned ? 0 : 3000);
      return () => clearTimeout(timer);
    }
    const idle = requestIdleCallback(read, { timeout: turned ? 500 : 5000 });
    return () => cancelIdleCallback(idle);
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
});
