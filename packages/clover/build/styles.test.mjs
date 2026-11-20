/*
 * The part sheets in `dist/styles/` as `build/styles.mjs` writes them: together, every
 * declaration of styles.css and of the sheets that load with their parts' code, and,
 * imported core first, the same cascade. Run `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DRAWN_INSIDE,
  EXTENDING,
  PART_SHEETS,
  SHARED,
  SHEETS,
  lazyParts,
  mapLibreSheetCss,
  ownersOf,
  partSheets,
  partsDrawing,
  rulesOf,
} from "./clover-sheets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const GROUPS = partSheets();
/** The part sheets that load with their code, and are not in styles.css. */
const LAZY = lazyParts(GROUPS);
const read = (file) => readFileSync(resolve(dist, file), "utf8").trim();

/** The index after the block that opens at `open`, past quoted braces. */
function blockEnd(css, open) {
  let depth = 0;
  for (let at = open; at < css.length; at++) {
    const char = css[at];
    if (char === '"' || char === "'") {
      at++;
      while (css[at] !== char) at += css[at] === "\\" ? 2 : 1;
    } else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return at + 1;
  }
  throw new Error("unclosed block");
}

/** `css` split at top-level `separator`s, outside parentheses, brackets and quotes. */
function splitTop(css, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let from = 0;
  for (let at = 0; at < css.length; at++) {
    const char = css[at];
    if (quote) {
      if (char === "\\") at++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if ("([".includes(char)) depth++;
    else if (")]".includes(char)) depth--;
    else if (char === separator && depth === 0) {
      parts.push(css.slice(from, at));
      from = at + 1;
    }
  }
  return [...parts, css.slice(from)].filter((part) => part.trim());
}

/**
 * Minified CSS's style rules, in order, each selector apart: its selector, the
 * conditions around it (`@media`, `@supports`), and its declarations. Keyframes skipped.
 */
function rulesIn(css, conditions = "") {
  const rules = [];
  let at = 0;
  while (at < css.length) {
    const open = css.indexOf("{", at);
    const semicolon = css.indexOf(";", at);
    if (css[at] === "@" && semicolon !== -1 && semicolon < open) {
      at = semicolon + 1;
      continue;
    }
    const end = blockEnd(css, open);
    const prelude = css.slice(at, open).trim();
    const body = css.slice(open + 1, end - 1);
    if (/^@(layer|media|supports|container)\b/.test(prelude))
      rules.push(
        ...rulesIn(
          body,
          prelude.startsWith("@layer")
            ? conditions
            : `${conditions}${prelude}|`,
        ),
      );
    else if (!prelude.startsWith("@")) {
      const declarations = splitTop(body, ";").map((declaration) => {
        const colon = declaration.indexOf(":");
        return [
          declaration.slice(0, colon).trim(),
          declaration.slice(colon + 1).trim(),
        ];
      });
      for (const selector of splitTop(prelude, ","))
        rules.push({ selector: selector.trim(), conditions, declarations });
    }
    at = end;
  }
  return rules;
}

/** Minified CSS's `@keyframes`, each its name and its whole block. */
const keyframesIn = (css) =>
  [...css.matchAll(/@keyframes\s*([\w-]+)\s*\{/g)].map((match) => [
    match[1],
    css.slice(match.index, blockEnd(css, match.index + match[0].length - 1)),
  ]);

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** A selector's specificity, `[ids, classes, types]`. */
function specificity(selector) {
  const count = [0, 0, 0];
  const add = ([a, b, c]) => {
    count[0] += a;
    count[1] += b;
    count[2] += c;
  };
  for (let at = 0; at < selector.length; ) {
    const char = selector[at];
    const name = () => {
      const start = at;
      while (at < selector.length && /[\w-]/.test(selector[at])) at++;
      return selector.slice(start, at);
    };
    if (char === "#" || char === ".") {
      at++;
      name();
      count[char === "#" ? 0 : 1]++;
    } else if (char === "[") {
      at = selector.indexOf("]", at) + 1;
      count[1]++;
    } else if (char === ":" && selector[at + 1] === ":") {
      at += 2;
      name();
      count[2]++;
    } else if (char === ":") {
      at++;
      const pseudo = name();
      if (selector[at] === "(") {
        const start = at;
        let depth = 0;
        do {
          if (selector[at] === "(") depth++;
          if (selector[at] === ")") depth--;
          at++;
        } while (depth > 0);
        const argument = selector.slice(start + 1, at - 1);
        if (["is", "not", "has"].includes(pseudo))
          add(splitTop(argument, ",").map(specificity).sort(compare).at(-1));
        else if (pseudo !== "where") count[1]++;
      } else if (["before", "after", "marker", "placeholder"].includes(pseudo))
        count[2]++;
      else count[1]++;
    } else if (/[a-zA-Z]/.test(char)) {
      name();
      count[2]++;
    } else at++;
  }
  return count;
}

/** The last compound of a selector, the element the rule styles. */
function subjectOf(selector) {
  let depth = 0;
  let from = 0;
  for (let at = 0; at < selector.length; at++) {
    const char = selector[at];
    if ("([".includes(char)) depth++;
    else if (")]".includes(char)) depth--;
    else if (depth === 0 && " >+~".includes(char)) from = at + 1;
  }
  return selector.slice(from);
}
/** The classes a selector or compound requires, `:not()`'s left out. */
const classesOf = (css) =>
  new Set(
    [...css.replace(/:not\([^()]*\)/g, "").matchAll(/\.([\w-]+)/g)].map(
      ([, name]) => name,
    ),
  );
const pseudoElementOf = (compound) =>
  compound.match(
    /::?(before|after|marker|placeholder|backdrop|-webkit-[\w-]+)/,
  )?.[0] ?? "";
const meets = (a, b) => [...a].some((name) => b.has(name));

test("every sheet of styles.css is in exactly one part sheet, each written", () => {
  const sheets = Object.values(GROUPS).flat();
  assert.equal(new Set(sheets).size, sheets.length);
  assert.deepEqual(
    readdirSync(resolve(dist, "styles")).sort(),
    Object.keys(GROUPS)
      .map((name) => `${name}.css`)
      .sort(),
    "run npm run build first",
  );
});

test("the part sheets together, but those loaded with their code, declare what styles.css does", () => {
  const declarations = (rules) =>
    new Set(
      rules.flatMap(({ selector, conditions, declarations }) =>
        declarations.map(
          ([property, value]) =>
            `${conditions}${selector}{${property}:${value}}`,
        ),
      ),
    );
  const kept = Object.keys(GROUPS).filter((name) => !LAZY.includes(name));
  const whole = declarations(rulesIn(read("styles.css")));
  const parts = declarations(
    kept.flatMap((name) => rulesIn(read(`styles/${name}.css`))),
  );
  assert.deepEqual(
    [...parts].filter((each) => !whole.has(each)),
    [],
  );
  assert.deepEqual(
    [...whole].filter((each) => !parts.has(each)),
    [],
  );
  // And its keyframes, each in one part sheet.
  const blocks = (css) => keyframesIn(css).map(([, block]) => block);
  assert.deepEqual(
    kept.flatMap((name) => blocks(read(`styles/${name}.css`))).sort(),
    blocks(read("styles.css")).sort(),
  );
});

/*
 * A recording's, a Scene's, a map's, a vertical slider's, the pager's, the Panel's
 * sections' and a Canvas's hotspots' sheets, and those several share, load with the code
 * that draws what they style (`lazySheets`): each a module of what its part sheet holds,
 * which every module that draws any of it adopts as it loads.
 */
test("each part sheet loaded with its code is its file's, adopted where it draws", async () => {
  assert.deepEqual(LAZY.sort(), [
    "annotations",
    "codes",
    "collection-select",
    "contents",
    "download",
    "hotspots",
    "items-vertical",
    "map",
    "media",
    "pager",
    "placeholder",
    "rows",
    "scene",
    "search",
    "text",
    "transcript",
  ]);
  const src = resolve(root, "src");
  for (const name of LAZY) {
    const { default: css } = await import(
      resolve(dist, `ui/sheets/${name}.mjs`)
    );
    assert.equal(css, read(`styles/${name}.css`));
    const owners = GROUPS[name]
      .flatMap((sheet) => ownersOf(sheet))
      .filter((file) => !file.startsWith(resolve(src, "web-components")));
    assert.ok(owners.length);
    for (const owner of new Set(owners)) {
      const built = owner.replace(src, dist).replace(/\.tsx?$/, ".mjs");
      assert.match(
        readFileSync(built, "utf8"),
        new RegExp(
          `adoptSheet\\("${name}", __clover_sheet_${name.replace(/\W/g, "_")}\\)`,
        ),
        `${built} draws what ${name}.css styles without adopting it`,
      );
    }
  }
});

/*
 * MapLibre's stylesheet, for a page with none of its own: MapLibre's rules whole, in a
 * layer after Clover's, loaded only with MapLibre (`components/Map/sheet.ts`), never with
 * the map's own code, and in the elements' build left empty, their registry bringing it.
 */
test("MapLibre's stylesheet loads with MapLibre, after Clover's layer", async () => {
  const { css } = await import(
    resolve(dist, "components/Map/maplibre-sheet.mjs")
  );
  assert.equal(css, await mapLibreSheetCss());
  assert.match(
    css,
    /^@layer clover,maplibre;@layer maplibre\{\.maplibregl-map\{/,
  );
  const statically = (file) =>
    [
      ...readFileSync(resolve(dist, file), "utf8").matchAll(
        /^import\b[^;]*?"([^"]+)"/gm,
      ),
    ].map(([, specifier]) => specifier);
  assert.ok(statically("components/Map/worker.mjs").includes("./sheet.mjs"));
  assert.match(
    readFileSync(resolve(dist, "components/Map/sheet.mjs"), "utf8"),
    /import\("\.\/maplibre-sheet\.mjs"\)/,
  );
  for (const file of ["components/Map/MapView.mjs", "components/Map/sheet.mjs"])
    assert.ok(
      !statically(file).some((specifier) =>
        /maplibre-sheet|\.\/sheet\.mjs/.test(specifier),
      ),
      `${file} loads MapLibre's stylesheet with the map's own code`,
    );
  const elements = resolve(dist, "web-components");
  const placeholder = readdirSync(elements).find((file) =>
    /^maplibre-sheet-.*\.mjs$/.test(file),
  );
  if (placeholder)
    assert.doesNotMatch(
      readFileSync(resolve(elements, placeholder), "utf8"),
      /maplibregl/,
    );
});

/*
 * An animation runs only where its keyframes are on the page: in its own part sheet, or
 * in core.css, which every page imports.
 */
test("every part sheet's animations have their keyframes there or in core", () => {
  const names = (css) => new Set(keyframesIn(css).map(([name]) => name));
  const all = names(read("styles.css"));
  const core = names(read("styles/core.css"));
  const missing = [];
  for (const part of Object.keys(GROUPS)) {
    const css = read(`styles/${part}.css`);
    const own = names(css);
    for (const { selector, declarations } of rulesIn(css))
      for (const [property, value] of declarations)
        if (/^animation(-name)?$/.test(property))
          for (const name of value.split(/[\s,]+/))
            if (all.has(name) && !own.has(name) && !core.has(name))
              missing.push(`${part}.css ${selector} runs ${name}`);
  }
  assert.deepEqual([...new Set(missing)], []);
});

/*
 * What a sheet loaded with its code styles arrives as softly as the code does (Mat,
 * 2026-11-20: "make it universal … very subtle … to evoke content loading"): each such
 * sheet fades up its roots with `--clover-arrive` (`styles/scale.css`), whose token and
 * keyframes are core's, so they are in the page before any part sheet comes. Spared are
 * those with nothing of their own to show: a vertical slider lays out Items' own list, a
 * picture's text is there to select, never to see, and the rows are drawn inside a
 * section that arrives itself. What a first view draws, core's, shows at once.
 */
const ARRIVES_INSIDE = ["items-vertical", "rows", "text"];
test("what a sheet loaded with its code styles fades up as it arrives", () => {
  const core = read("styles/core.css");
  const arrives = ({ declarations }) =>
    declarations.some(
      ([property, value]) =>
        property === "animation" && value.includes("var(--clover-arrive)"),
    );
  assert.ok(
    rulesIn(core).some(({ declarations }) =>
      declarations.some(([property]) => property === "--clover-arrive"),
    ),
    "core.css sets --clover-arrive",
  );
  assert.ok(
    keyframesIn(core).some(([name]) => name === "clover-arrive"),
    "core.css has the clover-arrive keyframes",
  );
  assert.deepEqual(
    rulesIn(core)
      .filter(arrives)
      .map(({ selector }) => selector),
    [],
    "nothing a first view draws fades in",
  );
  for (const part of ARRIVES_INSIDE)
    assert.ok(LAZY.includes(part), `${part} still loads with its code`);
  assert.deepEqual(
    LAZY.filter(
      (part) =>
        !ARRIVES_INSIDE.includes(part) &&
        !rulesIn(read(`styles/${part}.css`)).some(arrives),
    ).map((part) => `${part}.css: animation: var(--clover-arrive) on its roots`),
    [],
  );
});

test("every part sheet's container queries name a container there or in core", () => {
  const names = (css) =>
    new Set(
      [...css.matchAll(/container(?:-name)?:\s*([\w-]+)/g)].map(([, n]) => n),
    );
  const core = names(read("styles/core.css"));
  const missing = [];
  for (const part of Object.keys(GROUPS)) {
    const css = read(`styles/${part}.css`);
    const own = names(css);
    for (const [, name] of css.matchAll(/@container\s+([\w-]+)/g))
      if (!own.has(name) && !core.has(name))
        missing.push(`${part}.css queries ${name}`);
  }
  assert.deepEqual([...new Set(missing)], []);
});

/*
 * A custom property a part sheet reads with no fallback, set only in another part's sheet
 * (core's aside), is invalid on a page without that sheet, and until it loads where the
 * sheet comes with its code: a recording's Body draws its still before its transport.
 */
test("no part sheet reads a custom property only another part's sets", () => {
  const sets = (css) =>
    new Set([...css.matchAll(/(?<=[{;])\s*(--[\w-]+)\s*:/g)].map(([, n]) => n));
  const set = Object.fromEntries(
    Object.keys(GROUPS).map((part) => [part, sets(read(`styles/${part}.css`))]),
  );
  const unset = [];
  for (const part of Object.keys(GROUPS))
    for (const [, name] of read(`styles/${part}.css`).matchAll(
      /var\((--[\w-]+)\s*\)/g,
    )) {
      if (
        set[part].has(name) ||
        set.core.has(name) ||
        set[EXTENDING[part]]?.has(name)
      )
        continue;
      const by = Object.keys(set).filter((other) => set[other].has(name));
      if (by.length)
        unset.push(`${part}.css reads ${name}, set in ${by.join(", ")}.css`);
    }
  assert.deepEqual([...new Set(unset)], []);
});

test("Styling's table lists every part sheet", () => {
  const styling = readFileSync(
    resolve(root, "../../content/docs/styling/index.mdx"),
    "utf8",
  );
  const listed = [...styling.matchAll(/^\| `styles\/([\w-]+)\.css`/gm)].map(
    ([, name]) => name,
  );
  assert.deepEqual(listed.sort(), Object.keys(GROUPS).sort());
});

/*
 * A page imports core.css first, then the other part sheets in any order. Where two
 * rules tie (the same specificity and property, on an element both could style), the
 * later wins, so a tie flips from styles.css's winner if its rules are in two parts
 * other than core, or if core's comes later in styles.css. Higher specificity wins in
 * any order, so only ties count. "Both could style" is read loosely, so the check errs
 * toward failing.
 */
test("imported core first, the part sheets cascade as styles.css does", async () => {
  const rules = await placed(GROUPS);
  const flips = [];
  for (const early of rules)
    for (const late of rules) {
      if (early.index >= late.index || early.part === late.part) continue;
      // Core comes first, and a sheet extending a part's after that part's.
      if (early.part === "core" || EXTENDING[late.part] === early.part)
        continue;
      flips.push(...tied(early, late));
    }
  assert.deepEqual(flips, []);
});

/*
 * The sheets that load with their code are adopted after every sheet of the page, so
 * after templates.css too, which came after them in styles.css's order: a tie between
 * one of theirs and a template's would flip, unless a template's rule settles it
 * (`settled`).
 */
test("the part sheets loaded with their code tie with no template's", async () => {
  const lazy = await placed(
    Object.fromEntries(LAZY.map((name) => [name, GROUPS[name]])),
  );
  const templates = await placed({
    templates: SHEETS.filter(({ inStyles, layered }) => !inStyles && layered),
  });
  assert.ok(templates.length);
  const flips = [];
  for (const early of lazy)
    for (const late of templates) flips.push(...tied(early, late, templates));
  assert.deepEqual(flips, []);
});

/*
 * Whether one of `rules` settles a tie on `property` whichever of the two comes later:
 * more specific than `early`, in `late`'s conditions, and its selector `late`'s with what
 * `early` adds to its element (a state, an attribute), so it styles wherever both do. The
 * Document template's `.clover-template-document-tools .clover-field-pill:hover` settles
 * `.clover-field-pill:hover` against `.clover-template-document-tools .clover-field-pill`.
 */
function settled(early, late, property, rules) {
  const own = subjectOf(early.selector);
  const theirs = subjectOf(late.selector);
  const added = own.startsWith(theirs) ? own.slice(theirs.length) : "";
  if (!/^[:[]/.test(added)) return false;
  return rules.some(
    (rule) =>
      rule.selector === late.selector + added &&
      rule.conditions === late.conditions &&
      rule.properties.has(property) &&
      compare(rule.specificity, early.specificity) > 0,
  );
}

/** Each rule of each part's sheets, with its place and what a tie is read from. */
async function placed(groups) {
  const rules = [];
  for (const [part, sheets] of Object.entries(groups))
    for (const sheet of sheets)
      for (const rule of rulesIn(await rulesOf(sheet))) {
        const subject = subjectOf(rule.selector);
        rules.push({
          ...rule,
          part,
          index: sheet.index,
          key: sheet.key,
          specificity: specificity(rule.selector),
          classes: classesOf(subject),
          all: classesOf(rule.selector),
          subject: subject.replace(/::?[\w-]+$/, ""),
          pseudoElement: pseudoElementOf(subject),
          properties: new Set(rule.declarations.map(([property]) => property)),
        });
      }
  return rules;
}

/**
 * Where `late` would win a tie that `early` won before, each property tied, said, but
 * those one of `settledBy` settles (`settled`).
 */
/** The properties a shorthand sets besides those named after it (`sets`). */
const ALSO_SETS = {
  inset: ["top", "right", "bottom", "left"],
  "inset-block": ["top", "bottom"],
  "inset-inline": ["left", "right"],
  gap: ["row-gap", "column-gap"],
  "place-items": ["align-items", "justify-items"],
  "place-content": ["align-content", "justify-content"],
  "place-self": ["align-self", "justify-self"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  "grid-area": [
    "grid-row-start",
    "grid-row-end",
    "grid-column-start",
    "grid-column-end",
  ],
  font: ["line-height"],
  columns: ["column-count", "column-width"],
};
/**
 * Whether setting `a` sets `b` too, as a shorthand sets its longhands (`padding` and
 * `padding-inline-start`): two rules tie on them though their names differ.
 */
const sets = (a, b) =>
  a !== b &&
  ((b.startsWith(`${a}-`) &&
    !NAMED_APART.some(([s, l]) => s === a && l.test(b))) ||
    (ALSO_SETS[a] ?? []).includes(b));
/** Longhands named after a shorthand that it does not set (`flex` sets no direction). */
const NAMED_APART = [
  ["border", /radius|collapse|spacing/],
  ["outline", /^outline-offset$/],
  ["flex", /^flex-(direction|wrap|flow)$/],
  ["grid", /^grid-(area|row|column)/],
  ["overflow", /^overflow-(wrap|anchor|clip-margin)$/],
];

/** A compound's states and attributes, outside `:is()` and `:where()`, and those its `:not()`s exclude. */
function statesOf(compound) {
  const inner = (name) =>
    [
      ...compound.matchAll(
        new RegExp(`:${name}\\(((?:[^()]|\\([^()]*\\))*)\\)`, "g"),
      ),
    ].map(([, body]) => body);
  const tokens = (css) =>
    [...css.matchAll(/:[\w-]+(?![\w(-])|\[[^\]]+\]/g)].map(([token]) => token);
  const outside = compound.replace(
    /:(not|is|where|has)\(((?:[^()]|\([^()]*\))*)\)/g,
    "",
  );
  return {
    required: new Set(tokens(outside)),
    excluded: new Set(inner("not").flatMap((body) => tokens(body))),
  };
}
/** Whether no element can match both at once: a state one requires, the other excludes. */
const exclusive = (a, b) => {
  const x = statesOf(a);
  const y = statesOf(b);
  return (
    [...x.required].some((token) => y.excluded.has(token)) ||
    [...y.required].some((token) => x.excluded.has(token))
  );
};
/** The compound a selector's subject is a child of (`a > b`), if it is one. */
function parentOf(selector) {
  const subject = subjectOf(selector);
  const before = selector.slice(0, selector.length - subject.length).trimEnd();
  if (!before.endsWith(">")) return null;
  return subjectOf(before.slice(0, -1).trimEnd());
}

function tied(early, late, settledBy = []) {
  if (compare(early.specificity, late.specificity) !== 0) return [];
  if (early.pseudoElement !== late.pseudoElement) return [];
  // A class in common on the element, or, where one names none, its type and a
  // class in common on the way to it. Two classes one element carries are missed.
  const sameElement =
    early.classes.size && late.classes.size
      ? meets(early.classes, late.classes)
      : early.subject === late.subject && meets(early.all, late.all);
  if (!sameElement) return [];
  // Children of two parents with no class in common, or in states that exclude each other.
  const parents = [parentOf(early.selector), parentOf(late.selector)];
  if (parents.every((parent) => parent && classesOf(parent).size))
    if (!meets(classesOf(parents[0]), classesOf(parents[1]))) return [];
  if (exclusive(subjectOf(early.selector), subjectOf(late.selector))) return [];
  // A property both set to one value: whichever wins, it is the same.
  const value = (rule, property) =>
    rule.declarations.find(([name]) => name === property)?.[1];
  const shared = [...early.properties].flatMap((property) =>
    late.properties.has(property)
      ? settled(early, late, property, settledBy) ||
        value(early, property) === value(late, property)
        ? []
        : [property]
      : [...late.properties]
          .filter(
            (other) =>
              (sets(property, other) || sets(other, property)) &&
              !settled(early, late, other, settledBy),
          )
          .map((other) => `${property}/${other}`),
  );
  return shared.length
    ? [
        `${early.key} ${early.selector} and ${late.key} ${late.selector}: ${shared.join(", ")}`,
      ]
    : [];
}

/*
 * A rule in one part's sheet whose classes another part's code writes, all of them,
 * styles that part's page too, which may not import the sheet: its sheet's owners in
 * `OWNERS` (`build/clover-sheets.mjs`) are missing that part's modules. A part extending
 * another (`EXTENDING`) draws with that part's sheet, always in before it.
 */
const DRAWN_APART = [
  // A Canvas has `data-player` only while a recording's player, media's, draws in it.
  /\[data-player\]/,
  /*
   * Items run down the page only once their vertical slider's sheet is in (`ItemsView`
   * loads it before it draws so), which every rule of that sheet names: the pager, which
   * draws Items too, never does.
   */
  /\[data-orientation=vertical\]/,
];
/** The package's modules, the elements' own and tests left out. */
const sourcesOf = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "web-components" ? [] : sourcesOf(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
/** The classes each part's code writes, whole words in its strings, by `drawing`. */
function writtenBy(drawing) {
  const written = new Map();
  for (const file of sourcesOf(resolve(root, "src"))) {
    const classes = [
      ...readFileSync(file, "utf8").matchAll(
        /(?<=["'` ])clover-[\w-]+(?=["'` ])/g,
      ),
    ].map(([name]) => name);
    for (const part of drawing(file))
      written.set(part, new Set([...(written.get(part) ?? []), ...classes]));
  }
  return written;
}

test("no part draws what only another part's sheet styles", () => {
  const written = writtenBy(partsDrawing());
  const leaks = [];
  for (const part of Object.keys(GROUPS)) {
    // A shared sheet is several parts' by design: "every module that draws…" holds it.
    if (part === "core" || part in SHARED) continue;
    for (const { selector } of rulesIn(read(`styles/${part}.css`))) {
      const classes = [...classesOf(selector)];
      if (!classes.length || DRAWN_APART.some((rule) => rule.test(selector)))
        continue;
      for (const [other, names] of written)
        if (
          other !== part &&
          other !== EXTENDING[part] &&
          EXTENDING[other] !== part &&
          classes.every((name) => names.has(name))
        )
          leaks.push(`${other} draws ${selector}, styled in ${part}.css`);
    }
  }
  assert.deepEqual([...new Set(leaks)], []);
});

/*
 * The part sheets loaded with their code are in the page before that code's first paint
 * on the client, but a server's HTML has none of them: what they style must not be in it
 * (Mat, 2026-11-20: "make sure lazy loaded css doesn't have any client/run layout
 * shifts"). A server draws no content, which the Root loads as the page hydrates, only
 * the frames: the Viewer in each template, and a Root with each part. A Map's box is
 * drawn as its code loads, so a page whose server draws a Map imports its sheet (Styling).
 */
const SERVER_DRAWN = { map: /\.clover-geomap\b/ };
test("nothing a part sheet loaded with its code styles is in a server's HTML", async () => {
  const require = createRequire(import.meta.url);
  const { createElement: h } = require("react");
  const { renderToString } = require("react-dom/server");
  const Clover = await import(resolve(dist, "index.mjs"));
  const Templates = await import(resolve(dist, "templates/index.mjs"));
  const book = JSON.parse(
    readFileSync(resolve(root, "src/fixtures/iiif-cookbook/0009-book-1.json")),
  );
  for (const name of PARTS_DRAWN_ALONE)
    assert.ok(Clover[name], `${name} is no export of @nulib/clover`);
  const html = [
    ...["Default", "Document", "Gallery"].map((name) =>
      renderToString(
        h(Clover.default, { iiifContent: book, template: Templates[name] }),
      ),
    ),
    renderToString(
      h(
        Clover.Root,
        { iiifContent: book },
        ...PARTS_DRAWN_ALONE.map((name) => h(Clover[name], { key: name })),
      ),
    ),
  ].join("");
  const drawn = new Set(
    [...html.matchAll(/class="([^"]*)"/g)].flatMap(([, list]) =>
      list.split(/\s+/),
    ),
  );
  assert.ok(drawn.has("clover-root") && drawn.has("clover-template-default"));
  // Each attribute a selector requires, `:not()`'s left out, must be in the HTML too.
  const attributes = (selector) =>
    [...selector.replace(/:not\([^()]*\)/g, "").matchAll(/\[([\w-]+)/g)].map(
      ([, name]) => name,
    );
  const painted = [];
  for (const name of LAZY)
    for (const { selector } of rulesIn(read(`styles/${name}.css`))) {
      const classes = [...classesOf(selector)];
      if (!classes.length || !classes.every((each) => drawn.has(each)))
        continue;
      if (
        !attributes(selector).every((each) =>
          new RegExp(`\\s${each}[=\\s/>]`).test(html),
        )
      )
        continue;
      if (!SERVER_DRAWN[name]?.test(selector))
        painted.push(`${name}.css ${selector}`);
    }
  assert.deepEqual(painted, []);
});

/** The parts a page can draw with no props, each in a Root, as the docs' pages do. */
const PARTS_DRAWN_ALONE = [
  "Label",
  "Thumbnail",
  "Summary",
  "Metadata",
  "RequiredStatement",
  "Rights",
  "Homepage",
  "SeeAlso",
  "Rendering",
  "PartOf",
  "Id",
  "Provider",
  "Logo",
  "Body",
  "Canvas",
  "Timeline",
  "Scene",
  "Items",
  "Position",
  "Status",
  "Panel",
  "About",
  "Annotations",
  "Collection",
  "CollectionSelect",
  "Contents",
  "Download",
  "Search",
  "Transcript",
  "Map",
];

/*
 * A part that draws another inside it (the Panel's Collection section draws `Items`) needs
 * that part's sheet too, where it draws it: a rule of the other's sheet whose classes the
 * part and what it draws write, all of them, and its own code alone does not (the test
 * above). `DRAWN_INSIDE` names each, and Styling's table says so.
 */
test("a part names the sheets of the parts it draws inside it", () => {
  const own = writtenBy(partsDrawing());
  const inside = writtenBy(partsDrawing({ inside: true }));
  const needed = new Set();
  for (const part of Object.keys(GROUPS)) {
    // A sheet extending a part comes with that part's code, wherever it draws, and a
    // shared one with each of its owners' ("every module that draws…").
    if (part === "core" || EXTENDING[part] || part in SHARED) continue;
    for (const { selector } of rulesIn(read(`styles/${part}.css`))) {
      const classes = [...classesOf(selector)];
      if (!classes.length) continue;
      for (const [other, names] of inside)
        if (
          other !== part &&
          classes.every((name) => names.has(name)) &&
          !classes.every((name) => own.get(other)?.has(name))
        )
          needed.add(`${other}: ${part}`);
    }
  }
  assert.deepEqual(
    [...needed].sort(),
    Object.entries(DRAWN_INSIDE)
      .flatMap(([part, sheets]) => sheets.map((sheet) => `${part}: ${sheet}`))
      .sort(),
    "update DRAWN_INSIDE (build/clover-sheets.mjs) and Styling's table",
  );
});

/*
 * A sheet that loads with its code is in the page once a module that adopts it has run.
 * So every module whose code draws what one of its rules styles, writing each class the
 * rule names (one way through each `:is()`), adopts it (its part sheet's `OWNERS`),
 * imports a module that does, or is drawn only by modules covered so, never by a page
 * itself (a package entry exports it). A class built from a prefix (`${part}-languages`)
 * is its template's, covered too where every module naming that prefix is. Attributes
 * that mark a rule as drawn apart (`DRAWN_APART`) keep their own guard.
 */
test("every module that draws what a sheet loaded with its code styles brings it", async () => {
  const src = resolve(root, "src");
  const files = sourcesOf(src);
  const target = (from, specifier) =>
    ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]
      .map((ending) => resolve(dirname(from), specifier + ending))
      .find((file) => existsSync(file) && /\.tsx?$/.test(file));
  const statics = new Map();
  const exports = new Map();
  const importers = new Map();
  const literal = new Map();
  const templated = new Map();
  for (const file of files) {
    // Its code, its comments left out: a class named in one draws nothing.
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const fixed = [
      ...code.matchAll(
        /^(?:import|export)\b(\s+type\b)?[^;]*?\bfrom\s*"(\.[^"]+)"/gm,
      ),
    ]
      .flatMap(([, type, specifier]) => (type ? [] : [specifier]))
      .concat([...code.matchAll(/^import\s*"(\.[^"]+)"/gm)].map(([, s]) => s));
    const later = [...code.matchAll(/\bimport\(\s*"(\.[^"]+)"/g)].map(
      ([, s]) => s,
    );
    statics.set(
      file,
      new Set(fixed.map((s) => target(file, s)).filter(Boolean)),
    );
    exports.set(
      file,
      [...code.matchAll(/^export\b(?!\s+type\b)[^;]*?\bfrom\s*"(\.[^"]+)"/gm)]
        .map(([, s]) => target(file, s))
        .filter(Boolean),
    );
    for (const specifier of [...fixed, ...later]) {
      const imported = target(file, specifier);
      if (imported)
        importers.set(imported, [...(importers.get(imported) ?? []), file]);
    }
    literal.set(
      file,
      new Set(
        [...code.matchAll(/(?<=["'` ])clover-[\w-]+(?=["'` ])/g)].map(
          ([name]) => name,
        ),
      ),
    );
    templated.set(
      file,
      [...code.matchAll(/className=\{`([^`]*)`\}/g)].flatMap(([, value]) =>
        [...value.matchAll(/\$\{\w+\}(-[\w-]+)/g)].map(([, end]) => end),
      ),
    );
  }
  // What a page imports itself: each export's source, and what it exports.
  const exported = Object.values(
    JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).exports,
  )
    .flatMap((entry) =>
      typeof entry === "string" ? [entry] : Object.values(entry),
    )
    .filter(
      (path) => typeof path === "string" && /^\.\/dist\/.*\.mjs$/.test(path),
    )
    .map((path) =>
      [".ts", ".tsx"]
        .map((ending) =>
          path.replace(/^\.\/dist\//, `${src}/`).replace(/\.mjs$/, ending),
        )
        .find((file) => existsSync(file)),
    )
    .filter(Boolean);
  // What the entries export, at any depth (`index.ts` exports `parts.ts`'s parts).
  const entries = new Set(exported);
  for (const entry of entries)
    for (const next of exports.get(entry) ?? []) entries.add(next);
  const isPublic = (file) => entries.has(file);
  const reach = (file, seen = new Set()) => {
    for (const next of statics.get(file) ?? [])
      if (!seen.has(next)) {
        seen.add(next);
        reach(next, seen);
      }
    return seen;
  };
  const covered = (file, owners, seen = new Set()) => {
    if (owners.has(file) || [...reach(file)].some((f) => owners.has(f)))
      return true;
    if (isPublic(file) || seen.has(file)) return false;
    const by = importers.get(file) ?? [];
    return (
      by.length > 0 &&
      by.every((importer) =>
        covered(importer, owners, new Set([...seen, file])),
      )
    );
  };
  // A selector one way through each `:is()` and `:where()`.
  const ways = (selector) => {
    const at = selector.search(/:(is|where)\(/);
    if (at < 0) return [selector];
    const open = selector.indexOf("(", at);
    let close = open;
    for (let depth = 0; close < selector.length; close++) {
      if (selector[close] === "(") depth++;
      else if (selector[close] === ")" && --depth === 0) break;
    }
    return splitTop(selector.slice(open + 1, close), ",").flatMap((each) =>
      ways(selector.slice(0, at) + each.trim() + selector.slice(close + 1)),
    );
  };
  const uncovered = new Set();
  for (const name of LAZY) {
    const owners = new Set(
      GROUPS[name]
        .flatMap((sheet) => ownersOf(sheet))
        .filter((file) => !file.startsWith(resolve(src, "web-components"))),
    );
    for (const { selector } of rulesIn(read(`styles/${name}.css`)))
      for (const way of ways(selector)) {
        const classes = [...classesOf(way)];
        if (!classes.length || DRAWN_APART.some((rule) => rule.test(way)))
          continue;
        for (const file of files) {
          // The prefixes whose modules this one's template draws for, where it needs one.
          const prefixes = [];
          const draws = classes.every((name) => {
            if (literal.get(file).has(name)) return true;
            const end = templated.get(file).find((each) => name.endsWith(each));
            if (!end) return false;
            prefixes.push(name.slice(0, -end.length));
            return true;
          });
          if (!draws || covered(file, owners)) continue;
          const passers = prefixes.flatMap((prefix) =>
            files.filter((each) => literal.get(each).has(prefix)),
          );
          if (passers.length && passers.every((each) => covered(each, owners)))
            continue;
          uncovered.add(
            `${relative(src, file)} draws ${way}, which ${name}.css styles`,
          );
        }
      }
  }
  assert.deepEqual([...uncovered], []);
});

test("every part sheet resolves through the package's exports", () => {
  for (const name of Object.keys(GROUPS)) {
    const url = import.meta.resolve(`@nulib/clover/styles/${name}.css`);
    assert.equal(fileURLToPath(url), resolve(dist, `styles/${name}.css`));
    assert.ok(existsSync(fileURLToPath(url)));
  }
});

test("every part's directory is in a part sheet, so none falls to core unseen", () => {
  const named = new Set(Object.values(PART_SHEETS).flat());
  for (const dir of readdirSync(resolve(root, "src/components")))
    assert.ok(
      named.has(`components/${dir}`),
      `components/${dir} is in no part sheet; add it to PART_SHEETS (build/clover-sheets.mjs)`,
    );
});
