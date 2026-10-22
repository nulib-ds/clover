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
2. **`download="false"` does nothing.** Default has no Download, but Get Started promises
   it.
3. **Get Started says "about 90 kB".** The build measures 103.3 kB, and the element's size
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
(2). `sizes.json` records `webComponentsGzip`, which Get Started states (3). Every id comes
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
| The imperative handle (`onReady`) | Methods on the element                                                                      |
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
| 5     | `clover-canvas`, `clover-map`, `clover-viewer` with `template`                                                                                                                                                                                                                                                                                                                                                                                          |

The parts that need more than their props:

- **Metadata's `renderValue`, Annotations' `renderEntry` and Items' `renderItem`** are
  function properties.
- **Status's `loading` and `error`** are slots.
- **Tip and ReadMore** stay inside the parts. Neither is an element.

## Build, packaging and size

- **Entry points.** `@nulib/clover/web-components` defines every element. Each element is
  a small stub that loads its part's code the first time it connects, so a page of
  `<clover-label>`s never loads a Canvas. One shared chunk holds Preact, the core and the
  host. Every element comes from one build, so the singletons are shared: the translator,
  the WebGL context budget, `useOneOpen` and the Tip's listeners.
- **`sideEffects`** names the web-components entry, so the import is kept.
- **Types.** `HTMLElementTagNameMap` for every element, and a Custom Elements Manifest
  (`custom-elements.json`) generated from each element's spec. The manifest gives editors
  completion and is the source of the docs' attribute tables. It is published with the
  site, for agents.
- **The CDN loader** reports a failed load instead of failing silently. Get Started says
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

- **The header's switch**, React | Web Components (`docs/components/CodeSwitch.tsx`,
  `docs/lib/code-flavor.ts`). React is the default. The choice is stored, kept in step
  across tabs, and set on the root as `data-code` before the page paints. An example
  holds its code in both, each marked `data-code-flavor`, and CSS shows the chosen one.

### To build

- **Example frames.**
  - `Example`, `ViewerExample` and `OptionsExample` hold both flavors in the page's HTML,
    each labeled "React" or "Web Components".
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
  Web Components: "Not yet a web component, shown in React."
- **API tables.** In Web Components mode, a part's page shows its element's attributes,
  properties and events, generated from the manifest.
- **Get Started** installs and loads both flavors and lists the elements. **Composing
  Layouts** shows every composition in both. Its hooks become `root.clover` and the
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
   transformer, the API tables, Get Started, Composing Layouts, the homepage's editor, and
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
- [x] Tests, the build in Chrome, Get Started, the changelog, AGENTS.md.

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

## Decisions for Mat

| Decision                        | Recommended                                                         | Instead                                                              |
| ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The elements' runtime           | Preact, as today: small, and one tree keeps its ids unique          | React, the same runtime as the React parts, about 40 kB more         |
| One tree, or a root per element | One tree per page, parts portaled                                   | A root per element: simpler, but no shared context and duplicate ids |
| Light or shadow DOM             | Light                                                               | Shadow: isolation, but the page's CSS and `aria` references break    |
| Event names                     | `clover-<name>`, composed (renames `<clover-viewer>`'s, unreleased) | Keep the unprefixed names                                            |
| Objects in HTML                 | Properties, and JSON attributes for data                            | Properties only                                                      |
| Entry points                    | `@nulib/clover/web-components` for all, with lazy per-element code  | One entry per element, imported one by one                           |
| The docs' web-component code    | Generated, with hand-written twins where it can't be                | All hand-written, with a test for drift                              |
