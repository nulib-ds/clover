import { BROWSERS } from "./browsers.mjs";
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
    /*
     * Markdown as plain text beside the rest of IIIF's text, as it was in one module: apart
     * from it for React's first view (`core/markdown-text.ts`), which the property elements
     * have with `clover-value`, it was a chunk of its own on their every page.
     */
    if (/\/src\/core\/(markdown-)?text\.ts$/.test(id)) return "text";
    /*
     * Clover's glyphs, a module each (`src/ui/glyphs/`) and the caret's svg
     * (`ui/Caret.tsx`), in one small chunk: alone, each was a chunk of its own, about
     * 0.2 kB gzip of boilerplate apiece, five or six on a page with a few parts. Not the
     * speaker or the external link, which only parts that load later show (a recording,
     * Annotations' links): in the chunk, every first view carried them,
     * `<clover-canvas>` alone some 0.2 kB.
     */
    if (/\/src\/ui\/(glyphs\/(?!Speaker|External)[^/]+|Caret)\.tsx$/.test(id))
      return "glyphs";
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
    // As the package's: the browsers the stylesheet needs (`browsers.mjs`).
    target: BROWSERS,
    minify: "esbuild",
    // Which chunk holds each element's code, for measuring a page of some of them
    // (`build/element-size.mjs`).
    manifest: true,
    lib: {
      // The elements, and the Scene's three.js engine, opt-in, which a page loads beside.
      entry: {
        index: resolve(root, "src/web-components/index.ts"),
        three: resolve(root, "src/web-components/three.ts"),
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.mjs`,
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
