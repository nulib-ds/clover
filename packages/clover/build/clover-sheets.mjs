import { build as esbuild } from "esbuild";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "src");

/** A sheet's module, by its key, and the registry it registers with. */
const ID = "virtual:clover-sheet/";
const REGISTRY = resolve(src, "web-components/styles.ts");

/**
 * The modules that draw what each stylesheet styles, beside which the sheet loads. A sheet
 * not listed is its own module's alone: `Items.css` loads with `Items.tsx`. A sheet listed
 * loads with every module named, its own only where named. A family's sheet styles what its
 * members draw (`ui/Button.css`: the pager's, Search's and the panel's buttons), and some
 * sheets style what another module draws: `scale.css` every element's, the Canvas's
 * overlays the renderer's. A module that only queries a class (`closest(".clover-tip")`)
 * draws nothing, and is no owner. A rule that needs an ancestor's class too
 * (`.clover-template-default .clover-items`) needs only one owner, the rarer:
 * `Default.css` loads with Default, never with every Items.
 *
 * Checked on the elements' page by what each element's nodes compute, alone and with the
 * whole stylesheet (`AGENTS.md`, "Styles"): a module missing here shows as a difference.
 */
const OWNERS = {
  // Every element's: the scale's custom properties, and its controls' font.
  "styles/scale": ["web-components/host.tsx"],
  // Every element's too: the higher-contrast mode's values, which its parts' rules read.
  "styles/contrast": ["web-components/host.tsx"],
  // The Body's box while its code loads, then the Canvas, a Timeline's or a Scene's.
  "components/Canvas/Canvas": [
    "components/Canvas/CanvasView.tsx",
    "components/Body/Pending.tsx",
    "components/Scene/SceneView.tsx",
  ],
  // A Scene's own, with its view (`Body` loads the view, never the part's module).
  "components/Scene/Scene": ["components/Scene/SceneView.tsx"],
  // The hotspots and their layer, which the first hotspot makes (`overlaysOf`).
  "components/Canvas/Annotations": [
    "components/Canvas/Annotations.tsx",
    "lib/renderer/overlays/OverlayLayer.ts",
  ],
  "components/Canvas/ControlMenu": [
    "components/Canvas/ControlMenu.tsx",
    "components/Canvas/ChoiceMenu.tsx",
  ],
  // A recording's Body and transport, and an animation's.
  "components/Canvas/media/MediaBody": [
    "components/Canvas/media/MediaBody.tsx",
    "components/Canvas/FrameAnimation.tsx",
  ],
  "components/Canvas/media/Transport": [
    "components/Canvas/media/Transport.tsx",
    "components/Canvas/FrameAnimation.tsx",
  ],
  // A page's renderer draws the cluster's box for the page's own buttons.
  "ui/ControlCluster": [
    "ui/ControlCluster.tsx",
    "web-components/elements/renderers.tsx",
  ],
  "ui/Button": [
    "ui/Button.tsx",
    "components/Items/Items.tsx",
    "components/Items/Pager.tsx",
    "components/Search/Search.tsx",
    "components/Panel/Panel.tsx",
    "ui/Sections.tsx",
    "components/Canvas/media/Transport.tsx",
    "components/Canvas/FrameAnimation.tsx",
  ],
  // The scrolling edge's shadow, which the sections, Search, a Transcript, Items' slider
  // and the pager cast.
  "ui/Shade": [
    "ui/Sections.tsx",
    "components/Search/Search.tsx",
    "components/Transcript/Transcript.tsx",
    "components/Items/Items.tsx",
    "components/Items/Pager.tsx",
  ],
  "ui/ReadMore": ["ui/ReadMore.tsx", "web-components/elements/read-more.tsx"],
  // A row of language codes: a Transcript's files, an annotation set's languages.
  "ui/Codes": [
    "components/Transcript/Transcript.tsx",
    "components/Annotations/Annotations.tsx",
  ],
  // Its links' rule reaches About's, a caption's and an annotation's text.
  "components/Primitives/Primitives": [
    "components/Primitives/Primitives.tsx",
    "components/Panel/About.tsx",
    "components/Collection/Collection.tsx",
    "components/Body/Caption.tsx",
    "components/Annotations/Annotations.tsx",
    "components/Canvas/AnnotationMenu.tsx",
  ],
  // A Body's alert, where it could not load what it was to draw.
  "components/Status/Status": [
    "components/Status/Status.tsx",
    "components/Body/BodyAlert.tsx",
  ],
  // The pager is Items' (`clover-items clover-pager`).
  "components/Items/Items": [
    "components/Items/Items.tsx",
    "components/Items/Pager.tsx",
  ],
  // The pager's, and `Position`'s, which counts views where no pager draws.
  "components/Items/Pager": [
    "components/Items/Pager.tsx",
    "components/Items/Position.tsx",
  ],
  // The Collection's list, which Items' targets and count menu draw too.
  "components/Collection/Collection": [
    "components/Collection/Collection.tsx",
    "components/Items/TargetItems.tsx",
    "components/Items/CountMenu.tsx",
  ],
  // The panel's own, and the lists of its sections and About's, anywhere.
  "components/Panel/Panel": [
    "components/Panel/Panel.tsx",
    "components/Panel/About.tsx",
    "components/Panel/PartOfManifest.tsx",
    "components/Collection/Collection.tsx",
    "components/Annotations/Annotations.tsx",
    "components/Canvas/AnnotationMenu.tsx",
    "components/Contents/Contents.tsx",
    "components/Transcript/Transcript.tsx",
    "components/Search/Search.tsx",
    "components/Map/MapView.tsx",
  ],
  // The Split's elements are its boxes (`native`), drawn without `Split`.
  "components/Split/Split": [
    "components/Split/Split.tsx",
    "web-components/elements/split.tsx",
  ],
  "components/Annotations/Annotations": [
    "components/Annotations/Annotations.tsx",
    "components/Canvas/AnnotationMenu.tsx",
  ],
  // What draws `.clover-geomap`, MapLibre with it: not the map's shell.
  "components/Map/Map": ["components/Map/MapView.tsx"],
  maplibre: ["components/Map/MapView.tsx"],
};

/** The stylesheets a list imports, in its order. */
const listed = (list) =>
  [...readFileSync(list, "utf8").matchAll(/^@import\s+"([^"]+)";/gm)].map(
    (match) => resolve(dirname(list), match[1]),
  );

/**
 * Every stylesheet of the elements, in the cascade's order: MapLibre's first (unlayered, as
 * it ships), then `src/styles/clover.css`'s list, then the other templates'
 * (`src/templates/templates.css`), as an app loads `templates.css` after `styles.css`.
 * Each sheet's place in it is its index, by which the page's registry orders it.
 */
const STYLES = listed(resolve(src, "styles/clover.css"));
export const SHEETS = [
  createRequire(import.meta.url).resolve("maplibre-gl/dist/maplibre-gl.css"),
  ...STYLES,
  ...listed(resolve(src, "templates/templates.css")),
].map((file, index) => ({
  file,
  index,
  key: index === 0 ? "maplibre" : relative(src, file).replace(/\.css$/, ""),
  layered: index !== 0,
  // In `dist/styles.css`, and so in a part sheet (`partSheets`).
  inStyles: STYLES.includes(file),
}));

/**
 * Where each sheet rides. The light parts' sheets each in their own code's chunk, so a
 * page of labels, or of a record's properties, loads only theirs. The sheets of media,
 * maps and the other templates in their lazy code's, so they load as those draw. Every
 * other sheet in one chunk, `styles`, which loads with the first part to draw any of
 * them, in a few runs, each the sheets between those apart: thirty small sheets gzip to
 * 19.1 kB apart and to 10.1 kB as one, so a sheet apart in each owner's chunk cost a
 * viewer's page 4 kB, and a `<style>` of each in one chunk still 1 kB more.
 */
const APART = new Set([
  "styles/scale",
  /*
   * Every element's, as the scale is (the higher-contrast mode's values, `OWNERS`):
   * grouped, it brought every run to every page, a page of labels 14 kB (2026-10-30).
   */
  "styles/contrast",
  "components/Label/Label",
  "components/Primitives/Primitives",
  "ui/ReadMore",
  "components/Status/Status",
]);
const LAZY = new Set([
  "maplibre",
  "components/Canvas/media/MediaBody",
  "components/Canvas/media/Transport",
  "components/Canvas/media/Player",
  "components/Map/Map",
  "components/Scene/Scene",
]);

/**
 * Whether a sheet rides with the others, in the `styles` chunk. `whole`: a build for a
 * page that needs all of them (`web-components/viewer`), whose light parts' sheets ride
 * with the rest, as nothing is gained by their loading apart.
 */
const grouped = (sheet, { whole = false } = {}) =>
  (whole || !APART.has(sheet.key)) &&
  !LAZY.has(sheet.key) &&
  !(
    sheet.key.startsWith("templates/") &&
    sheet.key !== "templates/default/Default"
  );

/** The grouped sheets in runs, each the ones between two that are not, in order. */
const runsOf = (options) =>
  SHEETS.reduce((runs, sheet, at) => {
    if (!grouped(sheet, options)) return runs;
    const last = runs.at(-1);
    if (last && grouped(SHEETS[at - 1], options)) last.sheets.push(sheet);
    else
      runs.push({
        key: `styles-${runs.length + 1}`,
        index: sheet.index,
        sheets: [sheet],
      });
    return runs;
  }, []);

/** The module that registers the runs. */
const GROUP = "virtual:clover-sheets";

/**
 * The chunk a module goes in: `styles` for the runs and the sheets that ride in them, and
 * `shared`, which every page with an element loads, for the light parts' (about 1 kB
 * gzipped in all), which in their owners' chunks made small chunks of their own.
 */
export function sheetChunk(id, options = {}) {
  if (id === `\0${GROUP}`) return "styles";
  if (!id.startsWith(`\0${ID}`)) return undefined;
  const sheet = SHEETS.find((each) => each.key === id.slice(ID.length + 1));
  if (grouped(sheet, options)) return "styles";
  return APART.has(sheet.key) ? "shared" : undefined;
}

/** Each sheet's owners, as files: those `OWNERS` names, else its own module. */
export function ownersOf(sheet) {
  if (OWNERS[sheet.key])
    return OWNERS[sheet.key].map((path) => resolve(src, path));
  const own = [".tsx", ".ts"]
    .map((extension) => resolve(src, `${sheet.key}${extension}`))
    .find((file) => existsSync(file));
  return own ? [own] : [];
}

/**
 * Sheets' rules, minified as one, as `build/styles.mjs` minifies the whole stylesheet: a
 * run's sheets together, which merges what they repeat.
 */
export async function rulesOf(...sheets) {
  const { outputFiles } = await esbuild({
    stdin: {
      contents: sheets
        .map(({ file }) => `@import ${JSON.stringify(file)};`)
        .join("\n"),
      resolveDir: src,
      loader: "css",
    },
    bundle: true,
    minify: true,
    write: false,
    logLevel: "warning",
    // As `build/styles.mjs`: the cascade-layer baseline.
    target: ["chrome99", "edge99", "firefox97", "safari15.4"],
  });
  return outputFiles[0].text.trim();
}

/**
 * The elements' stylesheet, a sheet at a time (`OWNERS`): each a module, imported by the
 * modules that draw what it styles, so it rides in their chunk and is in the page as soon
 * as they are, before anything they draw. It registers itself with the page's registry
 * (`addSheet`, `src/web-components/styles.ts`), which puts it in its place in the cascade,
 * or, if it rides with the others, brings their runs. Package code still imports no CSS:
 * only the elements' build, and their tests, add the imports. `rules: false`, for the
 * tests: each sheet's key and place with no CSS, which jsdom's selector engine cannot read.
 */
export function cloverSheets(options = {}) {
  const RUNS = runsOf(options);
  const rules = (...sheets) =>
    options.rules === false ? Promise.resolve("") : rulesOf(...sheets);
  const byKey = new Map(SHEETS.map((sheet) => [sheet.key, sheet]));
  const owned = new Map();
  for (const sheet of SHEETS) {
    const owners = ownersOf(sheet);
    if (!owners.length)
      throw new Error(
        `web components: ${sheet.key}.css has no module beside it; name its owners in OWNERS (build/clover-sheets.mjs)`,
      );
    for (const owner of owners) {
      if (!existsSync(owner))
        throw new Error(
          `web components: ${sheet.key}.css's owner ${relative(src, owner)} does not exist`,
        );
      owned.set(owner, [...(owned.get(owner) ?? []), sheet.key]);
    }
  }
  for (const key of Object.keys(OWNERS))
    if (!byKey.has(key))
      throw new Error(
        `web components: OWNERS names ${key}.css, which no list imports`,
      );
  const register = (index, key, css, unlayered = false) =>
    `addSheet(${index}, ${JSON.stringify(key)}, ${JSON.stringify(css)}${unlayered ? ", true" : ""});`;
  const registry = `import { addSheet } from ${JSON.stringify(REGISTRY)};`;
  return {
    name: "clover-sheets",
    resolveId: (id) => (id === GROUP || id.startsWith(ID) ? `\0${id}` : null),
    async load(id) {
      if (id === `\0${GROUP}`) {
        const runs = await Promise.all(
          RUNS.map(async (run) => {
            const css = await rules(...run.sheets);
            return register(run.index, run.key, `@layer clover{${css}}`);
          }),
        );
        return [registry, ...runs].join("\n");
      }
      if (!id.startsWith(`\0${ID}`)) return null;
      const sheet = byKey.get(id.slice(ID.length + 1));
      if (grouped(sheet, options)) return `import "${GROUP}";`;
      const own = await rules(sheet);
      const css = sheet.layered ? `@layer clover{${own}}` : own;
      return [
        registry,
        register(sheet.index, sheet.key, css, !sheet.layered),
      ].join("\n");
    },
    // After the module's own lines, which keep their place: imports run first wherever written.
    transform(code, id) {
      const keys = owned.get(id.split("?")[0]);
      if (!keys) return null;
      return {
        code: `${code}\n${keys.map((key) => `import "${ID}${key}";`).join("\n")}\n`,
        map: null,
      };
    },
  };
}

/**
 * The part sheets that load with their part's code, and are left out of styles.css
 * (`build/styles.mjs`): those whose every sheet the elements load lazily too (`LAZY`), a
 * recording's, a Scene's and a map's, which only code loaded as they draw draws.
 */
export function lazyParts(groups = partSheets()) {
  return Object.keys(groups).filter(
    (name) =>
      groups[name].length && groups[name].every(({ key }) => LAZY.has(key)),
  );
}

const PART_ID = "virtual:clover-part-sheet-";
const ADOPT = resolve(src, "ui/adoptSheet.ts");
/** The placeholder the React build fills with MapLibre's stylesheet (`Map/sheet.ts`). */
const MAPLIBRE_SHEET = resolve(src, "components/Map/maplibre-sheet.ts");
/*
 * MapLibre's stylesheet as the map brings it: in a layer of its own, after Clover's (the
 * statement declares both, whichever sheet comes first), so it outranks Clover's rules as
 * it does unlayered, and a page's own rules outrank it, as they do Clover's.
 */
export const mapLibreSheetCss = async () =>
  `@layer clover,maplibre;@layer maplibre{${await rulesOf(
    SHEETS.find(({ key }) => key === "maplibre"),
  )}}`;
/** Where a lazy part sheet's module is, as if in `src/` (`dist/ui/sheets/media.mjs`). */
const sheetModule = (name) => resolve(src, "ui/sheets", `${name}.ts`);

/**
 * The React build's lazy part sheets (`lazyParts`): each a module of its CSS, which every
 * module that draws what it styles (its sheets' `OWNERS`) hands to `adoptSheet`
 * (`src/ui/adoptSheet.ts`) as it loads, so a page never imports them. A call, not an
 * import for its side effect, which the package's `sideEffects` would let a bundler drop.
 * It fills MapLibre's placeholder too (`components/Map/maplibre-sheet.ts`), which the map
 * loads where the page has no MapLibre stylesheet (`Map/sheet.ts`). The elements' build
 * leaves it empty: their registry brings MapLibre's with the map's code (`OWNERS`), so
 * the map finds it there and loads nothing.
 */
export function lazySheets() {
  const groups = partSheets();
  const owned = new Map();
  for (const name of lazyParts(groups))
    for (const sheet of groups[name])
      for (const owner of ownersOf(sheet))
        if (!owner.startsWith(resolve(src, "web-components")))
          owned.set(owner, new Set([...(owned.get(owner) ?? []), name]));
  const binding = (name) => `__clover_sheet_${name.replace(/\W/g, "_")}`;
  /*
   * Each sheet's module at a path of its own, never on disk, so the build names it for
   * its part, as a consumer's bundler does its chunk (Vite's preload list names it).
   */
  const modules = new Map(
    lazyParts(groups).map((name) => [sheetModule(name), name]),
  );
  for (const file of modules.keys())
    if (existsSync(file))
      throw new Error(
        `lazy sheets: ${relative(src, file)} is a lazy part sheet's module; move the file`,
      );
  return {
    name: "clover-lazy-sheets",
    resolveId: (id) =>
      id.startsWith(PART_ID) ? sheetModule(id.slice(PART_ID.length)) : null,
    async load(id) {
      if (id === MAPLIBRE_SHEET)
        return `export const css = ${JSON.stringify(await mapLibreSheetCss())};`;
      const name = modules.get(id);
      if (!name) return null;
      const css = await rulesOf(...groups[name]);
      return `export default ${JSON.stringify(`@layer clover{${css}}`)};`;
    },
    transform(code, id) {
      const names = owned.get(id.split("?")[0]);
      if (!names) return null;
      const lines = [
        `import { adoptSheet as __clover_adoptSheet } from ${JSON.stringify(ADOPT)};`,
        ...[...names].flatMap((name) => [
          `import ${binding(name)} from "${PART_ID}${name}";`,
          `__clover_adoptSheet(${JSON.stringify(name)}, ${binding(name)});`,
        ]),
      ];
      return { code: `${code}\n${lines.join("\n")}\n`, map: null };
    },
  };
}

/**
 * The stylesheets a page of parts can import one by one (`build/styles.mjs`), by the
 * source each part's code is in, its own and what it draws with. A sheet goes in the one
 * of these its users all fall in, else `core`: its users are its owners (`ownersOf`), a
 * module outside them (`ui/`, `lib/`) standing for the modules that import it. So
 * `ui/Sections.css` is the panel's, as only the panel and its sections draw sections.
 */
export const PART_SHEETS = {
  core: [
    "components/Root",
    "components/Provider",
    "components/Body",
    "components/Canvas",
    "components/Status",
    "components/Label",
    "components/Primitives",
    "components/Viewer",
  ],
  items: ["components/Items"],
  panel: [
    "components/Panel",
    "components/Annotations",
    "components/Collection",
    "components/Contents",
    "components/Download",
    "components/Search",
    "components/Transcript",
  ],
  // Recordings' Body and transport, and an animation's, which plays with the same bar.
  media: [
    "components/Canvas/media",
    "components/Canvas/FrameAnimation",
    "components/Timeline",
  ],
  scene: ["components/Scene"],
  map: ["components/Map"],
  split: ["components/Split"],
  "collection-select": ["components/CollectionSelect"],
  default: ["templates/default"],
};

/** The modules that import each module in `src/`, the elements' own and tests left out. */
function importersOf() {
  const importers = new Map();
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory())
        return path === resolve(src, "web-components") ? [] : walk(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  const target = (from, specifier) =>
    ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]
      .map((ending) => resolve(dirname(from), specifier + ending))
      .find((file) => existsSync(file) && /\.tsx?$/.test(file));
  for (const file of walk(src)) {
    const source = readFileSync(file, "utf8");
    // Statements (a type-only one draws nothing), side effects, and dynamic imports.
    const specifiers = [
      ...[
        ...source.matchAll(
          /^(?:import|export)\b(\s+type\b)?[^;]*?\bfrom\s*"(\.[^"]+)"/gm,
        ),
      ].flatMap(([, type, specifier]) => (type ? [] : [specifier])),
      ...[...source.matchAll(/^import\s*"(\.[^"]+)"/gm)].map(([, s]) => s),
      ...[...source.matchAll(/\bimport\(\s*"(\.[^"]+)"/g)].map(([, s]) => s),
    ];
    for (const specifier of specifiers) {
      const imported = target(file, specifier);
      if (imported)
        importers.set(imported, [...(importers.get(imported) ?? []), file]);
    }
  }
  return importers;
}

/**
 * The part sheets a page of a part needs besides core's and its own, for the parts it
 * draws inside it, where it draws them: a Canvas's recordings, animations and map of a
 * place, and a Body's Scene; the Panel's Collection and Views sections' items, and its Map
 * section. Styling's table says the same. `build/styles.test.mjs` fails on a part that
 * draws what another part's sheet styles unnamed here, and on a name here it never needs.
 */
export const DRAWN_INSIDE = {
  core: ["media", "scene", "map"],
  panel: ["items", "map"],
};

/**
 * The parts that draw what a module draws: its own part (`PART_SHEETS`), or, for a module
 * of no part (`ui/`, `lib/`), the parts of the modules that import it. `inside`: every
 * part that draws it, inside another part too (`DRAWN_INSIDE`), up to core, which every
 * page has, with what it draws inside it. A template draws every part, and the Viewer's
 * page takes styles.css whole, so a template's modules are its own alone, and draw no
 * part inside them.
 */
export function partsDrawing({ inside = false } = {}) {
  const importers = importersOf();
  const prefixes = Object.entries(PART_SHEETS)
    .flatMap(([name, paths]) => paths.map((path) => [resolve(src, path), name]))
    .sort(([a], [b]) => b.length - a.length);
  for (const [prefix] of prefixes)
    if (!existsSync(prefix) && !existsSync(`${prefix}.tsx`))
      throw new Error(
        `part sheets: ${relative(src, prefix)} does not exist; update PART_SHEETS (build/clover-sheets.mjs)`,
      );
  const partOf = (file) =>
    prefixes.find(
      ([prefix]) => file === `${prefix}.tsx` || file.startsWith(`${prefix}/`),
    )?.[1];
  const inTemplate = (file) => file.startsWith(`${resolve(src, "templates")}/`);
  const usersOf = (file, seen = new Set()) => {
    const part = partOf(file);
    if (part && (!inside || part === "core" || inTemplate(file))) return [part];
    if (seen.has(file)) return [];
    seen.add(file);
    const users = (importers.get(file) ?? [])
      .filter((by) => !inside || !inTemplate(by))
      .flatMap((by) => usersOf(by, seen));
    return part ? [part, ...users] : users;
  };
  return (file) => new Set(usersOf(file));
}

/**
 * Each of `PART_SHEETS`' sheets with the sheets in it, in the cascade's order: together,
 * styles.css's. The other templates' stay in templates.css alone, for the Viewer.
 */
export function partSheets() {
  const drawing = partsDrawing();
  const groups = Object.fromEntries(
    Object.keys(PART_SHEETS).map((name) => [name, []]),
  );
  for (const sheet of SHEETS.filter(({ inStyles }) => inStyles)) {
    const users = new Set(
      ownersOf(sheet)
        .filter((file) => !file.startsWith(resolve(src, "web-components")))
        .flatMap((file) => [...drawing(file)]),
    );
    groups[users.size === 1 ? [...users][0] : "core"].push(sheet);
  }
  return groups;
}
