# @nulib/clover

The composable 4.x Clover, used two ways: the ready-made `Viewer` (the default export,
`<Viewer iiifContent={url} template={Document} />`), or parts with dot notation around one
`Clover.Root` (named exports). The Viewer only draws a template, and every template is
built only from the parts. It is an npm workspace of the
repository, private and unpublished. The repository root is its documentation site. The
3.x line, `@samvera/clover-iiif`, is maintained separately, in `samvera-labs/clover-iiif`.

The root `AGENTS.md` applies here too, including the agents' scope of work: no commits,
staging, `git mv`, versions or publishing.

## Prime directive

WCAG 2.2 AA, as the root `AGENTS.md` and `DESIGN.md` §0 state: non-negotiable, above
every rule below.

## Package rules

- **Relative imports only.** Nothing in `src/` imports `src/...`, `docs/...` or
  `@samvera/clover-iiif`; ESLint forbids it. The Vite build throws on any bare import that
  is not a declared dependency or peer, so OpenSeadragon, Radix and the like cannot slip
  in. Code copied from 3.x (fullscreen, hls, i18n, the control cluster) is copied on
  purpose, and the copies may drift.
- **Dependencies:** peers `react` and `react-dom` (18 or 19). Dependencies are
  `@iiif/parser@4` (the Presentation 4 upgrader, loaded on demand, and P4 types),
  `@iiif/helpers@4` (`i18n` only, 0.6 kB), `@iiif/presentation-3` (types), and
  `dompurify`, `hls.js` and `maplibre-gl`, all loaded on demand. The docs keep helpers 1.x, and
  the 3.x docs' `@samvera/clover-iiif` parser 2, at the root; npm nests the package's own
  copies under `packages/clover/node_modules`. No
  Vault: it is 19.5 kB gzip. Add a dependency only when a milestone needs it.
- **ES modules only**, one file per source module (`preserveModules`), named exports
  only. `import * as Clover from "@nulib/clover"` gives dot notation and still
  tree-shakes; `build/consumer.test.mjs` asserts that. Never an aggregate object or
  `Root.Item = …` statics. A CommonJS build beside it would let an app load two copies and
  split the React context the parts share.
- **Styles:** colocated `.css` files, listed by hand in `src/styles/clover.css` and built
  into `dist/styles.css` (esbuild), which `build/styles.mjs` wraps in `@layer clover`.
  Keep the aggregate's imports plain: the docs import it from source, and Next 14 reads
  `@import … layer()` as a media query that never matches. Package JS never imports CSS.
  Color tokens are `--clover-color-*` with literal fallbacks, since a page sets them. The
  scale's tokens (`--clover-space-*`, `--clover-text-*`, `--clover-control`) are defined
  in `src/styles/scale.css`, first in the list, and need none. Add every new stylesheet to
  the list.
- **Space, type and selectors follow `DESIGN.md`.** Every space and text size is a step of
  the golden scale from the page's own 1rem, chosen by how closely things belong together
  (a container's inset one step above the gap between its children). Never set a font
  family, a base size or a line height: Clover reads at the page's type. Select a part's
  insides by structure under its one root class, and write families (round controls,
  text buttons, rows, fields) once. `src/styles/scale.test.ts` fails on any literal rem or em in
  spacing, and on any font family.
- **Plain-layout scaffolding.** Every part must still lay out plainly without the
  stylesheet: semantic HTML in reading order, SVG icons with `width`/`height`
  attributes, and the few functional styles inline (stage position and height, track
  overflow, visually hidden text, `hidden` on closed popovers). Everything visual goes in
  the stylesheet. The Canvas's figure, viewport, surface and DOM layers set their geometry
  inline. Without it, WebKit grows the canvas without bound. `e2e/specs/plain.spec.ts`
  checks this layout in every engine.
- **Full screen** is offered only where `isFullscreenSupported()` says an element can have
  it. Read it with `useFullscreenSupported()`, which assumes support on the server, so
  hydration matches. Where elements cannot go full screen (iPhone), a video goes to the
  system player: pass it to `toggleFullscreen(from, video)`. A `texture` video is not on
  the page, so it is placed first in its Canvas at full size, under the viewport, until
  `webkitendfullscreen`. The player is handed it a frame later. Handed over at once, a
  video that has never been laid out shows as black. Safari still honors the press.
  Checked in the iOS 26 Simulator.
- **Class names** are `clover-*`, and never one 3.x uses: both stylesheets load on the
  docs pages, and an app moving to 4.x may load both too. The Viewer's are its template's
  (`clover-template-default*`), not `clover-viewer*`. Before adding a class, grep `src/` for it. Copied 3.x classes were renamed (`clover-canvas-controls`,
  `clover-canvas-button`, `clover-canvas-exit-full-screen`, `clover-canvas-error`), so 3.x
  and 4.x styles never collide on one page.

## Sections

- `ui/Sections.tsx` is the information panel's body, as `tabs` or `accordion`. Keep the
  two layouts one component: the same buttons, panels, state and mounting rule, with only
  the pattern's differences switched (tablist and `tab` roles with roving focus and
  select-on-arrow; or headings, `aria-expanded`, `region`, arrow keys that only move focus)
  and the layout CSS under `[data-layout]`. A panel keeps its place in the tree across a
  layout switch, so its content does not remount.
- Tabs keep to one row, never wrapping (Mat, 2026-10-20). The tab list is
  `useScrollTrack`'s viewport (`dragFree`, its tabs the slides), in
  `.clover-sections-tabs` (the rule under the row, the Panel's room for its close
  button) > `.clover-sections-row` (where the arrows sit). While tabs lie past an end
  the box carries `data-more` (`start`, `end`, both), the list is masked to fade there,
  and that end's arrow shows, a round control that pages the row. The arrows are for a
  pointer only: a tab list holds only tabs, and the keyboard reaches every tab already,
  so they are `aria-hidden`, `tabIndex={-1}`, keep focus where it was on a press, and
  name themselves with a `Tip`. The fade and the row's `scroll-padding-inline` are both
  `--clover-sections-fade` (a control and `s`), so a tab brought into view by focus or
  by opening rests clear of them (WCAG 2.4.11). The open tab is brought into view when
  it opens out of sight.
- The `Panel`'s default sections past About are `React.lazy`, each in its own
  `Suspense` (`later`), as the Map's is: `Sections` mounts a section's content only when
  it first opens, so a section never opened is never fetched. Its helpers (whether to
  offer a section) must not import the section's module: `partOfCollection` lives in
  `core/selectors.ts` for that.
- Accordion headings stay in sight in a scrolling container (Mat): sticky, stacked at
  the top when scrolled past and at the bottom when an open section pushes them below.
  Labels wrap (`overflow-wrap: anywhere`) and are never cut short (WCAG 1.4.12), so
  headings have no fixed height and the stacks are measured. One ResizeObserver in
  `Sections` measures every heading's border box. It writes `--clover-sections-before`
  and `-after` (the height of the headings before and after it) on each box, and
  `--clover-sections-total` on the list: properties on the elements, never state, so
  measuring renders nothing. The headings' `top`/`bottom` read them, and so does the
  open panel content's `scroll-margin-block` (total minus after above, after below, each
  plus its inset). `--clover-sections-index` (on the box) and `--clover-sections-count`
  (on the list), times `--clover-sections-step` (on the list), are only the fallback
  until the headings are measured. The boxes are `display: contents`, so a heading
  sticks within the whole list, not only its own box, and what a box carries reaches
  both its heading and its panel. Keep both if you restyle the accordion. The panels are
  `isolation: isolate`, so layered content (a map's controls) stays under the headings.
  The stacks stick where the headings rest: `--clover-sections-inset-start` above and
  `-end` below. The information panel sets both to `--clover-inset` less `s`, since its
  boxes reach `s` out over its padding, so a heading's text stays on the inset. A
  closable panel starts below its close control. The first heading's `::before` and the
  last's `::after` paint that padding, so nothing shows between a stuck heading and the
  edge. Each heading carries the boxes' `2xs` as its own bottom padding (the list has no
  `gap`, and an open panel a `2xs` margin), so stuck headings touch and none shifts as
  it comes unstuck. Not a border or a shadow: a border's width snaps to device pixels
  and left a hairline, and a shadow outside the box was sometimes dropped while
  scrolling. The shadows under the open heading (once scrolled) and over the next one
  (while more is below) are the buttons' `::after` / `::before`, as scroll-driven
  animations on the nearest scroller (`animation-timeline: scroll()`, inside
  `@supports`), so they cost no script; keep them that way. `Items`' carousel casts the
  same shadows at its ends from the frame's `::before` / `::after`, reading the
  viewport's scroll through a named timeline (`--clover-items-track`, `timeline-scope`
  on the frame); its arrows sit above them (`z-index: 2`). Both use
  `@keyframes clover-shade`.
- Chromium scrolls a focused element into view only when it is outside the scrollport,
  whatever covers it. So `keepInSight` (the list's `onFocus`) moves the scroller to
  bring focus out between the stacks (WCAG 2.4.11). It is not redundant with the scroll
  margin; do not remove it. It skips focus that is not `:focus-visible`, so a press (a
  map's drag) never scrolls the pane under the pointer.
- The observer also watches the scrolling container. `scrollerOf` finds the nearest
  ancestor with `overflow` auto, scroll or hidden, whether or not it overflows yet;
  failing that, the page, measured on the window's `resize`. Where the insets and stacks
  leave the open box less than two lines of its text, the observer sets
  `data-stacks="off"` on the list: the headings go
  `position: relative; inset-block: auto` and the content's scroll margin drops to 0, as
  under `@media (max-height: 32rem)`, which stays the rule for short windows and before
  anything is measured. Without it, WebKit squeezes the stacks over the open section in
  a pane too short for them, and Chromium and Firefox drop the bottom stack. The insets
  are read from the first heading's computed `top` and the last's `bottom` while they
  stick, and cached. The container is found again only outside the observer's callback
  (at mount and on `resize`): observing an ancestor from inside the callback raises
  ResizeObserver's loop error. `e2e/specs/sections.spec.ts` (`?scene=panel`) checks all
  of this in every engine.

## Popovers (`ui/Tip.tsx`)

- Every control that shows an icon alone renders `<Tip label shortcut />` last inside it:
  its name, the same string as its `aria-label` (never different words), and its key. Do
  not give a control `title`, or an icon an SVG `<title>`: both make a second, native
  tooltip. DESIGN.md §7 has the rule and the WCAG reasons.
- A key goes in `SHORTCUTS` (with `aria-keyshortcuts`' spelling and the glyph shown) only
  once the Canvas handles it, and in `SHORTCUT_KEYS` so `forwardShortcut` sends it from
  the Canvas's controls to the viewport. A new key the viewport does not handle would make
  a popover lie.
- Placement is by family in `ui/Tip.css`. A new row of controls that sits at the top of a
  stage, or at a row's end, needs its selector there.
- Placement listens once per document, in capture, beside Escape's listener (`useTips`):
  `pointerenter` and `focus` on a control measure its child `.clover-tip` against its
  clipping ancestors and write `--clover-tip-room` / `--clover-tip-shift` inline. A
  Tip's own effect measures again only when its words change while it shows.
- A dismissed Tip (`data-tip-hidden`) takes no pointer. It comes back on its control's
  next `pointerenter`, or on blur, never on `pointerleave`: hidden from under a resting
  pointer, it causes that leave itself, so restoring on leave would bring it straight
  back (Firefox, WebKit).
- The viewport lists its own keys too, in `aria-keyshortcuts` and in words in its
  description: `CAMERA_KEYS` and `MEDIA_KEYS` in `CanvasView.tsx`, with the strings
  `canvasKeysImage` and `canvasKeysMedia`. When the viewport starts or stops handling a
  key, change both. The arrows stay out of `SHORTCUT_KEYS`, because controls use them.

## Split

- `Clover.Split`, `SplitPane`, `SplitHandle` (`components/Split/`): one sized pane beside
  each handle (`size`, `min`, `max`), the other takes the rest. Sizes are border boxes
  (`box-sizing: border-box`), as a drag measures them. The handle finds its panes by DOM
  siblings with the `clover-split-pane` class, so anything else in the Split (a scrim) is
  skipped.
- A handle's limits come from the two panes beside it only. Its widest is what they
  share, less the other pane's `min`, never the Split's whole width. Otherwise, with
  three panes, flex squeezes the third pane, the pane never reaches its stop, and
  `aria-valuemax` is wrong.
- The look: a faint 3px bar (the muted secondary mixed toward transparent, with no
  `opacity`, which would fade the grip too), and at its middle a grip in
  `--clover-color-primary-muted`, `xl` long and 1px wider than the bar on each side (Mat:
  flush with the bar, it read as part of the line). The grip, not the bar, identifies the
  control, so it must keep 3:1 beside both panes (WCAG 1.4.11): don't remove it, fade it
  or lighten it. The grab area is `::before`, `l` wide; Document puts it on the page's
  side, off the thumbnails' scrollbar. Forced colors: `CanvasText`, `Highlight` while
  active, and a 2px outline on focus.
- A click or tap steps the sized pane min → own `size` → max and round (WCAG 2.5.7). A
  press turns into a drag only past 4px (8px for touch). A step starts from the size the
  pane was given (stored, or its own), not its measured width, which flex may squeeze
  below it; measuring stalled the cycle. Reaching its own size clears the stored size.
- After a pointer's step, presses outside the bar within 4 slops of where it was are
  swallowed for 500ms, or until the pointer moves away (`holdOff`: window, capture
  phase, pointer, mouse, click and dblclick events). This keeps the second click of a
  double click from pressing what the step uncovered.
- The Tip (inside the handle, last) carries the name, from `splitHandle` or the handle's
  `aria-label`. Presses on it are ignored (`onTip`), and it has `cursor: default`
  (`ui/Tip.css`).
- A template that snaps a split pane to an overlay keeps one tree (the Split stays, the
  pane is positioned over by CSS), so crossing the snap point never remounts the Canvas.
  `templates/shared/useSlide.ts` holds `useSlide`, `useFocusOnOpen` and `useWideEnough`
  (a layout's own width, not the window's).

## Templates

- `src/templates/<name>/` holds a ready-made layout: `<Name>.tsx`, `<Name>.css` and a
  `README.md` (the docs page imports the README, so it is the documentation). Templates
  are a second entry, `@nulib/clover/templates`, in the same module graph, with their
  own stylesheet, `@nulib/clover/templates.css` (`src/templates/templates.css`).
- **The Viewer** (`components/Viewer/Viewer.tsx`) is a shell (under 1 kB) that only
  picks a template: `template`, or `Default`, loaded with `React.lazy` when none is
  given. It is the default export and `Clover.Viewer`. Never import `Default` (or any
  template or part) statically into it: a bundler cannot tell whether a page passes
  `template`, so every page would ship `Default` and all its parts (Mat: the Viewer shell
  is the lightweight part). `consumer.test.mjs` checks that only the shell loads up
  front. The cost of `<Viewer />` with no template is one request before the Manifest
  loads and nothing drawn on the server; `template={Default}` avoids both, and
  `<clover-viewer>` passes it. A template is passed as a
  component, never named by a string. A named import that is never used is deleted by
  TypeScript, SWC and Babel, so registering templates on import would silently fail, and
  a string cannot type the template's props. `ViewerProps<T>` takes its props from the
  template, so `template={Document}` types `defaultSidebarOpen`.
- `Default`'s CSS is in `styles.css` (`src/styles/clover.css`), not `templates.css`, so
  `<Viewer />` needs one stylesheet. The templates entry exports it with the others.
- A template imports only `react`, `../../parts` (every public part: `src/index.ts` is
  `parts` plus the Viewer) and `../shared/…`. `templates.test.tsx` enforces it, so any
  template can be copied into an app with `../../parts` read as `@nulib/clover`. They
  import `parts`, not `index`: the index reaches `Default` through the Viewer, so
  importing it back would be a cycle. If a template needs something, export it from `parts` first.
- Classes are `clover-template-<name>-*`.
- Current set: `Default` (3.x Viewer layout, the Viewer's own; `items` picks its
  thumbnails), `Document` (a PDF viewer: thumbnails left,
  the pages down one scrolling column, the panel sliding out right), `Gallery` (grid and lightbox).
  A `Text` template (3.x's Scroll: an article per Canvas, its text by language) was
  removed for now, to settle these three first; it is in the history.
- `Document`'s stage is `document/Sheets.tsx` (Mat, 2026-10-16: less friction, a flow
  like Preview's continuous PDF view; it replaced `usePaging`, a page per wheel gesture).
  Every view is a sheet down one natively scrolling column, a still of its pictures
  (`stillSource`, the painted image at about 1600px, not the small `thumbnail`), each at
  most the stage less `2 × --clover-inset` tall, so the next one's picture shows under
  the one at rest. No CSS snap: the top of the stage is the one place a sheet is active
  (Mat, 2026-10-16), and `Sheets` decides where the scroll rests (`SETTLE_MS`, 200, quiet;
  never while a finger or the scrollbar holds it): past `THRESHOLD` (a quarter of the
  way to the next place, from where it last rested) the next sheet, short of it the
  active one, the previous going up, and brings it to the top. A press on a muted sheet,
  a thumbnail, PageUp/PageDown or a link bring theirs; a reader's own wheel, touch or
  scrollbar press lets a scroll of ours go. Sheets not active are muted (`opacity`; Mat
  may try golden-ratio sizing). The one live `Content` (`Sheets` renders it, the
  template's controls as its children) sits on the active sheet, exactly over its still
  (the Canvas's home fit, the same inset), moved there by `top`, never remounted (Mat: a
  turn simply swaps the content). It and its controls stay hidden (`data-moved`,
  `data-scrolling`; controls through `--clover-chrome-shown`) until the sheet is in
  place and the Canvas has drawn it (`data-status` not `loading`, or its placeholder,
  or `REVEAL_MS`), unless focus is in it. Zoomed, moved or turned (the handle's
  `atHome`, which a resize keeps, so growing never reads as zooming out), the active
  sheet fills the stage (`data-zoomed`), the others dissolve, and the Canvas takes every
  drag; another view or home puts it back. A resize keeps the active sheet at the top
  (`pin`). It relies on the Canvas leaving a plain wheel alone (`scrollToZoom: false`),
  so the wheel scrolls the column; at home a finger does too (`touch-action: pan-y`).
  The toolbar is the `Label` and Download. No pager, no `CollectionSelect` (Mat: the
  panel's Collection section does that). The page thumbnails' toggle is a pill drawn as
  the round controls are, open or shut (control fill, control glyph, accent on hover and
  focus; Mat, 2026-10-16: no light state while open), holding a glyph of a list of
  thumbnails (its pictures filled while open) and `Position` (`text-xs`, keeping no room
  for its widest: nothing sits after the toggle), no thumbnail. Its name starts with its
  Tip's words ("Show Items"), then the place. Open, it sits on the thumbnails' spine
  (below), over them but for its far rounded end, which hangs over the page (Mat: the
  bar where that end's curve begins; its start's, the other way round, was tried
  first), so the thumbnails keep their pane's whole height; shut, it sits
  over the page's top left, `--clover-inset` in, level with the Canvas's controls.
  `e2e/specs/document.spec.ts` checks every move with `settled()`, and where the toggle
  sits. The panel slides with `useSlide` (`hidden` once out of sight, so it reads
  plainly without CSS).
- **Toggles on the spine** (Mat, 2026-10-16). While a pane is open beside the page, its
  toggle sits on the bar between them (`shared/useSpine.ts`): `Default`'s and
  `Document`'s `PanelToggle`, centered on the panel's bar, and `Document`'s thumbnails'
  toggle, `cap` (over the thumbnails but for its far rounded end). It is rendered in the
  `Split` right after the `SplitHandle` (not in the handle, whose `separator` role makes
  its contents presentational; not in a pane, which clips or scrolls it), placed by
  `left` and `--clover-template-spine-top`, level with the Canvas's controls. Where the
  bar is hidden (`Document`'s thumbnails floating over a phone's page), it sits on the
  pane's inner edge, and `useDragToClose`'s `alongside` drags it with the pane. Shut, or
  over the page, the toggle is back among the Canvas's controls (the panel's) or over
  the page's top left (the thumbnails'). Each press moves it, so focus follows with
  `shared/useFollowFocus.ts`, frame by frame rather than after a render: React 19 can
  run a stale effect before committing the move (an effect-based version lost focus
  one time in five there), and a Canvas draws its controls a frame later. It focuses the
  control only once focus has gone (on `body`, or in something `hidden`), never taking
  it from somewhere the reader put it.
- **Closing the information panel** is `Panel`'s job, not a template's. Only
  a panel floating over the page gets `onClose` (a close button, and focus handed back to
  the `aria-controls` control) and `closeOnEscape`, which also puts the button at the
  panel's inner edge (`data-floating`: the start, for a panel over the end of the page).
  A docked panel (`Default`'s, beside the stage) gets no `onClose`: its toggle closes it
  (Mat). A floating one (`Default` on a phone, `Document`) also takes focus when it
  opens. Any new layout with a panel does the same. `shared/Lightbox.tsx` is a native `<dialog>`; jsdom lacks
  `showModal()`, so tests polyfill it.

## Build and test

- `npm run build -w @nulib/clover` builds `dist/` (Vite with three entries: the parts,
  `templates/index` and `map/index`; then `build/styles.mjs` for `styles.css` and
  `templates.css`, then `dts-bundle-generator` for each entry's `.d.mts`). The root `npm run build` runs it.
- `npm run test -w @nulib/clover`, or the root `npm test`, which runs both Vitest
  projects (`vitest.workspace.mjs`).
- `npm run test:build -w @nulib/clover` checks the built package, so build first.
  `build/bundle.test.mjs` checks the emitted graph (three entries, only package source,
  externals within dependencies and peers, a forbidden list, lazy modules) and the size a
  consumer ships against `build/size-budget.json`. Raise a budget only on purpose, and
  say so in the changelog.
- After the budgets, the test prints what each `<Viewer template={X} />` page is made
  of: the Viewer shell, the parts the template uses, and the template's own code. The
  total is exact; gzip does not add up module by module, so it is split by each group's
  share of the minified code. Do not derive these by subtracting separate builds: Rollup
  chunks each build differently, enough to make a difference negative.
- The sizes are measured as a Vite app builds for production (`build/consumer-bundle.mjs`:
  Rollup, minified, React external), not with esbuild. Through the package entry,
  esbuild's code splitting counts a module as reachable by its re-export alone, even
  once tree shaking drops it, so any lazy chunk (the Viewer's `Default`) drags the
  modules it shares up front. Measured that way, every import from `@nulib/clover`,
  even a lone `Canvas`, is the whole Default template (62 kB). Rollup and webpack (Next)
  split by what is used. It is a real cost for apps bundled with esbuild, not only a
  measuring artifact.
- The docs import `@nulib/clover`, `@nulib/clover/templates`, `@nulib/clover/map` and the
  stylesheets, which the root `tsconfig.json` maps to this package's source. Its pages are `content/docs/*` (3.x's in `content/docs/3.x/`), its demos in
  `docs/components/Clover4/`, and the homepage shows it (`docs/components/Home/`).

### End to end (`e2e/`)

- `npm run e2e -w @nulib/clover` runs Playwright (`e2e/playwright.config.ts`) over a Vite
  harness of the package's source (`e2e/app`, port 4321). The projects are chromium,
  webkit, firefox, `iphone` (WebKit at iPhone 15 size, with touch), `android` (Chromium
  as Chrome on a Pixel 7: its size, density, touch and user agent), `react19` and
  `timing`.
  `timing` runs the timed specs (`TIMED` in the config) in Chromium once every other project
  has finished, alone: run alongside four other browsers they measured the machine.
  `react19` runs Chromium against a second server on port 4322. That server aliases React
  to `e2e/react19/node_modules`, which is its own install, so run `npm ci` there once.
  Since the docs moved to Next 16 the root's React is 19 too, so the unit tests and the
  main e2e projects run on 19 and nothing runs on React 18, which the package still
  supports; pointing the second harness at React 18 would test it again.
- The harness picks a scene by query:
  `?scene=viewer|items|document|gallery|composed|map|panel` (`document` and `gallery` are
  the Viewer with that template; `map` is a Root's Map on the style its spec routes;
  `panel` is an accordion `Panel` of a site's own long-named Tabs, full of
  links, in a 15rem × 24rem scrolling pane), `&content=`, `&css=0` (no stylesheet, the
  plain layout), `&headers=1` (request settings), `&panel=tabs|accordion` and `&lng=`
  (a host's `initCloverI18n({ lng })`, set before anything renders). `composed`
  puts the viewport channel on `window.__viewport`, for gesture specs, and takes
  `&navigator=1` and `&presentation=texture`.
- `specs/fixtures.ts` serves everything from disk, so nothing reaches the network:
  - Cookbook fixtures as `https://fixtures.test/<name>.json`, with the request's Origin
    echoed so credentials work.
  - `generated/<n>.json`, a Manifest of n Canvases.
  - Every image service as a tiled 4096 px level 0 service. A smaller one would cap zoom
    at the fit, and gesture specs would see nothing move.
  - Every image and tile as one small PNG.
- Engine differences are skipped with a reason, never loosened:
  - WebKit blocks third-party cookies.
  - Firefox's Tab at the end of a page leaves the page.
  - Synthetic touch pointers cannot be captured, so the pinch spec stubs
    `setPointerCapture`.
  - Timings are checked in Chromium only.
  - On macOS every engine opens a select's own list on an arrow key, which the page does
    not see, so `collection.spec.ts`'s arrow-key specs run on Linux and Windows only.
- `specs/transport.spec.ts` (Chromium only) checks the transport's reflow at 320px and on
  640 × 360, 320 × 256 and 320 × 180 stages: the end controls stay together, and the
  menus, the frames menu, the information box and the captions stay on the stage. It
  also checks the on-state mark and the sliders in forced colors, and the tracks a real
  video adds.
- `specs/hotspots.spec.ts` serves its own Manifest of hotspots: nested, under the
  cluster's second control, near the edges. A dismissed popover only fades, so check it
  with the spec's `seen()`, not `toBeHidden()`.
- `specs/language.spec.ts` runs a French browser (`locale: "fr-FR"`) on the harness's
  English page, Chromium only, and reads names from Chromium's own accessibility tree
  (CDP `Accessibility.getFullAXTree`). With `&lng=fr` Clover speaks French there and
  marks it; without, it speaks the page's English and marks nothing.
- The Viewer's information panel starts closed on a phone (the `iphone` and `android`
  projects): call `openPanel(page, isMobile)` (`specs/fixtures.ts`) before choosing a
  tab or section.
- A phone's screen is dense (3× on the iPhone, 2.625× on the Pixel), so a spec that reads
  a screenshot's pixels takes it with `scale: "css"`, or its pixel counts mean less.
- Playwright's WebKit is the desktop engine, and `android` is desktop Chromium emulating
  a phone. iPhone-only behavior (full screen for a video alone, native HLS) is covered by
  unit tests, not by the `iphone` project; Chrome on Android's own (picture in picture,
  TalkBack) needs a device or the Android emulator.
- On a device or the iOS Simulator, Safari loads the harness at `localhost:4321` with a real
  Manifest URL in `&content=`. `&debug=1` adds a fixed readout of the video element, the
  chrome and the pointer events that reached the page, because there is no console to
  read. The page mutes every `play()`. In the Simulator, drive the page with real touches
  (`touch_path`, `touch2_path`): the plain `tap` sends a click but no pointer events, so
  the chrome never shows.
- An open disclosure in the Canvas holds its chrome on screen (`:has([aria-expanded="true"])`),
  except the panel toggle (`data-button="panel"`), whose panel sits beside the Canvas. Exclude
  any new toggle whose target is outside the Canvas in the same way.
- `src/ssr.test.tsx` runs in Vitest's node environment (`renderToString`).
  `setupTests.ts` skips its DOM stand-ins when there is no `window`. It also gives jsdom a
  desktop's `document.fullscreenEnabled`, which tests of iPhone behavior turn off, and
  sets `<html lang="en">` before each test, as a page declares its language. A test of
  another page language sets its own.

## Data and state

- **One shape: Presentation 4.** `core/load.ts` fetches `iiifContent` once (with the
  request settings) and `core/presentation.ts` upgrades it with
  `upgradeToPresentation4()`. Every part and `Canvas` read P4 only (`placeholderContainer`,
  `accompanyingContainer`, `Timeline` for sound, `motivation` arrays, `{ id, type }`
  targets). Never add a P2/P3 branch to a part; upgrade at the boundary instead. Scenes
  are skipped by `selectSequence` until the `Scene` component exists.
- `createClover()` (`core/clover.ts`) is one Root's state: a small store (`core/store.ts`)
  holding only `status`, `error`, `manifest`, `collection`, `canvasId` and `target`.
  Per-frame and per-tick values (viewport, media element) go through channels, never the
  store; a test asserts that 60 viewport events write nothing.
- Selectors (`core/selectors.ts`) are memoized on the Manifest object. Never mutate the
  Manifest: `core/pages.ts` embeds a referenced annotation page by copying only the path
  to it. A selector must return the same object for the same input (an empty result is a
  shared constant), or `useSyncExternalStore` loops.
- `target` is a pending deep link (content state, `start`, auto-advance). The connected
  Canvas applies it once the Canvas is laid out (`fitCanvasRect` returns false until then)
  and consumes it. The view it opened keeps its placeholder away afterwards.
- Content state is decoded by Clover (`core/content-state.ts`), not `@iiif/helpers`
  (14 kB). `groupViews` must match `@iiif/helpers`' `getManifestSequence`;
  `core/sequence.parity.test.ts` checks that with a Vault used only in the test (the
  Vault normalizes in place, so it gets its own copy).
- Parts take `as`, `className` and rest props, render nothing when they have nothing to
  show, and throw a message naming themselves outside a `Root`.
- **Heading levels.** Every part or template that renders a heading takes
  `headingLevel?: 2|3|4|5|6` and never hard-codes `h2` or `h3` (WCAG 1.3.1). It hands
  `Math.min(level + 1, 6)` to the parts inside it: the Panel, Download, the
  Lightbox, About, and the Annotations' Markdown. When a layout drops its title, as
  `Default` does with `header={false}`, it hands its own level to whatever takes the
  title's place, not the level below.
- **Live regions stay mounted** and change only their words (WCAG 4.1.3). `Status`
  keeps its `role="status"` `<p>` for its whole life, empty and visually hidden once
  ready, with the `role="alert"` box beside it on failure. Search's status is visually
  hidden while empty, never `display: none`. Many screen readers do not announce a
  region inserted with its message already inside it.
- `Content` imports the connected Canvas (`Canvas/Connected.tsx`) directly. `Canvas`
  loads it lazily, so a standalone Canvas does not carry it.
- **Measuring size.** `initialGzip` starts from the output whose `entryPoint` is the stdin
  `sourcefile` (`entry.mjs`), never "the first output with an entryPoint": esbuild marks
  every lazy chunk an entry point too, and which comes first depends on the graph.
- `build/bundle.test.mjs` bundles through the barrel with esbuild,
  the conservative case: esbuild hoists modules shared by a lazy chunk and anything the
  barrel reaches (`selectors`, `hooks`, `core/value`) into the initial chunk, about 1.1 kB
  for a standalone Canvas (32.7 kB imported directly, 33.8 through the barrel). Rollup
  (Vite) splits it correctly; its library-mode numbers look larger only because Vite
  does not strip whitespace from ES library output.
- **Annotations.** `core/annotation-sets.ts` reads the Manifest's non-painting pages
  (and `addedSets`, from `core/annotation-collection.ts`) into sets of entries, memoized
  on the Manifest. The store holds `annotationId`, `hiddenSets` and `addedSets`; hover is
  the `highlight` channel. Selection is controlled on the Canvas (`selectedAnnotation`),
  which frames a new id once its hotspot is placed. Presentation 4 groups several bodies
  in `Independents`/`Composite`/`List`; read bodies through `bodiesOf()`.
  - The `Panel` lists every annotation (`Annotations scope="all"`, Mat
    2026-10-19): `AnnotationLayers`, by layer (`layersOf`: sets sharing a localized label
    are one layer, the unlabeled ones another) and then by Canvas, in sequence order;
    a Manifest of one Canvas gets no Canvas labels or `aria-current` (`grouped`), which
    would only repeat the item and push a note's headings a level deeper.
    The Canvases in view are `aria-current`; on a move the list scrolls their group to
    its start, and a picked entry to nearest, within its own scroller (`scrollerOf`,
    never the page), skipped while the pointer is over it or focus in it.
  - Each entry shows its region (`regionSource` in `core/region.ts`, Mat 2026-10-19, as
    3.x drew one). It is its own module, apart from `core/thumbnail.ts`, which every page
    loads for its strip: in there, its import of `parseAnnotationTarget` put about
    0.23 kB on every template's first load. The painted image's level 1/2 service cuts it and sizes it to
    `!52,52` (twice the `l` square it is shown at). Never a level 0 or service-less
    image, which would mean fetching a large one: those get none. Intersect the region
    with the painted image's bounds; never clamp its corner.
  - It needs every Canvas's pages, so it calls `clover.holdAllAnnotationPages()`, which
    returns its release. Do not call `setAnnotationPages("all")` from a part: the Root's
    own effect resets the scope after a child's effect runs.
  - The Canvas's annotations menu, its hotspots and the panel share `annotationId` and
    `hiddenSets` through the store, as the captions' language goes through
    `clover.captions`: nothing of the choice is local to any of them.
  - Hiding a set hides only what the Canvas draws (Mat, 2026-10-20). `Connected` hands
    the Canvas every set's annotations with `pageId`, and the store's `hiddenSets` as
    `hiddenPages`; `CanvasView` filters what it draws and keeps the menu's list whole,
    each page after its `HideToggle` (`ui/HideToggle.tsx`: an eye, a checkbox checked
    while hidden, its Tip "Hide", its name "Hide" and the page's label through
    `aria-labelledby`), as the panel's set headers have it. A menu group with a legend is
    named by `aria-labelledby` on its label alone: from its legend's content its name
    would take in the toggle's. A pick of a hidden page's annotation still frames it or
    goes to it. `ControlMenu` focuses a checked radio on opening, never the checked eye.
- **Hotspot look.** Active (picked, hovered, focused), a rectangle keeps its edges and
  covers nothing it marks; the picture round it dims (`0 0 38vw 38vw #0002`, lighter than
  3.x's `#0003`). The 18% accent tint inside it, and inside a shape, was dropped at
  Mat's request, 2026-10-19: it washed out what the annotation points to. Hotspots beneath the
  active one (`depthOf` below its own) that meet it carry `--clover-annotation-mask`
  (`maskUnder`, Mat 2026-10-19): an SVG drawn in their own world box (a tenth spare each
  side, for a shape's stroke past it) less the active one's rectangle or shape, so it
  holds through zoom and rotation (the overlay layer sizes each box to its world rect and
  rotates it about its center). The layer sets it on each element (`remask`), never in
  the rendered `style`: where both stand still, once per change of active; where either
  follows a recording, again on each frame either moves (`moved`, from `useFollow`), from
  where each is then, and not at all under an active one off the recording. A mask is
  written only when it changes. Those over the active one are never masked: a masked
  hotspot on top would be an unseen target. A point masks nothing; its marker is opaque.
  The active one always wins over a tracked one (Mat, 2026-10-19): none is raised over
  it, and a tracked one is never raised over the active.
- **Letting go of a pick** (Mat, 2026-10-19). A tap or click on the stage off every
  hotspot first asks the renderer's `dismiss()` (`setDismiss`, set by `CanvasView` to
  `releaseAnnotation`); if there was a pick it is let go and the tap does nothing more
  (no zoom, no `tap` event). Escape in the figure does the same (WCAG 2.1.1), after the
  caption and any open menu, and is `preventDefault`ed, so hosts' Escape handlers must
  check `defaultPrevented` (the docs' demo panel does). `onAnnotationSelect(null)` reports
  it. The picked hotspot's Tip shows while it is `data-active` and `aria-current`
  (`ui/Tip.css`), so hovering or focusing another takes the name over and it never
  covers a hotspot in focus (2.4.11). Renderer stubs in tests list `setDismiss`.
- **Picks from outside open the Canvas** (Mat, 2026-10-19). `CanvasView` holds a new
  `selectedAnnotation` as pending until it is among its `annotations` (so after a move to
  its Canvas), then opens the placeholder: images through `imagesOpen`, a recording
  through `mediaOpenedFor` with `quietlyOpened` keeping it from autoplaying. A pick that
  persists across moves does not reopen a placeholder; only a new pick does.
- **Framing a pick** (Mat, 2026-10-19). `CanvasView` places hotspots, and frames a pick,
  only once the Canvases it is handed are the drawn ones (`drawn`: `drawnScene.key ===
canvasKey`, set by `markDrawn` on `open`/`change`). Placement uses the planned scene's
  layout, so before this a move's new hotspots lay over the last view and the camera
  glided in the wrong scene, then jumped at the swap. Framing is a cut
  (`fitAnnotation(world, true)`) unless `animateAnnotations`. A content state with a
  note drops its region from the target, so the pick does the one framing.
- **The upgrader and fragments.** `@iiif/parser`'s upgrader turns an object target with a
  fragment in its id into a path (`…/canvas/1/xywh=…`); `toPresentation4` runs
  `keepFragments` (lazy, with the upgrader) first, rewriting it as a SpecificResource.
  Never upgrade a page that came out of an upgraded resource again: nested pages carry
  no `@context`, so `upgradePage` would take them for Presentation 3 (`LoadedCanvas`
  reads embedded pages with `readPage` for that reason).
- **The `i`, the annotations control and a paused Play never fade** (Mat, 2026-10-19),
  as the panel toggle and a placeholder's toggle do (`[data-button="information"]`,
  `[data-button="annotations"]`, and a transport bar's `[data-button="play"]`, in
  `Canvas.css`), over a picture or a recording; playing, its Pause fades with the rest
  (Mat: only while paused). For Play, the transport fades by its parts (its
  `::before` scrim, which carries every scrim, sound's too; its seek area; each of its
  bar's children), never its box, so the one child can stay. A large paused play button
  in the middle, shown while the chrome was away, was tried and removed (Mat: it came
  and went). Captions tell their state
  by the glyph, outlined or filled (`CaptionsIcon` `on`), not the transport's bar.
- **What an annotation leads to, carries and covers** (Mat, 2026-10-19; Cookbook 0022,
  0377, 0266, 0019, 0103). Each in the lazy chunks, not a Canvas's first:
  - A `linking` annotation's target is read by `readLink` (`core/link.ts`, apart from
    `core/annotations.ts`, which every Canvas loads): a Canvas (with its `partOf`
    Manifest), a Manifest, or an `http(s)` page, nothing else. Its hotspot follows it
    (`onFollow`, given only when `onAnnotationLink` is): a web page is an `<a>`, a Canvas
    or Manifest a button that first moves focus to the viewport, since the hotspot goes
    (WCAG 2.4.3). `Connected` and the list's "Open the link" use `showLink(clover, link)`;
    `LoadedCanvas` follows within what it loaded, keeping its `CanvasView` (with
    `manifestId="loading"`) while another Manifest loads, so focus stays.
  - An image body shows in the hotspot's `Tip` (`image`), lazy, re-placed on load.
  - A whole-Canvas annotation (no region, point, shape or time) goes to the caption
    (`wholeCanvasComments`, in the hotspot chunk, so the `i` it brings shows once that
    loads), rendered in `CaptionDetails` by `EntryBodies` (shared with the list, in
    `components/Annotations/EntryBodies.tsx`) over `readBodies` (`core/annotation-bodies.ts`,
    light, so the caption's chunk does not pull in the selectors). `readLink` is read
    where a link is used (the hotspots, the list's `FollowLink`), never in `readPage`,
    and `showLink` is apart in `core/show-link.ts`: either eager put 0.25 kB on the
    Viewer's first load.
  - A `#t=` annotation is a `TimedAnnotation` (`timeAnnotations`, in the hotspot chunk):
    `MediaStage` shows it among the caption cues while its stretch plays (a moment, three
    seconds), the menu lists it by its start, and a pick seeks (`sought`), never plays.
    Each cue carries its own `lang`, not the captions box. `CanvasAnnotation.pageLabel`
    (its AnnotationPage's) labels its cue and groups the menu.
  - An annotation whose targets each give a region and a time, `xywh=…&t=…` (Mat,
    2026-10-19: a person followed through a film), is a track: `PlacedAnnotation.track`,
    its keys in time order (`Canvas/track.ts`, lazy with the hotspots, as is
    `annotationTargets`, which reads every target; `parseAnnotationTarget`, which every
    Canvas loads, reads the first, through Presentation 4's `Independents`, `List` and
    `Composite`). Keys that meet in time glide (`boxAt`); a gap is time it is not there.
    Its hotspot follows the recording in `useFollow`: `requestVideoFrameCallback`'s
    `mediaTime` while a video plays (each display frame for sound), every seek while
    paused, moved by `renderer.overlays.move`, never a render, and `hidden` off its keys;
    one losing focus that way hands it to the viewport (WCAG 2.4.3). It is never framed; a
    pick goes to its start only when it is off the recording (`goToTrack`), from the menu
    or the list. The docs' `rudolf-hess-nuremberg` mock is one.
- **A Canvas as the content** (Mat, 2026-10-19). Shown on its own, never its `partOf`
  Manifest up front: `loneCanvas` (in `core/load.ts`) wraps it as a Manifest of one with
  the Canvas's id (`isLoneCanvas` tells it apart: its id is its one Canvas's) and the
  Canvas's descriptive properties (`DESCRIPTIVE`), `partOf` among them. About's "Part of"
  opens a `partOf` Manifest with `goToManifest(id, canvasId)`, then moves focus to its
  section's heading button (or About, `tabIndex={-1}`), since the button is gone
  (WCAG 2.4.3). A standalone `Canvas` takes `iiifContent` too: `LoadedCanvas.tsx`, lazy
  from `Canvas/index.tsx`, reads it with `loadContent`, as a `Root` does (a Manifest
  gives its first Canvas, a Collection its first Manifest's, a content state the Canvas
  it names), showing the loading bar until then and an alert (`clover-status`) with the
  reason if it fails or has no Canvas; never an empty box.
- **Annotations as the content** (Mat, 2026-10-19; 3.x did it). `loadContent` hands an
  AnnotationPage/AnnotationCollection (`ANNOTATIONS`) to `core/annotations-content.ts`,
  imported on demand (in `bundle.test.mjs` `LAZY_MODULES`), which reads it with
  `loadAnnotationSets` (a page's `next` followed too) and opens the Manifest of the first
  annotation whose target names one (`manifestOfAnnotation`: the Canvas's `partOf`), or
  the host's `manifestId` among them. `load` sets `stateSets` from the content (these, or
  a content state's note) once per content; `arrive` never resets them, so moves between
  the Manifests they name keep them. `selectAnnotation` on a Canvas not in the Manifest
  leaves the pick `pending` and opens its `partOf` Manifest through `show` (which picks
  it, at its Canvas), or, when the host holds the Manifest, calls `onManifestChange` and
  `show` picks it when the host's change arrives.
  The list's `useElsewhere` fetches the other Manifests (one promise per Root and id)
  only when the list shows, for names and thumbnails; `inOrder` keeps the annotations'
  order whenever any group is elsewhere.
- **A content state's note.** `resolveContentState` keeps an Annotation's `body` as
  `annotation` (its own id and target); `loadContent` returns it, and `arrive` makes it a
  set of its own (`${id}#content-state`, `source: "added"`) and picks it, when its
  Canvas is the one opened. The store's `addedSets` is `hostSets` then `stateSets`
  (closures in `createClover`), so `loadAnnotations` never drops the note. Its body is
  read by its declared `format`: Digital Collections' links write `<em>` in a
  `text/plain` body, which shows as written.
- **Sanitizer.** `core/sanitize.ts` runs on its own DOMPurify instance
  (`DOMPurify(window)`, made on first use). `dompurify` is external, so a host that
  imports it gets the same default instance. Never call `addHook` or `setConfig` on the
  default export: those leak into the host's own `sanitize` calls. `{ markdown: true }`
  adds only what `markdownToHtml` writes: `ul`, `ol` and `li`; `role="heading"` and
  `aria-level` 1–6 on `p`; and a numeric `start` on `ol`. The hook removes these
  anywhere else. IIIF HTML never gets them.
- **Text formats, strictly** (Mat, 2026-10-19). `readAs(format, value)` in
  `core/text.ts` decides: the media type before any `;`, case aside — `text/html` is
  HTML, `text/markdown` Markdown, anything else plain, shown as written. No format: IIIF's
  property-value rule, HTML only from a first `<` to a last `>` (whitespace trimmed).
  `Markup`, the Annotations list's names and the hotspots' names all use it; never test
  a format with a loose regex (`/html/` matched `application/xhtml+xml`). Plain text in
  `Markup` keeps its line breaks as `<br>` and never loads the sanitizer. The Markdown
  converter (`core/markdown.ts`, footnotes included, 1.7 kB gzip, loaded with the
  sanitizer) is Clover's own; no GFM library (Mat: package size).
- **Markdown.** `core/markdown.ts` escapes `& < > "` before it writes any markup, so no
  source text can close an attribute. Headings are `p[role=heading][aria-level]`, never
  `h1`–`h6`. Levels come from a stack (each heading goes one level under the nearest
  shallower heading before it), so none is skipped. Names built from a `text/markdown`
  body (an `aria-label`, a hotspot's Tip, a menu label) use `markdownToPlainText` from
  `core/text.ts`, which is small and synchronous. Never use `toPlainText` on raw
  Markdown.
- **Content state out.** `clover.getContentState()` builds it from the viewport channel
  (ignoring a region left over from the previous view) or the media time. `Root`'s
  `onContentStateChange` debounces on store, viewport and media events; there is no
  polling anywhere.
- **Media text.** `core/vtt.ts` parses WebVTT and caches each file's text (`loadVtt`),
  shared by the Canvas's caption tracks and `Transcript`; tests call `clearVttCache()`.
  A transcript as plain text (`canvasTextTranscripts` in `Canvas/layout.ts`: a Canvas's
  `text/plain` `rendering` or supplementing body, as in Cookbook recipes 0017 and 0253,
  a recording's or an image's, Mat 2026-10-19) is the Transcript's too, after the captions, untimed, in
  paragraphs (`loadText`, `paragraphsOf`). In the row it shows "TXT" after the caption files'
  language codes (Mat, 2026-10-19), "TXT EN" where there are several, and any code that
  would show twice shows its label instead. The docs' `transcripts` mock has both kinds. `decodeText` reads UTF-8, else Windows-1252 with its
  0x80–0x9F mapped by hand: Node's decoder reads that label as Latin-1. Only caption
  files take part in the captions' one choice (`clover.captions`).
  `Transcript` follows the media element from the `media` channel (`timeupdate`, `seeked`)
  in component state, never the store. Chapters come from `core/ranges.ts`.
- **Caption languages** (Mat, 2026-10-19). Several caption files are offered by their
  language codes first ("EN", "IT", `ui/languageCode.ts`), each named by its code and its
  file's label: in the Captions menu the label follows the code; in the Transcript the
  code alone shows, the label its `Tip` (a `<label>` around a radio can hold one), and
  the row sits beside the Transcript's heading in an accordion (`useSectionActions` in
  `ui/Sections.tsx`: a slot after the heading, held with it, its width kept clear in the
  heading's button), never a `<select>`, which got lost in the cues. Captions and the
  Transcript are one choice, both ways, through `clover.captions`: the Canvas's menu
  (`onCaptionChange`) sets it and the Transcript follows; the Transcript sets it and the
  Canvas shows that file (`caption`) while captions show. Off stays off: the Transcript
  never turns captions on. The transport's buttons take the accent only under the pointer
  or on focus, not when on or open: on is the bar under the glyph.
- **Upstream bug:** `@iiif/parser` 4.0.3's upgrader rewrites a Range item's Canvas id
  `…#t=0,30` as `…/t=0,30` (and `#xywh=` likewise). Read Range items through
  `rangeItemTarget()`, which restores the fragment. Drop it once the parser is fixed.
- **Items** (`components/Items/`) lists `core/items.ts` models, never resources: one item
  per view of a Manifest (a spread is one item), or one per Collection member. Inside a
  `Root` it is a listbox (`ui/useRovingFocus.ts`): its views' selection follows focus
  (`followFocus`, through `onMove`, a held arrow selecting where it stops), while
  `onSelect` stays a choice (Enter, a click), which the Gallery opens on. A Collection's
  members stay manual, since each selection loads a Manifest. Standalone it is a
  list of links (`core/load.ts` `fetchResource`, which does not open a Collection).
  Thumbnails come from `core/thumbnail.ts`: sized at once for level 1/2 services, through
  the renderer's cached `fetchInfo` for level 0.
  Items is the one part for a sequence and where the reader is in it (Mat, 2026-10-16: the
  Pager was to become an abstraction of Items). `layout="pager"` is the count, then
  `Previous` and `Next`, with no thumbnails, over whatever the source lists (views,
  members, a standalone list); each source builds its `Steps` (`stepsOf`) and hands them
  to `ItemsPager`. `Previous`, `Next` and `Position` are the same pieces read from the
  Root (`of`). They live in `Items/Pager.tsx`, which imports no thumbnails or `Items.tsx`,
  so a layout with a pager and no strip carries none of the strip. A step is a selection,
  as the carousel's arrows' are (`followFocus`, else `onActivate` for members). Position
  keeps its widest count's room (`.clover-pager-room`, `hidden` without the stylesheet),
  so nothing beside it moves. Its gap is the Canvas cluster's `s`, so a pager over a stage
  lines up with the controls; don't override it in a template.
  A step with nowhere to go shows disabled, never hidden (Mat, 2026-10-16): faded, taking
  no pointer, whole again while focused. One rule in `ui/Button.css` covers the pager's,
  the strip's and an animation's frames' steps; a new Previous or Next joins it.
  A carousel's or grid's title is clamped (`--clover-items-lines`, 3) on
  `.clover-items-label-text`. `Items/clamped.ts` watches every title with one
  ResizeObserver (and the page's styles and fonts, for text spacing), and a title cut short
  gets `data-clamped` and a hidden, `aria-hidden` copy, shown over the picture while its
  item is hovered or focused (WCAG 1.4.12; Mat chose it over unclamping, 2026-10-16). Its
  Escape hides the copy until the pointer returns or focus leaves (1.4.13). Keep the copy
  out of the item's name, and the item's box the same whether it shows or not.
- **Content Search.** `core/search-service.ts` finds the Manifest's service (type
  `SearchService1`/`2`, or a `search/N/` profile or context, as Presentation 2 has it;
  version 2 preferred). `core/search.ts` asks it (following `next`, at most 10 pages)
  and reads both versions into `SearchHit`s and one `AnnotationSet` (`source: "search"`,
  id `SEARCH_SET_ID`) whose annotations are rewritten as Presentation 4 highlighting
  annotations, so the Canvas reads one shape. The store's `search` holds query, status,
  hits and set; `arrive` resets it, and a result for another Manifest (compared by id:
  embedding a page replaces the Manifest object) is dropped. The Canvas draws
  `selectDrawnSets` (annotations plus the search set); the Annotations list does not.
  `clover-search*` classes are 3.x's, so the part's are `clover-content-search*`. The
  client (`core/search.ts`) loads with the first search (`clover.search`), and the
  panel's Search section when first opened.
- **Map** (`@nulib/clover/map`, `src/map/index.ts`, a third entry). Keep MapLibre small:
  - `maplibre-gl` is a dependency (Mat: the Viewer shows the map by itself, no prop, so
    the default path must resolve it), imported only inside the Map's mount effect.
    `bundle.test.mjs` asserts no entry imports it statically and that the parts reach the
    map only lazily; `@allmaps/*` is on the forbidden list (422 kB gzip). The size table
    has "Map, before MapLibre" and "MapLibre, on a map" (MapLibre's chunks only).
  - The panel offers the tab when `core/geo-detect.ts` `hasMapData` (a look, not a read)
    finds navPlace or a georeference, and lazy-loads `RootMap` from
    `components/Map/MapView.tsx`. That module must never import `Root` (the standalone
    `iiifContent` wrapper is `Map.tsx`, map entry only): a lazy chunk importing `Root`
    made esbuild hoist `Root` and the core into a standalone Canvas (35.6 → 43.7 kB). It
    shares as little as it can with the parts: it builds its overlay URL itself
    (`overlayImageUrl`), not through `core/thumbnail`. What remains is esbuild's chunk
    overhead, about 0.7 kB on a Canvas.
  - The worker URL is global, as MapLibre's is: `setMapWorkerUrl` (`core/map-config.ts`),
    exported from both entries; a standalone `Map` also takes `workerUrl`.
  - `core/geo.ts` reads navPlace (Collection, Manifest, Canvas, annotation `navPlace`,
    GeoJSON annotation bodies) into flat features (`title`, `canvasId`, simplestyle keys;
    MapLibre stringifies nested properties), and georeferencing annotations into
    `Georeference`s, memoized on the Manifest.
  - Georeferences are drawn the basic way, with no Allmaps: the least-squares affine fit
    of the control points in Web Mercator (exact for three) maps the image's corners, and
    the image (about 2048 px via `core/thumbnail` `imageSource`, clipped to the
    SvgSelector mask on a 2D canvas) is a MapLibre `canvas` source under the places.
    Needs CORS on the image. No TPS, no tiled overlay: document, don't add.
  - Inside a Root the Map overlays the view's Canvases only (memoized, or the map is
    re-framed under the reader on every render); standalone `iiifContent` wraps a Root
    with `annotationPages="all"`. Pressing a feature with a `canvasId` goes there.
  - Under the map, `ul.clover-geomap-places` lists each feature and each overlay drawn,
    as buttons that do what a click on the map does (frame, popup with the title's
    `lang`, `onSelect`, `goTo`). It is the map's text alternative and the keyboard's way
    to its places (WCAG 2.1.1, 1.1.1). Only scope "view" (a host's Root) passes
    `current`: a standalone `iiifContent` map has no view, so it marks no place current.
  - MapLibre's canvas is the map's one region, named `mapLabel`. Its `aria-describedby`
    points to a `hidden` count (`mapPlacesListed`), never to the list itself, which would
    read every name run together. `RootMap` passes `landmark={false}`, which makes the
    canvas `role="group"`, because the panel's accordion section is already a region
    named "Map". The canvas's role, name and MapLibre's control labels are set again
    whenever `t` changes.
  - `.clover-geomap` is a grid wrapper: the map's sized box is its first child `div`,
    and `style`/`className` land on the wrapper. Size the map with
    `--clover-map-height`, never `height`.
  - No bundled worker (3.x's is ~500 kB): the host serves it if its bundler moves
    MapLibre's files. The docs build a blob from the worker
    `scripts/build-maplibre-worker.mjs` bundles into `docs/lib/` and call
    `setMapWorkerUrl`. MapLibre's CSS is the host's import too.
  - Wheel zoom off by default; default basemap as 3.x (Liberty, roads removed,
    hillshade); classes `clover-geomap*` (3.x has `clover-map*`); layer ids `geomap-*`.
  - Tests mock `maplibre-gl` (`components/Map/Map.test.tsx`): the module has no
    `default`, so the Map reads `"Map" in module`.
- **Collections.** The store's `collection` is the Collection the shown Manifest was
  reached through; `core/load.ts` `withMembers()` fills a paged Collection's `items` from
  `first`/`next`. `clover.goToManifest(id)` shows a member (fetched by `loadManifest`), or
  `load`s a nested Collection, which then replaces `collection` (there is no way back up
  yet). With a controlled `manifestId` it only asks (`onManifestChange`), and `Root`
  hands the id back through `syncManifest`, as `canvasId` does with `syncCanvas`.
  `isShown()` treats the Collection just entered as shown, so a host naming it does not
  reload it in a loop. `CollectionSelect` commits a keyboard step only on Enter. Escape
  and blur take the step back, because a Manifest loaded after focus has moved on could
  remove the control focus went to (2.4.3). A choice from the native list commits at
  once; it is told apart from a step by the time since the last stepping key
  (`STEP_TIME`, 100 ms). After a failed load, or a host that ignores
  `onManifestChange`, the guard against asking twice clears, so Enter asks again.
- **Native scroll track** (`ui/useScrollTrack.ts`): CSS scroll snap plus paging, resting a
  slide at an alignment, and mouse dragging that swallows the click ending it. Positions
  come from bounding rectangles and `scrollBy`, so right-to-left needs no special case.
  No carousel library (Embla is on the forbidden list). 3.x's `useTrack` is a copy.
- Buttons in package CSS are selected `button.x`, not `.x`: a reset's `[type="button"]`
  ties with one class, and the tie goes to whichever stylesheet loads last.
- In `dist/styles.css` every rule is in `@layer clover`, so any unlayered stylesheet beats
  it, a reset included (Tailwind 3's preflight clears button backgrounds). That is the
  intended trade: consumer CSS wins. Keep visual rules robust to a reset.
- Part tests mock the renderer with several listeners per event
  (`components/Root/Root.test.tsx`): the connected Canvas adds its own `change`
  listener, which the single-listener mock in the Canvas tests would overwrite.

## Canvas

- `Canvas` (`src/components/Canvas/`, exported as `Canvas`) is Clover's own **2D**
  renderer. It replaces OpenSeadragon (images) and Vidstack (A/V), which 4.x does not use. It is
  2D only. 3D (IIIF Presentation 4 Scenes) is reserved for a future, separate `Scene`
  component, so do not add 3D abstractions such as 4×4 matrices or perspective cameras.
- The renderer core is framework-free in `src/lib/renderer/`. `CanvasRenderer` owns the
  camera (`camera/`), frame loop (`loop/`), input (`input/`), loading (`io/`) and painters
  (`backends/`). The React component is a thin host.
- Painters sit behind one `Backend` interface. WebGL2 is primary and Canvas2D is a
  full-fidelity fallback. `DomLayers` positions real `<img>`/`<video>` elements with the same
  camera transform.
- **WebGL contexts are rationed** (Mat, 2026-10-19: Chrome's face-in-a-box showed on the
  Canvas page). Browsers cap a page's contexts (about 16, 8 on Android) and kill the
  oldest past it, and Chrome paints a killed one with that picture. So a renderer takes a
  context only while its host is in the window (`inWindow` at construction, then its
  `IntersectionObserver`), never on creation alone; `backends/contexts.ts` holds Clover's
  to `MAX_CONTEXTS` (6) page-wide, freeing the one out of view longest, else handing
  the newcomer Canvas2D; and on `webglcontextlost` the renderer drops the canvas at once
  and draws on with Canvas2D (`acquireBackend(false)`), trying WebGL again on its next
  return to view. Never leave a lost context's canvas in the page.
- Cross-origin pixels without CORS cannot be uploaded to WebGL. They are shown as a DOM
  layer, decided **per item, never per instance**.
- World units are the first image's own pixels (its declared IIIF `width`/`height` when
  known), so `getBounds()` is directly an `xywh=` region.
- Image services: `sources/imageService.ts` parses `info.json` for 3.0, 2.1.1 and 2.0 and
  spells **canonical** request URLs. A level 0 static tree answers to nothing else, which
  is also why a tile covering the whole image uses the region `full`.
  `sources/tilePyramid.ts` builds levels from `tiles`, from `sizes`, or from tiles Clover
  derives itself.
- Each frame is decided by `scene/planFrame.ts`, which is pure. `io/TileCache.ts` follows
  its required set: abort on supersede, a priority window, one retry, a negative cache,
  and a byte LRU. Tiles are keyed by URL and shared across items.
  - While the camera animates, `planFrame` wants the target level for its `destination`
    (where it lands), and for the views on the way only the coarsest level and one
    `IN_FLIGHT_LEVELS` (2) coarser than their target. Planning every in-between view at
    full resolution was 1.8× the tiles on a fast link (M3 benchmark). Draws are always
    of the current view.
  - `scene/uploadBudget.ts` caps new GPU uploads per frame (`UPLOAD_BUDGET_BYTES`, about
    two 512 px tiles, always at least one). A tile held back reads as missing to the
    planner, which paints the coarser level beneath it, and the frame loop runs again.
    Without it, a burst of tiles cost 10–30 ms in one frame at 4–6× CPU throttling.
    Backends report residency through `has(key)`.
- Controls render `src/ui/ControlCluster.tsx` (copied from 3.x `Image`'s controls) with
  click handlers. `ControlButtons` (`src/ui/controlButtons.ts`) includes `choice`.
  Labels come from `useCloverTranslation` (`t`), each with `lang={langOf(key)}`: see the
  root AGENTS.md's i18n section. `useClusterReach` (`src/ui/useClusterReach.ts`) writes
  how far the cluster's controls reach, `--clover-canvas-controls-width` and `-height`,
  on `.clover-canvas`, so the information box and the menus clear every row however the
  cluster wraps, and sets `data-popups="beside"` where a short stage leaves them under
  `BELOW_MIN` (112px) below it and `BESIDE_MIN` (128px) beside it (`ControlMenu.css`
  then hangs them from the top, beside the cluster). It measures the controls, not the
  cluster's box, which the pinned panel toggle's room is part of; the box itself takes
  no presses.
- **Rows at every size, never a column** (Mat, 2026-10-20: a column wrapped onto columns
  on a short phone stage, jumbled, the panel toggle mid-pack). The cluster is a row at
  the top end that wraps onto more rows, each right-aligned, in DOM order (WCAG 1.3.2,
  2.4.3). The panel toggle is out of the row (`position: absolute` at the cluster's top
  end, `padding-right` keeping its room; twice that with a placeholder's toggle beside
  it, `Placeholder.css`), so it is top right at every size. No column rules for phones
  (once `@media (max-width: 575px)`) remain; do not bring one back.
- IIIF text in the Canvas (the caption's label, Choice's legend and items, the
  placeholder's alt, the viewport's name, hotspots) is read with `localize()` in the
  Canvas's `language` (Connected passes the Root's) and carries its `lang`. The viewport
  holds the hotspots, so a viewport name in another language goes through
  `useContainerName`, never `lang` on the viewport.
- `Canvas` draws the IIIF Canvases it is handed (`canvases`) and nothing Manifest-level.
  It has no stepper, no `behavior`, and no Manifest fetching: which Canvases to show,
  and moving between them, is the host's job.
  - `src/components/Canvas/layout.ts` is pure. Its painted images are scaled into each
    annotation's `#xywh=` target. Several Canvases are laid along the `viewingDirection`
    axis at a common height (in a row) or width (in a column). World units are Canvas
    coordinates.
  - For hosts, `src/core/sequence.ts` (`groupViews`) groups a Manifest into views by
    `behavior`. It is the only sequence implementation. `paged` must match
    `@iiif/helpers`' `getManifestSequence`.
- Chrome follows the Player for a mouse, or a pen that hovers (`isHovering`: a pen
  `pointermove` with `buttons === 0`). `useChromeVisibility` sets `data-chrome="visible"`
  on its activity and hides it after `hideDelay`. A finger, or a pen not yet seen to
  hover (`isDirect(pointerType, hovers)`), gets no timer (WCAG 2.2.1). A tap on the
  picture (the viewport) toggles the chrome after `TAP_MS`, so the second tap of a
  double tap is left alone, and a tap elsewhere only shows it. A press on the picture
  where faded chrome sits (`FADING_CHROME`: the cluster's children, the navigator, the
  transport's children) is held in the capture phase on the figure: it shows the
  chrome, and neither its pointer events nor its click (within `TAP_MS`) reach the
  picture or a hotspot. Focus that arrives more than `PRESS_FOCUS_MS` after any press on
  the page (the keyboard's, a screen reader's) shows the chrome and holds it, overriding
  every timer, until focus leaves or a press comes. CSS also shows the chrome on
  keyboard focus (`:has(:focus-visible)`), which is required. The media transport uses
  the same hook. `GestureController` and the hook each track pen hover on their own;
  keep the two rules alike. Do not bring back a timer for touch or pen. `Choice`
  selection is Canvas-level state (`findChoices` / `ChoiceSelections` in `layout.ts`),
  not the host's.
- Video and sound live in `src/components/Canvas/media/`. `MediaStage` is `React.lazy`,
  so its code loads only when a Canvas paints media. Its CSS is in `styles.css` with
  the rest.
  - `useMediaElement` makes the `<video>` imperatively. The renderer moves it into its
    DOM layer, so React must not own it. Sound plays through a `<video>` too, never
    placed in the scene.
  - HLS goes through `hls.js` wherever `Hls.isSupported()`; native HLS only where it is
    not (older iOS). Do not go back to "`canPlayType` says HLS, so play natively":
    Chromium plays HLS natively now, and on that path a `texture` video (never on the
    page) stayed on the lowest rendition and a `dom` one stalled at its first frame.
  - A video is a `SceneImage` with `media: { element, presentation }`. `dom` (the
    default) positions the real element. `texture` uploads frames with `texImage2D`,
    once per `requestVideoFrameCallback` frame. Do not switch to `texSubImage2D`: from
    a video it uploads black in Chrome.
  - Only `texture` asks for CORS. If the CORS load fails outright, the element is made
    again without it and presented as `dom`, for that source only (`useMediaElement`
    keeps the failed `src`). The next recording asks again. This also covers a cached
    non-CORS copy of the same URL.
  - Captions are fetched with CORS and handed to `<track>` as blob URLs, because a
    cross-origin track is refused on a video without `crossorigin`. `useCaptionTracks`
    lists the Manifest's tracks first, then any the media adds (hls.js, in-band). Clover
    draws the chosen track's cues, so that track is `hidden`. The Manifest's other
    tracks stay `hidden`, and the media's are `disabled`, which stops hls.js loading
    them. A track made by `addTextTrack` starts `hidden` and fires no `change`, so the
    modes are applied again whenever the list grows. While the iPhone's system player
    or picture in picture has the video, the chosen track is `showing`, and that
    player's own menu sets the choice. Do not add a second writer of modes: two fight.
    Checked in the iOS 26 Simulator (2026-10-16): the system player shows the chosen
    track, a choice in its Subtitles menu is kept, and the page shows one copy after. The
    Simulator starts no picture in picture on Home, so check that on a device.
    Tests use `Canvas/testing/textTracks.ts`, whose `add()` makes `hidden` tracks, as
    `addTextTrack` does.
  - `MediaStage` is not keyed by the media: the transport stays mounted from one
    recording to the next, so focus stays on it (WCAG 2.4.3). Per-recording state is
    keyed by `media.id` or `media.src` inside the hooks (the caption choice, the CORS
    fallback). Never put a `key` back on it. If the focused control goes with the
    recording (Captions, Chapters, Full screen), `Transport` hands focus to Play/Pause,
    but only while focus was on the page itself.
  - `useMediaController` is the headless state; `Transport.tsx` is native range inputs
    and buttons styled as 3.x's Player bar. Sound has no waveform, and `wavesurfer.js`
    and `@vidstack/react` are on the build's forbidden list.
  - With media, `clickToZoom` is off, and a mouse click or a hovering pen's (renderer
    `"tap"`) plays and pauses. A finger's tap, or a pen's that has not hovered, only
    toggles the chrome.
  - The chapter under the pointer on the seek bar (`Transport.tsx`, Mat 2026-10-20) is
    state that changes only as the pointer crosses into another chapter, never per
    move: its stretch drawn out (`.clover-canvas-transport-chapter-span`) and a `Tip`
    over the stretch's middle (`--clover-transport-preview`), keyed by chapter so it
    measures itself into the stage each time; keyboard focus on the bar shows the one
    playing, and `aria-valuetext` names it. The Tip's Escape finds it through
    `controlOf`, which takes any element holding a focused input and its popover, not
    only a label. In a `Root`, `clover.chapter` (a Range's id) is one highlight between
    the seek bar and `Contents`; one from `Contents` draws the stretch only, since a
    popover away from the pointer could not be hovered (WCAG 1.4.13). While the popover
    shows the caption cues stay over it, whichever chapter it is: the transport writes
    how far its top is from the figure's foot (`--clover-transport-preview-top`,
    measured from the popover alone, never the cues, whose glide would skew it), and the
    captions' foot is the larger of their usual room and that, `2xs` clear. Escape's
    `data-tip-hidden` on the seek area puts it back to 0 in CSS.
  - The transport and the caption cues sit `--clover-canvas-chrome-inset` in from the
    stage's sides and foot, as the cluster does (Mat, 2026-10-19), never a step of their
    own; below 28rem of stage width the bar's controls go `xs` apart so 320px keeps two
    rows. The sliders have no edge: the scrim, at least 60% black up to the seek bar,
    keeps them at 3:1 (WCAG 1.4.11), so never thin it there.
  - The bar wraps instead of clipping (WCAG 1.4.10). `.clover-canvas-media` is a size
    container (`container-type: size`; it is `inset: 0`, so containing its height
    changes nothing), and size rules for the transport read the stage, never the window:
    no `@media` width queries. Below 28rem of stage width (37.5rem with a Chapters
    menu), `.clover-canvas-transport-status` (the time and the chapter) takes its own row
    over the buttons. Chapters, Captions and Full screen sit in one
    `.clover-canvas-transport-end`, which never wraps inside itself and is pushed to the
    end of its row, so they are always on the bar's last row. `useBarHeight` writes the
    bar's measured height to the figure as `--clover-transport-bar-height`, which
    `--clover-transport-room` adds up, so captions and the information box clear every
    row. `TransportMenu` places its menu when it opens and on resize: it measures the
    room above its button (`--clover-transport-menu-above`) and shifts the menu along to
    stay inside the bar's inset (`--clover-transport-menu-shift`), never wider than the
    stage less the inset. The menu closes when focus moves to an element outside it, but
    not when focus goes nowhere (Chrome blurs to the page on a press of an option's
    label). While a menu is open or a control has keyboard focus, the transport sits
    over the captions; `Canvas.css` changes that `z-index` at once, never through the
    chrome's transition. The volume slider renders only where the page can set the
    volume (`canSetVolume()`; iOS cannot).
  - An animation's frames bar renders inside a `.clover-canvas-media[data-kind="frames"]`
    layer, so it fades with the chrome and its menu is sized against the stage
    (`container-type: size`, `100cqb`).
  - A lone media Canvas (`canvases.length === 1`) is always fitted: `navigable: false`
    on the gestures, `fit: true` on every `setImages`, and the world is the video's rect
    at its intrinsic aspect (`containAspect`). It has no top cluster, scrim or
    navigator; full screen is the last button in the transport. The cluster returns
    only to offer a `Choice`, the `i` or its annotations (those on its time), or to hold
    a host's own controls (the panel toggle), which must never disappear with the image
    controls.
  - Navigability is one value in `CanvasView`:
    `navigable = !mediaOnly && options.gestures.navigable !== false`. It gates
    `CAMERA_KEYS` and the role description on the viewport, `data-navigable` on the
    figure (grab cursor, `panClearOfChrome`), and the `navigable` that `MediaStage`
    passes to `setGestures`. Never let the media stage turn a host's `navigable: false`
    back on.
  - One pointer can always zoom out (WCAG 2.5.1): `GestureController.zoomIn` goes home
    at `atMaxZoom()` on a click, a double click or a double tap. A touch double tap zooms
    only with `clickToZoom || dblClickToZoom`.
  - The viewport is `z-index: -1`, inline and in `Canvas.css`, in a figure isolated
    inline, so without the stylesheet the controls in the flow still sit above it (WCAG
    2.5.8). Anything placed in the figure to lie beneath the viewport (the iPhone
    `texture` video) goes first, at `z-index: -1`.
  - The transport fades with the rest of the chrome, through the single reveal rule
    in `Canvas.css`, all but its Play while paused, which never fades (above). Do not add
    "stay visible while paused" or other overrides beyond that one. The
    reveal is `data-chrome` (from `useChromeVisibility`: a mouse's activity, lingering
    `LEAVE_DELAY` after leave or blur; a finger's tap on the picture; focus no press
    brought), `:has(:focus-visible)`, an open menu, or a control, the navigator or the
    transport under a resting pointer (`:hover`, Play's aside), so a control never fades,
    Tip and all, while the pointer is on it (WCAG 1.4.13). It is not `:focus-within`: a
    click focuses the viewport and would pin a video's bar.
- The wrapper is a `<figure>`. A shown Canvas with a `summary` or `metadata` (as in
  Cookbook recipe 0029) gets an `i` control (`controls.information`, label "About"). It
  opens `Caption.tsx`, the figure's `<figcaption>`, which must stay its last child.
  - The caption hangs below the cluster's last row, right-aligned, as the Choice and
    annotations menus do. Its z-index is below the cluster's, so zoom and the other
    controls stay usable while it is open. On a short stage (`data-popups="beside"`)
    it sits beside the cluster, from the top.
  - It is content, not a menu: it does not fade with the chrome or close on an outside
    press. It closes from its ×, the `i` control, or Escape anywhere in the figure, and
    stays open as the host moves between Canvases that have information. Escape inside
    the caption hands focus back to the `i` control; from elsewhere (CanvasView's
    `onKeyDown`) focus stays where it is, so a hotspot under the caption comes back into
    view (WCAG 2.4.11). Both prevent the keydown, so a dialog around it stays open.
  - The captioned Canvases' labels name the figure through `aria-labelledby`.
  - `CaptionDetails.tsx` is `React.lazy` and renders `Markup` and `MetadataList`
    (`src/ui/Markup.tsx`), whose sanitizer (`src/core/sanitize.ts`, DOMPurify, ~9 kB
    gzip) loads on first open. Keep it out of the entry chunk; `bundle.test.mjs`
    asserts it.
- A shown Canvas with a `placeholderCanvas` opens on `Placeholder.tsx`. This is a still
  (`placeholderStill()` in `layout.ts`) fitted and centered with container units, and a
  toggle in the top right (the Viewer's magnifier, then a ×).
  - Until it is opened, it holds back everything else: `setImages`, pan and zoom,
    hotspots, `Choice` and the media stage. Two controls stay beside the toggle: the `i`
    control, and the annotations menu (Mat, 2026-10-19), which lists the annotations as
    the planned layout places them (`listedAnnotations`, nothing drawn). A pick from it
    is `held` (not framed), opens the placeholder through the pending pick, and is framed
    by the same effect as a host's pick once the view is drawn.
  - Each new set of `canvases` starts from its placeholder again (`openedFor` keyed by
    `canvasKey`). Reopening re-frames the Canvas (`fit`), as the Viewer remounts OSD.
  - The still lingers, inert, until the renderer's `open` event. `open` fires once the
    coarsest tiles are decoded, so opening never flashes an empty stage.
  - For video and sound, the toggle is a 4rem play button in the center ("think
    YouTube"). Opening passes `autoPlay` to the media stage, because that press was a
    press of play. Once open, the toggle is the × in the top right. Safari may refuse
    the deferred `play()`; it is swallowed, leaving the transport ready.
- **Web component** (`src/web-components/`): `element.tsx` defines `<clover-viewer>`
  with React APIs and is tested with React; `index.ts` (the build entry) hands it the
  stylesheet, MapLibre's worker (`?worker&url`) and a lazy MapLibre stylesheet. The
  stylesheet comes from `virtual:clover-styles`, a plugin in
  `build/web-components.config.mjs` that reads `src/styles/clover.css` in order and cuts
  it into runs: `clover-1`, `media`, `clover-2`, `map`, `clover-3`. The `media` and
  `map` runs (`DEFERRED` there) load when the element holds what they style (`DEFERRED`
  in `index.ts`: a `.clover-canvas[data-media]` or `[data-animated]`, drawn before the
  player's own code, and `.clover-geomap`), and `inject` puts each after the nearest
  earlier run, so every rule keeps its place in one `clover` layer. Never sublayers: a
  later sublayer beats an earlier one's more specific rule (the controls' `z-index`
  fell from 3 to 1). A stylesheet only media or a map needs goes in `DEFERRED`, listed
  with its kind in `clover.css`; the plugin throws if a kind's sheets are not adjacent.
  `build/web-components.config.mjs`
  aliases React to Preact (`preact/compat`, `/client`, `/jsx-runtime`) and keeps
  `base: "./"`: an absolute base wrote the worker as `/assets/…`, which failed from any
  path but the site root. `build/web-components.test.mjs` asserts Preact not React,
  MapLibre and hls.js deferred, the worker relative, and the up-front size. The element
  renders into its light DOM and injects Clover's stylesheet once, first in `<head>`.
- **Renderers** (`components/Content/renderers.ts`): `renderers` on `Root` go into the
  context (kept while `sameRenderers`, so an inline array does not change the context
  value), and every `Content` asks `pickRenderer` with the view's Canvases and
  `paintingBodies`. A claimed view is the host's component, not `ConnectedCanvas`. Keep
  this the one override point: templates and the Viewer reach it through `Root`, never a
  prop of their own.
- **Animations** (painting annotations at `#t=` times, `layout.ts` `animationFrames`):
  the scene holds every frame (`paintedImages(…, { allFrames })`), all but the selected
  one `hidden`, and `canvasScene().frames` maps each frame to its image ids. Playing is
  `FrameAnimation.tsx`, lazy: its clock calls `renderer.setHidden(ids)`, which flips draw
  flags only (no preparing, no `change`, no re-placed hotspots). Do not play frames by
  changing `setImages` input: each call prepares items again and a 100 ms frame never
  settles (a blank stage). `SceneImage.hidden` is not part of `sameSpec`; `planFrame`
  keeps a hidden item's tiles coming but draws nothing of it. The clock waits on
  `renderer.isReady(id)` (the coarsest level loaded) before showing a frame. Frames read
  as a timeline (until the next start; the last until `duration`). A Manifest's
  `auto-advance` moves on through `onEnded`, as for media. Fixtures: 0688 and NUL's
  Muybridge plate 626 (`src/fixtures/muybridge-626-annie-g-galloping.json`).
- A body cropped by region through a service passes no declared `width`/`height`: the
  region is in the service's coordinates, and a body may declare a derivative's size.
- Hotspots are `Annotations.tsx` `placeAnnotations`: a rectangle (`xywh`), a point (a
  fixed-size marker in a 40-unit box, which is what pressing it frames, as 3.x), or an
  SvgSelector shape. `core/svg-shape.ts` reads a shape's geometry and box with
  `DOMParser`, copying only geometry elements and validated numeric attributes; the
  hotspot redraws them in an `<svg viewBox=box>` and never injects the selector's markup.
  The button of a point or shape takes no pointer; only the marker or the shape does. The
  reader is lazy (`useSvgReader.ts`, listed in `bundle.test.mjs` `LAZY_MODULES`): it
  imports nothing, so its chunk shares nothing and costs no esbuild chunk overhead.
- The hotspot layer (`Annotations.tsx`) and the annotations and Choice menus load on
  demand through `hooks/useLoaded.ts`, asked for as soon as the Canvas has annotations
  or a Choice, not on the press that opens a menu, so they are there before they are
  used. `useSvgReader` lives apart from the layer because `CanvasView` calls it on every
  draw. The navigator (`overlays/Navigator.ts`) loads in `attachNavigator`, the latest
  call winning. Tests reach them with the `open()` / `loaded()` helpers in
  `Canvas/index.test.tsx`.
- A hotspot's note is a `Tip` with `scrolls`: capped at the stage's height, it scrolls
  (WCAG 1.4.10), by wheel or touch over it and, from the hotspot's keys, by `scrollNote`
  in `Canvas/Annotations.tsx` (kept there, out of the Tip every Canvas loads). A scroller
  cuts what passes its edge, so its gap to the hotspot is a clear border in its own box,
  not `::before`; mind both when moving it. It has `tabindex="-1"` and a
  press on it focuses its hotspot, because a scroller may otherwise take focus (Chrome's
  focusable scrollers) and it is `aria-hidden`. `GestureController` leaves the wheel to
  any box in the stage that can scroll that way (`scrollsWithin`).
- Hotspots render in the annotations' given order, which is the Tab and reading order
  (WCAG 2.4.3); never sort the DOM by size. A hotspot's name is its `Tip` (the same
  string as its `aria-label`, its number when it has no text), never a `<label>` in the
  button. The picked one carries `aria-current="true"`; `data-active` is only how it
  looks. Stacking is a `z-index` from `--clover-annotation-depth`:
  - Rank is by area, largest lowest. Of two equal areas, the later stacks on top (the
    sort is stable).
  - The active hotspot goes over all. A hotspot is raised over it only if it lies within
    the active one and already stacks above it at rest.
  - Never raise a twin (same region) over the active hotspot. The pointer would land on
    the twin, which then raises the first, so the two flip on every move. That breaks
    the popover's hover delay and the shared highlight.
- `panClearOfChrome.ts` (WCAG 2.4.11) is lazy:
  - It loads on a hotspot's first focus, and runs on the Tab keyup while that hotspot
    still has focus.
  - It imports nothing at run time, and is listed in `bundle.test.mjs` `LAZY_MODULES`.
    Keep it that way: inline it costs about 0.7 kB gzip on every Canvas.
  - A piece of chrome cuts the clear area only once the hotspot is beside it on the
    other axis. This is rechecked after each cut, so a hotspot that is already clear
    never moves. Add any new chrome over the stage to its `CHROME` list.
- While the view is upright, the overlay layer places each element's edges and size on
  whole device pixels (`snap` in `OverlayLayer.position`, Mat 2026-10-20). Placed between
  pixels, a hotspot's hairlines were shared by two, and tracked ones gliding over a film
  pulsed, each at its own speed. Keep it; a turned view is left unsnapped.
- While the view is upright, the overlay layer writes `--clover-overlay-x`,
  `--clover-overlay-top`, `--clover-overlay-bottom` and `data-overlay-room` on each
  pinned element. A hotspot's Tip uses them to clamp itself into the stage with
  `cqw`/`cqh` (the layer is a size container).
- Round controls are a solid dark fill with white glyphs (`--clover-color-control`,
  `--clover-color-control-glyph`, defaults `#1a1d1e` and `#fff`), in light and dark mode
  alike, and the accent under the pointer or focused. They read no `primary` or
  `secondary`: a page swaps those for its dark mode, which turned the controls light.
  Light controls (the surface's color) and an accent at rest were both tried and
  reverted at Mat's request, as was a translucent 85% rest state. Do not reintroduce
  them.
- Fixtures: `src/fixtures/iiif-image/info.ts` holds the reference server's Göttingen
  `info.json` for 3.0, 2.1 and 2.0, which is the image in Cookbook recipe 0005. The
  Cookbook recipes the tests use are in `src/fixtures/iiif-cookbook/`, as published
  (mostly Presentation 3). Tests read them through `p4()` (`src/fixtures/presentation4.ts`),
  as Clover reads the web.
- Loading is lazy: `useNearViewport` holds back `setImages` and the media stage until the
  Canvas is within half a screen of view, once, and never unloads. Tests install
  `stubViewport()` (`Canvas/testing/viewport.ts`), since the suite's IntersectionObserver
  mock never reports.
- Draws happen only in `requestAnimationFrame` and on demand. A hidden tab or preview pane
  never fires rAF, so verify rendering in a visible browser or headless Playwright.
- The one exception is a resize. A ResizeObserver runs after the frame's rAF callbacks
  and before its paint, and changing a canvas's size clears it. So `measure(true)` draws
  at once (`FrameLoop.drawNow()`): routed through `invalidate()`, every step of a
  dragged split handle paints one blank frame.
