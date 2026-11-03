/*
 * Builds dist/styles.css from the hand-ordered aggregate src/styles/clover.css,
 * dist/templates.css from src/templates/templates.css (the templates' own styles), and
 * the same sheets again a part at a time, in dist/styles/ (`partSheets`).
 *
 * Package JS never imports CSS: consumers import "@nulib/clover/styles.css" once. That
 * keeps server rendering free of a flash of unstyled content, works under a strict CSP,
 * and suits frameworks (Next's Pages Router) that only allow global CSS in one place.
 * Every part still lays out plainly without it.
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { layerOf, partSheets, rulesOf, SHEETS } from "./clover-sheets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One aggregate as one stylesheet, everything in one cascade layer, so a consumer's
 * unlayered rules win without a specificity contest. The layer is added here rather than
 * with `@import … layer()` in the source aggregate, which the docs import directly and
 * Next's CSS loader mishandles.
 */
async function bundle(source, output) {
  const { outputFiles } = await build({
    entryPoints: [resolve(root, source)],
    outfile: resolve(root, output),
    bundle: true,
    minify: true,
    write: false,
    logLevel: "warning",
    // The cascade-layer baseline: a browser without `@layer` drops every rule inside one.
    target: ["chrome99", "edge99", "firefox97", "safari15.4"],
  });
  const css = outputFiles[0].text.trim();
  if (/@(import|charset)\b/.test(css)) {
    throw new Error(
      `${output}: an @import or @charset cannot sit inside @layer`,
    );
  }
  mkdirSync(resolve(root, "dist"), { recursive: true });
  writeFileSync(resolve(root, output), `@layer clover{${css}}\n`);
}

await bundle("src/styles/clover.css", "dist/styles.css");
await bundle("src/templates/templates.css", "dist/templates.css");

/*
 * A page imports part sheets in any order, so each sheet's rules sit in a layer of their
 * own within `clover`, and every part sheet opens by stating the order of them all,
 * styles.css's, whichever part sheet loads first.
 */
const order = `@layer ${SHEETS.filter(({ inStyles }) => inStyles)
  .map(layerOf)
  .join(",")};`;
mkdirSync(resolve(root, "dist/styles"), { recursive: true });
for (const [name, sheets] of Object.entries(partSheets())) {
  const layers = await Promise.all(
    sheets.map(async (sheet) => `@layer ${layerOf(sheet)}{${await rulesOf(sheet)}}`),
  );
  writeFileSync(
    resolve(root, `dist/styles/${name}.css`),
    `@layer clover{${order}${layers.join("")}}\n`,
  );
}
