/*
 * The part sheets in `dist/styles/` as `build/styles.mjs` writes them: together, every
 * declaration of styles.css and of the sheets that load with their parts' code, and,
 * imported core first, the same cascade. Run `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DRAWN_INSIDE,
  EXTENDING,
  PART_SHEETS,
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
 * A recording's, a Scene's, a map's and a vertical slider's sheets load with the code that
 * draws what they style (`lazySheets`): each a module of what its part sheet holds, which
 * every module that draws any of it adopts as it loads.
 */
test("each part sheet loaded with its code is its file's, adopted where it draws", async () => {
  assert.deepEqual(LAZY.sort(), ["items-vertical", "map", "media", "scene"]);
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
    resolve(root, "../../content/docs/styling.mdx"),
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
 * one of theirs and a template's would flip.
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
    for (const late of templates) flips.push(...tied(early, late));
  assert.deepEqual(flips, []);
});

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

/** Where `late` would win a tie that `early` won before, each property tied, said. */
function tied(early, late) {
  if (compare(early.specificity, late.specificity) !== 0) return [];
  if (early.pseudoElement !== late.pseudoElement) return [];
  // A class in common on the element, or, where one names none, its type and a
  // class in common on the way to it. Two classes one element carries are missed.
  const sameElement =
    early.classes.size && late.classes.size
      ? meets(early.classes, late.classes)
      : early.subject === late.subject && meets(early.all, late.all);
  if (!sameElement) return [];
  const shared = [...early.properties].filter((property) =>
    late.properties.has(property),
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
 * `OWNERS` (`build/clover-sheets.mjs`) are missing that part's modules.
 */
const DRAWN_APART = [
  // A Canvas has `data-player` only while a recording's player, media's, draws in it.
  /\[data-player\]/,
];
/** The classes each part's code writes, whole words in its strings, by `drawing`. */
function writtenBy(drawing) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory())
        return entry.name === "web-components" ? [] : walk(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  const written = new Map();
  for (const file of walk(resolve(root, "src"))) {
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
    if (part === "core") continue;
    for (const { selector } of rulesIn(read(`styles/${part}.css`))) {
      const classes = [...classesOf(selector)];
      if (!classes.length || DRAWN_APART.some((rule) => rule.test(selector)))
        continue;
      for (const [other, names] of written)
        if (
          other !== part &&
          other !== EXTENDING[part] &&
          classes.every((name) => names.has(name))
        )
          leaks.push(`${other} draws ${selector}, styled in ${part}.css`);
    }
  }
  assert.deepEqual([...new Set(leaks)], []);
});

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
    // A sheet extending a part comes with that part's code, wherever it draws.
    if (part === "core" || EXTENDING[part]) continue;
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
