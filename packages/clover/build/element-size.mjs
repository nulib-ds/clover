/**
 * What a page loads for Clover's elements, measured from the built files: the entry, which
 * defines every element as a stub, and, once one connects, the host and each connected
 * element's code, every chunk each of those imports statically, gzipped: Clover's
 * stylesheet with them, each sheet in the chunk of the code that draws what it styles
 * (`clover-sheets.mjs`). Lazy chunks past those (MapLibre, hls.js, a panel's sections,
 * media and maps, each with its styles) are left out. The build's chunk map (`.vite/manifest.json`, `build.manifest` in
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
 * The modules an element's loader imports, as `src/web-components/define.ts` writes them,
 * for the elements drawn through a part's own module rather than one of their own
 * (`primitive("Summary")`, `pager("Next")`, `part(() => import(...), ...)`), so a page of
 * them is measured by what it loads. Read from the loaders, so it never drifts from them.
 */
const LOADED = (() => {
  const define = readFileSync(
    join(root, "src/web-components/define.ts"),
    "utf8",
  );
  const from = define.indexOf("const LOADERS");
  const block = define.slice(from, define.indexOf("\n};", from));
  const part = "src/web-components/elements/part.tsx";
  const keys = [...block.matchAll(/"(clover-[a-z-]+)":/g)];
  const loaded = {};
  keys.forEach((key, at) => {
    // An entry runs to the next one's key.
    const body = block.slice(key.index + key[0].length, keys[at + 1]?.index);
    const imported = body.match(/import\("\.\.\/(components\/[^"]+)"\)/);
    if (/^\s*primitive\(/.test(body))
      loaded[key[1]] = ["src/components/Primitives/Primitives.tsx", part];
    else if (/^\s*pager\(/.test(body))
      loaded[key[1]] = ["src/components/Items/Pager.tsx", part];
    else if (/^\s*splitPart\(/.test(body))
      loaded[key[1]] = ["src/web-components/elements/split.tsx"];
    else if (imported) loaded[key[1]] = [`src/${imported[1]}.tsx`, part];
  });
  return loaded;
})();

/** The chunks a page loads for an element: its loader's modules, else its own chunk. */
const keysOf = (map, tag) =>
  map[tag] ? [tag] : (LOADED[tag] ?? [elementKey(map, tag)]);

/**
 * The files a page loads, with the given elements on it: the entry and what it imports,
 * and once one connects, the host and each element's chunk, with theirs and their sheets.
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
    visit(sharedKey(map));
    // An element by its tag; or a module by its key (a template, a deferred run).
    tags.forEach((tag) => keysOf(map, tag).forEach(visit));
  }
  return files;
}

/** Where `@nulib/clover/web-components/viewer`, `<clover-viewer>` built whole, is. */
export const VIEWER_DIR = join(root, "dist/web-components/viewer");

/**
 * What a page with only a `<clover-viewer>` loads from `@nulib/clover/web-components/
 * viewer`: the entry and what it imports, and the host that loads as the viewer connects,
 * with what it imports, the sheets among them. Its lazy parts are left out, as
 * a page's are.
 */
export function viewerEntryFiles(dir = VIEWER_DIR) {
  const map = readMap(dir);
  const keys = new Set();
  const files = new Set();
  const visit = (key) => {
    const chunk = map[key];
    if (!chunk || keys.has(key)) return;
    keys.add(key);
    files.add(chunk.file);
    (chunk.imports ?? []).forEach(visit);
  };
  visit(Object.keys(map).find((key) => map[key].isEntry));
  for (let grew = true; grew; ) {
    grew = false;
    for (const key of [...keys])
      for (const later of map[key].dynamicImports ?? [])
        if (!keys.has(later) && later.endsWith("web-components/host.tsx")) {
          visit(later);
          grew = true;
        }
  }
  return files;
}

/** Those files, in bytes gzipped one by one. */
export const viewerEntryGzip = (dir = VIEWER_DIR) =>
  [...viewerEntryFiles(dir)].reduce(
    (sum, file) =>
      sum + gzipSync(readFileSync(join(dir, file)), { level: 9 }).length,
    0,
  );

/**
 * What an element adds to a page with a `<clover-root>`, in bytes gzipped: the page with
 * both, less the root's alone, up front, as `parts` measures React's (`build/sizes.mjs`).
 */
export const elementAdds = (tag, dir = ELEMENT_DIR) =>
  pageGzip(["clover-root", tag], dir) - pageGzip(["clover-root"], dir);

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
    ["clover-root", "clover-label", "clover-body", "clover-items"],
  ],
  // A layout as Default's, of elements: the stage and its toggle beside the panel.
  [
    "A layout of containers",
    "layoutPageGzip",
    [
      "clover-root",
      "clover-label",
      "clover-body",
      "clover-panel-toggle",
      "clover-items",
      "clover-split",
      "clover-split-pane",
      "clover-split-handle",
      "clover-panel",
    ],
  ],
  // A Canvas alone, as it loads what it is given (`LoadedCanvas`, on demand).
  [
    "A <clover-canvas> alone",
    "canvasElementGzip",
    ["clover-canvas", "src/components/Canvas/LoadedCanvas.tsx"],
  ],
  // A viewer in Document: its template, its styles with it.
  [
    "A <clover-viewer> in Document",
    "documentElementGzip",
    ["clover-viewer", "src/templates/document/Document.tsx"],
  ],
];
