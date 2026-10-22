# Web components at every level: the plan

Clover 4 is React today, with one custom element, `<clover-viewer>`, for a page without
React. The goal (Mat, 2026-10-21): React or web components at every level. Every part a
React component is, a custom element is too, composed the same way, so a page builds the
same layouts in HTML that it builds in JSX. The docs show every example in either, switched
in the header, React by default.

```html
<clover-root iiif-content="https://example.org/manifest.json">
  <clover-content style="height: 60vh"></clover-content>
  <clover-label as="h2"></clover-label>
  <clover-items layout="grid"></clover-items>
</clover-root>
```

This plan rests on three surveys of the code (2026-10-21): today's element, the parts and
how they compose, and the docs' examples. File references are to `packages/clover/src/`
unless they say otherwise.

## What holds throughout

- **WCAG 2.2 AA.** An element renders the same part, so the same markup, names, states and
  keyboard. Light DOM only, so ids, `aria-*` references and the page's `lang` work as they
  do in React. Every phase is checked by keyboard and against the accessibility tree.
- **One implementation.** Elements wrap the React parts. They are not a second copy. A
  part changes once, for both.
- **Seamless.** Light DOM, the stylesheet in `@layer clover`, the page's font, size and
  custom properties. No shadow DOM, which would cut the page's CSS off from the parts.
- **Light.** A page ships the elements it uses. Budgets per element, measured, recorded in
  `sizes.json`, and never written into the copy.
- **Parity, tested.** A part with no element fails a test. The same goes for an example
  with no web-component code, unless it is marked as React only.

## Today

`<clover-viewer>` (`web-components/element.tsx`):

- It is one Preact root per element, rendering `<Viewer template={Default}>` into the
  element's light DOM.
- Its styles are inlined and injected once per document as `<style data-clover>` in
  `@layer clover`.
- It has a fixed attribute table, one object property (`iiifContent`), and three bubbling
  events (`canvaschange`, `manifestchange`, `contentstatechange`).
- It is built with React aliased to Preact (`build/web-components.config.mjs`). The
  entry measures 89.1 kB gzip up front with phase 1's elements, against an 89.2 kB budget
  (86.7 kB after phase 0, 103.3 kB before).

Bugs to fix first, whatever else follows (all fixed in phase 0, October 21, 2026):

1. **`import "@nulib/clover/web-components"` can define nothing.** The package marks
   itself side-effect-free (`package.json` `sideEffects: ["*.css"]`), so a bundler may
   drop the import. esbuild does.
2. **`download="false"` does nothing.** Default has no Download, but Get started promises
   it.
3. **Get started says "about 90 kB".** The build measures 103.3 kB, and the element's size
   isn't in `sizes.json` for the docs to state.
4. **Two viewers on one page share ids.** Preact's `useId` restarts in each root, which
   breaks `aria-controls`, `aria-labelledby` and `htmlFor`.
5. **A property set before the element upgrades is lost.** The loader is async, so this
   happens: the early value shadows the setter.
6. **Booleans only turn off with the exact string `"false"`, and `items` takes any
   string.** Neither is validated.
7. **The element's tests never run in CI.** They run under React, not the Preact that
   ships, and the size budget isn't enforced in CI either.
8. **The minified bundle keeps its whitespace.** Vite's ES library output leaves it in;
   stripping it saves about 18 kB.

How each was fixed: `sideEffects` names `dist/web-components/**`, and a build test bundles
the import with esbuild (1). `download` passes through `Default` and `Panel` to `About`
(2). `sizes.json` records `webComponentsGzip`, which Get started states (3). Every id comes
from `useUniqueId`, which each element prefixes, and ESLint forbids `useId` in the package
(4). `connectedCallback` takes a property set early (5). `"false"` is read in any case,
and `items` warns of a layout it doesn't know (6). The element's tests run under Preact,
and CI builds the package and runs `test:build` (7). A `renderChunk` step strips each
chunk's whitespace: 16.6 kB gzip (8). The Preact tests found a ninth: Preact empties a
`lang` that React removes, so after a language change the element marked its words
`lang=""`, the language unknown (WCAG 3.1.2). The element removes those now.

## Architecture

### One render tree per page, parts portaled into their elements

Each element owning a Preact root breaks four things:

- **Context.** A part reads its Root through React context, which can't cross render
  roots.
- **Ids.** Preact restarts its id counter in each root (and, phase 1 found, in each
  portal).
- **Children.** Rendering into an element wipes the page's children in it.
- **Containers.** The Split and the Panel's tabs rely on context and DOM structure across
  parts.

So the elements share one tree:

- **A host.** The first Clover element to connect makes one hidden Preact root for the
  page, the host. Every element registers with it on connect and leaves it on disconnect.
  A move is told apart from a removal with a microtask check, as today.
- **`<clover-root>`.** The host renders a Root provider for each one: the Clover store, the
  Root's effects, and `CloverContext` and `HostLanguageContext`. It renders no wrapper of
  its own:
  - the element itself takes `class="clover-root"` and `data-status`;
  - the live region (the Announcer) is portaled into it;
  - the page's markup inside it stays as written.
- **Part elements** (`<clover-label>`, `<clover-items>`, …) find their nearest
  `<clover-root>`. The host renders each one's part with `createPortal` into the element,
  inside that root's provider. Every context works. Each element prefixes its own ids:
  one tree does not make them unique, as Preact counts `useId` afresh in each portal.
- **A boundary per element.** With one tree, an error left to rise would take every
  element on the page down, so each element catches its own, inside its portal.
- **Standalone elements** (`<clover-canvas iiif-content>`, `<clover-items iiif-content>`,
  `<clover-map>`) and `<clover-viewer>` are portaled from the host directly.

`Root.tsx` splits in two: what it holds (the store, its effects and the contexts), and its
frame (the wrapper and the Announcer). React's `Root` is both, as now; `<clover-root>` is
the first only. Effects that live only in `Root.tsx` stay there, shared:

- load and reload by content and request;
- controlled Canvas and Manifest;
- status, content state (debounced), search query, annotations and language.

Phase 1 proves this before anything is built on it. In particular: that Preact's portals
leave the page's children in an element untouched, and that one hidden root does not slow
the page.

### Containers

- **Panel and Tab.** `<clover-panel>` reads its `<clover-tab value label>` children, and
  watches them for changes. It renders `<Panel>` with a `<Tab>` for each, and moves each
  tab's own content into its section when the section first opens. Tab labels take an
  attribute, or a `slot="label"` child for markup.
- **The Content's controls.** `<clover-content>` reads a `<clover-panel-toggle
controls="…">` child as configuration and renders the `PanelToggle` itself, in the
  cluster, where the Content's CSS and child count expect it. The open state lives in the
  element, which shows and hides its target by id.
- **Split.** `<clover-split>`, `<clover-split-pane>` and `<clover-split-handle>` are
  native: the Split's logic (sizes, storage, pointer and keys) runs on the hosts
  themselves. That logic depends on direct children and siblings, which a portal
  would put a box between.
- **Templates** are offered whole: `<clover-viewer template="default | document |
gallery">`, each loaded when used, rather than rebuilt from elements. A template's
  geometry (spines, slides, drag to close, the following focus) is React state over its
  own DOM.

### What becomes what

| React                             | Element                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| A string, number, boolean, enum   | An attribute, kebab-case, parsed and validated                                              |
| An object or array                | A property, and for data a JSON attribute too (`value='{"en":["…"]}'`)                      |
| A callback                        | An event, `clover-<name>`, bubbling and composed, cancelable where React's can be prevented |
| A render prop (`renderItem`, …)   | A function property returning a node                                                        |
| A React component (`renderers`)   | A framework-neutral contract, `(container, props) => cleanup`                               |
| The imperative handle (`onReady`) | `handle` on the element, kept from `clover-ready`                                           |
| Hooks, for parts of your own      | `root.clover`: the store, actions, channels and language, with the selectors exported       |

Properties set before an element upgrades are taken on connect. Booleans are HTML boolean
attributes; `="false"` still turns one off. An enum outside its values warns and falls
back to the default.

## The elements

Tag names are `clover-` plus the part's name in kebab case. 3.x defines `clover-viewer`,
`clover-image`, `clover-slider` and `clover-map` in light DOM, so a page runs one version's
elements, not both.

| Phase | Elements                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `clover-root`, `clover-label`, `clover-content`, `clover-items`                                                                                                                                                                                                                                                                                                                                                                                         |
| 3     | `clover-thumbnail`, `clover-summary`, `clover-metadata`, `clover-required-statement`, `clover-rights`, `clover-homepage`, `clover-see-also`, `clover-rendering`, `clover-part-of`, `clover-id`, `clover-value`, `clover-status`, `clover-position`, `clover-next`, `clover-previous`, `clover-download`, `clover-search`, `clover-contents`, `clover-transcript`, `clover-annotations`, `clover-collection`, `clover-collection-select`, `clover-about` |
| 4     | `clover-panel`, `clover-tab`, `clover-panel-toggle`, `clover-split`, `clover-split-pane`, `clover-split-handle`                                                                                                                                                                                                                                                                                                                                         |
| 6     | `clover-tip`                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5     | `clover-canvas`, `clover-map`, `clover-viewer` with `template`                                                                                                                                                                                                                                                                                                                                                                                          |

The parts that need more than their props:

- **Metadata's `renderValue`, Annotations' `renderEntry` and Items' `renderItem`** are
  function properties.
- **Status's `loading` and `error`** are slots.
- **ReadMore** stays inside Summary. **Tip** is `<clover-tip>` since phase 6: a page's own
  control has `<Clover.Tip>` in React, and its elements needed the same.

## Build, packaging and size

- **Entry points.** `@nulib/clover/web-components` defines every element. Each element is
  a small stub that loads its part's code the first time it connects, so a page of
  `<clover-label>`s never loads a Canvas. One shared chunk holds Preact, the core and the
  host. Every element comes from one build, so the singletons are shared: the translator,
  the WebGL context budget, `useOneOpen` and the Tip's listeners.
  `@nulib/clover/web-components/viewer` (phase 8) defines `<clover-viewer>` alone, built
  whole, for a page that shows a Viewer and nothing else: a page loads one entry or the
  other.
- **`sideEffects`** names the web-components entry, so the import is kept.
- **Types.** `HTMLElementTagNameMap` for every element, and a Custom Elements Manifest
  (`custom-elements.json`) generated from each element's spec. The manifest gives editors
  completion and is the source of the docs' attribute tables. It is published with the
  site, for agents.
- **The CDN loader** reports a failed load instead of failing silently. Get started says
  what a CDN needs (CORS).
- **Sizes.** Each element's up-front size and a few compositions go in `sizes.json`, with
  budgets in `size-budget.json`. `test:build` runs in CI.

## Tests

- **Element tests run under Preact**, the runtime that ships: a Vitest project with the
  build's aliases.
- **Spec-driven tests** for every element: attributes parsed and validated, properties
  taken before upgrade, events and their details.
- **Parity.** Every exported part has an element, or is on a short list that says why not
  (hooks and helpers). Each part's accessible tree, its roles, names and states, matches
  between React and the element.
- **A page of many.** Two `<clover-root>`s and a `<clover-viewer>` on one page, checking:
  - unique ids;
  - one popup open at a time across all of them;
  - focus returning where it should;
  - a part moved from one root to another;
  - children connecting before their root.
- **End to end.** Playwright on static HTML pages built from elements (a Default-like
  layout, a gallery, a standalone Canvas), with keyboard checks and axe, in CI.

## The docs

### Built (2026-10-21)

- **The header's switch**, React | Web components (`docs/components/CodeSwitch.tsx`,
  `docs/lib/code-flavor.ts`). React is the default. The choice is stored, kept in step
  across tabs, and set on the root as `data-code` before the page paints. An example
  holds its code in both, each marked `data-code-flavor`, and CSS shows the chosen one.

### To build

- **Example frames.**
  - `Example`, `ViewerExample` and `OptionsExample` hold both flavors in the page's HTML,
    each labeled "React" or "Web components".
  - CSS shows the chosen one, never the `hidden` attribute, so the Markdown copies keep
    both. `OptionsExample` moves from `hidden` to CSS too: today the Markdown loses seven of
    its eleven code blocks.
  - Code fences keep their language in the Markdown. Nextra's `pre` drops it, so
    `mdx-components.tsx` passes it on.
- **Web-component code, generated.**
  - A transformer in `docs/lib` turns an example's JSX into HTML, tested there:
    - it parses with TypeScript;
    - it maps each prop through the element's own spec;
    - `{url}` becomes the example's resource;
    - style objects become CSS text;
    - imports become one module script.
  - Functions, hooks and components are not turned: such an example gets a hand-written
    twin, or it is marked React only.
  - The frames read the code on the server, as `SourceFile` does, so the twin is built with
    the page.
  - Of the docs' 105 framed examples, 63 of the 78 part examples are plain markup, which
    the transformer handles. 13 pass objects or arrays, which need JSON attributes or
    properties. 2 are React code. Of the 27 Viewer examples, 19 work with today's element.
- **Until an element exists**, its examples show React with one line for those who chose
  Web components: "Not yet a web component, shown in React."
- **API tables.** In Web components mode, a part's page shows its element's attributes,
  properties and events, generated from the manifest.
- **Get started** installs and loads both flavors and lists the elements. **Composing
  layouts** shows every composition in both. Its hooks become `root.clover` and the
  events.
- **The homepage's code editor** writes HTML too. Its syntax lives in four builders in
  `PartsLive.tsx` (`element`, `head`, `partLines`, `tail`), and its live values ride on
  tokens, not syntax, so dragging and the values keep working.
- **For agents.**
  - `?code=web-components` on any address chooses that flavor before the page paints.
  - `llms.txt` says both flavors are in the Markdown.
  - The manifest is published.

## Phases

Each is a change of its own, shippable, with its CHANGELOG entries and AGENTS.md rules.

0. **Fix today's element**: the eight bugs above. Small, and worth it whatever follows.
1. **Spike**: the host, `<clover-root>`, `<clover-label>`, `<clover-content>` and
   `<clover-items>`. It must prove:
   - the page's children are kept;
   - every context works;
   - ids are unique across two roots;
   - moves and out-of-order upgrades work;
   - properties set before upgrade are taken;
   - host display, and styles injected once;
   - and it must measure the size of a page with only labels.

   Then go or no go on this architecture.

2. **The element framework.** The spec format, which gives attributes, properties, events,
   types and the manifest from one table. Also the lazy stubs, one style registry per
   document (not an observer per element), the packaging and the budgets.
3. **The parts that read only the store**: the primitives, Status, the pager's parts,
   Download, Search, Contents, Transcript, Annotations, Collection and CollectionSelect,
   About, and the connected Map.
4. **The containers**: Panel and Tab, the Content's controls, the Split's three, Status's
   slots, and render props as function properties.
5. **Standalone, and the templates**: `<clover-canvas>`, the standalone `<clover-items>`,
   `<clover-map>`, and `<clover-viewer template>` for all three.
6. **Parts of your own**: `root.clover`, the exported selectors, the events, and
   renderers and control buttons without React.
7. **The docs' flavors**, from phase 2 on, as each element lands: the frames, the
   transformer, the API tables, Get started, Composing layouts, the homepage's editor, and
   what agents read.
8. **Release**: renamed events on `<clover-viewer>`, budgets, docs claims.

## Phase 1 progress

Begun October 21, 2026, on the three recommended defaults: Preact, one tree per page with
parts portaled, light DOM. Event names, objects in HTML and entry points wait for
phases 2 and 8. Work may stop at a session's limit; resume from this list.

- [x] `Root.tsx` split: `useRootState` (the store, its effects, the context) and
      `Announcer`, apart from its frame. React's `Root` unchanged.
- [x] The host (`web-components/host.tsx`): one per document, a registry of elements, a
      provider per `<clover-root>`, a portal per part, an error boundary per element.
- [x] The style registry (`web-components/styles.ts`): one per document, shared with
      `<clover-viewer>`, with the elements' own display rules.
- [x] The base element (`web-components/base.ts`): connect and move, properties set early,
      attributes read.
- [x] `<clover-root>`, `<clover-label>`, `<clover-content>`, `<clover-items>`
      (`web-components/elements/`, a module each).
- [x] Tests under Preact for each thing phase 1 must prove (`elements.test.tsx`,
      `upgrade.test.tsx`).
- [x] A page in a real browser, checked by keyboard and against the accessibility tree
      (`e2e/elements`, served by `e2e/vite.elements.config.mjs`).
- [x] The size of a page with only labels (`labelPageGzip` in `sizes.json`).
- [x] Go or no go, with what was found: below.

### What phase 1 found (October 22, 2026)

- **The page's markup stays.** A portal adds to an element and leaves the page's nodes
  where they were, the same nodes, in tests and in Chrome.
- **Every context works through the portals.** A label in one element follows the items
  in another; the root's live region announces the move; each root reads the page's
  language where it sits, and Clover's words are marked where it differs.
- **One tree did not make ids unique.** Preact counts `useId` afresh in each portal unless
  the tree's root has used one first, so two `<clover-items>` both made `clover-P0-0`.
  Each element now prefixes its ids (`clover-<n>-`), as `<clover-viewer>` does.
- **One tree needs a boundary per element**, or one part's error takes every element on
  the page down. It is inside the portal, so it catches the part's effects too.
- **Moves and upgrade order work.** A root moved keeps the reader's place without
  reloading; a part moved into another root reads that one; parts defined before their
  root wait for it; a property set before an element is defined is taken.
- **Display.** Roots and items are blocks; `<clover-content>` is the stage's box, sized
  by `--clover-content-height` or its own `style`; `<clover-label>` is
  `display: contents`, so a heading or a word in a sentence sits as if written there. The
  page's CSS wins: a root given `display: grid` lays out its parts. Nothing overflows at
  320px.
- **Styles go in once**, from one registry per document, shared with `<clover-viewer>`,
  with one observer for the runs only media and maps need.
- **The keyboard and the accessibility tree match the React composition**: the Canvas's
  controls, its viewport, the listbox as one tab stop, then Next; an arrow key moves the
  stage and a label in another element.
- **It stays quick.** Only an element whose props change re-renders (tested). In headless
  Chrome on the dev server, 1,200 elements in 200 roots draw in 77 ms, and 3,000 in
  234 ms with one long task of 59 ms.
- **Size.** A page of `<clover-root>` and `<clover-label>` alone loads 22.4 kB of script
  gzipped; React's `Root` and `Label` are 12.5 kB, React aside, so Preact and the host are
  about 10 kB. With `<clover-items>` it is 32.2 kB, and all four 66.2 kB, about Default's
  66.8 kB. Most of a label's page is Preact and Clover's core: `createClover` brings
  annotation sets, content state and search to every root, even one that shows a label.
  The entry, which defines every element at once, grows 2.4 kB (86.7 to 89.1 kB) until
  phase 2's lazy stubs.
- **`Root`'s split costs React pages 0.1 kB** (Default, Gallery), with each prop's name
  written once: `useRootState` takes `Root`'s props whole and returns
  `[context, status, rest]`.
- **A bug in today's element**: `<clover-viewer manifest-id>` held the reader on one
  member of a Collection unless the page answered `manifestchange`. It opens there now
  (`defaultManifestId`, new on `Root`), and the reader moves on.
- **For phase 2**: lazy stubs, so a page loads only the elements it uses; whether the core
  can load annotations, content state and search only when a part needs them; the
  registry indexed by root (it scans every element on each change, which is fine at
  3,000); which attributes an element passes to its part (an author's `aria-label` on
  `<clover-items>` names a generic element, not the list); and the event names.
- jsdom cannot read `@layer`, so the element tests log "Could not parse CSS stylesheet".
  It is harmless.

**Recommendation: go.** The architecture holds, with the two corrections above (ids and
a boundary per element) now part of it. Next is phase 2, the element framework.

## Phase 2 progress

Begun October 22, 2026. Taken, on the recommendations: events are `clover-` and the
callback's name in kebab case (`onCanvasChange` is `clover-canvas-change`), bubbling and
composed, which renames `<clover-viewer>`'s now, before any release; data an attribute
can carry is a URL or JSON in it, and anything else a property; one entry defines every
element, each a small stub that loads its code the first time one connects.

- [x] The spec: each element's attributes, properties and events in one table, with
      their descriptions and types beside it for the manifest, never shipped.
- [x] The base element from the spec: events dispatched from the part's callbacks,
      `data` attributes, and its code, the host and the stylesheet loaded on first
      connect.
- [x] `<clover-viewer>` on the host, as an element that always draws alone, its events
      renamed.
- [x] The host's registry indexed by root, and `lang=""` removed wherever the host
      draws (Preact's, as `<clover-viewer>` had it).
- [x] Types (`HTMLElementTagNameMap`, the events) and the Custom Elements Manifest,
      generated from the spec.
- [x] Packaging: the entry's exports, its types and the manifest; the CDN loader saying
      when it fails.
- [x] Sizes and budgets per page: the entry, a `<clover-viewer>`, labels alone, the four
      parts.
- [x] Tests, a real browser, docs, the changelog, AGENTS.md.

### What phase 2 found (October 22, 2026)

- **A page loads only the elements it uses.** The script is 3.5 kB gzipped and defines
  every element; an element's code, the host and the stylesheet load the first time one
  is on the page. A page of `<clover-root>` and `<clover-label>` loads 37.7 kB, the four
  parts 83.2 kB, and a `<clover-viewer>` 95.4 kB, all with the stylesheet, which is
  10.2 kB of each.
- **Splitting has a price, which the viewer pays.** Its page was 89.1 kB in phase 1's one
  chunk, and is 91.4 kB as one stream now (the host, the specs and the stubs), but
  95.4 kB in its 13 files, each gzipped apart. Left to Rollup, the shared code came in a
  score of small chunks, which cost the viewer page 7 kB; one shared chunk (Preact, the
  core, the host and `<clover-root>`, which every page with an element loads) halved
  that, and Rollup's `experimentalMinChunkSize` made every page larger.
- **Elements draw as their code arrives**, the stage last (it brings the Canvas). Their
  display rules go in before any code loads, so the page does not move.
- **Phase 1's parts left `lang=""`** after a language change, as `<clover-viewer>` had;
  the host now removes it wherever it draws, for every element (tested, and checked in
  Chrome on the build).
- **`<clover-viewer>` is on the host**, drawn by itself even inside a root, its events
  renamed (`clover-canvas-change`…) and its tests unchanged otherwise.
- **The types and the manifest come from the specs**, and the build fails on an
  attribute, property or event without docs. The docs' API tables can read them in
  phase 7.
- **For phase 3**: the stylesheet is still whole, so a page of labels loads 10 kB of CSS
  it mostly does not use: each part's CSS could load with its code. The core's question
  stands (phase 1): whether annotations, content state and search can load only when a
  part needs them. And which attributes pass to a part (an author's `aria-label` on an
  element names a generic element, not the part).

## Phase 3 progress

Begun and done October 22, 2026: the parts that read their root's state.

- [x] Specs and docs for the property parts (`<clover-thumbnail>`, `<clover-summary>`,
      `<clover-metadata>`, `<clover-required-statement>`, `<clover-rights>`,
      `<clover-homepage>`, `<clover-see-also>`, `<clover-rendering>`, `<clover-part-of>`,
      `<clover-id>`, `<clover-value>`), each with `of` and a `value` of its own.
- [x] `<clover-status>`, `<clover-previous>`, `<clover-position>`, `<clover-next>`.
- [x] The panel's sections, each on its own: `<clover-about>`, `<clover-annotations>`,
      `<clover-collection>`, `<clover-collection-select>`, `<clover-contents>`,
      `<clover-search>`, `<clover-transcript>`, `<clover-download>`; and `<clover-map>`.
- [x] A part drawn as it is needs no module of its own (`part()` in `define.ts`).
- [x] Parity: every exported part has an element or a reason (`specs/specs.test.ts`).
- [x] A part of a root draws nothing outside one, and says so; ARIA on an element is
      warned of.
- [x] Tests, the build in Chrome, Get started, the changelog, AGENTS.md.

### What phase 3 found (October 22, 2026)

- **Every new part works as an element** from the built files in Chrome: the outline
  holds at the levels given, ids are unique, no `lang=""` is left, the keyboard follows
  the page, and nothing overflows at 320px.
- **Loading per element costs the viewer more as elements are added.** Rollup cuts the
  code the parts share by which elements reach it, so a `<clover-viewer>` page now loads
  31 files: 102.3 kB gzipped one by one, 94.2 kB as one (Brotli the same). A second
  shared chunk for the light parts, and merging small chunks at 1, 3 and 8 kB, each made
  the entry or the pages larger. A page of labels is 38.9 kB, of the four parts 87.3 kB.
  Mat's call: keep it, or give `<clover-viewer>` an entry of its own, built whole, for
  pages that use only it (about 90 kB; a page using both would load two copies of
  Preact and the core).
- **Each part's CSS cannot be found from its modules**: the families' stylesheets list
  their members' rules (`ui/Button.css` holds Items' arrows), and the members never
  import them. Splitting the stylesheet needs a table per element, checked by eye.
- **Markdown in `<clover-value>`** draws a `<p>` inside its default `span`, as `Value`
  does in React; `as="div"` suits Markdown.
- **For phase 4**: the containers (Panel and Tab, the Content's controls, the Split's
  three, Status's slots) and render props as function properties (`renderValue`,
  `renderEntry`, `renderItem`).

## Phase 4 progress

Begun and done October 22, 2026: the containers.

- [x] The Split's logic apart from React (`components/Split/splitting.ts`): limits, the
      click's steps, keys, the drag and the double click's guard, shared by `SplitHandle`
      and the elements.
- [x] `<clover-split>`, `<clover-split-pane>`, `<clover-split-handle>`: the elements are
      the boxes, so nothing comes between a pane and its handle.
- [x] `<clover-panel>` and `<clover-tab value label>`: each tab's content moved into its
      section when the section first opens; a `slot="label"` child shown as a copy.
- [x] `<clover-panel-toggle controls>`: in `<clover-content>`, drawn in the cluster;
      elsewhere, its own button; open while its target is not `hidden`.
- [x] `<clover-status>`'s slots, `loading` and `error`.
- [x] Function properties: Metadata's `renderValue`, Annotations' `renderEntry`, Items'
      `renderItem`, each returning a DOM node or text.
- [x] Parity, specs and the manifest (slots), tests under Preact, a page in Chrome by
      keyboard and the accessibility tree, sizes, Get started, the changelog, AGENTS.md.

### What phase 4 found (October 22, 2026)

- **A layout as Default's works in HTML** (`e2e/elements`, "A layout of containers"): the
  stage with the toggle among its controls, a handle the keys move and the page
  remembers, the panel's tabs with a label's markup copied and a tab's content moved into
  its section, the toggle hiding the pane and the handle going with it. Chrome's
  accessibility tree reads as the React composition's (a separator named "Resize
  panels", a complementary panel with its tablist), and axe finds nothing at WCAG 2.2 A
  or AA. At 320px the page's own CSS stacks the panes, as Default floats its panel on a
  phone: two panes' minimums never fit beside each other there.
- **The toggle's state is its target's `hidden`**, not an attribute of the toggle's own,
  as this plan first had it: a panel written `hidden` starts shut before any code loads,
  with nothing to flash, and a page that shows or hides it itself is followed.
- **What the page writes in a container is moved, or copied**: a tab's content moves (the
  page's own nodes, with their listeners, back into the tab when the panel lets them go),
  and a label's or a status's slot is copied, kept in step, the slot hidden where it is
  written so a screen reader meets it once.
- **The Split's logic is one now**, shared by React's handle and the element. As a class
  it cost every page with a Split 0.3 kB, its names surviving minifying; held in a
  closure, 0.15 kB, which `Default` and `Document` pay.
- **A bug, fixed**: the elements' display rules beat the browser's `[hidden]`, as an
  author's styles do, so `<clover-items hidden>` showed. Each is `:not([hidden])` now.
- **Size.** The script is 5.2 kB (4.6 before): six elements more, slots, function
  properties. A `<clover-viewer>` page loads 104.5 kB in 36 files (102.3 kB in 31): the
  containers share Panel, Split and the toggle with Default, so those came in chunks of
  their own, gzipped apart (95.3 kB as one). A layout of the containers loads 103.7 kB.
  The budgets are raised to these. The case for `<clover-viewer>`'s own entry, built whole
  for pages that use only it (about 90 kB), grows with each phase.
- **For phase 5**: the standalone parts (`<clover-canvas>`, `<clover-items
iiif-content>`, `<clover-map>`) and `<clover-viewer template>` for all three templates.

## Phase 5 progress

Begun October 22, 2026: standalone, and the templates. Work may stop at a session's limit;
resume from this list.

- [x] `<clover-canvas>`: the Canvas, alone (`iiif-content`, `src`, `canvases`) or, inside
      a `<clover-root>`, its view.
- [x] `<clover-items>` and `<clover-map>` alone, tested as they ship.
- [x] `<clover-viewer template="default | document | gallery">`: each loaded when used,
      with the templates' stylesheet loaded beside it; the templates' own attributes.
- [x] Parity (`Canvas` off the later list), specs and docs, tests under Preact, a page in
      Chrome, sizes, Get started, the changelog, AGENTS.md.

### What phase 5 found (October 22, 2026)

1. **A Canvas of its own costs every viewer page.** `<clover-canvas>` shares the Canvas
   with the stage and the viewer, so Rollup cut that code into more chunks: a
   `<clover-viewer>` page went from 36 files and 104.5 kB to 39 files and 106.3 kB
   gzipped apart, against 96.3 kB as one. The case for giving the viewer one whole entry
   grows with each phase: 10.0 kB now. A Canvas alone loads 75.6 kB once it draws, and a
   viewer in Document 112.6 kB, its template and styles with it.
2. **A template passes on what it does not know.** Each hands unknown props to its root's
   element, so `size` on Default would have landed as an HTML attribute. `ONLY` in
   `elements/viewer.tsx` hands each template its own attributes and none of another's.
3. **The templates' styles are a deferred run.** Document's and Gallery's sheets
   (`src/templates/templates.css`) load with the first `<clover-viewer>` that names one.
   The registry's `when` now matches the watched element itself, not only what it holds.
4. **A build check's marker went stale.** The viewer's spec now names its templates'
   props, so `defaultPanelOpen`, the string that marked "the template has loaded", was in
   the entry every page loads. The check reads the template's class as its code writes
   it, quoted, which the stylesheet never does, and now covers a Canvas alone too.
5. **The Panel's landmark had no name**, in React too. Open in Document, it was a second
   complementary landmark beside "Items". It is named "Information panel" now, as its
   tabs are: 52 B on a viewer page, and three budgets 0.1 kB higher.
6. **In Chrome** (`e2e/elements`'s new section): 27 tab stops in the page's order, each
   with a visible ring; the accessibility tree as written; axe at 0 violations, with the
   panel and the lightbox open too; nothing scrolling across at 320px. Gallery's lightbox
   opens with Enter and gives focus back on Escape. The first screenshots were gray: a
   stage draws only once it comes near the window, as it should.

## Phase 6 progress

Begun October 22, 2026: parts of your own. Mat (2026-10-22): go on through phases 7 and 8
with the recommendations, asking only where his input is needed. Work may stop at a
session's limit; resume from this list.

- [x] `root.clover`: React's hooks as methods (`useNavigation()` is `navigation()`),
      `subscribe`, the store's actions, its channels and the language, once the root has
      loaded; `clover-ready` when it is there.
- [x] The Canvas's handle on `<clover-canvas>` and `<clover-content>`: `clover-ready`
      with it, and its methods on the element (`zoomBy`, `home`, …).
- [x] Renderers without React: `{ format | canvasId | match, render(container, view) }`,
      on `<clover-root>` and `<clover-content>`.
- [x] Control buttons without React: a replacement is a function returning the page's
      own button, which Clover wires; a page's own buttons in `<clover-content>` join the
      cluster, each with the popover Clover's have.
- [x] Specs, types and the manifest (methods), tests under Preact, a page in Chrome,
      sizes, Get started, the changelog, AGENTS.md.

### What phase 6 found (October 22, 2026)

1. **The handle, not methods.** Forwarding the handle's 18 methods onto the element cost
   every page 0.25 kB in the entry, for a second way to the handle React does not have.
   The element keeps the handle as `handle` (`stage.handle.zoomBy(2)`), as `onReady`
   hands it to a React host.
2. **A ready event must not bubble.** The stage inside a root sends its own
   `clover-ready`, and the test page's script, listening on the root, read the stage's
   detail as the root's and threw. Each element's `clover-ready` is its own now, as
   `load` is: one name, and a root's listener hears only the root.
3. **A control of the page's must be one of the cluster's own children.** The cluster's
   `> *` rules fade each control with the chrome and take its clicks while it is away.
   In a box of `display: contents` a button inherits the clicks rule but not the fade:
   shown, and unpressable. The page's buttons go right after a hidden mark Clover draws
   among its controls, as a React host's children sit.
4. **A Tip of its own.** React's parts of your own have `<Clover.Tip>`; the elements had
   nothing for a page's own control, which `DESIGN.md` §7 calls an accessibility boon.
   `<clover-tip>` draws it into its button, since Tip takes its parent for its control.
5. **Adapters only where used.** The renderers' and control buttons' adapters (1.3 kB
   gzip alone) load on a page that gives them, and what needs one waits for it, so the
   stage never shows Clover's controls and then the page's. The root's API (0.6 kB) is in
   the shared chunk: it is the phase. A viewer page went from 106.3 to 107.1 kB (97.1 kB
   as one), a page of labels from 39.8 to 40.6, the entry from 5.5 to 5.8. React's pages
   did not change.
6. **The types are the page's own.** `index.d.mts` declares `CloverRootApi`,
   `CloverCanvasHandle` (from the handle's methods' docs), `CloverRenderer` and
   `CloverControlButtons` structurally (`build/web-components-api.d.ts`), importing
   nothing of React's, so a page of elements needs no React types.
7. **In Chrome** (`e2e/elements`, "Parts of your own"): the page's script follows the
   root; the page's zoom in zooms; its copy button sits after Clover's controls with its
   popover, follows the stage onto a renderer's view and back; the renderer draws its view
   and lets it go. axe at 0 violations on both views; nine tab stops in order; nothing
   scrolling across at 320px.
8. **A phase 4 failure, found in a dark mode.** Checked in the preview's dark mode (the
   test page given Clover's tokens for one, from the system's colors, as "Colors and
   contrast" asks of a dark page), axe found the containers' `<clover-split-handle>`
   with no `aria-valuenow`: it had measured before the pane it sizes was marked, each
   element drawing in its own order, and nothing measured again. It does now, when a
   pane is marked (4.1.2), and a test reproduces the order. The page is at 0 violations
   in light and dark. axe takes a page that paints no ground as white: the test page
   paints its own (`Canvas`), or a dark mode's contrast reads as failing.

## Phase 7 progress

Begun October 22, 2026: the docs in both flavors. Resume from this list.

- [x] The transformer (`docs/lib/jsx-to-html.mjs`, tested): JSX to the elements' HTML
      through their specs; what HTML cannot say comes back with its reason.
- [x] Twins as each page compiles (`docs/lib/code-flavors.mjs`, run by
      `mdx-code-flavors-loader.cjs` before Nextra's loader, under Turbopack and webpack):
      each React fence and its twin marked `data-code-flavor`, `{url}` the frame's
      resource (`example-urls.mjs`), a hand-written twin as ```html twin.
- [x] `OptionsExample` by CSS (`data-shown`), so the Markdown keeps every option; code
      keeps its language as a class (`mdx-components.tsx`).
- [x] API tables from the specs in web-components mode (`ApiReference`, 24 pages).
- [x] For agents: `?code=`, `llms.txt`, the manifest at `/custom-elements.json`, the
      Markdown's flavors labeled.
- [x] Twins by hand for the examples HTML cannot say (hooks, state, functions), above
      all Composing layouts' (`root.clover` and the events).
- [x] `<clover-read-more>`: React's parts of your own have ReadMore.
- [x] The homepage's code editor in HTML too.
- [x] Checks in the preview and Chrome, the changelog, AGENTS.md, what phase 7 found.

### What phase 7 found (October 22, 2026)

1. **Twins at compile time, by a loader.** A remark plugin is a function, and Nextra
   hands its options to Turbopack, which takes none. A loader named by its path, placed
   before Nextra's for Markdown pages, gives each React fence its twin under Turbopack
   and webpack alike, and nothing is written twice in the pages. Node keeps the
   loader's modules: a change to them shows once `npm run dev` restarts.
2. **Most examples turn as written.** Of the 143 JSX fences on Clover 4's pages, 112
   turn as written; most of the rest are hooks, state and functions, now each with a
   twin by hand (`root.clover`, the events, `render(container)`), and a few stay React's.
   Sibling elements with nothing around them needed reading as a fragment; React's
   `defaultX` is the element's `x`, as an attribute is both where it opens and what
   moves it later.
3. **The transformer finds the gaps.** It refuses a prop an element has neither an
   attribute nor a property for, and so found what the elements lacked: `controls` as
   an object (now a property), `<clover-viewer>`'s `annotations` and `request`, and
   React's helpers for parts of your own that had no element: `ReadMore` (now
   `<clover-read-more>`, its measuring shared as `useReadMore`) and `useOneOpen` (now
   `root.clover.oneOpen`, shared as `openOne`). Every exported part is an element now
   (`NEVER` is empty). React's pages paid under 0.1 kB for the sharing.
4. **The API tables come from the specs.** In the web-components flavor a component's
   page draws its elements' attributes, properties, events and slots (`ApiReference`,
   with the page's own Markdown components), from the specs the types and the manifest
   are written from.
5. **What agents read holds both.** `?code=` chooses a flavor without storing it, which
   the switch's own hook reads too; the Markdown labels each flavor and keeps each
   fence's language, which Nextra's `code` had dropped; the manifest is published at
   `/custom-elements.json`.
6. **Checked** in the preview and in Chrome: the Items, Composing layouts, Viewer, Panel
   and Get started pages and the homepage at 0 axe violations in light and dark, in the
   web-components flavor, with no duplicate ids. The homepage's editor writes HTML with
   its values as live and its lines as many, so the Composable story keeps its 15.

## Phase 8 progress

Begun October 22, 2026: the release. Resume from this list.

- [x] `<clover-viewer>`'s events renamed (in phase 2, with the changelog's migration),
      and nothing left using the old names outside the 3.x pages and the records.
- [x] Budgets: every page in `PAGES` held to `size-budget.json`, in CI (`test:build`),
      the Viewer's own entry among them.
- [x] `@nulib/clover/web-components/viewer`: `<clover-viewer>` alone, built whole.
- [x] Two copies on one page: no id made twice (the elements', a Canvas's controls',
      Markdown's), and a warning.
- [x] Docs claims: Clover described as web components, not one; 3.x's element measured.
- [x] Checks, the changelog, AGENTS.md, what phase 8 found.

### What phase 8 found (October 22, 2026)

1. **The events were renamed in phase 2**, as the decisions table recommended, before
   any release. Nothing uses the old names now outside the 3.x pages and the records of
   the change.
2. **A page with a Viewer alone loads less from an entry of its own.** Loading per
   element costs a page of one `<clover-viewer>` 39 files, 107.3 kB gzipped one by one
   (97.3 kB as one). Its own entry, built whole, loads four, 90.7 kB: a sixth less and
   35 requests fewer, for what most pages without React will do. It is opt-in:
   `@nulib/clover/web-components` stays the entry for every element, and Get started
   offers the other for a page with a Viewer alone. Its cost is the package's: 0.8 MB
   more of gzipped files to install (1.1 to 1.9 MB), most of it MapLibre and hls.js,
   which no page loads unless it shows a map or a stream. Taken on the recommendation
   (Mat, 2026-10-22: "go with recommendations").
3. **Two copies of Clover on one page met in their ids.** A page with both entries, or
   with React's Clover beside the elements', has two copies, and three counts started
   again in each: the elements' (`clover-1-…`), a Canvas's for its controls
   (`zoomIn-clover-canvas-1`, a count of its module's, never `useUniqueId`) and
   Markdown's for its groups past h6. In Chrome, with both entries, seven control ids
   showed twice and the viewport's description named two elements (4.1.2). Every copy of
   the elements counts in one count kept on the document now, a Canvas's controls take
   `useUniqueId`'s ids (React's pages a few bytes smaller for it), and Markdown counts on
   the page's global. The second copy of the elements says in the console that Clover is
   loaded twice; each keeps its own translator and popups, so Get started still says to
   load one. Checked again in Chrome: no id twice, and every `aria` reference names one
   element.
4. **Descriptions still said "a web component"**, from when `<clover-viewer>` was the
   only one: the README, both packages' descriptions, the site's descriptions and
   structured data (`docs/lib/site.ts`), Get started and the homepage's Install. They
   say "web components" now, and Get started's section is "Web components", keeping its
   id (`#web-component`) for the links to it.
5. **3.x's element is measured.** Get started compared Clover 4's element with a figure
   written in for 3.x's, "about 530 kB". The docs' build measures it now, from the
   release the 3.x pages document (`docs/lib/earlier-size.ts`): 563 kB.

## Per-part CSS

Begun October 22, 2026 (Mat: "start per-part CSS for the elements"), the deferral left
from phase 3: a page of labels loaded the whole stylesheet, 10 kB of CSS it mostly did not
use.

- [x] Each sheet a module, imported beside the modules that draw what it styles
      (`build/clover-sheets.mjs`, `OWNERS`), registering with the document's registry in
      its place in the stylesheet's order (`addSheet`, `data-clover-index`).
- [x] The light parts' sheets apart, in `shared`; the rest in one `styles` chunk, as a few
      runs; media's, maps' and the other templates' with their code. The watcher for the
      deferred runs is gone.
- [x] Each element checked alone against the whole stylesheet (`e2e/check-sheets.mjs`).
- [x] Sizes, budgets, the build's checks and the elements' tests, the changelog,
      AGENTS.md.

### What it found (October 22, 2026)

1. **Small sheets compress badly apart.** Each sheet in its owner's chunk made a page of
   labels 10 kB lighter and a viewer's 4 kB heavier: thirty sheets gzip to 19.1 kB apart
   and to 10.1 kB as one. So most sheets still load together, in one chunk, as runs
   between the light parts' sheets, which load apart: a page of labels loads 31.2 kB, from
   40.8; a viewer's 107.5 kB, from 107.3; the Viewer's own entry, which keeps no sheet
   apart, 90.6 kB, from 90.8; the entry 5.3 kB, from 5.8.
2. **Owners are what draws a class, not what finds it.** A sheet's classes are written by
   the modules that draw them and by modules that only look for them (`closest`,
   `querySelector`); only the first own it. A rule that needs an ancestor's class too
   needs only the rarer owner, so `Default.css` loads with Default, never with every
   Items. Thirteen sheets have owners beyond their own module, some found only by
   reading the rules: the renderer's overlay layer, on every Canvas, is styled in the
   hotspots' sheet.
3. **A rule in another part's sheet costs that part's page.** `.clover-link-format`, which
   only Primitives draws, was in `Panel.css`, so a page of property parts loaded all four
   runs, 46.5 kB. Beside the links that write it, the page is 36.8 kB.
4. **Rollup puts a manual chunk's unclaimed dependencies in it.** The host's sheet imports
   the registry, so the registry moved into `shared`, and the entry, which needs the
   registry, loaded `shared` up front: 29.3 kB for a page with no element drawn. The
   entry's own modules now have a chunk of their own (`index`).
5. **Nothing watches the page for styles now.** Media's, maps' and the other templates'
   sheets come with their lazy code, as the elements' tests show for Document's.
6. **Checked**: 30 pages, each element alone or in a natural group, at rest and with every
   disclosure and tab opened, in light and dark. Adding the whole stylesheet changed no
   node's computed style. jsdom cannot read some of the stylesheet's selectors, so the
   elements' tests take each sheet's key and place without its CSS.

## Decisions for Mat

| Decision                        | Recommended                                                                                                                   | Instead                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The elements' runtime           | Preact, as today: small, and one tree keeps its ids unique                                                                    | React, the same runtime as the React parts, about 40 kB more         |
| One tree, or a root per element | One tree per page, parts portaled                                                                                             | A root per element: simpler, but no shared context and duplicate ids |
| Light or shadow DOM             | Light                                                                                                                         | Shadow: isolation, but the page's CSS and `aria` references break    |
| Event names                     | `clover-<name>`, composed (renames `<clover-viewer>`'s, unreleased)                                                           | Keep the unprefixed names                                            |
| Objects in HTML                 | Properties, and JSON attributes for data                                                                                      | Properties only                                                      |
| Entry points                    | `@nulib/clover/web-components` for all, with lazy per-element code, and `/web-components/viewer` for a Viewer alone (phase 8) | One entry per element, imported one by one                           |
| The docs' web-component code    | Generated, with hand-written twins where it can't be                                                                          | All hand-written, with a test for drift                              |
