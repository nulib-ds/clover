/*
 * Builds dist/styles.css from the hand-ordered aggregate src/styles/clover.css,
 * dist/templates.css from src/templates/templates.css (the templates' own styles), and
 * the same sheets again a part at a time, in dist/styles/ (`partSheets`).
 *
 * Package JS never imports CSS: consumers import "@nulib/clover/styles.css" once. That
 * keeps server rendering free of a flash of unstyled content, works under a strict CSP,
 * and suits frameworks (Next's Pages Router) that only allow global CSS in one place.
 * Every part still lays out plainly without it. Only the part sheets of what loads as it
 * draws (a recording, a Scene, a map, a vertical slider) come with their code instead,
 * adopted by the document as it loads (`lazySheets`, `src/ui/adoptSheet.ts`), which a
 * strict CSP allows and no framework sees.
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lazyParts, partSheets, rulesOf } from "./clover-sheets.mjs";
import { tierSheets } from "./tiers.mjs";

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

/*
 * styles.css is the list's sheets but the part sheets that load with their parts' code
 * (`lazyParts`: a recording's, a Scene's, a map's, a vertical slider's), which the
 * package's build hands to the page as those parts load (`lazySheets`). The docs, from
 * source, take the list whole.
 */
const groups = partSheets();
const lazy = new Set(lazyParts(groups).flatMap((name) => groups[name]));
await bundle("src/templates/templates.css", "dist/templates.css");
writeFileSync(
  resolve(root, "dist/styles.css"),
  `@layer clover{${await rulesOf(
    ...Object.values(groups)
      .flat()
      .filter((sheet) => !lazy.has(sheet))
      .sort((a, b) => a.index - b.index),
  )}}\n`,
);

/*
 * The stylesheet in tiers (`build/tiers.mjs`): base.css, the structure of every part and
 * template, and spacing.css, their margins, paddings and gaps, which a page that brings
 * its own look imports in place of styles.css and templates.css, base.css first.
 */
const tiers = await tierSheets();
for (const name of ["base", "spacing"])
  writeFileSync(
    resolve(root, `dist/${name}.css`),
    `@layer clover{${tiers[name]}}\n`,
  );

/*
 * The same sheets a part at a time, each in the one `clover` layer, its sheets in
 * styles.css's order. Core's rules come before every other part's in that order, or tie
 * with none, so a page that imports core.css first cascades as styles.css does
 * (`build/styles.test.mjs`).
 */
mkdirSync(resolve(root, "dist/styles"), { recursive: true });
for (const [name, sheets] of Object.entries(groups))
  writeFileSync(
    resolve(root, `dist/styles/${name}.css`),
    `@layer clover{${await rulesOf(...sheets)}}\n`,
  );
