/**
 * What a page loads for Clover's elements, measured from the built files: the entry, which
 * defines every element as a stub, and, once one connects, the host, the stylesheet and
 * each connected element's code, every chunk each of those imports statically, gzipped.
 * Lazy chunks past those (MapLibre, hls.js, a panel's sections, the media and map styles)
 * are left out. The build's chunk map (`.vite/manifest.json`, `build.manifest` in
 * `web-components.config.mjs`) says which chunk holds what.
 * `web-components.test.mjs` holds each page to its budget, and `sizes.mjs` records them
 * for the docs.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ELEMENT_DIR = join(root, "dist/web-components");

const ENTRY = "src/web-components/index.ts";
const STYLES = "virtual:clover-styles";

/**
 * The chunk every page with an element loads (`sharedChunk` in
 * `web-components.config.mjs`): Preact, the core, the host and `<clover-root>`.
 */
const sharedKey = (map) =>
  Object.keys(map).find((key) => map[key].name === "shared");

const readMap = (dir) =>
  JSON.parse(readFileSync(join(dir, ".vite/manifest.json"), "utf8"));

/**
 * The key of the chunk holding an element's code (`elements/<name>.tsx`): its own, or the
 * shared chunk, where `<clover-root>`'s is.
 */
function elementKey(map, tag) {
  const name = tag.replace(/^clover-/, "");
  const source = `src/web-components/elements/${name}.tsx`;
  if (map[source]) return source;
  const named = Object.entries(map).find(
    ([, chunk]) => chunk.isDynamicEntry && chunk.name === name,
  );
  return named ? named[0] : sharedKey(map);
}

/**
 * The files a page loads, with the given elements on it: the entry and what it imports,
 * and once one connects, the host, the stylesheet and each element's chunk, with theirs.
 */
export function pageFiles(tags = [], dir = ELEMENT_DIR) {
  const map = readMap(dir);
  const files = new Set();
  const visit = (key) => {
    const chunk = map[key];
    if (!chunk || files.has(chunk.file)) return;
    files.add(chunk.file);
    (chunk.imports ?? []).forEach(visit);
  };
  visit(ENTRY);
  if (tags.length) {
    // What the first element to connect loads, whichever it is.
    [sharedKey(map), STYLES].forEach(visit);
    tags.forEach((tag) => visit(elementKey(map, tag)));
  }
  return files;
}

/** Those files' source, read. */
export const pageSource = (tags, dir = ELEMENT_DIR) =>
  [...pageFiles(tags, dir)]
    .map((file) => readFileSync(join(dir, file), "utf8"))
    .join("\n");

/** Their size, in bytes gzipped. */
export const pageGzip = (tags, dir = ELEMENT_DIR) =>
  [...pageFiles(tags, dir)].reduce(
    (sum, file) =>
      sum + gzipSync(readFileSync(join(dir, file)), { level: 9 }).length,
    0,
  );

/** The pages `sizes.json` records, by budget key: `[name, key, tags]`. */
export const PAGES = [
  ["Web components entry", "elementsEntryGzip", []],
  ["A <clover-viewer>", "webComponentsGzip", ["clover-viewer"]],
  ["Labels alone", "labelPageGzip", ["clover-root", "clover-label"]],
  [
    "The four parts",
    "composedPageGzip",
    ["clover-root", "clover-label", "clover-content", "clover-items"],
  ],
];
