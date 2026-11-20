import { build as esbuild } from "esbuild";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BROWSERS } from "./browsers.mjs";

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
  // The Body's box while its code loads, then the Canvas, a Timeline's or a Scene's, and
  // the overlay layer that the first hotspot or a picture's text makes (`overlaysOf`).
  "components/Canvas/Canvas": [
    "components/Canvas/CanvasView.tsx",
    "components/Body/Pending.tsx",
    "components/Scene/SceneView.tsx",
    "lib/renderer/overlays/OverlayLayer.ts",
  ],
  // A Scene's own, with its view (`Body` loads the view, never the part's module).
  "components/Scene/Scene": ["components/Scene/SceneView.tsx"],
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
  // and the pager's count menu cast.
  "ui/Shade": [
    "ui/Sections.tsx",
    "components/Search/Search.tsx",
    "components/Transcript/Transcript.tsx",
    "components/Items/Items.tsx",
    "components/Items/CountMenu.tsx",
  ],
  "ui/ReadMore": ["ui/ReadMore.tsx", "web-components/elements/read-more.tsx"],
  // A row of language codes: a Transcript's files, an annotation set's languages, and the
  // choice of languages (About's, a Transcript's and an annotation set's) folded or not.
  "ui/Codes": [
    "components/Transcript/Transcript.tsx",
    "components/Annotations/Annotations.tsx",
    "ui/LanguageChoice.tsx",
    "ui/LanguageMenu.tsx",
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
  // A Body's alert, where it could not load what it was to draw, and a Transcript's.
  "components/Status/Status": [
    "components/Status/Status.tsx",
    "components/Body/BodyAlert.tsx",
    "components/Transcript/Transcript.tsx",
  ],
  // The pager is Items' (`clover-items clover-pager`).
  "components/Items/Items": [
    "components/Items/Items.tsx",
    "components/Items/PagerLayout.tsx",
  ],
  // The count: `Position`'s, where no pager draws, and the pager's count menu's.
  "components/Items/Position": [
    "components/Items/Position.tsx",
    "components/Items/CountMenu.tsx",
  ],
  // The pager and its count menu, which load as a pager draws, never with `Previous` and
  // `Next` alone (`Pager.tsx`, whose round controls are `ui/Button.css`'s).
  "components/Items/Pager": [
    "components/Items/PagerLayout.tsx",
    "components/Items/CountMenu.tsx",
  ],
  // The Collection's list, which Items' targets and count menu draw too.
  "components/Collection/Collection": [
    "components/Collection/Collection.tsx",
    "components/Items/TargetItems.tsx",
    "components/Items/CountMenu.tsx",
  ],
  // The panel's own and About's, anywhere; the sections' rows are `Rows.css`.
  "components/Panel/Panel": [
    "components/Panel/Panel.tsx",
    "components/Panel/About.tsx",
    "components/Panel/PartOfManifest.tsx",
    "components/Collection/Collection.tsx",
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
  // An annotation's bodies, in the Annotations list and in a Canvas's information.
  "components/Annotations/EntryBodies": [
    "components/Annotations/EntryBodies.tsx",
    "components/Body/CaptionDetails.tsx",
  ],
  // An entry's picture, whichever draws it: an annotation's, a chapter's, or its own.
  "ui/EntryThumbnail": [
    "ui/EntryThumbnail.tsx",
    "ui/AnnotationEntry.tsx",
    "ui/AnnotationPicture.tsx",
    "ui/ChapterEntry.tsx",
  ],
  // The sections' rows, and the Canvas's annotations menu's, which lists them as they do.
  "components/Panel/Rows": [
    "components/Annotations/Annotations.tsx",
    "components/Canvas/AnnotationMenu.tsx",
    "components/Contents/Contents.tsx",
    "components/Transcript/Transcript.tsx",
    "components/Search/Search.tsx",
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
 * Scenes, maps, a vertical slider, the pager, the Panel's sections, a Canvas's hotspots
 * and the other templates in their lazy code's, so they load as those draw
 * (`LAZY_PARTS`). Every other sheet in one chunk,
 * `styles`, which loads with the first part to draw any of them, in a few runs, each the
 * sheets between those apart: thirty small sheets gzip to 19.1 kB apart and to 10.1 kB as
 * one, so a sheet apart in each owner's chunk cost a viewer's page 4 kB, and a `<style>`
 * of each in one chunk still 1 kB more.
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
/**
 * The part sheets (`PART_SHEETS`) that load with their code, as only code that loads as it
 * draws draws what they style: a recording's and its chapters menu's, a Scene's, a
 * picture's text and hotspots, a placeholder's still, a map's, a vertical slider's, the
 * pager's and the Panel's sections', which no template's first view draws, and
 * `CollectionSelect`'s, which no template draws. So each is in the page before its code's
 * first paint and restyles nothing drawn before it (Mat, 2026-11-20: no layout shifts):
 * nothing else draws what it styles, and a server's HTML, which holds no content (the Root
 * loads it as the page hydrates), holds none of it but a Map's box
 * (`build/styles.test.mjs`). What is drawn before that code comes keeps its rules up
 * front: the Canvas held back behind a placeholder and the overlay layer the hotspots
 * share with a picture's text (`Canvas.css`), and the count a header draws where no pager
 * is (`Position.css`). The elements load each of their sheets with that code too
 * (`grouped`), and MapLibre's with the map's.
 */
const LAZY_PARTS = new Set([
  "items-vertical",
  "pager",
  "annotations",
  "contents",
  "download",
  "search",
  "transcript",
  "media",
  "scene",
  "text",
  "hotspots",
  "placeholder",
  "map",
  "collection-select",
]);
/**
 * Sheets that parts of several part sheets draw with, all of which load as they draw:
 * each a part sheet of its own, which loads with whichever of its owners' code comes
 * first (Mat, 2026-11-20: "Shared sheets"), never in styles.css. The language codes of
 * About, a Transcript and an annotation set, and the sections' rows. Not a sheet a first
 * view draws, or a module that draws it from its first paint: `ui/Steps.css` (the Panel's
 * tab row and the Canvas's tray step with its buttons), a menu's own rules and a cue's
 * (a recording's transport writes them, and every Timeline would carry them from its
 * first view), nor one a public part draws with what a page hands it, which a server may
 * draw (`ui/Inset.css`). `build/styles.test.mjs` fails on a module that draws what one
 * styles without bringing it.
 */
export const SHARED = {
  codes: ["ui/Codes"],
  rows: ["components/Panel/Rows"],
};
/** The keys of the lazy part sheets' sheets, and MapLibre's (`LAZY_PARTS`, `SHARED`). */
let lazyKeys;
function isLazy(key) {
  if (!lazyKeys) {
    const groups = partSheets();
    lazyKeys = new Set([
      "maplibre",
      ...lazyParts(groups).flatMap((name) =>
        groups[name].map((sheet) => sheet.key),
      ),
    ]);
  }
  return lazyKeys.has(key);
}

/**
 * Whether a sheet rides with the others, in the `styles` chunk. `whole`: a build for a
 * page that needs all of them (`web-components/viewer`), whose light parts' sheets ride
 * with the rest, as nothing is gained by their loading apart.
 */
const grouped = (sheet, { whole = false } = {}) =>
  (whole || !APART.has(sheet.key)) &&
  !isLazy(sheet.key) &&
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
    target: BROWSERS,
  });
  return tidy(outputFiles[0].text.trim());
}

/*
 * What esbuild leaves as written in a custom property's value and a `var()`'s fallback,
 * which it cannot parse: the space after the colon and inside the parentheses, and after
 * the fallback's comma. None of it is significant once substituted (no `var()` in the
 * sheets sits against an operator), and gzip cannot fold it, as it varies.
 */
export function tidy(css) {
  // Its patterns never meet a string: one holding `var(` or `--` would be changed too.
  for (const [string] of css.matchAll(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g))
    if (/var\(|--/.test(string))
      throw new Error(`tidy would change the string ${string}: read it apart`);
  return css
    .replace(/([{;]--[\w-]+):\s+/g, "$1:")
    .replace(
      /([{;]--[\w-]+:)([^;{}]*)/g,
      (_, name, value) =>
        name + value.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")"),
    )
    .replace(/var\((--[\w-]+),\s+(?=[^\s)])/g, "var($1,");
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
 * (`build/styles.mjs`): `LAZY_PARTS`, a recording's, a Scene's, a map's, a vertical
 * slider's, the pager's, the Panel's sections', a Canvas's hotspots and the others only
 * code loaded as it draws draws, and the sheets several of them share (`SHARED`).
 */
export function lazyParts(groups = partSheets()) {
  return Object.keys(groups).filter(
    (name) => groups[name].length && (LAZY_PARTS.has(name) || name in SHARED),
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
  // The Collection's list is Items' (`MemberItems`), which Items' count menu draws too.
  items: ["components/Items", "components/Collection"],
  // Items' `pager` layout and its count menu, which Items loads as it draws one.
  pager: ["components/Items/PagerLayout", "components/Items/CountMenu"],
  // A vertical slider's own, apart, as few Manifests run down the page (Mat, 2026-11-06).
  "items-vertical": ["components/Items/vertical"],
  panel: ["components/Panel"],
  /*
   * The Panel's sections, each its own, which the Panel loads as it shows them, in the
   * Panel or alone: Annotations' with the Canvas's annotations menu, which lists them as
   * it does, loaded as it opens; Search's with its field, which a Transcript's find draws
   * too.
   */
  annotations: ["components/Annotations", "components/Canvas/AnnotationMenu"],
  contents: ["components/Contents"],
  download: ["components/Download"],
  search: ["components/Search", "ui/FieldPill"],
  transcript: ["components/Transcript"],
  /*
   * Recordings' Body and transport, and an animation's, which plays with the same bar; and
   * a recording's chapters menu, which brings the transport's code with it, over the
   * recording's still too.
   */
  media: [
    "components/Canvas/media",
    "components/Canvas/FrameAnimation",
    "components/Canvas/ChaptersMenu",
    "components/Timeline",
  ],
  scene: ["components/Scene"],
  // The text a Canvas reads from its picture, to select and copy (`TextLayer.tsx`).
  text: ["components/Canvas/text"],
  // A Canvas's annotations on its picture, which it loads where it has any.
  hotspots: ["components/Canvas/Annotations"],
  // A Canvas's placeholder still and its toggle, which it loads where it has one.
  placeholder: ["components/Canvas/Placeholder"],
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
 * draws inside it, where it draws them: a Canvas's recordings and their chapters,
 * animations, hotspots, placeholder, map of a place and annotations menu, and a Body's
 * Scene; the Panel's sections, its Views section's items and its Map section; a
 * Transcript's find field, Search's; and a Map's list of places, drawn by Items. Styling's
 * table says the same. `build/styles.test.mjs` fails on a part that draws what another
 * part's sheet styles unnamed here, and on a name here it never needs.
 */
export const DRAWN_INSIDE = {
  core: [
    "media",
    "scene",
    "map",
    "text",
    "hotspots",
    "placeholder",
    "annotations",
  ],
  panel: [
    "items",
    "map",
    "annotations",
    "contents",
    "download",
    "search",
    "transcript",
  ],
  transcript: ["search"],
  // Its list of places and images, drawn by Items (`MapItems`).
  map: ["items"],
};

/**
 * A part sheet for a way another part draws that is seldom wanted, which that part's code
 * loads apart, after its sheet, before it draws that way: a vertical slider's, which
 * Items loads (`ItemsView`), and the pager's, which Items loads as it draws one
 * (`PagerLayout`). It reads what that sheet sets, styles only what that part draws, and
 * wins where the two tie, as it did in styles.css's order, where it came after. A part
 * drawing that part inside it never needs it: it comes with that part. A sheet that both
 * draw with is that part's (`partSheets`).
 */
export const EXTENDING = { "items-vertical": "items", pager: "items" };

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
 * styles.css's. The other templates' stay in templates.css alone, for the Viewer. A sheet
 * that a part extending another (`EXTENDING`) draws with besides is that part's, which is
 * always in first, and a shared sheet its own (`SHARED`).
 */
export function partSheets() {
  const drawing = partsDrawing();
  const shared = new Map(
    Object.entries(SHARED).flatMap(([name, keys]) =>
      keys.map((key) => [key, name]),
    ),
  );
  for (const key of shared.keys())
    if (!SHEETS.some((sheet) => sheet.key === key && sheet.inStyles))
      throw new Error(
        `part sheets: SHARED names ${key}.css, which styles.css's list does not import`,
      );
  const groups = Object.fromEntries(
    [...Object.keys(PART_SHEETS), ...Object.keys(SHARED)].map((name) => [
      name,
      [],
    ]),
  );
  for (const sheet of SHEETS.filter(({ inStyles }) => inStyles)) {
    if (shared.has(sheet.key)) {
      groups[shared.get(sheet.key)].push(sheet);
      continue;
    }
    const drawn = new Set(
      ownersOf(sheet)
        .filter((file) => !file.startsWith(resolve(src, "web-components")))
        .flatMap((file) => [...drawing(file)]),
    );
    const users =
      drawn.size > 1
        ? new Set([...drawn].map((part) => EXTENDING[part] ?? part))
        : drawn;
    groups[users.size === 1 ? [...users][0] : "core"].push(sheet);
  }
  return groups;
}
