/**
 * A Clover 4 page's MDX with each React example's "Web components" twin beside it
 * (WEB-COMPONENTS.md, phase 7). Each ```jsx or ```tsx fence is turned by `jsx-to-html.mjs`
 * into the HTML of Clover's elements, or followed by one written by hand (```html twin);
 * the two are marked `data-code-flavor`, which the site's CSS shows by the reader's choice
 * (`code-flavor.ts`, `layout.css`), and both stay in the page for agents. A fence HTML
 * cannot say stays React's, shown in both; one marked ```jsx react shows to React's readers
 * alone (a stylesheet's import, which elements need not write). In a frame
 * (`Example` with a `PartDemo`, `ViewerExample`, `OptionsExample`), `{url}` is the frame's
 * resource. Only the fences' text changes: everything else is left as written.
 *
 * Run on the page's text before Nextra compiles it (`mdx-code-flavors-loader.cjs`), so it
 * works under Turbopack, which takes no plugin functions.
 */
import { createProcessor } from "@mdx-js/mdx";
import prettier from "prettier";

import { readSpecs } from "../../packages/clover/build/custom-elements.mjs";
import { partDemoUrls, viewerUrls } from "./example-urls.mjs";
import { DEFAULT_URL, jsxToHtml } from "./jsx-to-html.mjs";

const FRAMES = new Set(["Example", "ViewerExample", "OptionsExample"]);

let known = null;
/** The elements' specs and the examples' resources, read once. */
const knowledge = () =>
  (known ??= readSpecs().then(({ SPECS }) => ({
    specs: SPECS,
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

/** A fence's text, indented as the fence is. */
const indented = (text, indent) =>
  text
    .split("\n")
    .map((line) => (line ? indent + line : line))
    .join("\n");

/**
 * The two flavors of a fence, each in its marked box, at the fence's indent. `react` is
 * the fence as written from its first character: its later lines keep their own indent.
 */
function flavors(react, html, indent) {
  return [
    `<div data-code-flavor="react">`,
    "",
    indent + react,
    "",
    `${indent}</div>`,
    "",
    `${indent}<div data-code-flavor="web-components">`,
    "",
    indented("```html\n" + html + "\n```", indent),
    "",
    `${indent}</div>`,
  ].join("\n");
}

/** The page's MDX with its examples' twins; the same text where there are none. */
export async function withCodeFlavors(source) {
  if (!/```(jsx|tsx)/.test(source)) return source;
  const tree = createProcessor({ format: "mdx" }).parse(source);
  const found = fencesOf(tree);
  if (!found.length) return source;
  const context = await knowledge();
  const edits = [];
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
    edits.push({ start, end, text: flavors(react, html, indent) });
  }
  // From the end, so each edit's offsets still hold.
  let text = source;
  for (const { start, end, text: replaced } of edits.sort(
    (a, b) => b.start - a.start,
  ))
    text = text.slice(0, start) + replaced + text.slice(end);
  return text;
}
