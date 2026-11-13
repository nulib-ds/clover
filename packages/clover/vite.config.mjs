import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { lazySheets } from "./build/clover-sheets.mjs";
import { ENTRIES } from "./build/entries.mjs";
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

/** React, as a module reaches it: the package, its client and its JSX runtime. */
const REACT = /^react(-dom)?(\/|$)/;

/**
 * `"use client"` atop every module that reaches React, statically or on demand, as React
 * Server Components read it: the parts are client components. A module that reaches none
 * (the helpers, and the IIIF reading under them) says nothing, so a server can call it.
 * Read from the module graph, once it is built, and written as each module's chunk is
 * (`preserveModules`: a chunk a module).
 */
function useClient() {
  const client = new Set();
  return {
    name: "clover-use-client",
    buildEnd() {
      const importers = new Map();
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id);
        for (const imported of [
          ...info.importedIds,
          ...info.dynamicallyImportedIds,
        ]) {
          if (!importers.has(imported)) importers.set(imported, []);
          importers.get(imported).push(id);
        }
      }
      const reached = [...importers.keys()].filter((id) => REACT.test(id));
      while (reached.length) {
        for (const by of importers.get(reached.pop()) ?? []) {
          if (client.has(by)) continue;
          client.add(by);
          reached.push(by);
        }
      }
    },
    renderChunk(code, chunk) {
      return chunk.moduleIds.some((id) => client.has(id))
        ? { code: `"use client";\n${code}`, map: null }
        : null;
    },
  };
}

/**
 * @nulib/clover — one ES module per source module, so `import * as Clover` tree-shakes in
 * the consumer's bundler. ES only: a CommonJS build beside it would let an app load two
 * copies and split the React context the composable parts share.
 */
export default defineConfig({
  root,
  publicDir: false,
  /*
   * MapLibre's worker, bundled, so a consumer's bundler need not find it; and the part
   * sheets styles.css leaves out, brought by the code that draws what they style.
   */
  plugins: [inlineMapLibreWorker(), lazySheets(), useClient()],
  esbuild: { jsx: "automatic" },
  json: { stringify: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: Object.fromEntries(
        Object.entries(ENTRIES).map(([name, path]) => [
          name,
          resolve(root, path),
        ]),
      ),
      formats: ["es"],
    },
    rollupOptions: {
      /*
       * Every bare import must be a declared dependency or peer. Anything else — the 3.x
       * tree (`src/...`), OpenSeadragon, Radix — fails the build rather than being bundled
       * in silently.
       */
      external(id, importer) {
        if (
          id.startsWith("\0") ||
          id.startsWith("virtual:clover-") ||
          id.startsWith(".") ||
          isAbsolute(id)
        ) {
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
      },
    },
  },
});
