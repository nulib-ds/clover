import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { inlineMapLibreWorker } from "./build/maplibre-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

/** Packages the build may leave as imports: the declared dependencies and peers. */
const allowed = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);

/** `@scope/name/sub/path` → `@scope/name`; `name/sub` → `name`. */
const packageName = (id) =>
  id.startsWith("@") ? id.split("/").slice(0, 2).join("/") : id.split("/")[0];

/**
 * @nulib/clover — one ES module per source module, so `import * as Clover` tree-shakes in
 * the consumer's bundler. ES only: a CommonJS build beside it would let an app load two
 * copies and split the React context the composable parts share.
 */
export default defineConfig({
  root,
  publicDir: false,
  // MapLibre's worker, bundled, so a consumer's bundler need not find it.
  plugins: [inlineMapLibreWorker()],
  esbuild: { jsx: "automatic" },
  json: { stringify: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      // The parts, and the ready-made layouts built from them (one module graph).
      entry: {
        index: resolve(root, "src/index.ts"),
        "templates/index": resolve(root, "src/templates/index.ts"),
        // The map: navPlace and georeferences, MapLibre loaded on demand.
        "map/index": resolve(root, "src/map/index.ts"),
        // The Scene's three.js engine, opt-in: `three` a page installs to use it.
        "three/index": resolve(root, "src/three/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      /*
       * Every bare import must be a declared dependency or peer. Anything else — the 3.x
       * tree (`src/...`), OpenSeadragon, Radix — fails the build rather than being bundled
       * in silently.
       */
      external(id, importer) {
        if (id.startsWith("\0") || id.startsWith(".") || isAbsolute(id)) {
          return false;
        }
        if (allowed.has(packageName(id))) return true;
        throw new Error(
          `@nulib/clover: "${id}" (imported by ${importer}) is not a dependency of the package. Use a relative import, or declare it.`,
        );
      },
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].mjs",
        banner: '"use client";',
      },
    },
  },
});
