import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "package.json"));

/** The placeholder the package's build fills (`src/components/Map/maplibre-worker.ts`). */
const PLACEHOLDER = resolve(root, "src/components/Map/maplibre-worker.ts");

/**
 * MapLibre's worker as one script, with the shared module it imports by relative path
 * bundled in, so it runs from a blob URL. An app's bundler moves MapLibre's files and
 * breaks that relative import (the basemap draws, every GeoJSON layer silently vanishes),
 * so Clover ships the worker as source text instead. Shared with the docs
 * (`scripts/build-maplibre-worker.mjs`).
 */
export async function bundleMapLibreWorker() {
  const entry = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
  const { version } = JSON.parse(
    readFileSync(require.resolve("maplibre-gl/package.json"), "utf8"),
  );
  const result = await build({
    logLevel: "error",
    configFile: false,
    mode: "production",
    build: {
      write: false,
      target: "es2020",
      lib: { entry, formats: ["es"], fileName: () => "maplibre-worker.js" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const chunk = [result].flat()[0].output.find((o) => o.type === "chunk");
  if (!chunk) throw new Error("No chunk produced for MapLibre's worker");
  const { code } = await transform(chunk.code, {
    minify: true,
    target: "es2020",
    legalComments: "none",
  });
  return { code, version };
}

/**
 * Fills the placeholder with the bundled worker and the MapLibre version it came from, in
 * the package's build only: in source (the docs, the tests) the placeholder stays empty.
 */
export function inlineMapLibreWorker() {
  let bundled;
  return {
    name: "clover:maplibre-worker",
    async load(id) {
      if (id !== PLACEHOLDER) return null;
      bundled ??= bundleMapLibreWorker();
      const { code, version } = await bundled;
      return (
        `export const source = ${JSON.stringify(code)};\n` +
        `export const version = ${JSON.stringify(version)};\n`
      );
    },
  };
}
