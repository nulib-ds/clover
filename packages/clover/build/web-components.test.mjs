/**
 * `@nulib/clover/web-components` as built (`npm run build:web-components`): Preact, not
 * React; kept by a bundler that imports it for its effect; each element's code loaded
 * only when one is on the page; MapLibre and hls.js only on demand; MapLibre's worker
 * found from any path; its types and Custom Elements Manifest written from the specs; and
 * what each page loads, against its budget and as `sizes.json` records it.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

import { manifestOf, readSpecs, typesOf } from "./custom-elements.mjs";
import {
  ELEMENT_DIR as dir,
  PAGES,
  pageFiles,
  pageGzip,
  pageSource,
} from "./element-size.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(
  readFileSync(join(root, "build/size-budget.json"), "utf8"),
);
const VIEWER = ["clover-viewer"];
const LABELS = ["clover-root", "clover-label"];
const FOUR = ["clover-root", "clover-label", "clover-content", "clover-items"];

test("the elements are built, with a classic-script loader beside them", () => {
  assert.ok(existsSync(join(dir, "index.mjs")), "run npm run build first");
  assert.ok(existsSync(join(dir, "index.umd.js")));
});

test("the classic-script loader says when the module cannot load", () => {
  const loader = readFileSync(join(dir, "index.umd.js"), "utf8");
  assert.match(loader, /\.catch\(/);
  assert.match(loader, /could not load/);
});

test("Preact draws them, not React", () => {
  const source = pageSource(VIEWER);
  assert.ok(!/react-dom\.production|scheduler\.production/.test(source));
  assert.ok(
    /\.__H\b|\.__k\b/.test(source),
    "Preact's internals should be there",
  );
});

test("a page loads only the elements it uses", () => {
  // The script defines every element and draws none: no Preact until one connects.
  assert.ok(!/\.__H\b|\.__k\b/.test(pageSource([])));
  // A page of labels never loads a Canvas (its renderer), or the Viewer's template.
  const CANVAS = "webglcontextlost";
  const TEMPLATE = "defaultPanelOpen";
  const labels = pageSource(LABELS);
  assert.ok(!labels.includes(CANVAS) && !labels.includes(TEMPLATE));
  assert.ok(pageSource(FOUR).includes(CANVAS));
  assert.ok(pageSource(VIEWER).includes(TEMPLATE));
});

test("MapLibre and hls.js load only on demand; the worker is found from any path", () => {
  const files = readdirSync(dir).filter((file) => file.endsWith(".mjs"));
  const front = pageFiles(VIEWER);
  for (const name of ["maplibre-gl", "hls"]) {
    const chunk = files.find((file) => file.startsWith(`${name}-`));
    assert.ok(chunk, `${name} must be emitted`);
    assert.ok(!front.has(chunk), `${name} must stay deferred`);
  }
  const source = pageSource([]);
  assert.ok(
    /new URL\("assets\/maplibre-gl-worker-[^"]+",\s*import\.meta\.url\)/.test(
      source,
    ),
    "MapLibre's worker must resolve against the module, not the site root",
  );
  assert.ok(!/["']\/assets\//.test(pageSource(VIEWER)));
});

test("what each page loads stays within budget", (t) => {
  for (const [name, key, tags] of PAGES) {
    const size = pageGzip(tags);
    t.diagnostic(
      `${name.padEnd(22)} ${(size / 1000).toFixed(1)} kB gzip (budget ${(budget[key] / 1000).toFixed(1)} kB)`,
    );
    assert.ok(size <= budget[key], `${name}: ${size} B gzip, over budget`);
  }
});

test('a bundler keeps `import "@nulib/clover/web-components"`, which defines the elements', async () => {
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
  assert.match(outputFiles[0].text, /customElements\.define\(/);
  assert.match(outputFiles[0].text, /"clover-viewer"/);
});

test("the types and the manifest are the specs', every element, attribute and event", async () => {
  const { SPECS, DOCS } = await readSpecs();
  const written = JSON.parse(
    readFileSync(join(dir, "custom-elements.json"), "utf8"),
  );
  assert.deepEqual(written, manifestOf(SPECS, DOCS));
  assert.equal(
    readFileSync(join(dir, "index.d.mts"), "utf8"),
    typesOf(SPECS, DOCS),
  );
  const declared = written.modules[0].declarations;
  for (const spec of SPECS) {
    const declaration = declared.find((each) => each.tagName === spec.tag);
    assert.ok(declaration, `${spec.tag} must be in the manifest`);
    assert.deepEqual(
      declaration.attributes.map(({ name }) => name),
      Object.keys(spec.attributes),
    );
    assert.deepEqual(
      declaration.events.map(({ name }) => name),
      Object.keys(spec.events ?? {}),
    );
  }
  const types = readFileSync(join(dir, "index.d.mts"), "utf8");
  for (const spec of SPECS) {
    assert.match(types, new RegExp(`"${spec.tag}": ${DOCS[spec.tag].name};`));
  }
  assert.match(
    types,
    /"clover-canvas-change": CustomEvent<\{ canvasId: string \}>;/,
  );
});

test("sizes.json records what each page loads, as measured", () => {
  const sizes = JSON.parse(
    readFileSync(join(root, "build/sizes.json"), "utf8"),
  );
  for (const [, key, tags] of PAGES) {
    assert.equal(
      sizes[key],
      pageGzip(tags),
      `${key}: run npm run build:sizes after the element's build`,
    );
  }
});
