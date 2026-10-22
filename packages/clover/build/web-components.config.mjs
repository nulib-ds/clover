import { build as esbuild, transform } from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { preactAliases } from "./preact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Stylesheets only some pages need, injected with what they style (`element.tsx`). */
const DEFERRED = {
  media: [
    "../components/Canvas/media/MediaStage.css",
    "../components/Canvas/media/Transport.css",
  ],
  map: ["../components/Map/Map.css"],
};

/**
 * The element's stylesheet, `virtual:clover-styles`, without what only media and maps
 * need: `virtual:clover-styles/media` and `/map`, which load with them. One list still
 * states the order, `src/styles/clover.css`, and the stylesheet comes in its runs, in
 * that order: `clover-1`, `media`, `clover-2`, `map`, `clover-3`. The element puts each
 * deferred run in its place among them, so its rules keep their place in the one
 * `clover` layer, and the cascade is the list's. (Not sublayers: a later sublayer would
 * beat an earlier one's more specific rule.)
 */
function cloverStyles() {
  const styles = resolve(root, "src/styles");
  const sheets = [
    ...readFileSync(resolve(styles, "clover.css"), "utf8").matchAll(
      /^@import\s+"([^"]+)";/gm,
    ),
  ].map((match) => match[1]);
  const deferredOf = (sheet) =>
    Object.keys(DEFERRED).find((name) => DEFERRED[name].includes(sheet));
  // Consecutive sheets of one kind make one run.
  const runs = [];
  for (const sheet of sheets) {
    const kind = deferredOf(sheet) ?? "clover";
    const last = runs.at(-1);
    if (last?.kind === kind) last.sheets.push(sheet);
    else runs.push({ kind, sheets: [sheet] });
  }
  let shown = 0;
  for (const run of runs) {
    run.key = run.kind === "clover" ? `clover-${++shown}` : run.kind;
  }
  for (const name of Object.keys(DEFERRED)) {
    const found = runs.filter((run) => run.kind === name);
    const listed = found.flatMap((run) => run.sheets);
    if (found.length !== 1 || listed.length !== DEFERRED[name].length) {
      throw new Error(
        `web components: ${name}'s stylesheets must be listed together in clover.css`,
      );
    }
  }
  const css = async (run) => {
    const { outputFiles } = await esbuild({
      stdin: {
        contents: run.sheets.map((sheet) => `@import "${sheet}";`).join("\n"),
        resolveDir: styles,
        loader: "css",
      },
      bundle: true,
      minify: true,
      write: false,
      logLevel: "warning",
      // As `build/styles.mjs`: the cascade-layer baseline.
      target: ["chrome99", "edge99", "firefox97", "safari15.4"],
    });
    return `@layer clover{${outputFiles[0].text.trim()}}`;
  };
  const ID = "virtual:clover-styles";
  return {
    name: "clover-styles",
    resolveId: (id) =>
      id === ID || id.startsWith(`${ID}/`) ? `\0${id}` : null,
    async load(id) {
      if (!id.startsWith(`\0${ID}`)) return null;
      const name = id.slice(ID.length + 2);
      if (name) {
        const run = runs.find((each) => each.kind === name);
        return `export default ${JSON.stringify(await css(run))};`;
      }
      const parts = await Promise.all(
        runs.map(async (run) =>
          run.kind === "clover"
            ? { key: run.key, css: await css(run) }
            : { key: run.key },
        ),
      );
      return `export default ${JSON.stringify(parts)};`;
    },
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
  plugins: [cloverStyles(), minifyWhitespace()],
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  json: { stringify: true },
  define: { "process.env.NODE_ENV": '"production"' },
  worker: { format: "es" },
  build: {
    outDir: "dist/web-components",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    lib: {
      entry: resolve(root, "src/web-components/index.ts"),
      formats: ["es"],
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external: [],
      output: { chunkFileNames: "[name]-[hash].mjs" },
    },
  },
});
