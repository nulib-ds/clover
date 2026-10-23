/**
 * A Clover 4 page's MDX with each React example's "Web components" twin beside it
 * (WEB-COMPONENTS.md, phase 7). Each ```jsx or ```tsx fence is turned by `jsx-to-html.mjs`
 * into the HTML of Clover's elements, or followed by one written by hand (```html twin);
 * the two are marked `data-code-flavor`, which the site's CSS shows by the reader's choice
 * (`code-flavor.ts`, `layout.css`), and both stay in the page for agents. A fence HTML
 * cannot say stays React's, shown in both; one marked ```jsx react shows to React's readers
 * alone (a stylesheet's import, which elements need not write). In a frame
 * (`Example` with a `PartDemo`, `ViewerExample`, `OptionsExample`), `{url}` is the frame's
 * resource. Clover's names in the prose turn too (`inline-names.mjs`): `Root` is shown as
 * `<clover-root>` to those who chose web components, beside it in the page, but in
 * headings (their ids and the table of contents are their text) and in React's own API
 * tables (`ApiReference`, whose other flavor the specs write). Only the fences' and those
 * names' text changes: everything else is left as written.
 *
 * Run on the page's text before Nextra compiles it (`mdx-code-flavors-loader.cjs`), so it
 * works under Turbopack, which takes no plugin functions.
 */
import { createProcessor } from "@mdx-js/mdx";
import prettier from "prettier";

import { readSpecs } from "../../packages/clover/build/custom-elements.mjs";
import { partDemoUrls, viewerUrls } from "./example-urls.mjs";
import { namesOf, webNameOf } from "./inline-names.mjs";
import { DEFAULT_URL, jsxToHtml } from "./jsx-to-html.mjs";

const FRAMES = new Set(["Example", "ViewerExample", "OptionsExample"]);

let known = null;
/** The elements' specs and the examples' resources, read once. */
const knowledge = () =>
  (known ??= readSpecs().then(({ SPECS }) => ({
    specs: SPECS,
    names: namesOf(SPECS),
    parts: partDemoUrls(),
    viewers: viewerUrls(),
  })));

const attributeOf = (node, name) =>
  node.attributes?.find((attribute) => attribute.name === name)?.value;

/** The first `PartDemo` in a frame, wherever it sits. */
function demoIn(node) {
  for (const child of node.children ?? []) {
    if (child.type?.startsWith("mdxJsx") && child.name === "PartDemo")
      return child;
    const found = demoIn(child);
    if (found) return found;
  }
  return null;
}

/** What `{url}` is in a fence: its frame's resource, else the Cookbook's book. */
function urlOf(ancestors, { parts, viewers }) {
  const frame = [...ancestors].reverse().find((node) => FRAMES.has(node.name));
  if (!frame) return DEFAULT_URL;
  if (frame.name === "Example") {
    const demo = demoIn(frame);
    const key = demo ? (attributeOf(demo, "resource") ?? "paged") : null;
    return (typeof key === "string" && parts.get(key)) || DEFAULT_URL;
  }
  const key = attributeOf(frame, "resource");
  if (typeof key !== "string") return DEFAULT_URL;
  return viewers.get(key) ?? (/^https?:/.test(key) ? key : DEFAULT_URL);
}

/** Each React fence, with its ancestors and the fence after it. */
function fencesOf(tree) {
  const found = [];
  const walk = (node, ancestors) => {
    (node.children ?? []).forEach((child, index) => {
      if (child.type === "code" && /^(jsx|tsx)$/.test(child.lang ?? "")) {
        found.push({ node: child, ancestors, next: node.children[index + 1] });
      }
      walk(child, [...ancestors, child]);
    });
  };
  walk(tree, [tree]);
  return found;
}

/**
 * Each name in code in the page's prose: not in a heading, React's own API tables, a box
 * already one flavor's, or a page's section for web components (`## Web components`, to
 * the next `##`), whose names are theirs already: there `iiifContent` is the element's
 * property, not the prop.
 */
function namesIn(tree) {
  const found = [];
  const walk = (node) => {
    if (
      node.type === "heading" ||
      node.name === "ApiReference" ||
      attributeOf(node, "data-code-flavor")
    )
      return;
    if (node.type === "inlineCode") found.push(node);
    let theirs = false;
    for (const child of node.children ?? []) {
      if (child.type === "heading" && child.depth === 2)
        theirs = /^web components?\b/i.test(textOf(child));
      if (!theirs) walk(child);
    }
  };
  walk(tree);
  return found;
}

/** A node's text. */
const textOf = (node) =>
  node.value ?? (node.children ?? []).map(textOf).join("");

/** A fence's text, indented as the fence is. */
const indented = (text, indent) =>
  text
    .split("\n")
    .map((line) => (line ? indent + line : line))
    .join("\n");

/**
 * The two flavors of a fence, each in its marked box, at the fence's indent. `react` is
 * the fence as written from its first character: its later lines keep their own indent.
 * `marked` is the twin's lines to mark, in a fence's own words (`{4}`).
 */
function flavors(react, html, indent, marked = "") {
  return [
    `<div data-code-flavor="react">`,
    "",
    indent + react,
    "",
    `${indent}</div>`,
    "",
    `${indent}<div data-code-flavor="web-components">`,
    "",
    indented(
      "```html" + (marked && ` ${marked}`) + "\n" + html + "\n```",
      indent,
    ),
    "",
    `${indent}</div>`,
  ].join("\n");
}

/** The lines a fence marks (```jsx {3} or {2-4,6}), counted from 1. */
export function markedLines(meta) {
  const ranges = meta?.match(/\{([\d,\s-]+)\}/)?.[1];
  if (!ranges) return [];
  return ranges.split(",").flatMap((range) => {
    const [from, to = from] = range.trim().split("-").map(Number);
    return Array.from({ length: to - from + 1 }, (_, at) => from + at);
  });
}

/** Lines as a fence marks them: `{4}`, `{2-3,5}`. */
const asMarked = (lines) => {
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  const ranges = [];
  for (const line of sorted) {
    const last = ranges.at(-1);
    if (last && line === last[1] + 1) last[1] = line;
    else ranges.push([line, line]);
  }
  return ranges.length
    ? `{${ranges.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(",")}}`
    : "";
};

/**
 * A React fence's marked lines, in its HTML twin (Mat, 2026-10-22: an example's code
 * mutes all but the lines it is about): each part's tag on a marked line is its element's
 * tag in the twin, the same one counted in order (an opening tag, through its attributes'
 * lines, or a closing one), and a marked line of one attribute is that attribute's line.
 */
export function twinLines(react, html, marked, names) {
  const reactLines = react.split("\n");
  const htmlLines = html.split("\n");
  // Each opening or closing tag of each part, in order: `[line, name, closing]`.
  const tagsIn = (lines, pattern, nameOf) =>
    lines.flatMap((text, at) =>
      [...text.matchAll(pattern)].map((match) => [
        at,
        nameOf(match[2]),
        match[1] === "/",
      ]),
    );
  const reactTags = tagsIn(
    reactLines,
    /<(\/?)((?:Clover\.)?[A-Z][\w]*)/g,
    (name) => names.tags.get(name.replace(/^Clover\./, "")),
  );
  const htmlTags = tagsIn(htmlLines, /<(\/?)(clover-[a-z-]+)/g, (name) => name);
  // An opening tag's lines: from its line to the one where it ends.
  const openingAt = (from) => {
    const lines = [from];
    for (let at = from; at < htmlLines.length - 1; at += 1) {
      const rest =
        at === from ? htmlLines[at].replace(/^\s*<[\w-]+/, "") : htmlLines[at];
      if (/>/.test(rest.replace(/"[^"]*"/g, ""))) break;
      lines.push(at + 1);
    }
    return lines;
  };
  const found = [];
  for (const line of marked) {
    const at = line - 1;
    let tagged = false;
    reactTags.forEach(([on, tag, closing], index) => {
      if (on !== at) return;
      tagged = true;
      if (!tag) return;
      // The same tag, opening or closing as it is, counted in order in both.
      const alike = ([, other, isClosing]) =>
        other === tag && isClosing === closing;
      const nth = reactTags.slice(0, index).filter(alike).length;
      const twin = htmlTags.filter(alike)[nth];
      if (twin) found.push(...(closing ? [twin[0]] : openingAt(twin[0])));
    });
    if (tagged) continue;
    // A line of one attribute: `layout="pager"`, `headingLevel={3}`.
    const prop = reactLines[at]?.trim().match(/^([a-z][\w]*)=/)?.[1];
    const attribute = prop && names.props.get(prop);
    if (!attribute || attribute.startsWith(".")) continue;
    const twin = htmlLines.findIndex((text) =>
      new RegExp(`(^|\\s)${attribute}=`).test(text),
    );
    if (twin >= 0) found.push(twin);
  }
  return asMarked(found.map((at) => at + 1));
}

/** The page's MDX with its examples' twins and its names'; the same text where there are none. */
export async function withCodeFlavors(source) {
  if (!/```(jsx|tsx)|`[^`\n]+`/.test(source)) return source;
  const tree = createProcessor({ format: "mdx" }).parse(source);
  const found = fencesOf(tree);
  const context = await knowledge();
  const edits = [];
  // Names in the prose, each as web components write it beside React's.
  for (const node of namesIn(tree)) {
    const web = webNameOf(node.value, context.names);
    if (!web) continue;
    const start = node.position.start.offset;
    const end = node.position.end.offset;
    edits.push({
      start,
      end,
      text: `<span data-code-flavor="react">${source.slice(start, end)}</span><span data-code-flavor="web-components">\`${web}\`</span>`,
    });
  }
  for (const { node, ancestors, next } of found) {
    if (ancestors.some((ancestor) => attributeOf(ancestor, "data-code-flavor")))
      continue;
    const start = node.position.start.offset;
    const indent = source.slice(source.lastIndexOf("\n", start - 1) + 1, start);
    if (indent.trim()) continue; // A fence that does not begin its line.
    // React's alone (```jsx react): shown only to those who chose React.
    if (/(^|\s)react(\s|$)/.test(node.meta ?? "")) {
      const react = source.slice(start, node.position.end.offset);
      edits.push({
        start,
        end: node.position.end.offset,
        text: [
          `<div data-code-flavor="react">`,
          "",
          indent + react,
          "",
          `${indent}</div>`,
        ].join("\n"),
      });
      continue;
    }
    // A twin written by hand, right after it.
    const twin =
      next?.type === "code" &&
      next.lang === "html" &&
      /(^|\s)twin(\s|$)/.test(next.meta ?? "")
        ? next
        : null;
    let html = twin?.value;
    if (!html) {
      const turned = jsxToHtml(node.value, {
        specs: context.specs,
        url: urlOf(ancestors, context),
      });
      if (!turned.html) continue;
      html = (
        await prettier.format(turned.html, {
          parser: "html",
          bracketSameLine: true,
        })
      ).trim();
    }
    const end = (twin ?? node).position.end.offset;
    const react = source.slice(start, node.position.end.offset);
    // The lines the React fence marks, marked in its twin too, but in one written by hand.
    const marked = markedLines(node.meta);
    const twinMarked =
      !twin && marked.length
        ? twinLines(node.value, html, marked, context.names)
        : "";
    edits.push({ start, end, text: flavors(react, html, indent, twinMarked) });
  }
  // From the end, so each edit's offsets still hold.
  let text = source;
  for (const { start, end, text: replaced } of edits.sort(
    (a, b) => b.start - a.start,
  ))
    text = text.slice(0, start) + replaced + text.slice(end);
  return text;
}
