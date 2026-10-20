/*
 * What a consumer ships from @nulib/clover, measured: the built `dist/` bundled as a Vite
 * app builds it for production (`consumer-bundle.mjs`), gzipped, keyed as
 * `size-budget.json` is. `bundle.test.mjs` holds each size to its budget. The package's
 * build records them in `sizes.json` (`npm run build:sizes`), which the docs' homepage
 * shows, so its figures are measured, never claimed: a build changes them only when what
 * a consumer ships changes.
 *
 *     npm run build -w @nulib/clover   # builds dist/, then records sizes.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { transformSync } from "esbuild";

import { bundleAsConsumer, gzipSize } from "./consumer-bundle.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

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
      minified[group] += transformSync(module.code, {
        minify: true,
      }).code.length;
    }
  }
  const all = minified.shell + minified.parts + minified.template;
  const shell = Math.round((size * minified.shell) / all);
  const parts = Math.round((size * minified.parts) / all);
  return { shell, parts, template: size - shell - parts };
}

const gzip = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

/** What is measured: `[name, budget key, exports, entry, options]`. */
const BUNDLES = [
  ["Canvas initial JS", "canvasInitialGzip", "Canvas"],
  // `import Viewer from "@nulib/clover"`: a shell. `<Viewer />` loads Default later.
  ["Viewer shell", "viewerShellGzip", "default"],
  // `<Viewer template={X} />`: the shell, the template, and the parts it uses.
  ...[
    ["Default", "defaultTemplateGzip"],
    ["Document", "documentTemplateGzip"],
    ["Gallery", "galleryTemplateGzip"],
  ].map(([template, key]) => [
    `Viewer, ${template}`,
    key,
    "default",
    "index.mjs",
    { also: [template, "templates/index.mjs"], template },
  ]),
  ["Map, before MapLibre", "mapInitialGzip", "Map", "map/index.mjs"],
  // What a Viewer loads when its Map tab is first shown: MapLibre.
  [
    "MapLibre, on a map",
    "mapOnDemandGzip",
    "default",
    "index.mjs",
    { onDemand: /maplibre-gl/, also: ["Default", "templates/index.mjs"] },
  ],
];

const STYLES = [
  ["styles.css", "stylesGzip", "styles.css"],
  ["templates.css", "templatesStylesGzip", "templates.css"],
];

/**
 * Every size, in bytes gzipped: `sizes` by budget key, `rows` as `[name, key, size]` for
 * a table, and `pages`, each template's page split into the Viewer, its parts and its
 * own code.
 */
export async function measure() {
  const sizes = {};
  const rows = [];
  const pages = [];
  for (const [name, key, exports, entry, options] of BUNDLES) {
    const { size, bundle } = await initialGzip(exports, entry, options);
    sizes[key] = size;
    rows.push([name, key, size]);
    if (options?.template) {
      pages.push([options.template, split(bundle, size), size]);
    }
  }
  for (const [name, key, file] of STYLES) {
    const size = gzip(resolve(dist, file));
    sizes[key] = size;
    rows.push([name, key, size]);
  }
  return { sizes, rows, pages };
}

/** Where the build records them, for the docs. */
export const SIZES_FILE = resolve(root, "build/sizes.json");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { sizes, rows } = await measure();
  writeFileSync(SIZES_FILE, `${JSON.stringify(sizes, null, 2)}\n`);
  for (const [name, , size] of rows) {
    console.log(`${name.padEnd(22)} ${(size / 1000).toFixed(1)} kB gzip`);
  }
}
