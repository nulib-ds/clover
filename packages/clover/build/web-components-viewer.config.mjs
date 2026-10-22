import { resolve } from "node:path";
import { defineConfig } from "vite";

import { cloverSheets, sheetChunk } from "./clover-sheets.mjs";
import elements from "./web-components.config.mjs";

/**
 * `@nulib/clover/web-components/viewer`: `<clover-viewer>` alone (`src/web-components/
 * viewer.ts`), built whole into `dist/web-components/viewer/`, with what the main
 * element build has (Preact for React, the stylesheet's sheets, the whitespace stripped)
 * but no chunks shared with other elements: a page with only a Viewer loads a few files,
 * gzipped together, rather than the dozens the elements share. Its lazy parts stay lazy.
 * Run after the main element build, which empties `dist/web-components`.
 */
/** A viewer's page needs every sheet: none loads apart (`cloverSheets`'s `whole`). */
const WHOLE = { whole: true };

export default defineConfig({
  ...elements,
  plugins: elements.plugins.map((plugin) =>
    plugin.name === "clover-sheets" ? cloverSheets(WHOLE) : plugin,
  ),
  build: {
    ...elements.build,
    outDir: "dist/web-components/viewer",
    emptyOutDir: true,
    lib: {
      entry: resolve(elements.root, "src/web-components/viewer.ts"),
      formats: ["es"],
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external: [],
      output: {
        chunkFileNames: "[name]-[hash].mjs",
        // Clover's stylesheet in a chunk of its own, which compresses as CSS does.
        manualChunks: (id) =>
          sheetChunk(id, WHOLE) === "styles" ? "styles" : undefined,
      },
    },
  },
});
