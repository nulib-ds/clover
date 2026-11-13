/*
 * The package's JavaScript entries, as the build emits them (`dist/<name>.mjs`) and
 * `package.json`'s `exports` names them: the parts and the Viewer (`index`), the
 * ready-made layouts built from them, the map, the Scene's three.js engine, the parts
 * that draw without a `Root` each on its own, the Viewer alone, and the helpers. One
 * module graph: an entry of its own re-exports the modules `index` does, so a page
 * importing both carries one copy. Each `src/<name>.ts` says what it is for.
 */
export const ENTRIES = {
  index: "src/index.ts",
  "templates/index": "src/templates/index.ts",
  // The map: navPlace and georeferences, MapLibre loaded on demand.
  "map/index": "src/map/index.ts",
  // The Scene's three.js engine, opt-in: `three` a page installs to use it.
  "three/index": "src/three/index.ts",
  // A part at a time, for a bundler that counts re-exports as reached (esbuild).
  "viewer/index": "src/viewer/index.ts",
  "canvas/index": "src/canvas/index.ts",
  "timeline/index": "src/timeline/index.ts",
  "scene/index": "src/scene/index.ts",
  "items/index": "src/items/index.ts",
  "primitives/index": "src/primitives/index.ts",
  // The functions that read IIIF, without React.
  "helpers/index": "src/helpers/index.ts",
};

/**
 * The entries that only re-export what `index` exports, by the same names: their
 * declarations re-export `index`'s (`build/entry-types.mjs`), so a type is one type
 * whichever entry a page imports it from. The others' are bundled on their own
 * (`dts-bundle-generator`), the helpers' among them, which name no React type.
 */
export const PART_ENTRIES = [
  "viewer/index",
  "canvas/index",
  "timeline/index",
  "scene/index",
  "items/index",
  "primitives/index",
];
