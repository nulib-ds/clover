import { transform } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { cloverSheets, sheetChunk } from "./clover-sheets.mjs";
import { preactAliases } from "./preact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One chunk for what every page with an element loads (the plan's "one shared chunk holds
 * Preact, the core and the host"): what the host and `<clover-root>` import, statically,
 * and nothing loaded on demand. Left to Rollup, it came in a score of small chunks, each
 * gzipped apart, which cost a `<clover-viewer>` page 7 kB. Never what the entry holds,
 * which is its own chunk (`index`), the stubs and what they import: Rollup puts in a
 * manual chunk the dependencies no other manual chunk claims, so the style registry,
 * which the host's sheet imports, came into `shared`, and the entry loaded it up front.
 */
function sharedChunk() {
  let shared = null;
  let entry = null;
  return (id, { getModuleInfo }) => {
    // Most of Clover's sheets ride together (`sheetChunk`, `clover-sheets.mjs`).
    const sheets = sheetChunk(id);
    if (sheets) return sheets;
    if (!shared) {
      const reach = (from) => {
        const found = new Set();
        const visit = (moduleId) => {
          if (found.has(moduleId)) return;
          const info = getModuleInfo(moduleId);
          if (!info) return;
          found.add(moduleId);
          info.importedIds.forEach(visit);
        };
        from.map((path) => resolve(root, path)).forEach(visit);
        return found;
      };
      entry = reach(["src/web-components/index.ts"]);
      shared = new Set(
        [
          ...reach([
            "src/web-components/host.tsx",
            "src/web-components/elements/root.tsx",
          ]),
        ].filter((moduleId) => !entry.has(moduleId)),
      );
    }
    if (shared.has(id)) return "shared";
    return entry.has(id) ? "index" : undefined;
  };
}

/**
 * Each chunk without its whitespace. Vite minifies an ES library's names and syntax but
 * leaves its whitespace, so a consumer's bundler can still read its annotations. The
 * element is loaded as it is, not bundled again, so it goes too.
 */
function minifyWhitespace() {
  return {
    name: "minify-whitespace",
    renderChunk: {
      order: "post",
      async handler(code) {
        const { code: minified } = await transform(code, {
          minifyWhitespace: true,
          logLevel: "warning",
        });
        return { code: minified, map: null };
      },
    },
  };
}

/**
 * `<clover-viewer>`, standalone: Preact stands in for React (about 4 kB instead of 45),
 * everything else bundled, lazy parts kept as chunks beside `index.mjs`. As 3.x builds
 * its web components. Run by `npm run build:web-components`, after the main build.
 */
export default defineConfig({
  root,
  publicDir: false,
  // Relative: emitted files (MapLibre's worker) resolve against the module's own URL, so
  // the element works from any path or CDN, not only from the site root.
  base: "./",
  resolve: { alias: preactAliases },
  plugins: [cloverSheets(), minifyWhitespace()],
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  json: { stringify: true },
  define: { "process.env.NODE_ENV": '"production"' },
  worker: { format: "es" },
  build: {
    outDir: "dist/web-components",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    // Which chunk holds each element's code, for measuring a page of some of them
    // (`build/element-size.mjs`).
    manifest: true,
    lib: {
      entry: resolve(root, "src/web-components/index.ts"),
      formats: ["es"],
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external: [],
      output: {
        chunkFileNames: "[name]-[hash].mjs",
        manualChunks: sharedChunk(),
      },
    },
  },
});
