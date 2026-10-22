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
- It is built with React aliased to Preact (`build/web-components.config.mjs`). It has a
  104 kB budget and measures 103.3 kB.

Bugs to fix first, whatever else follows:

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

## Architecture

### One render tree per page, parts portaled into their elements

Each element owning a Preact root breaks four things:

- **Context.** A part reads its Root through React context, which can't cross render
  roots.
- **Ids.** Preact restarts its id counter in each root.
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
  inside that root's provider. Every context works, and ids are unique across every root
  on the page.
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
- **Download's button content** is the element's children.
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
