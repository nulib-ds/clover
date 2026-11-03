/*
 * The part sheets in `dist/styles/` as `build/styles.mjs` writes them: together, every
 * declaration of styles.css, and, imported core first, the same cascade. Run
 * `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PART_SHEETS,
  partSheets,
  partsDrawing,
  rulesOf,
} from "./clover-sheets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const GROUPS = partSheets();
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

test("the part sheets together declare what styles.css does", () => {
  const declarations = (rules) =>
    new Set(
      rules.flatMap(({ selector, conditions, declarations }) =>
        declarations.map(
          ([property, value]) =>
            `${conditions}${selector}{${property}:${value}}`,
        ),
      ),
    );
  const whole = declarations(rulesIn(read("styles.css")));
  const parts = declarations(
    Object.keys(GROUPS).flatMap((name) => rulesIn(read(`styles/${name}.css`))),
  );
  assert.deepEqual(
    [...parts].filter((each) => !whole.has(each)),
    [],
  );
  assert.deepEqual(
    [...whole].filter((each) => !parts.has(each)),
    [],
  );
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
  const rules = [];
  for (const [part, sheets] of Object.entries(GROUPS))
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
  const flips = [];
  for (const early of rules)
    for (const late of rules) {
      if (early.index >= late.index || early.part === late.part) continue;
      if (early.part === "core") continue;
      if (compare(early.specificity, late.specificity) !== 0) continue;
      if (early.pseudoElement !== late.pseudoElement) continue;
      // A class in common on the element, or, where one names none, its type and a
      // class in common on the way to it. Two classes one element carries are missed.
      const sameElement =
        early.classes.size && late.classes.size
          ? meets(early.classes, late.classes)
          : early.subject === late.subject && meets(early.all, late.all);
      if (!sameElement) continue;
      const shared = [...early.properties].filter((property) =>
        late.properties.has(property),
      );
      if (shared.length)
        flips.push(
          `${early.key} ${early.selector} and ${late.key} ${late.selector}: ${shared.join(", ")}`,
        );
    }
  assert.deepEqual(flips, []);
});

/*
 * A rule in one part's sheet whose classes another part's code writes, all of them,
 * styles that part's page too, which may not import the sheet: its sheet's owners in
 * `OWNERS` (`build/clover-sheets.mjs`) are missing that part's modules.
 */
const DRAWN_APART = [
  // Every Canvas's `--clover-transport-room`, which only a recording's rules read.
  /^\.clover-canvas$/,
  // A Canvas has `data-player` only while a recording's player, media's, draws in it.
  /\[data-player\]/,
];
test("no part draws what only another part's sheet styles", () => {
  const drawing = partsDrawing();
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory())
        return entry.name === "web-components" ? [] : walk(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  // The classes each part's code writes: whole words in its strings.
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
  const leaks = [];
  for (const part of Object.keys(GROUPS)) {
    if (part === "core") continue;
    for (const { selector } of rulesIn(read(`styles/${part}.css`))) {
      const classes = [...classesOf(selector)];
      if (!classes.length || DRAWN_APART.some((rule) => rule.test(selector)))
        continue;
      for (const [other, names] of written)
        if (other !== part && classes.every((name) => names.has(name)))
          leaks.push(`${other} draws ${selector}, styled in ${part}.css`);
    }
  }
  assert.deepEqual([...new Set(leaks)], []);
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
