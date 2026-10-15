/*
 * What @nulib/clover's build emits, and what a consumer ships from it.
 *
 * The graph checks build in memory. The size table bundles the built `dist/` as a Vite
 * app builds it for production (`consumer-bundle.mjs`), so run
 * `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { transformSync } from "esbuild";
import { build } from "vite";

import { bundleAsConsumer, gzipSize } from "./consumer-bundle.mjs";

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
];
/** Packages imported only on demand: media streaming, sanitising, upgrading old IIIF. */
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

test("media, caption details, the sanitiser, hls.js and the upgrader load only on demand", async () => {
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

/**
 * What a consumer's app ships up front for some named exports, built as Vite builds it
 * (`consumer-bundle.mjs`): the entry and every chunk it imports statically, gzipped. Lazy
 * chunks are left out. `also` adds exports of another entry, `[exports, entry]`, for what
 * a page imports together. `onDemand` measures instead what loads later, from the lazy
 * chunks it matches (MapLibre's), not everything lazy (the upgrader loads with any
 * content).
 */
async function initialGzip(
  exports,
  entry = "index.mjs",
  { onDemand = null, also = null } = {},
) {
  const line = (names, file) =>
    `export { ${names} } from ${JSON.stringify(resolve(dist, file))};`;
  const bundle = await bundleAsConsumer(
    [line(exports, entry), also && line(...also)].filter(Boolean).join("\n"),
  );
  const { chunks, initial } = bundle;
  const sum = (fileNames) =>
    [...fileNames].reduce(
      (total, fileName) => total + gzipSize(chunks.get(fileName).code),
      0,
    );
  if (!onDemand) return { size: sum(initial), bundle };
  const later = new Set();
  const reach = (fileName) => {
    if (later.has(fileName) || !chunks.has(fileName)) return;
    later.add(fileName);
    const chunk = chunks.get(fileName);
    [...chunk.imports, ...chunk.dynamicImports].forEach(reach);
  };
  for (const chunk of chunks.values()) {
    if (chunk.isDynamicEntry && onDemand.test(chunk.facadeModuleId ?? "")) {
      reach(chunk.fileName);
    }
  }
  return {
    size: sum([...later].filter((fileName) => !initial.has(fileName))),
    bundle,
  };
}

/**
 * A page's up-front size split three ways: the Viewer shell, the parts its template uses
 * (with their dependencies), and the template's own code. Gzip does not add up module by
 * module, so the exact total is divided by each group's share of the minified code.
 */
function split({ chunks, initial }, size) {
  const minified = { shell: 0, parts: 0, template: 0 };
  for (const fileName of initial) {
    for (const [id, module] of Object.entries(chunks.get(fileName).modules)) {
      if (!module.code) continue;
      const group = id.endsWith("/dist/components/Viewer/Viewer.mjs")
        ? "shell"
        : id.includes("/dist/templates/")
          ? "template"
          : "parts";
      minified[group] += transformSync(module.code, { minify: true }).code.length;
    }
  }
  const all = minified.shell + minified.parts + minified.template;
  const shell = Math.round((size * minified.shell) / all);
  const parts = Math.round((size * minified.parts) / all);
  return { shell, parts, template: size - shell - parts };
}

const kB = (bytes, digits = 1) => (bytes / 1000).toFixed(digits);

const gzip = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

test("what a consumer ships stays within budget", async (t) => {
  assert.ok(
    existsSync(resolve(dist, "index.mjs")),
    "dist/ is missing: run `npm run build -w @nulib/clover` first",
  );
  const rows = [];
  const pages = [];
  for (const [name, exports, limit, entry, options] of [
    ["Canvas initial JS", "Canvas", budget.canvasInitialGzip],
    // `import Viewer from "@nulib/clover"`: a shell. `<Viewer />` loads Default later.
    ["Viewer shell", "default", budget.viewerShellGzip],
    // `<Viewer template={X} />`: the shell, the template, and the parts it uses.
    ...[
      ["Default", budget.defaultTemplateGzip],
      ["Document", budget.documentTemplateGzip],
      ["Gallery", budget.galleryTemplateGzip],
    ].map(([template, limit]) => [
      `Viewer, ${template}`,
      "default",
      limit,
      "index.mjs",
      { also: [template, "templates/index.mjs"], template },
    ]),
    ["Map, before MapLibre", "Map", budget.mapInitialGzip, "map/index.mjs"],
    // What a Viewer loads when its Map tab is first shown: MapLibre.
    [
      "MapLibre, on a map",
      "default",
      budget.mapOnDemandGzip,
      "index.mjs",
      { onDemand: /maplibre-gl/, also: ["Default", "templates/index.mjs"] },
    ],
  ]) {
    const { size, bundle } = await initialGzip(exports, entry, options);
    rows.push([name, size, limit]);
    if (options?.template) {
      pages.push([options.template, split(bundle, size), size]);
    }
  }
  rows.push([
    "styles.css",
    gzip(resolve(dist, "styles.css")),
    budget.stylesGzip,
  ]);
  rows.push([
    "templates.css",
    gzip(resolve(dist, "templates.css")),
    budget.templatesStylesGzip,
  ]);

  for (const [name, size, limit] of rows) {
    t.diagnostic(
      `${name.padEnd(18)} ${kB(size)} kB gzip (budget ${kB(limit)} kB)`,
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
  t.diagnostic(
    "  shell alone up front and loads Default when it first draws.",
  );
  for (const [name, size, limit] of rows) {
    assert.ok(size <= limit, `${name} is ${size} B gzip, over ${limit} B`);
  }
});
