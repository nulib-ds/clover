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

import { bundleAsConsumer } from "./consumer-bundle.mjs";
import { ENTRIES, PART_ENTRIES } from "./entries.mjs";
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
  "/components/Canvas/media/MediaBody.tsx",
  "/components/Body/CaptionDetails.tsx",
  "/core/sanitize.ts",
  "/core/svg-shape.ts",
  "/components/Canvas/FrameAnimation.tsx",
  // The Map's link to Allmaps and its mark, only for a map that offers it (`allmaps`).
  "/components/Map/AllmapsLink.tsx",
  "/components/Canvas/panClearOfControls.ts",
  // Hotspots and the Canvas's menus, for a Canvas with annotations or a Choice.
  "/components/Canvas/Annotations.tsx",
  "/components/Canvas/AnnotationState.tsx",
  "/components/Canvas/AnnotationMenu.tsx",
  "/components/Canvas/ChoiceMenu.tsx",
  // The image controls' tray, only where the row cannot hold the view's controls.
  "/components/Canvas/ImageControls.tsx",
  // Off by default.
  "/lib/renderer/overlays/Navigator.ts",
  // Annotations as the content, an AnnotationPage or AnnotationCollection.
  "/core/annotations-content.ts",
  // A Manifest's images' own annotations (Cookbook 0326), for one whose images carry some.
  "/core/image-layers.ts",
  // A picked annotation's place on its map (Cookbook 0139), MapLibre with it.
  "/components/Canvas/PlaceBox.tsx",
  // A standalone Canvas loading its own (`iiifContent`).
  "/components/Canvas/LoadedCanvas.tsx",
  // Presentation 4's Timeline and Scene, in a Root (and `Body`) or loading their own;
  // and the Scene's 3D drawing, three.js with it.
  "/components/Timeline/Connected.tsx",
  "/components/Scene/Connected.tsx",
  "/components/Scene/Loaded.tsx",
  // Clover's own glTF renderer, the Scene's other drawing.
  "/components/Scene/cloverEngine.ts",
  "/lib/gltf/renderer.ts",
  // The upgrader's fix for fragmented targets, loaded with the upgrader.
  "/core/keep-fragments.ts",
  // Presentation 2, read as 3, only for a resource in it.
  "/core/upgrade-2.ts",
  // About's "Part of", for a Canvas shown on its own.
  "/components/Panel/PartOfManifest.tsx",
  // The hotspots' layer, the DOM layer and Canvas2D, made when first needed.
  "/lib/renderer/overlays/OverlayLayer.ts",
  "/lib/renderer/backends/dom/DomLayers.ts",
  "/lib/renderer/backends/canvas2d/Canvas2DBackend.ts",
  // Items outside a Root, which no template has.
  "/components/Items/StandaloneItems.tsx",
  // A content state's several targets (Cookbook 0540), listed and counted.
  "/components/Items/TargetItems.tsx",
  // An AnnotationCollection's annotations (Cookbook 0309), listed and counted.
  "/components/Items/AnnotationItems.tsx",
  // Items' masonry layout, which spans each item over the rows its height needs.
  "/components/Items/masonry.ts",
  // A floating drawer's drag, loaded as one first floats.
  "/templates/shared/dragToClose.ts",
  // Every language but English, the first time Clover is to speak it.
  ...[
    "es",
    "fi",
    "fr",
    "it",
    "ja",
    "nb",
    "nn",
    "no",
    "pt",
    "zh-Hans",
    "zh-Hant",
  ].map((lng) => `/i18n/locales/${lng}.json`),
];
/** Packages imported only on demand: media streaming, sanitizing, upgrading old IIIF, maps, 3D. */
const LAZY_PACKAGES = [
  "hls.js",
  "dompurify",
  "@iiif/parser",
  "maplibre-gl",
  "three",
];

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

/** Every entry's file, as `build/entries.mjs` names them. */
const ENTRY_FILES = Object.keys(ENTRIES).map((name) => `${name}.mjs`);

/** React, as a module reaches it: the package, its client and its JSX runtime. */
const REACT = /^react(-dom)?(\/|$)/;

test("the entries, only package source, externals within dependencies and peers", async () => {
  const chunks = await emitted();
  const entries = [...chunks.values()].filter((chunk) => chunk.isEntry);
  assert.deepEqual(
    entries.map((chunk) => chunk.fileName).sort(),
    [...ENTRY_FILES].sort(),
  );
  for (const name of Object.keys(ENTRIES)) {
    const subpath =
      name === "index" ? "." : `./${name.replace(/\/index$/, "")}`;
    assert.equal(
      pkg.exports[subpath]?.import,
      `./dist/${name}.mjs`,
      `package.json's exports must name ${subpath}`,
    );
  }

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

test("media, caption details, hotspots, the Canvas's menus, the navigator, languages, the sanitizer, hls.js, the upgrader, the Timeline's and Scene's views and three.js load only on demand", async () => {
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

test("MapLibre loads only on demand; a page reaches the map only lazily, unless it draws one", async () => {
  const chunks = await emitted();
  for (const entry of ENTRY_FILES.filter(
    (file) => file !== "three/index.mjs",
  )) {
    for (const fileName of closure(chunks, entry)) {
      for (const id of chunks.get(fileName).imports) {
        assert.ok(
          packageName(id) !== "maplibre-gl",
          `${fileName} (from ${entry}) imports ${id} statically`,
        );
      }
    }
  }
  /*
   * `Map` is one of the parts (`<Clover.Map />`), so the package's own graph reaches it,
   * as an app's tree shaking does not: a page that draws no map ships none of it, the
   * Viewer's Map tab a lazy chunk.
   */
  const page = await bundleAsConsumer(
    [
      `export { default, Root, Body, Items, Panel } from ${JSON.stringify(resolve(root, "dist/index.mjs"))};`,
      `export { Default, Document } from ${JSON.stringify(resolve(root, "dist/templates/index.mjs"))};`,
    ].join("\n"),
  );
  for (const fileName of page.initial)
    assert.ok(
      !Object.keys(page.chunks.get(fileName).modules).some((id) =>
        /\/components\/Map\/|\/core\/geo\.mjs$/.test(id),
      ),
      `${fileName} carries the map up front, on a page that draws none`,
    );
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

/*
 * The Scene's three.js engine is opt-in (Mat, 2026-10-27): only `@nulib/clover/three`
 * reaches it, and three.js with it, on demand; the parts never do, up front or later.
 */
test("three.js only through the opt-in entry, and only on demand", async () => {
  const chunks = await emitted();
  const engine = [...chunks.values()].find((c) =>
    Object.keys(c.modules).some((id) =>
      id.endsWith("/components/Scene/engine.ts"),
    ),
  );
  assert.ok(engine, "the three.js engine must be emitted");
  for (const entry of ENTRY_FILES.filter((file) => file !== "three/index.mjs"))
    assert.ok(
      !closure(chunks, entry, true).has(engine.fileName),
      `${entry} reaches the three.js engine`,
    );
  assert.ok(!closure(chunks, "three/index.mjs").has(engine.fileName));
  assert.ok(closure(chunks, "three/index.mjs", true).has(engine.fileName));
});

/*
 * The helpers read IIIF without React (`src/helpers/index.ts`): no module they reach, up
 * front or on demand, imports it, and none says `"use client"`, so a React Server
 * Component can call them. Every module that does reach React says it.
 */
test("the helpers reach no React and are no client component; every module that reaches React is", async () => {
  const chunks = await emitted();
  const reachesReact = (fileName) =>
    [...closure(chunks, fileName, true)].some((each) =>
      [...chunks.get(each).imports, ...chunks.get(each).dynamicImports].some(
        (id) => REACT.test(id),
      ),
    );
  const client = (fileName) =>
    chunks.get(fileName).code.startsWith('"use client";');
  for (const fileName of closure(chunks, "helpers/index.mjs", true)) {
    assert.ok(!reachesReact(fileName), `${fileName} reaches React`);
    assert.ok(!client(fileName), `${fileName} says "use client"`);
  }
  for (const fileName of chunks.keys())
    if (reachesReact(fileName))
      assert.ok(client(fileName), `${fileName} reaches React unmarked`);
  assert.ok(client("index.mjs"));
});

/*
 * An entry a part at a time (`PART_ENTRIES`) reaches that part's modules, up front, and
 * no template; the Viewer's, the shell alone, its templates on demand.
 */
test("a part's own entry loads no template up front, and the Viewer's only its shell", async () => {
  const chunks = await emitted();
  for (const entry of PART_ENTRIES) {
    const upFront = closure(chunks, `${entry}.mjs`);
    for (const fileName of upFront)
      assert.ok(
        !fileName.startsWith("templates/"),
        `${entry} loads ${fileName} up front`,
      );
  }
  assert.deepEqual([...closure(chunks, "viewer/index.mjs")].sort(), [
    "components/Viewer/Viewer.mjs",
    "viewer/index.mjs",
  ]);
  assert.ok(
    closure(chunks, "viewer/index.mjs", true).has(
      "templates/default/Default.mjs",
    ),
  );
});

/*
 * A Timeline draws on a surface of its own (`playerSurface`), so a page that plays sound
 * never loads the image renderer, up front or later, alone or as a Root's view.
 */
test("a Timeline never loads the image renderer", async () => {
  const chunks = await emitted();
  for (const entry of [
    "components/Timeline/Timeline.mjs",
    "components/Timeline/Connected.mjs",
  ]) {
    assert.ok(chunks.has(entry), `${entry} must be emitted`);
    for (const fileName of closure(chunks, entry, true))
      assert.ok(
        !fileName.startsWith("lib/renderer/CanvasRenderer"),
        `${entry} reaches ${fileName}`,
      );
  }
});

/*
 * A Gallery draws thumbnails until one is opened, and Document's aside starts shut: the
 * lightbox's Body and Document's sections load on demand (`LightboxView`,
 * `SectionContent`), never with the template.
 */
test("a Gallery loads its lightbox's Body, and Document its sections, only on demand", async () => {
  const chunks = await emitted();
  for (const [entry, part] of [
    ["templates/gallery/Gallery.mjs", "components/Body/Body.mjs"],
    ["templates/document/Document.mjs", "templates/document/SectionContent.mjs"],
  ]) {
    assert.ok(chunks.has(entry), `${entry} must be emitted`);
    assert.ok(
      !closure(chunks, entry).has(part),
      `${entry} loads ${part} up front`,
    );
    assert.ok(
      closure(chunks, entry, true).has(part),
      `${entry} must reach ${part} on demand`,
    );
  }
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
