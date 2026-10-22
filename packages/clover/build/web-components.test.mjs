/**
 * `<clover-viewer>` as built (`npm run build:web-components`): Preact, not React; kept by
 * a bundler that imports it for its effect; MapLibre and hls.js only on demand;
 * MapLibre's worker found from any path; and what a page loads up front, against its
 * budget and as `sizes.json` records it.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

import {
  ELEMENT_DIR as dir,
  elementGzip,
  upFront,
  upFrontSource,
} from "./element-size.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(
  readFileSync(join(root, "build/size-budget.json"), "utf8"),
);

test("the element is built, with a classic-script loader beside it", () => {
  assert.ok(existsSync(join(dir, "index.mjs")), "run npm run build first");
  assert.ok(existsSync(join(dir, "index.umd.js")));
});

test("Preact draws it, not React", () => {
  const source = upFrontSource();
  assert.ok(!/react-dom\.production|scheduler\.production/.test(source));
  assert.ok(
    /\.__H\b|\.__k\b/.test(source),
    "Preact's internals should be there",
  );
});

test("MapLibre and hls.js load only on demand; the worker is found from any path", () => {
  const files = readdirSync(dir).filter((file) => file.endsWith(".mjs"));
  const front = upFront();
  for (const name of ["maplibre-gl", "hls"]) {
    const chunk = files.find((file) => file.startsWith(`${name}-`));
    assert.ok(chunk, `${name} must be emitted`);
    assert.ok(!front.has(chunk), `${name} must stay deferred`);
  }
  const source = upFrontSource();
  assert.ok(
    /new URL\("assets\/maplibre-gl-worker-[^"]+",\s*import\.meta\.url\)/.test(
      source,
    ),
    "MapLibre's worker must resolve against the module, not the site root",
  );
  assert.ok(!/["']\/assets\//.test(source));
});

test("what a page loads up front stays within budget", (t) => {
  const size = elementGzip();
  t.diagnostic(
    `<clover-viewer> up front ${(size / 1000).toFixed(1)} kB gzip (budget ${(budget.webComponentsGzip / 1000).toFixed(1)} kB)`,
  );
  assert.ok(size <= budget.webComponentsGzip, `${size} B gzip, over budget`);
});

test('a bundler keeps `import "@nulib/clover/web-components"`, which defines the element', async () => {
  // The package is side-effect free but for its CSS and this entry (`sideEffects`), so
  // an import for its effect alone, as Get Started shows, must survive tree-shaking.
  const { outputFiles } = await build({
    stdin: {
      contents: 'import "@nulib/clover/web-components";',
      resolveDir: resolve(root, "../.."),
    },
    bundle: true,
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  assert.match(outputFiles[0].text, /customElements\.define\("clover-viewer"/);
});

test("sizes.json records what a page loads up front, as measured", () => {
  const sizes = JSON.parse(
    readFileSync(join(root, "build/sizes.json"), "utf8"),
  );
  assert.equal(
    sizes.webComponentsGzip,
    elementGzip(),
    "run npm run build:sizes after the element's build",
  );
});
