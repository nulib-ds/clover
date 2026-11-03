/*
 * The part sheets in `dist/styles/` as `build/styles.mjs` writes them: together, every
 * rule of styles.css, in its order, whichever sheet a page loads first. Run
 * `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

import { layerOf, PART_SHEETS, partSheets, SHEETS } from "./clover-sheets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const GROUPS = partSheets();
const IN_STYLES = SHEETS.filter(({ inStyles }) => inStyles);
const read = (file) => readFileSync(resolve(dist, file), "utf8").trim();

/** The blocks at the top level of `css`, `@layer name{…}` each, by name, in order. */
function layersIn(css) {
  const layers = [];
  let at = 0;
  while (at < css.length) {
    const open = css.indexOf("{", at);
    const name = css.slice(at, open).match(/^@layer ([\w-]+)$/)?.[1];
    assert.ok(name, `expected a layer at ${css.slice(at, at + 40)}`);
    let depth = 0;
    let quote = null;
    let end = open;
    for (; end < css.length; end++) {
      const char = css[end];
      if (quote) {
        if (char === "\\") end++;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) break;
    }
    layers.push([name, css.slice(open + 1, end)]);
    at = end + 1;
  }
  return layers;
}

/** A part sheet's order statement and its layers. */
function partSheet(name) {
  const css = read(`styles/${name}.css`);
  const [, order, body] = css.match(/^@layer clover\{(@layer [\w,-]+;)(.*)\}$/s);
  return { order, layers: layersIn(body) };
}

const minified = async (css) =>
  (await transform(css, { loader: "css", minify: true })).code;

test("every sheet of styles.css is in exactly one part sheet", () => {
  for (const sheet of IN_STYLES) {
    const holding = Object.keys(GROUPS).filter((name) =>
      GROUPS[name].includes(sheet),
    );
    assert.equal(holding.length, 1, `${sheet.key}.css is in ${holding.join(", ") || "none"}`);
  }
  assert.ok(!Object.values(GROUPS).flat().some(({ inStyles }) => !inStyles));
  assert.equal(new Set(IN_STYLES.map(layerOf)).size, IN_STYLES.length);
});

test("core holds the scale and the contrast mode, which every part reads", () => {
  const keys = GROUPS.core.map(({ key }) => key);
  assert.ok(keys.includes("styles/scale") && keys.includes("styles/contrast"));
});

test("each part sheet is written, states every layer's order, and holds its sheets", () => {
  const written = readdirSync(resolve(dist, "styles")).sort();
  assert.deepEqual(
    written,
    Object.keys(GROUPS)
      .map((name) => `${name}.css`)
      .sort(),
    "run npm run build first",
  );
  const order = `@layer ${IN_STYLES.map(layerOf).join(",")};`;
  for (const name of Object.keys(GROUPS)) {
    const sheet = partSheet(name);
    assert.equal(sheet.order, order, name);
    assert.deepEqual(
      sheet.layers.map(([layer]) => layer),
      GROUPS[name].map(layerOf),
      name,
    );
  }
});

test("the part sheets together are styles.css's rules", async () => {
  const rules = new Map(
    Object.keys(GROUPS).flatMap((name) => partSheet(name).layers),
  );
  assert.equal(
    await minified(IN_STYLES.map((sheet) => rules.get(layerOf(sheet))).join("")),
    await minified(read("styles.css").replace(/^@layer clover\{(.*)\}$/s, "$1")),
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
