/*
 * What a consumer's app ships, built as a Vite app builds it for production (Rollup,
 * minified), with React left out of the count. The size budgets and the Viewer's shell
 * test both use it.
 *
 * React is bundled, in a chunk of its own, as an app bundles it, and that chunk is left
 * out of what this returns: never counted, but there, so Clover's own chunks reach it as
 * a real app's do. Left external, as it was until 2026-11-01, they read it by name and
 * measured a few hundred bytes lighter than a browser fetches them (the Default template
 * 73,183 B, in an app 73,605 B; `build/first-view.mjs` found it).
 *
 * Vite rather than esbuild: through the package entry, esbuild's code splitting counts a
 * module as reachable from the page by its re-export alone, even once tree shaking has
 * dropped it. So a lazy chunk (the Viewer's `Default`) sharing modules with the entry
 * drags them up front, and every import from `@nulib/clover` would measure as the whole
 * Default template. Rollup, and webpack, split by what is used.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";

/** React, as an app bundles it: in a chunk of its own (`first-view.mjs` builds so too). */
const REACT = /node_modules\/(react|react-dom|scheduler)\//;

/**
 * Bundle `contents` as an app's entry. Resolves to the emitted chunks by file name, and
 * the set of those that load up front: the entry and what it imports statically.
 */
export async function bundleAsConsumer(contents) {
  const out = mkdtempSync(join(tmpdir(), "clover-consumer-"));
  try {
    const input = join(out, "entry.mjs");
    writeFileSync(input, contents);
    const result = await build({
      configFile: false,
      logLevel: "silent",
      root: out,
      build: {
        write: false,
        minify: "esbuild",
        modulePreload: { polyfill: false },
        rollupOptions: {
          input,
          preserveEntrySignatures: "exports-only",
          output: {
            manualChunks: (id) => (REACT.test(id) ? "react" : undefined),
          },
          // `"use client"` is dropped in a bundle, and Rollup says so per module. An
          // import it cannot find would be left out of the count: fail instead.
          onwarn: (warning) => {
            if (warning.code === "UNRESOLVED_IMPORT")
              throw new Error(warning.message);
          },
        },
      },
    });
    const output = (Array.isArray(result) ? result[0] : result).output;
    // React's chunk left out, so nothing reaches it to count it.
    const chunks = new Map(
      output
        .filter((item) => item.type === "chunk" && item.name !== "react")
        .map((chunk) => [chunk.fileName, chunk]),
    );
    const initial = new Set();
    const visit = (fileName) => {
      if (initial.has(fileName) || !chunks.has(fileName)) return;
      initial.add(fileName);
      chunks.get(fileName).imports.forEach(visit);
    };
    visit([...chunks.values()].find((chunk) => chunk.isEntry).fileName);
    return { chunks, initial };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

export const gzipSize = (code) => gzipSync(code, { level: 9 }).length;
