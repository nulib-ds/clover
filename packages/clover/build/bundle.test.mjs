/*
 * What @nulib/clover's build emits, and what a consumer ships from it.
 *
 * The graph checks build in memory. The size table bundles the built `dist/` as a Vite
 * app builds it for production (`sizes.mjs`, through `consumer-bundle.mjs`), so run
 * `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "vite";

import { measure } from "./sizes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const budget = JSON.parse(
  readFileSync(resolve(root, "build/size-budget.json"), "utf8"),
);

/** Packages 4.x has left behind. None may appear in the build, bundled or imported. */
const FORBIDDEN = [
  /^openseadragon/,
  /^@vidstack\//,
  /^wavesurfer\.js/,
  /^@radix-ui\//,
  /^embla-carousel/,
  /^react-error-boundary/,
  /^uuid/,
  /^react-lazy-load-image-component/,
  /^node-webvtt/,
  /^flexsearch/,
  /^marked/,
  /^@samvera\/clover-iiif/,
  // 422 kB gzip for one warped layer: Clover draws basic georeferences itself.
  /^@allmaps\//,
];

/** Modules that must load only on demand: reachable by dynamic import, never statically. */
const LAZY_MODULES = [
  "/components/Canvas/media/MediaStage.tsx",
  "/components/Canvas/CaptionDetails.tsx",
  "/core/sanitize.ts",
  "/core/svg-shape.ts",
  "/components/Canvas/FrameAnimation.tsx",
  "/components/Canvas/panClearOfChrome.ts",
  // Hotspots and the Canvas's menus, for a Canvas with annotations or a Choice.
  "/components/Canvas/Annotations.tsx",
  "/components/Canvas/AnnotationMenu.tsx",
  "/components/Canvas/ChoiceMenu.tsx",
  // Off by default.
  "/lib/renderer/overlays/Navigator.ts",
  // Annotations as the content, an AnnotationPage or AnnotationCollection.
  "/core/annotations-content.ts",
  // A standalone Canvas loading its own (`iiifContent`).
  "/components/Canvas/LoadedCanvas.tsx",
  // The upgrader's fix for fragmented targets, loaded with the upgrader.
  "/core/keep-fragments.ts",
  // About's "Part of", for a Canvas shown on its own.
  "/components/Panel/PartOfManifest.tsx",
  // Every language but English, the first time Clover is to speak it.
  ...["es", "fi", "fr", "nb", "nn", "no", "pt"].map(
    (lng) => `/i18n/locales/${lng}.json`,
  ),
];
/** Packages imported only on demand: media streaming, sanitizing, upgrading old IIIF. */
const LAZY_PACKAGES = ["hls.js", "dompurify", "@iiif/parser", "maplibre-gl"];

const packageName = (id) =>
  id.startsWith("@") ? id.split("/").slice(0, 2).join("/") : id.split("/")[0];

async function emitted() {
  const result = await build({
    configFile: resolve(root, "vite.config.mjs"),
    logLevel: "silent",
    build: { write: false },
  });
  const output = [result].flat()[0].output;
  return new Map(
    output
      .filter((file) => file.type === "chunk")
      .map((chunk) => [chunk.fileName, chunk]),
  );
}

/** Every chunk reached from `start` by static imports (and dynamic ones when asked). */
function closure(chunks, start, dynamic = false) {
  const seen = new Set();
  const visit = (fileName) => {
    if (seen.has(fileName) || !chunks.has(fileName)) return;
    seen.add(fileName);
    const chunk = chunks.get(fileName);
    chunk.imports.forEach(visit);
    if (dynamic) chunk.dynamicImports.forEach(visit);
  };
  visit(start);
  return seen;
}

test("three entries, only package source, externals within dependencies and peers", async () => {
  const chunks = await emitted();
  const entries = [...chunks.values()].filter((chunk) => chunk.isEntry);
  assert.deepEqual(entries.map((chunk) => chunk.fileName).sort(), [
    "index.mjs",
    "map/index.mjs",
    "templates/index.mjs",
  ]);

  const allowed = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
  for (const chunk of chunks.values()) {
    for (const id of Object.keys(chunk.modules)) {
      assert.ok(
        id.startsWith(resolve(root, "src") + "/") || id.startsWith("\0"),
        `${chunk.fileName} bundles ${id}, which is not package source`,
      );
    }
    for (const id of [...chunk.imports, ...chunk.dynamicImports]) {
      if (chunks.has(id)) continue;
      assert.ok(
        allowed.has(packageName(id)),
        `${chunk.fileName} imports ${id}, which is not a dependency or peer`,
      );
      for (const pattern of FORBIDDEN) {
        assert.ok(!pattern.test(id), `${chunk.fileName} imports ${id}`);
      }
    }
  }
});

test("media, caption details, hotspots, the Canvas's menus, the navigator, languages, the sanitizer, hls.js and the upgrader load only on demand", async () => {
  const chunks = await emitted();
  const initial = closure(chunks, "index.mjs");
  const reachable = closure(chunks, "index.mjs", true);

  for (const suffix of LAZY_MODULES) {
    const chunk = [...chunks.values()].find((c) =>
      Object.keys(c.modules).some((id) => id.endsWith(suffix)),
    );
    assert.ok(chunk, `${suffix} must be emitted`);
    assert.ok(!initial.has(chunk.fileName), `${suffix} must stay deferred`);
    assert.ok(reachable.has(chunk.fileName), `${suffix} must be reachable`);
  }
  for (const fileName of initial) {
    for (const id of chunks.get(fileName).imports) {
      assert.ok(
        !LAZY_PACKAGES.includes(packageName(id)),
        `${fileName} imports ${id} statically`,
      );
    }
  }
});

test("MapLibre loads only on demand; the parts reach the map only lazily", async () => {
  const chunks = await emitted();
  for (const entry of ["index.mjs", "templates/index.mjs", "map/index.mjs"]) {
    const initial = closure(chunks, entry);
    for (const fileName of initial) {
      for (const id of chunks.get(fileName).imports) {
        assert.ok(
          packageName(id) !== "maplibre-gl",
          `${fileName} (from ${entry}) imports ${id} statically`,
        );
      }
      if (entry === "map/index.mjs") continue;
      // The Viewer's Map tab is a lazy chunk: nothing of the map loads up front.
      const modules = Object.keys(chunks.get(fileName).modules);
      assert.ok(
        !modules.some((id) => /\/components\/Map\/|\/core\/geo\.ts$/.test(id)),
        `${fileName} (from ${entry}) carries the map statically`,
      );
    }
  }
  const reachable = closure(chunks, "index.mjs", true);
  assert.ok(
    [...reachable].some((fileName) =>
      Object.keys(chunks.get(fileName).modules).some((id) =>
        id.endsWith("/components/Map/MapView.tsx"),
      ),
    ),
    "the Map tab must be reachable from the parts, lazily",
  );
});

const kB = (bytes, digits = 1) => (bytes / 1000).toFixed(digits);

test("what a consumer ships stays within budget", async (t) => {
  assert.ok(
    existsSync(resolve(dist, "index.mjs")),
    "dist/ is missing: run `npm run build -w @nulib/clover` first",
  );
  // Measured as `sizes.mjs` measures them for `sizes.json`, the homepage's figures.
  const { rows, pages } = await measure();

  for (const [name, key, size] of rows) {
    t.diagnostic(
      `${name.padEnd(18)} ${kB(size)} kB gzip (budget ${kB(budget[key])} kB)`,
    );
  }

  // What each `<Viewer template={X} />` page is made of, up front.
  const cell = (value, width) => String(value).padStart(width);
  t.diagnostic("");
  t.diagnostic("<Viewer template={X} />, up front, kB gzip:");
  t.diagnostic(
    `  ${"Template".padEnd(10)}${cell("Viewer", 8)}${cell("Parts", 9)}${cell("Own code", 10)}${cell("Total", 9)}`,
  );
  for (const [template, { shell, parts, template: own }, size] of pages) {
    t.diagnostic(
      `  ${template.padEnd(10)}${cell(kB(shell, 2), 8)}${cell(kB(parts, 2), 9)}${cell(kB(own, 2), 10)}${cell(kB(size, 2), 9)}`,
    );
  }
  t.diagnostic(
    "  Viewer: the shell. Parts: what the template uses from @nulib/clover, and their",
  );
  t.diagnostic(
    "  dependencies. Own code: the template itself. The total is exact; it is split by",
  );
  t.diagnostic(
    "  each group's share of the minified code. <Viewer /> with no template ships the",
  );
  t.diagnostic("  shell alone up front and loads Default when it first draws.");
  for (const [name, key, size] of rows) {
    const limit = budget[key];
    assert.ok(size <= limit, `${name} is ${size} B gzip, over ${limit} B`);
  }
});
