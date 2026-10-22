/**
 * What a page loads up front for `<clover-viewer>`: the built entry and every chunk it
 * imports statically, gzipped. Lazy chunks (MapLibre, hls.js, the media and map styles)
 * are left out. `web-components.test.mjs` holds it to its budget, and `sizes.mjs` records
 * it for the docs.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ELEMENT_DIR = join(root, "dist/web-components");

const read = (file) => readFileSync(join(ELEMENT_DIR, file), "utf8");
const staticImports = (source) =>
  [
    ...source.matchAll(
      /(?:^|[;}\s])import\s*(?:[^"'()]*?from\s*)?["']\.\/([^"']+)["']/g,
    ),
  ].map((match) => match[1]);

/** The entry and every chunk it imports statically: what loads before anything shows. */
export function upFront() {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file) || !existsSync(join(ELEMENT_DIR, file))) return;
    seen.add(file);
    staticImports(read(file)).forEach(visit);
  };
  visit("index.mjs");
  return seen;
}

/** Those files' source, read. */
export const upFrontSource = () => [...upFront()].map(read).join("\n");

/** Their size, in bytes gzipped. */
export const elementGzip = () =>
  [...upFront()].reduce(
    (sum, file) =>
      sum +
      gzipSync(readFileSync(join(ELEMENT_DIR, file)), { level: 9 }).length,
    0,
  );
