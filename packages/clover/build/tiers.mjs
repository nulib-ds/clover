/*
 * Clover's stylesheet in tiers (Mat, 2026-11-06: "base styling that simply handles z index,
 * very basic layout, hidden/nones/absolutes/relatives … it would not include
 * spacing/paddings and these would be defined else in a spacing.css"). Every part and
 * template keeps one stylesheet of its own, written as DESIGN.md says; the build derives
 * the tiers from them all at once, by what each declaration sets, so a new rule lands in
 * its tier with no file of its own:
 *
 *   base.css     the structure of what Clover draws: what shows and what is hidden, where
 *                each box sits and what lies over what, how a region lays out its parts,
 *                how large a box or a target is, and the pointer's cursor over what takes
 *                a press or a drag (`BASE`), with the scale's tokens
 *   spacing.css  Clover's rhythm: every margin, padding and gap (`SPACING`)
 *   styles.css   everything, as before: base and spacing, and the look (`LOOK`: colors,
 *                edges, shadows, corners, type and motion)
 *
 * A page that brings its own look imports base.css, then spacing.css or a rhythm of its
 * own, then its own CSS, in place of styles.css and templates.css. Both are in
 * `@layer clover`, as styles.css is, so the page's own rules win without a specificity
 * contest.
 *
 * Every declaration of a property is in one tier, its shorthands and longhands with it, so
 * each tier keeps the cascade of styles.css among its own: the tiers never set the same
 * property, and their order among themselves changes nothing. A custom property is in the
 * lowest tier that reads it (`customTiers`), as a value read by the structure is
 * structure: the controls' inset places them. The scale (`src/styles/scale.css`'s
 * `:root`) is in base.css whole, so a page's own CSS can speak it too.
 *
 * Base.css alone draws a layout that works, with nothing of the look (WCAG 2.2 AA, as
 * every page of Clover's must):
 *
 *   - Some spacing and paint is structure (`structural`): an `auto` margin aligns a box
 *     (the provider's logo at the end of the title's line); a margin or padding that keeps
 *     room for a control holds it clear (the Canvas's row keeps the panel's toggle its
 *     corner), as without it one control lay over another (WCAG 2.4.11); Items' zero
 *     margins and paddings undo the browser's own (a figure's 40px each side), so an item
 *     is as wide as its pictures (Mat, 2026-11-07: "for items only, retain that and
 *     override figure defaults"); a glyph's `fill` or `stroke` in the text's own color
 *     draws it, as Clover's icons take theirs from the stylesheet; and what lies over the
 *     picture stays see-through (`SEE_THROUGH`: a hotspot, never the browser's gray
 *     button over it; Mat, 2026-11-07). Base.css keeps a copy of each, and spacing.css
 *     every margin and padding, those too, in the stylesheet's order, so spacing.css
 *     imported after base.css decides each as styles.css does.
 *   - A form control the look draws in its own way (a language's code, an eye for hiding
 *     a set) stays the browser's in base.css, its focus and its state with it
 *     (`drawnByTheLook`; WCAG 2.4.7): base.css never hides what nothing draws again.
 *   - What lies over other content (a popover, a menu, a sticky heading, the panel over
 *     the page) is a surface in the page's own colors, `Canvas` and `CanvasText`, so no
 *     words show through it (`SURFACES`; WCAG 1.4.3). A page's look paints its own.
 *   - A bar a press drags, a split's handle between its panes, is painted in the text's
 *     own color, as a glyph is (`BARS`), so it is always there to find.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SHEETS, rulesOf } from "./clover-sheets.mjs";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

/** The tiers, lowest first: a custom property read by several goes in the lowest. */
export const TIERS = ["base", "spacing", "look"];

/** Margins, paddings and gaps: Clover's rhythm, all of it. */
const SPACING = [
  /^(margin|padding)(-|$)/,
  /^((row|column|grid(-row|-column)?)-)?gap$/,
  /^border-spacing$/,
  /^text-indent$/,
];

/**
 * The structure: what shows (display, visibility, opacity and the presses it takes), where
 * a box sits (position and its offsets, transforms, z-index, isolation), how a region lays
 * out its parts (flex, grid, alignment, order, containment and container queries), how
 * large a box is (sizes, aspect ratio, box sizing: a target's size too, WCAG 2.5.8), what
 * overflows and scrolls (and where focus rests clear of what sticks, WCAG 2.4.11), how
 * text wraps or is cut (WCAG 1.4.10, 1.4.12), and the cursor over what takes a press or a
 * drag (Mat, 2026-11-07: "if it had a cursor in fully styled, keep it for base").
 */
const BASE = [
  /^(display|visibility|opacity|content-visibility|pointer-events|touch-action)$/,
  /^(user-select|user-drag|touch-callout)$/,
  /^(position|z-index|isolation|float|clear|top|right|bottom|left)$/,
  /^(inset|overflow|overscroll-behavior|scroll-snap|scroll-margin|scroll-padding)(-|$)/,
  /^(scroll-behavior|scrollbar-width|scrollbar-gutter)$/,
  /^(transform|transform-origin|transform-box|transform-style|translate|rotate|scale)$/,
  /^(perspective|perspective-origin|backface-visibility)$/,
  /^(flex|grid|align|justify|place|contain|container|column|columns|break)(-|$)/,
  /^(order|box-sizing|aspect-ratio|object-fit|object-position|resize)$/,
  /^(min-|max-)?(width|height|inline-size|block-size)$/,
  /^(clip|clip-path)$/,
  /^(white-space|white-space-collapse|word-break|word-wrap|overflow-wrap|hyphens)$/,
  /^(text-overflow|text-wrap|text-wrap-mode|text-wrap-style|line-clamp|box-orient)$/,
  /^(text-align|vertical-align|direction|unicode-bidi|writing-mode|table-layout)$/,
  /^(list-style|counter)(-|$)/,
  /^(content|quotes)$/,
  /^cursor$/,
];

/** The look: colors, edges, shadows, corners, type and motion. */
const LOOK = [
  /^(color|accent-color|caret-color|color-scheme|forced-color-adjust)$/,
  /^(background|border|outline|mask|fill|stroke)(-|$)/,
  /^(box-shadow|text-shadow|filter|backdrop-filter|mix-blend-mode)$/,
  /^(font|text-decoration|text-underline|text-emphasis)(-|$)/,
  /^(line-height|letter-spacing|word-spacing|text-transform|tab-size)$/,
  /^(appearance|tap-highlight-color|font-smoothing|image-rendering)$/,
  /^(transition|animation|scroll-timeline|view-timeline)(-|$)/,
  /^(timeline-scope|will-change)$/,
];

/** A property's tier, its vendor prefix aside. */
export function tierOf(property) {
  const name = property.replace(/^-(webkit|moz|ms)-/, "");
  if (SPACING.some((pattern) => pattern.test(name))) return "spacing";
  if (BASE.some((pattern) => pattern.test(name))) return "base";
  if (LOOK.some((pattern) => pattern.test(name))) return "look";
  throw new Error(
    `css tiers: ${property} is in no tier; add it to BASE, SPACING or LOOK (build/tiers.mjs)`,
  );
}

/**
 * What lies over other content, with words or controls on it: base.css gives each a
 * surface in the page's own colors (`Canvas`, `CanvasText`), so nothing shows through it.
 * Every element the stylesheet positions over others and fills is here, or one of
 * `UNDERLAID`'s (`build/tiers.test.mjs`).
 */
export const SURFACES = [
  // A control's name, and a hotspot's popover.
  "clover-tip",
  // The Canvas's caption box and every menu drawn as its menus are (the pager's too).
  "clover-canvas-caption",
  "clover-canvas-menu",
  // A recording's bar, its menus and its captions, over the picture.
  "clover-canvas-transport",
  "clover-canvas-transport-options",
  "clover-canvas-captions-cue",
  // What sticks in a pane that scrolls under it.
  "clover-sections-heading",
  "clover-content-search-field",
  "clover-transcript-find",
  // An item's whole label over the strip, and a recording's length over its picture.
  "clover-items-label-full",
  "clover-items-duration",
  "clover-scene-error",
  // Panes over the page: the information panel, Document's thumbnails, the lightbox.
  "clover-template-panel",
  "clover-template-document-sidebar",
  "clover-template-lightbox-content",
  // Document's downloads under their button, its map expanded over the pages, and the
  // map's places shown over its foot while focus is in them.
  "clover-template-document-download-menu",
  "clover-template-document-map",
  "clover-geomap-places",
];

/**
 * The elements the stylesheet positions over others and fills that need no surface:
 * controls, which the browser draws (`button`), marks and pictures with no words, and
 * washes meant to be seen through.
 */
export const UNDERLAID = [
  "clover-canvas-exit-full-screen",
  "clover-canvas-placeholder-toggle",
  "clover-canvas-more-step",
  "clover-sections-scroll-prev",
  "clover-sections-scroll-next",
  "clover-canvas-annotation-point",
  "clover-canvas-transport-mark-point",
  "clover-canvas-transport-chapter-span",
  "clover-canvas-player-art",
  "clover-canvas-player-ground",
  "clover-canvas-navigator",
  "clover-scene-rotate-disc",
  "clover-template-scrim",
  // The play button over a video's or a sound's still in Document: a mark with no words.
  "clover-template-document-play",
  // The dot on a section's button in Document's toolbar, for the page in view: a mark.
  "clover-template-document-mark",
  // Document's live Canvas over its page's still, the page's own ground under its picture.
  "clover-template-document-live",
  // The lightbox's layer, see-through unless a page gives it a backdrop; its panel is a
  // surface.
  "clover-template-lightbox",
];

const SURFACE_RULE = `:where(${SURFACES.map((name) => `.${name}`).join(",")}){background-color:Canvas;color:CanvasText}`;

/**
 * The bars a press drags, which only the look paints: base.css paints each in the text's
 * own color, as it does a glyph, so a page with a look of its own still sees what to take
 * hold of (Mat, 2026-11-08: "the line running the complete top-to-bottom. the handle is
 * just aesthetic"). A split's handle: 3px wide, as tall as the panes; its grip is the
 * look's.
 */
export const BARS = ["clover-split-handle"];

const BAR_RULE = `:where(${BARS.map((name) => `.${name}`).join(",")}){background-color:currentColor}`;

/**
 * Base.css says it is in the page, for the sheets that load with their parts' code (a
 * recording's, a Scene's, a map's, a vertical slider's, `ui/adoptSheet.ts`): it holds
 * their structure already, and the page brings its own look, so none of them is adopted.
 */
export const MARK = "--clover-stylesheet";
const MARK_RULE = `:root{${MARK}:base}`;

/** The index past the quoted string that opens at `at`. */
function pastQuote(css, at) {
  const quote = css[at];
  for (at++; at < css.length && css[at] !== quote; at++)
    if (css[at] === "\\") at++;
  return at + 1;
}

/** The first of `chars` at the top level from `at`, outside quotes and brackets. */
function find(css, at, chars) {
  let depth = 0;
  while (at < css.length) {
    const char = css[at];
    if (char === '"' || char === "'") {
      at = pastQuote(css, at);
      continue;
    }
    if (depth === 0 && chars.includes(char)) return at;
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth--;
    at++;
  }
  return -1;
}

/** `css` split at its top-level `separator`s. */
export function splitTop(css, separator) {
  const parts = [];
  let at = 0;
  for (let next; (next = find(css, at, separator)) !== -1; at = next + 1)
    parts.push(css.slice(at, next));
  return [...parts, css.slice(at)].filter((part) => part.trim());
}

/** At-rules whose block holds rules, kept as groups around what each tier keeps. */
const GROUPING = /^@(media|supports|container|layer|scope|starting-style)\b/;

/**
 * Minified CSS (esbuild's, comment free) as a tree: a style rule (its prelude and its
 * declarations, each `[property, value]`), a grouping at-rule around rules, another
 * at-rule's block whole (`@keyframes`), or a statement (`@layer a,b;`).
 */
export function parseCss(css) {
  const nodes = [];
  let at = 0;
  while (at < css.length) {
    if (/\s/.test(css[at])) {
      at++;
      continue;
    }
    const stop = find(css, at, "{;");
    if (stop === -1) break;
    if (css[stop] === ";") {
      nodes.push({ kind: "statement", text: css.slice(at, stop + 1) });
      at = stop + 1;
      continue;
    }
    const end = find(css, stop + 1, "}");
    const prelude = css.slice(at, stop).trim();
    const body = css.slice(stop + 1, end);
    if (GROUPING.test(prelude))
      nodes.push({ kind: "group", prelude, children: parseCss(body) });
    else if (prelude.startsWith("@"))
      nodes.push({ kind: "block", text: css.slice(at, end + 1) });
    else
      nodes.push({
        kind: "rule",
        prelude,
        declarations: splitTop(body, ";").map((declaration) => {
          const colon = find(declaration, 0, ":");
          // The value as written: a custom property's keeps the space esbuild leaves.
          return [
            declaration.slice(0, colon).trim(),
            declaration.slice(colon + 1),
          ];
        }),
      });
    at = end + 1;
  }
  return nodes;
}

/** The tree as CSS. */
export const printCss = (nodes) =>
  nodes
    .map((node) => {
      if (node.kind === "rule")
        return `${node.prelude}{${node.declarations
          .map(([property, value]) => `${property}:${value}`)
          .join(";")}}`;
      if (node.kind === "group")
        return `${node.prelude}{${printCss(node.children)}}`;
      return node.text;
    })
    .join("");

/** Every style rule in the tree, at any depth. */
export function* rulesIn(nodes) {
  for (const node of nodes) {
    if (node.kind === "rule") yield node;
    else if (node.kind === "group") yield* rulesIn(node.children);
  }
}

/** The custom properties a value reads. */
const readsOf = (value) =>
  [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name);

/**
 * The custom properties a control's size is in (`--clover-control`, and whatever reads
 * it, at any remove): a margin or padding of one of them keeps room for a control.
 */
export function roomOf(nodes) {
  const room = new Set(["--clover-control"]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const { declarations } of rulesIn(nodes))
      for (const [property, value] of declarations)
        if (
          property.startsWith("--") &&
          !room.has(property) &&
          readsOf(value).some((name) => room.has(name))
        ) {
          room.add(property);
          grew = true;
        }
  }
  return room;
}

/**
 * What lies over the picture and lets it show through: the Canvas's hotspots, whatever
 * their shape. The look leaves each see-through (`background-color: transparent`), and
 * base.css keeps that, where a button would be the browser's own gray over the picture.
 */
export const SEE_THROUGH = ["clover-canvas-annotation"];

/** A selector's subject: its last compound, after its last combinator outside brackets. */
export function subjectOf(selector) {
  const text = selector.trim();
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at++) {
    if ("([".includes(text[at])) depth++;
    else if (")]".includes(text[at])) depth--;
    else if (!depth && /[\s>+~]/.test(text[at])) from = at + 1;
  }
  return text.slice(from);
}

/** Whether every selector of a rule ends on an element whose class matches `pattern`. */
const styles = (prelude, pattern) =>
  splitTop(prelude, ",").every((selector) => pattern.test(subjectOf(selector)));
const ITEMS_OWN = /^\.clover-items(?!\w)/;
const SEE_THROUGH_OWN = new RegExp(`^\\.(${SEE_THROUGH.join("|")})(?![\\w-])`);

/**
 * Spacing and paint that are structure too, which base.css keeps a copy of: an `auto`
 * margin, which aligns a box; a margin or padding that keeps room for a control (`room`);
 * a zero margin or padding on one of Items' own elements, which undoes the browser's (a
 * figure's 40px each side), so an item is as wide as its pictures; a glyph's paint in the
 * text's own color, or none (`fill` and `stroke`, as Clover's icons take theirs from the
 * stylesheet), which draws its shape, and says where a hotspot's outline takes a press
 * (`transparent`), never a color of Clover's; and the see-through ground of what lies over
 * the picture (`SEE_THROUGH`). `prelude` is the rule's selector list.
 */
export function structural(property, value, room, prelude = "") {
  const plain = value.trim();
  if (/^(fill|stroke)$/.test(property))
    return /^(currentcolor|none|transparent)$/i.test(plain);
  if (/^background(-color)?$/.test(property))
    return (
      /^(none|transparent)$/i.test(plain) && styles(prelude, SEE_THROUGH_OWN)
    );
  if (!/^(margin|padding)(-|$)/.test(property)) return false;
  const aligns =
    /\bauto\b/.test(value) && /^(auto|0)(\s+(auto|0))*$/.test(plain);
  const undoes =
    /^0(px)?(\s+0(px)?)*$/.test(plain) && styles(prelude, ITEMS_OWN);
  return aligns || undoes || readsOf(value).some((name) => room.has(name));
}

/**
 * A rule that hides a form control the look draws in its own way (`opacity: 0` on an
 * `input` inside its label): base.css leaves the control the browser's.
 */
export const drawnByTheLook = (rule) =>
  rule.declarations.some(
    ([property, value]) => property === "opacity" && value.trim() === "0",
  ) &&
  splitTop(rule.prelude, ",").every((selector) =>
    /(^|[\s>+~])input(?![\w-])[^\s>+~]*$/.test(selector.trim()),
  );

/**
 * The custom properties the package's scripts read from computed styles: a script that
 * reads one reads the structure (`getPropertyValue("--clover-tip-room")`), so base.css
 * keeps its definition. Any `--` name a script spells, tests aside.
 */
function scriptReads(dir = src) {
  const names = new Set();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      for (const name of scriptReads(path)) names.add(name);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      for (const [, name] of readFileSync(path, "utf8").matchAll(
        /["'`](--[\w-]+)["'`]/g,
      ))
        names.add(name);
  }
  return names;
}

/**
 * Each custom property's tier: the lowest of what reads it, whether a declaration (by its
 * tier: base for the spacing base.css keeps a copy of), another custom property (by its
 * own) or a script (base). The scale's tokens are base, read or not. One nothing reads
 * is the look's, which only styles.css has.
 */
export function customTiers(nodes, { scale = new Set(), scripts = new Set() }) {
  const room = roomOf(nodes);
  const readers = new Map();
  const reads = (name, reader) =>
    readers.set(name, new Set([...(readers.get(name) ?? []), reader]));
  for (const { declarations, prelude } of rulesIn(nodes))
    for (const [property, value] of declarations)
      for (const name of readsOf(value))
        reads(
          name,
          property.startsWith("--")
            ? property
            : structural(property, value, room, prelude)
              ? "base"
              : tierOf(property),
        );
  const tiers = new Map();
  const tierOfCustom = (name, seen = new Set()) => {
    if (tiers.has(name)) return tiers.get(name);
    if (seen.has(name)) return "look";
    seen.add(name);
    const levels = [...(readers.get(name) ?? [])].map((reader) =>
      TIERS.indexOf(
        reader.startsWith("--") ? tierOfCustom(reader, seen) : reader,
      ),
    );
    const tier =
      scale.has(name) || scripts.has(name)
        ? "base"
        : TIERS[Math.min(TIERS.length - 1, ...levels)];
    tiers.set(name, tier);
    return tier;
  };
  for (const { declarations } of rulesIn(nodes))
    for (const [property] of declarations)
      if (property.startsWith("--")) tierOfCustom(property);
  return tiers;
}

/** The tree with only the rules and declarations kept, and no rule or group left empty. */
function project(nodes, keep, keepRule = () => true) {
  return nodes.flatMap((node) => {
    if (node.kind === "rule") {
      if (!keepRule(node)) return [];
      const declarations = node.declarations.filter(([property, value]) =>
        keep(property, value, node),
      );
      return declarations.length ? [{ ...node, declarations }] : [];
    }
    if (node.kind === "group") {
      const children = project(node.children, keep, keepRule);
      return children.length ? [{ ...node, children }] : [];
    }
    // `@keyframes` move only for an `animation`, which is the look's.
    return [];
  });
}

/**
 * What places a custom property in base.css whatever reads it: the scale's tokens (the
 * custom properties `scale.css` gives `:root`), and those a script reads.
 */
export async function baseReaders() {
  const sheet = SHEETS.find(({ key }) => key === "styles/scale");
  const scale = new Set(
    parseCss(await rulesOf(sheet))
      .filter((node) => node.kind === "rule" && node.prelude === ":root")
      .flatMap((node) => node.declarations.map(([property]) => property))
      .filter((property) => property.startsWith("--")),
  );
  return { scale, scripts: scriptReads() };
}

/** Minified CSS as each tier's, `base` and `spacing`, by `tierOf` and `customTiers`. */
export function tiersOf(css, { scale, scripts } = {}) {
  const nodes = parseCss(css);
  const custom = customTiers(nodes, { scale, scripts });
  const room = roomOf(nodes);
  const tier = (property) =>
    property.startsWith("--") ? custom.get(property) : tierOf(property);
  return {
    base:
      MARK_RULE +
      printCss(
        project(
          nodes,
          (property, value, rule) =>
            tier(property) === "base" ||
            structural(property, value, room, rule.prelude),
          (rule) => !drawnByTheLook(rule),
        ),
      ) +
      SURFACE_RULE +
      BAR_RULE,
    spacing: printCss(
      project(nodes, (property) => tier(property) === "spacing"),
    ),
  };
}

/**
 * Every one of Clover's sheets in tiers, in the cascade's order: styles.css's list, the
 * sheets that load with their parts' code among them (a recording's, a Scene's, a map's,
 * a vertical slider's), then templates.css's, so base.css and spacing.css serve every
 * part and every template.
 * MapLibre's own stylesheet is MapLibre's, and comes with the map as before.
 */
export async function tierSheets() {
  const css = await rulesOf(...SHEETS.filter(({ layered }) => layered));
  return tiersOf(css, await baseReaders());
}
