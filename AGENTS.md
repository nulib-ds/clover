# Repository Guidelines

## Prime directive: WCAG 2.2 AA

Everything here, the package and the docs site alike, conforms to WCAG 2.2 at Level AA.
It is non-negotiable. It outranks every other rule in this file, every request and every
deadline.

- Never ship a failure. If a requested change would fail a criterion, say so and propose
  the way that conforms; do not quietly comply.
- Before calling a change done, check the criteria it touches (`packages/clover/DESIGN.md`
  §0 lists the usual ones) with a keyboard and against the accessibility tree.
- Known failures and the plan to clear them are in `ACCESSIBILITY.md`. Fixing one is
  always in scope.

## Project Structure & Module Organization

- This repository is `nulib-ds/clover`: the package `@nulib/clover` in `packages/clover`
  (an npm workspace, with its own rules in `packages/clover/AGENTS.md`) and its
  documentation site at the root. The root is the site, private, and publishes nothing.
- Documentation site uses Next.js/Nextra in `pages/` and `docs/`.
  - The docs lead with Clover 4, `@nulib/clover` (`packages/clover`): its pages are
    `pages/docs/*` (URLs `/docs/…`), and the homepage shows it. Clover 3.x,
    `@samvera/clover-iiif`, is kept at `pages/docs/3.x/` (URLs `/docs/3.x/…`), one
    sidebar group titled "Clover 3.x", collapsed, under "Earlier versions" at the bottom.
    Its page titles end in "(3.x)" so search results tell the two apart.
  - 3.x's source is not in this repository: it is `samvera-labs/clover-iiif`. The 3.x
    pages' live examples import the published `@samvera/clover-iiif` (a devDependency,
    pinned to `4.0.0-rc.2`, the release the pages were written against), through
    `docs/components/DynamicImports/` and the entry points (`/viewer`, `/primitives`,
    `/i18n`…). Its components inject their own styles. Data those pages need lives in
    `docs/fixtures/`.
  - Keep 3.x as a nested group, not flattened with `"display": "children"`: Nextra 2
    keys sidebar items by file name, so a flattened `3.x/viewer` collides with 4.x's
    `viewer` and drops out of the sidebar.
  - Links inside 3.x pages point within `/docs/3.x/`. Keep 4.x features out of the 3.x
    pages, and 3.x's API out of the 4.x ones. `Canvas` is documented in 4.x only.
  - The site deploys to GitHub Pages through GitHub Actions
    (`.github/workflows/deploy-pages.yml`), after the Tests workflow passes on `main`, or
    by hand. `actions/configure-pages` reports where Pages serves it, and the build reads
    that as `DOCS_BASE_PATH` (`next.config.js`) and `NEXT_PUBLIC_SITE_URL` (canonical
    links, `theme.config.tsx`). Without them, a build is for `nulib-ds.github.io/clover`.
  - The site is a static export, so there are no server redirects. URLs that moved
    (3.x pages from `/docs/…`, 4.x pages from `/docs/4.x/…`) are sent on by the 404
    page, `pages/404.mdx`, from the table in `docs/components/Moved.tsx`. Move a page
    again, and add its old URL there. A 3.x page whose name 4.x now uses (`viewer`,
    `map`) shows the 4.x page, which links to its 3.x version.
  - How to compose a layout (`Root`, the parts, the property parts, the information
    panel's `Tab`s, `Split`, hooks, renderers, styles) lives on one page,
    `pages/docs/composing.mdx` ("Composing Layouts", under Templates). The Viewer page
    covers what the Viewer handles and links there; add composition material there, not
    to the Viewer page.
  - A Viewer or standalone `Items` on a docs page takes the `headingLevel` one below the
    heading it sits under (`docs/components/Clover4/Demos.tsx`: 3 under an `h2`, 4 under
    an `h3`), so the page's outline stays true. Move a demo, and check its level. The DC
    item mock's Explore Further rows take 3.
  - `/docs/viewer/demo` is Clover 4's demo: the field, featured items, and every IIIF
    Cookbook recipe to open, handled or not (`docs/components/Clover4/CookbookDemo.tsx`).
    iiif.io's recipe pages link to it as `…/docs/viewer/demo?iiif-content=<manifest>`, so
    never move it without leaving the 404 table a forward. `/docs/viewer/progress` is
    unlisted (hidden in the sidebar, out of search): each recipe's status in 4.x beside
    3.x, and what is missing. Its data is `docs/components/CookbookRecipes/progress4.ts`;
    when a recipe starts working, or stops, record it there with the date.
  - The site banner (`theme.config.tsx`) says Clover 4 is in development. Retire it, or
    change its `key`, when 4.0 ships.
  - The homepage (`docs/components/Home/`) opens with its headline, "Imagine a viewer built
    by you." (`Hero.tsx`, the page's `h1`), and one sentence on what Clover does
    for the distinctive collections a library, archive or museum shares (a lightweight,
    accessible, and modular viewer designed for IIIF Manifests, Collections, and the
    material they describe). It has two halves: the templates live under it
    (`docs/components/Playground/`), and below them the same resource shown one IIIF
    property at a time by the components the templates are made of (`Parts.tsx` and
    `PartsLive.tsx`), with no heading of its own. Between the two, under the playground's
    stage, is the choice: a template for the item above ("Template", a dropdown), or a
    layout of one's own from the parts below ("Build a layout", the one call to action,
    linking to Composing Layouts). The parts follow the playground: `Homepage` holds the resource the playground reports
    (`onResourceChange`) and hands it down, and the section's chips put another of the
    playground's resources on its stage (`pickResource`).
  - That section is one `Root` for that resource. On the left its parts make a small
    viewer, held in view (by its foot, once taller than the window), with no caption (it
    is a region named "Example Viewer" for assistive technology; never `<Clover.Root />`),
    its parts in the order its code gives them. The code control under it opens that code
    below, as an editor (Prism's Material colours on black, `--code-*` in
    `docs/styles/tokens.css`): its `Root` and parts as written. Its values are live
    (Content's `height` a number to type, step or drag, its `controls` a switch, Items'
    `layout` a menu), each part's lines drag into another order (by mouse anywhere on
    them, by touch from the grip, by keyboard with the grip's arrow keys), and the viewer
    follows, so the code is always what it shows; a part's lines outline the part as its
    tile does. A press on a part's lines (or focus on its grip) picks it, and the editor's
    head offers Move up and Move down for it, so no move needs a drag (WCAG 2.5.7);
    Escape lets it go. Escape also puts away a part's name tag in the viewer (1.4.13), and
    focus landing on a part of the held viewer above the window lets it go until focus
    leaves (2.4.11). Every target in it is 24px or inline in the code (2.5.8). On the right each
    part is a tile, live, named as it is written (`<Clover.Label />`), with what it reads
    (a property; for `Content`, the Canvas) and a fact from the resource (a count, a size,
    a name). Pointing at a tile outlines the part in the viewer. A part the resource gives
    nothing to is a chip at the end, naming what it would read and the playground resource
    that has it (`SHOWN_IN`). Every value shown is the resource's own: no illustrations,
    made-up figures or copy. Golden-ratio spaces, hairline edges, no grey fills.
  - The playground shows how far one Viewer stretches: any layout with any kind of
    resource. Two pickers, each changing the stage without the other. Over it, centred,
    the resource (`ResourceField.tsx`): one field, labelled "Select or provide a IIIF resource", for the
    address or content state of the reader's own, with ours listed under it (`resources`
    in `playground-config.ts`: a catalog, a print, a Collection, a photo, a map, a film, a
    recording…), each by its thumbnail, its own label, and a few words on one thing it has
    that the others do not (`description`: concise, only what the resource has). Each of
    the reader's own joins the list as they open it, first, by its root `label` and
    `thumbnail` (never a Canvas's or member's) over its address, so they can switch
    between theirs and ours; held in memory only, never stored, gone with the page. The
    field shows the label of the one on the stage, never our word for its kind (`name`,
    which only the parts' chips use). It is a WAI-ARIA editable combobox: typing narrows the
    list, Down and Up open and move through it, Enter opens the one marked or what is
    typed, Escape closes the list and then puts the field back; focus stays in the field.
    Its edge, and the Template button's, is 3:1 (`--pg-edge`). Under the stage, the
    "Template" dropdown listing the templates by name. No drawings of the layouts, no
    fills of light grey, spaces on Clover's golden-ratio scale. Each template shows with its own defaults: no props, no generated code (a
    Customize drawer with both was removed on purpose). The section is wider than the
    reading sections but held off the screen's edges; the stage keeps one height for
    every pairing, with a hairline edge and a small, soft grey shadow (never the accent).
    Keep it about layout and UX: names and those few words, no marketing lines.
  - Headers are solid, never frosted or translucent: the navbar (`docs/styles/layout.css`
    overrides Nextra's blur) and the playground's bar. From 80rem, where the bar is one
    row, it holds under the navbar as its lower half: while the stage passes under, the
    navbar's edge moves to the bar's foot, and the bar's foot rides on the stage's as the
    two leave. `useStuck` writes `data-stuck` to the bar directly, not to state, so this
    never re-renders the stage.
  - On the homepage the navbar's content lines up with the sections' 1300px (and the
    shell's padding) at every width (`Home.module.css`); docs pages keep Nextra's 90rem,
    which lines up with their sidebar.
  - The homepage renders on the server, so a component it imports statically must not
    import `@iiif/helpers` (through `docs/lib/iiif-content`, say). It is an ESM external
    there, which makes the importing module async, and the homepage's import of it is
    then undefined ("Element type is invalid").
  - `/test/…` (`pages/test/`) holds unlisted mocks of host pages, for trying Clover 4
    where it is meant to live: raw layout, no docs navbar or footer, out of search.
    `/test/dc-item` is a Digital Collections item page (`docs/components/DcItemMock/`),
    filled from the DC API, with the Viewer and `Items` where the site has 3.x's Viewer and
    Slider; `?id=<work id>` opens another work, and a row's works open in the mock.
- The package builds to `packages/clover/dist/`; the site's static assets are in `public/`.
- Tests are colocated near code as `*.test.ts|tsx`: the package's, and the docs' own
  helpers in `docs/lib/` (the root `vitest.config.mjs`), run together through
  `vitest.workspace.mjs`.

## Build, Test, and Development Commands

- `npm run dev`: start the docs site locally at `http://localhost:3000`.
- `npm run build`: build `@nulib/clover` (Vite-based, writes to `packages/clover/dist/`).
- `npm run build:docs`: build the Next.js docs site. Not while `npm run dev` is running:
  both write to `.next/`, and the build leaves the dev server failing with "Cannot find
  module './NNNN.js'". Stop the dev server first, or after a build clear `.next/` and
  restart it.
- `npm run test`: run unit tests (Vitest/JSDOM).
- `npm run coverage`: run tests with coverage reports (text/json/html).
- `npm run lint`: Prettier check + `next lint`.
- `npm run typecheck`: TypeScript project checks.

## Coding Style & Naming Conventions

- Language: TypeScript + React (Next for docs; Preact for UMD WC build).
- Formatting: Prettier (semicolons enabled). Use `npm run prettier:fix` to format.
- Linting: ESLint with `next/core-web-vitals` and `@typescript-eslint` rules.
- Naming: React components in PascalCase, files `*.tsx`; utilities in camelCase `*.ts`.
- Paths: TS path aliases enabled via `vite-tsconfig-paths`.

## Testing Guidelines

- Framework: Vitest with JSDOM and Testing Library (`packages/clover/src/setupTests.ts`).
- Include tests alongside code: `ComponentName.test.tsx`, `util.test.ts`.
- Coverage: v8 provider; reporters text/json/html. Run `npm run coverage`.
- Prefer user-centric tests; avoid brittle DOM snapshots.

## Commit & Pull Request Guidelines

- Branch from `main`; keep PRs focused and small.
- Commits: concise, imperative (“Fix slider scroll behavior”); reference issues `#123`.
- PRs: include description, linked issues, and screenshots/GIFs for UI changes.
- Required: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` must pass.
- Update docs (`docs/` or `pages/`) when changing public APIs or behavior.

## Agents: scope of work

Agents make code changes. Committing, versioning and releasing are done by a human.

- Do not run `git commit`, `git tag`, `git push`, `npm version` or `npm publish`, and do
  not stage changes — leave the working tree for a human to review and commit.
- Do not assign a version number or edit `version` in `package.json`.
- Leave completed work as unstaged changes and describe what changed.

## Changelog

`packages/clover/CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

- Any change to `packages/clover/src/` that a consumer could notice — a prop, a default,
  a dependency, a class name, rendered output — gets an entry under `## Unreleased`.
- Write entries for the person upgrading: what changed, and what they have to do about it.
  Include a migration snippet when behavior changed.
- Add to `## Unreleased` only. Version headings and dates are added at release time by a
  human, so never convert `Unreleased` into a numbered release.
- Docs-only changes are optional, and belong under a `Documentation` heading if included.

## MapLibre's worker (docs)

- MapLibre 6 loads its worker from a real URL resolved against its own module, so a
  bundler that rewrites that module (Next does) breaks it: the basemap still draws but
  every GeoJSON layer silently vanishes. The docs bundle the worker themselves and hand it
  to the package with `setMapWorkerUrl` (`docs/lib/map-worker.ts`).
- `scripts/build-maplibre-worker.mjs` bundles `maplibre-gl-worker.mjs` (it imports
  `maplibre-gl-shared.mjs` by relative path, which a blob URL cannot resolve, so it must
  be bundled rather than copied) into `docs/lib/maplibre-worker.generated.ts`, which is
  gitignored and regenerated by `prebuild:docs`, `predev` and `pretypecheck`. Run
  `npm run build:maplibre-worker` by hand after bumping maplibre-gl.

## Packages

- `packages/clover` is `@nulib/clover`, the composable 4.x Clover, as an npm workspace.
  It is private and unpublished. Its own rules are in `packages/clover/AGENTS.md`.
- The package never imports the docs or 3.x (`@samvera/clover-iiif`): ESLint forbids it,
  and the package's build rejects undeclared imports. Only the 3.x docs pages import 3.x.
- 3.x is maintained in `samvera-labs/clover-iiif`, apart from this repository. Code the
  package copied from it (fullscreen, hls, i18n, the control cluster) may drift.

## i18n

- Clover translates with its own small translator in `packages/clover/src/i18n/config.ts`
  (a copy of 3.x's). No i18next:
  it was about 20 kB gzip, and Clover used only key lookup, `{{name}}` interpolation,
  fallback and detection.
- Resources keep i18next's shape, `resources[lng][namespace][key]`, with the `clover`
  namespace, so `initCloverI18n({ lng, fallbackLng, resources })` is unchanged for
  consumers.
- Lookup order: the set `lng`, or else the page's `<html lang>` and then the browser's
  languages (Mat, 2026-10-16: Clover speaks the language of the page around it; 3.x put
  the browser first). After that come `fallbackLng`, and English last. IIIF text without
  a Root `language` follows the same order (`readerLanguages` in `core/value.ts`). Each regional tag also tries its base
  language (`pt-BR` → `pt`).
- Components call `useCloverTranslation()` and use `t` and `langOf`. It re-renders through
  `useSyncExternalStore` when `initCloverI18n` changes the language or the strings.
- Any element that shows one of Clover's strings, or is named by one (an `aria-label`, an
  icon button with a `Tip`), carries `lang={langOf(key)}`: the string's language where it
  differs from the page's, and nothing otherwise (WCAG 3.1.2). A container named by a
  string or a IIIF label (a `nav`, a list, a group) takes its name from
  `useContainerName(text, lang)` (`src/ui/useContainerName.tsx`), which, where the name's
  language differs from the page's, uses `aria-labelledby` and a hidden element carrying
  `lang`.
- Each Clover root reads the page's language with `useRootLanguage`
  (`src/react/language.ts`). The roots are a `Root`, and a `Canvas`, `Items` or `Map`
  outside one. The page's language is a `lang` given to the root, else the nearest `lang`
  around it, read after mount; until it is known, or where the page declares none, the
  interface language stands in. The root provides it through `HostLanguageContext`
  (`src/i18n/hostLanguage.ts`), and `langOf` compares against it. No root carries a
  `lang` of its own, because a root also holds the host's content. A new standalone root
  calls `useRootLanguage`, uses that hook's `langOf` for its own strings, passes its
  `hostLanguage` to `useContainerName`, and wraps its children in
  `HostLanguageContext.Provider`.
- IIIF text carries the `lang` that `localize` gives it. Text in `none` carries no `lang`
  and takes the page's.
- A key added to `en.json` lands in every locale, translated, in the same change:
  `packages/clover/src/i18n/locales/locales.test.ts` fails otherwise. A word a language
  spells as English does (fr "Collection", "Pause") goes on that test's
  `SAME_AS_ENGLISH` allowlist.
- Add a locale by adding `packages/clover/src/i18n/locales/<tag>.json` and its loader to
  `loaders` in `packages/clover/src/i18n/locales/index.ts`; it must pass the same test.
  English is bundled; every other locale is its own chunk, loaded the first time Clover
  is to speak it (Mat, 2026-10-16: bundled, they cost every page 5.7 kB gzip). Until it
  arrives its strings show in English, marked `lang="en"`, and readers re-render when it
  does. A server render or a test that needs them first awaits `cloverI18n.ready()`
  (`initCloverI18n(...)` returns it).
- Shipped: en, es, fi, fr, nb, nn, no (a copy of nb) and pt (European Portuguese, which
  Brazilian readers get too). The non-English strings await native review
  (`ACCESSIBILITY.md`, P56).

## Mocks

- Complex, reusable IIIF mocks are published, not kept private to a test. Each has one
  generator in `docs/mocks/<name>/` and three outputs that must agree:
  - static files in `public/mocks/<name>/`, written by `npm run build:mocks`
    (`scripts/build-mocks.mjs`, run with vite-node) and committed, published with the
    docs at `https://nulib-ds.github.io/clover/mocks/<name>/`;
  - a live copy for `npm run dev` under `pages/api/mocks/<name>/`, ids under the dev
    server and CORS open;
  - where the static site cannot answer (a search's `?q=`), a `mockFetch` the docs demos
    pass as `request.fetch`.
- Document every mock on `pages/docs/mocks.mdx` (URLs, contents, example answers, how to
  regenerate, rights). `public/mocks` is in `.prettierignore`; regenerate, don't hand-edit.
- `next.config.js` applies `output: "export"` only outside `next dev`: an export turns
  API routes off in development too, which had silently broken the 3.x
  `/api/fixtures/content-search` mock.
- Current: `content-search`, a two-page newspaper with line and word OCR (`xywh`,
  `textGranularity`) and a Content Search 2.0 service; `georeference`, Northwestern's
  Evanston township map with a stored georeference annotation and a navPlace (static);
  `tagging`, Northwestern's record of a Curtis photogravure, kept as fetched in
  `source.json`, with the words printed on the plate tagged where they sit (Cookbook 0021) and its Caption moved from the Manifest's `metadata` to the Canvas's `summary`
  (static). It is the playground's Print;
  `navplace`, Northwestern's record of a Sullivan slide of a Chicago bus, kept as fetched,
  with a navPlace point at the corner its summary names (static), the playground's
  Photo; `paged`, Northwestern's record of the White Sewing Machine Company's 1896 bicycle
  catalog, a `paged` Manifest kept as fetched, with a `summary` written from its own
  fields and pages (it had none), its double-page plate (Page 15)
  `facing-pages`, so it stands alone and Page 16 and Page 17 share a spread, and Ranges
  for its sections (`structures`, titled only by its printed headings or the covers'
  Canvas labels; some name a region), and each plate's "Then" and "Now" tagged (static),
  the playground's Catalog.

## Environment & Tooling

- Node: 20.10 or later (`engines` in `package.json`).
- When working with IIIF resources, verify CORS in local examples.
