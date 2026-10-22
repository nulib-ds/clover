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

import { SHEETS } from "./clover-sheets.mjs";
import { manifestOf, readSpecs, typesOf } from "./custom-elements.mjs";
import {
  ELEMENT_DIR as dir,
  PAGES,
  pageFiles,
  pageGzip,
  VIEWER_DIR,
  viewerEntryFiles,
  viewerEntryGzip,
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
  /*
   * A page of labels never loads a Canvas (its renderer), or the Viewer's template; a
   * Canvas alone, once it draws (its renderer loads then), not the template. The template
   * is known by its class as its code writes it, quoted: its stylesheet has it as a
   * selector, and the entry's spec names its props.
   */
  const CANVAS = "webglcontextlost";
  const TEMPLATE = '"clover-template-default"';
  const labels = pageSource(LABELS);
  assert.ok(!labels.includes(CANVAS) && !labels.includes(TEMPLATE));
  assert.ok(pageSource(FOUR).includes(CANVAS));
  const canvas = pageSource(
    PAGES.find(([, key]) => key === "canvasElementGzip")[2],
  );
  assert.ok(canvas.includes(CANVAS) && !canvas.includes(TEMPLATE));
  assert.ok(pageSource(VIEWER).includes(TEMPLATE));
});

test("a page loads the sheets of what it draws, and most of the stylesheet with the first part that draws any of it", () => {
  // The sheets a page's files register, by key (`addSheet`, `clover-sheets.mjs`).
  const sheetsOf = (tags) => {
    const source = pageSource(tags);
    return [
      ...SHEETS.map(({ key }) => key),
      ...["styles-1", "styles-2", "styles-3", "styles-4"],
    ].filter((key) => source.includes(`"${key}"`));
  };
  // A page of labels: the light parts' sheets, which every page loads, and no run.
  const labels = sheetsOf(LABELS);
  assert.deepEqual(labels, [
    "styles/scale",
    "ui/ReadMore",
    "components/Primitives/Primitives",
    "components/Label/Label",
    "components/Status/Status",
  ]);
  // A viewer: the runs too, its template among them; never what media, maps or the other
  // templates bring, which load as those draw.
  const viewer = sheetsOf(VIEWER);
  for (const run of ["styles-1", "styles-2", "styles-3", "styles-4"])
    assert.ok(viewer.includes(run), `a viewer's page must load ${run}`);
  for (const lazy of [
    "maplibre",
    "components/Map/Map",
    "components/Canvas/media/MediaStage",
    "components/Canvas/media/Transport",
    "templates/document/Document",
    "templates/gallery/Gallery",
  ])
    assert.ok(!viewer.includes(lazy), `${lazy} must load as it draws`);
  // Each lazy sheet rides with its code, in a chunk a page loads only for it.
  const files = readdirSync(dir).filter((file) => file.endsWith(".mjs"));
  const holding = (key) =>
    files.filter((file) =>
      readFileSync(join(dir, file), "utf8").includes(`"${key}"`),
    );
  assert.ok(holding("maplibre").some((file) => file.startsWith("MapView-")));
  assert.ok(
    holding("templates/document/Document").some((file) =>
      file.startsWith("Document-"),
    ),
  );
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

test("the Viewer's own entry is built whole, and a page with it alone loads less", (t) => {
  for (const file of ["index.mjs", "index.umd.js", "index.d.mts"])
    assert.ok(
      existsSync(join(VIEWER_DIR, file)),
      `viewer/${file} must be built`,
    );
  const files = [...viewerEntryFiles()];
  const source = files
    .map((file) => readFileSync(join(VIEWER_DIR, file), "utf8"))
    .join("\n");
  assert.ok(/"clover-viewer"/.test(source), "it defines <clover-viewer>");
  assert.ok(!/react-dom\.production|scheduler\.production/.test(source));
  // Whole: a few files, not the shared entry's dozens, and fewer bytes for it.
  assert.ok(files.length <= 6, `${files.length} files`);
  const whole = viewerEntryGzip();
  const shared = pageGzip(["clover-viewer"]);
  t.diagnostic(
    `<clover-viewer>, its own entry: ${(whole / 1000).toFixed(1)} kB gzip in ${files.length} files (shared entry ${(shared / 1000).toFixed(1)} kB; budget ${(budget.viewerEntryGzip / 1000).toFixed(1)} kB)`,
  );
  assert.ok(whole < shared);
  assert.ok(whole <= budget.viewerEntryGzip, `${whole} B gzip, over budget`);
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

test('a bundler keeps `import "@nulib/clover/web-components"`, which defines the elements, and the Viewer\'s own entry', async () => {
  // The package is side-effect free but for its CSS and these entries (`sideEffects`), so
  // an import for its effect alone, as Get Started shows, must survive tree-shaking.
  for (const entry of ["web-components", "web-components/viewer"]) {
    const { outputFiles } = await build({
      stdin: {
        contents: `import "@nulib/clover/${entry}";`,
        resolveDir: resolve(root, "../.."),
      },
      bundle: true,
      format: "esm",
      write: false,
      logLevel: "silent",
    });
    assert.match(outputFiles[0].text, /customElements\.define\(/, entry);
    assert.match(outputFiles[0].text, /"clover-viewer"/, entry);
  }
});

test("the types and the manifest are the specs', every element, attribute and event", async () => {
  const { SPECS, DOCS, HANDLE } = await readSpecs();
  const written = JSON.parse(
    readFileSync(join(dir, "custom-elements.json"), "utf8"),
  );
  assert.deepEqual(written, manifestOf(SPECS, DOCS));
  const types = readFileSync(join(dir, "index.d.mts"), "utf8");
  assert.equal(types, typesOf(SPECS, DOCS, HANDLE));
  // What a page's script reaches is typed too: the root's API, the Canvas's handle.
  assert.match(types, /export interface CloverRootApi \{/);
  assert.match(types, /export interface CloverCanvasHandle \{[^}]*zoomBy\(/);
  assert.match(types, /readonly clover: CloverRootApi \| null;/);
  assert.match(types, /readonly handle: CloverCanvasHandle \| null;/);
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
