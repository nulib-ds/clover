/*
 * What a consumer's app ships, built as a Vite app builds it for production (Rollup,
 * minified), with React left out. The size budgets and the Viewer's shell test both use
 * it.
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
          external: [/^react(-dom)?(\/.*)?$/],
          preserveEntrySignatures: "exports-only",
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
    const chunks = new Map(
      output
        .filter((item) => item.type === "chunk")
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
