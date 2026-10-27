# DRY cleanup before 4.x: the plan

Before the official 4.x release, a DRY pass over the whole package (Mat, 2026-10-26:
"raising budgets is fine. we will do a DRY cleanup of the whole thing before official 4.x
release"). The aim, in Mat's words: find code that can be unified, places where one
component can carry the load of several, and simplifications that buy efficiency; reduce
the Viewer's (Default) and Document templates; limit bloat; do the same for the core
helpers, Canvas, Scene and Timeline above all.

This plan rests on five read-only surveys of `packages/clover/src/` (2026-10-26): the
templates; the image Canvas and its renderer; media, Timeline, Scene, Body and Map; the
Panel's sections, the other parts and `ui/`; and `core/`, the hooks and the web components.
File references are to `packages/clover/src/` unless they say otherwise. An item marked
**(checked)** was reopened in the source after the survey.

Every size is **est.**: gzip, as a consumer's bundle carries it, worked out from the built
modules in `dist/` (each surveyor's method is in their notes), never measured by
`build/sizes.mjs`. Measure each phase with `npm run build` and `build/sizes.json` before
believing a figure, and lower the budgets to what is measured.

## What holds throughout

- **WCAG 2.2 AA.** Every item says which criteria it touches. Merging two copies of an ARIA
  pattern into one is a gain for consistency (3.2.4), but the merged one must keep every
  name, state, key and focus move of both.
- **Recorded decisions stand** unless Mat changes them. An item that would reverse one is
  in "Decisions for Mat", with the reason it was made.
- **The package rules stand:** templates import only `react`, `../../parts` and
  `../shared/…`; the Viewer shell stays tiny and lazy; ESM, `preserveModules`, named
  exports; React and the web components at parity.

## What the surveys found about bytes

- **A template's own code is small.** Default's module is about 1.2 kB of its 70.8 kB;
  Document's two modules about 3.8 kB of 73.3 kB. Default and Document load the same parts
  but for those modules. The weight is the parts:

  | Share (est.)                                                                     | Default | Document |
  | -------------------------------------------------------------------------------- | ------- | -------- |
  | Body: Canvas, its renderer, controls                                             | 29.5 kB | 29.5 kB  |
  | Shared by many parts: i18n, Tip, hooks, selectors, ranges…                       | ~19 kB  | ~19 kB   |
  | Panel and what only it loads (Sections 3.3, About, Primitives, ReadMore, Markup) | 7.9 kB  | 7.3 kB   |
  | Items                                                                            | 4.5 kB  | 4.5 kB   |
  | Root and the core                                                                | 4.3 kB  | 4.3 kB   |
  | Split                                                                            | 2.2 kB  | 2.2 kB   |
  | `templates/shared` hooks                                                         | 1.6 kB  | 1.6 kB   |
  | The template's own modules                                                       | 1.2 kB  | 3.8 kB   |

- **gzip already folds most copy-paste inside one chunk.** Merging Items' arrow button into
  the Pager's measured 24 B; a table for the Panel's sections measured +5 B. So most of the
  DRY work below pays back in maintenance and consistency, not bytes. **Bytes come back in
  three ways:** removing logic no caller reaches, loading code only when it is needed, and
  dropping or narrowing a feature.
- **What a page needs is often loaded before it needs it.** The largest wins are lazy loads:
  Gallery's lightbox Body (−34 kB), a Timeline's image renderer (−16 kB), Document's shut
  Panel (−7 kB), the Map's library before it is near the window.

## Fix first: bugs found on the way

These came out of the surveys. Each is small and none needs a decision.

1. **Done (2026-10-26).** The Transcript's find field had no placeholder contrast fix
   (WCAG 1.4.3), and its typed words were the browser's field text, not the theme's. The
   fields' rules and the placeholder (`styles/scale.css`) now key on
   `.clover-field-pill-query`, which every field pill's query carries (5.3:1 on white, 7.4:1
   on a dark theme, measured in Chromium); `.clover-transcript-track select` is gone.
   `scale.test.ts` renders the pill with Search's and the Transcript's classes and checks
   both match the rule.
2. **Done (2026-10-26).** `toPlainText` threw on a numeric reference outside Unicode
   (`&#x110000;`), breaking `Label`, `Thumbnail`'s alt, the link parts, `Provider` and the
   Annotations list. It now leaves one as written, as `cueText` does, with tests in
   `core/text.test.ts` and `components/Label/Label.test.tsx`. The two decoders are still
   two: A12 makes them one.
3. **Done (2026-10-27).** A Canvas or Timeline given `iiifContent` now reads its chapters
   and a content state's region and time as a Root's does, through one module,
   `Canvas/fromManifest.ts` (`useRangeChapters`, `applyTarget`), used by `Connected` and
   `LoadedCanvas`. On the way: a deep link's time into a recording with nothing to draw
   never applied, in a Root either, as it waited for the Canvas to be laid out; only a
   region waits now.
4. **Done (2026-10-27).** Document's panel lists no downloads (its toolbar has them), and
   the spec says what `download` does in each template.
5. **Done (2026-10-27), and Default had it too.** On a narrow arrival with
   `defaultPanelOpen`, both templates took focus into the panel; Default then closed it,
   reading arrival as narrowing, focus left on the hidden panel. `useWideEnough` is
   `undefined` until measured, and `useFocusOnOpen` takes the panel's intent and that
   flag, retrying after each commit until the pane shows. Decision 7 (settled the same
   day) then changed the rule: a pane that would float starts closed whatever the host
   asks.
6. **Done (2026-10-27).** The transport draws the controls' full-screen glyphs.
   `SettingsIcon` and `CheckIcon` are still dead (Phase 1).
7. **Done (2026-10-27).** One `annotationName(bodies, language)` in
   `core/annotation-name.ts`, for the hotspot, the Canvas's menu and the list (which
   still cuts its button's name to 120 characters). `annotationText` is gone with it.
8. **Done (2026-10-27).** `partOfCollection` reads one or a list (a single object threw);
   both `=== undefined` `asArray`s are `== null`; a map title goes through `toPlainText`.
   The other 19 `asArray` copies stay for A2.

## Phase 1: dead code

**Done (2026-10-27).** Measured by the build, with the bug fixes above: Default 70.3 kB
(70.8), Document 72.8 (73.3), Gallery 60.2 (60.8), Canvas and Timeline 38.7 (38.9),
styles 15.5 (15.6), `<clover-viewer>` 113.9 (114.4); the budgets lowered to match, and
`<clover-canvas>` alone raised to 83.0 kB for bug 3's chapters and deep links (82.8,
after the Ranges' reader and `annotationName` were made to load only where needed).
Smaller than estimated: gzip had folded much of it already. Left, each for a reason:

- **The elements' `styles` option**, only tests pass it, but the CHANGELOG offers it to
  pages (`defineCloverElements`' `styles`, a stylesheet handed in whole): public API, so
  a decision (Decision 13), not dead code.
- **`clover-pager-icon`**, styled nowhere, but a class a host may target.
- **Document's two `useUniqueId`s** are in two components, and its spine's `from` is
  A28's.
- **`TileCache`'s defaults**, which its tests construct it with.
- **`Steps`' `className`**, which no part passes yet (Sections' went with its
  uncontrolled state): a few bytes, left for the parts that may style it.

No behavior changes. Mostly in the Canvas's initial chunk, so Default, Document and
Timeline all shrink.

| What                                                                                                                                                                                                                                                                                                                                                               | Where                                                                                                                            | Est.                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| WebGL context restore: never heard, since a lost backend is disposed at once (checked)                                                                                                                                                                                                                                                                             | `WebGL2Backend.ts:91,94-96,180-183,261,306-311`; `backend.ts:58,71-75`; `Canvas2DBackend.ts:20`; `mipmapped` written, never read | with the next row           |
| Renderer members no caller reads (checked): `getStats`, `getItemRect`, `itemCount`, the `homePadding` option, `CameraAnimator.animating` and `setTimeConstant`, `FrameLoop.scheduled`, `OverlayLayer.size`, `DomLayers.has`; `releaseImage` unused and written out twice in `TileCache.ts:229,280`; `TileCache`'s defaults repeated from `CanvasRenderer.ts:97-98` | `lib/renderer/*`                                                                                                                 | ~0.25 kB Canvas             |
| `useScrollTrack`'s `orientation: "vertical"`, `slidesToScroll`, `align: "end"`: no caller passes them (checked: Items and Sections are the only callers)                                                                                                                                                                                                           | `ui/useScrollTrack.ts:21-266`                                                                                                    | ~0.3 kB Default, Document   |
| Sections' uncontrolled state (`defaultValue`, `own`): the Panel always passes `value`                                                                                                                                                                                                                                                                              | `ui/Sections.tsx:61-62,116-118,128,350`                                                                                          | ~30 B                       |
| `SettingsIcon`, `CheckIcon` (checked)                                                                                                                                                                                                                                                                                                                              | `ui/mediaIcons.tsx:112-162`                                                                                                      | ~0.15 kB media chunk        |
| `useMediaController`'s `waiting`, `ended`, `pause`, never read                                                                                                                                                                                                                                                                                                     | `media/useMediaController.ts`                                                                                                    | ~0.1 kB                     |
| `data-panel-open`, set and read nowhere (checked); `overscroll-behavior` on a pane that never scrolls; Document's spine `from`, always 0px; two `useUniqueId` in one layout                                                                                                                                                                                        | `Default.tsx:176`; `Default.css:162`; `Document.tsx:58,122,215-221`                                                              | ~50 B                       |
| `export { boxAt }`, the `canvasRegion` and `toSceneImages` re-exports                                                                                                                                                                                                                                                                                              | `Canvas/Annotations.tsx` (`boxAt`); `Canvas/index.tsx:49`                                                                        | ~0.1 kB                     |
| `export { bodiesOf, readBodies }` value re-export; nothing imports it                                                                                                                                                                                                                                                                                              | `core/annotation-sets.ts:9`                                                                                                      | 0                           |
| The web components' `ElementAssets.styles` path: only tests pass it                                                                                                                                                                                                                                                                                                | `web-components/styles.ts:8-17,50-74,82-94`                                                                                      | ~0.15 kB every element page |
| CSS that inline styles always override (viewport, surface, DOM layer, overlays)                                                                                                                                                                                                                                                                                    | `Canvas.css:66-86,97-112,143-160`; `Canvas/Annotations.css:9-32`                                                                 | ~0.1 kB styles              |
| Redundant `.clover-about ul.clover-about-part-of`; unstyled `clover-pager-icon`                                                                                                                                                                                                                                                                                    | `Panel.css:349-353`; `Pager.tsx:92`                                                                                              | small                       |

The AGENTS.md line on the viewport's `z-index: -1` "inline and in `Canvas.css`" changes
with the CSS row: it is inline only.

## Phase 2: one piece carries several

The heart of the cleanup. Each row names the one piece and what it replaces.

**The Body, A1 to A11: done (2026-10-27).** Measured by the build, against Phase 1:
a Timeline alone 23.4 kB (38.7), a `<clover-timeline>` page 66.9 (81.5), Default 70.0
(70.3), Document 72.6 (72.8), Gallery 60.1 (60.2), a Scene 15.3 (15.6), a Map 18.5
(18.6), the elements' viewer entry 95.0 (95.2), a Canvas alone unchanged (38.7). The
elements' pages that hold a Canvas end 0.23 to 0.47 kB heavier (`<clover-canvas>` 83.3,
`<clover-viewer>` 114.2): A3 splits the Canvas's view from its renderer, which costs them
0.56 kB of chunk boundaries, and A2 wins back 0.1 to 0.33. The budgets follow.

**What measuring taught: a merge pays only where both copies load on one page.** A page
draws one view (a Canvas or a Scene), loads one entry router, one Loaded part. Sharing
what only different pages hold takes no copy off any page and adds the shared piece's
interface (its props and fields are property names a minifier cannot shorten) to every
page. And a lazy chunk that imports a helper from the entry makes the entry keep and
export it: a helper the entry had tree-shaken away comes back up front. So:

- **A3: done.** `CanvasView` takes its surface from its caller (`Canvas/surface.ts`):
  `Canvas` and `Body` hand it the renderer (`rendererSurface.ts`), `Timeline` a DOM
  surface (`Timeline/playerSurface.ts`: a tap that plays, `open`/`change`, a video shown
  fitted should a Timeline paint one). Camera parts (zoom, rotation and reset, hotspots,
  the navigator, frames, `onReady`'s handle) need `hasCamera`. −15.3 kB; a Timeline in
  view holds no WebGL context. `bundle.test.mjs` holds it.
- **A1: not merged; kept in step by a test.** `BodyFrame` and `useBodyFrame` were built
  and measured: +0.41 kB on a Canvas, +0.49 on a Scene, +0.42 on Default, almost all of
  it the names of its ~20 props and ~11 fields (folding four props into one `kind` saved
  nothing). Undone. `Body/frame.parity.test.tsx` holds the two frames to each other
  instead (the figure, the viewport's name, role, keys and focus, the way out of full
  screen, the caption last and closed by Escape where focus is). Kept from it: a
  Canvas's loading mark before its caption, so the `<figcaption>` is last.
- **A2: done.** `core/painting.ts` (the rules: `GROUPS`, `bodiesOf`, `isPainting`), and
  `core/painted-bodies.ts` (the walk), apart so a Canvas alone, which needs only the
  rules up front, defers the walk with its thumbnail (together, the Canvas gained 80 B).
  Thumbnails, Items, the Body's renderer, region, layout, the Map and the Scene read
  painting one way; groups are unwrapped everywhere. One `asArray` (`lib/asArray.ts`)
  for twenty copies. −0.2 kB a template, −0.4 a Scene.
- **A4: the fix only.** A Root's `Canvas` shows `CanvasPending` while its part loads (it
  showed nothing). The router itself is one per page: not merged.
- **A5, A6, A7, A9: not merged.** Each joins the Canvas's copy to the Scene's (the
  Connected and Loaded parts, the control specs and the `i`, the key decoders, the
  surfaces and shader compiles, the wheel), which never load on one page; no dead code
  found in them. `CAMERA_KEYS` cannot feed `ui/Tip.tsx`'s `SHORTCUT_KEYS` without the
  `ui/` layer importing the Canvas.
- **A8: not merged.** One `useFullscreen` answering `is` and `within` (on
  `useSyncExternalStore`) measured +36 B on Default and +11 on a Scene (−34 on
  `<clover-viewer>`): gzip folds the second hook into the first. The two stay, now
  tested (`hooks/useFullscreen.test.tsx`).
- **A10: not merged.** The rectangle math in `planFrame` runs per tile per frame, where a
  helper returning a rectangle allocates; the hotspots' mask test as `intersects` cost a
  Timeline 58 B up front (above) to save 30 later; `toWorld` keeps the size
  `canvasRectToWorld` would read again for every image.
- **A11: done.** `media/TransportButton.tsx` for the transport's three plain buttons
  and the animation bar's four; one `chapterAt`; one `captionName` for the menu and the
  system player; HLS by one pattern, in any case (`lib/hls.test.ts`). The player's tracks
  write their time with `CueTime`, in the player's muted white (a rule a step more
  specific than `Cue.css`, which loads after it), and a press plays from the track's
  start with `playFrom`. A few cross-chunk exports: +12 to +18 B up front.

The same test applies to what follows: before A12 to A30, ask which pages hold both
copies.

### Body: Canvas, Timeline, Scene, Map

- **A1. `BodyFrame` and `useBodyFrame`, the Body's shell for Canvas and Scene**
  (`components/Body/BodyFrame.tsx`). Today CanvasView and SceneView each write the same
  frame:
  - the hooks: wrapper, full screen, root language, `useControlsVisibility`,
    `useNearViewport`;
  - the controls config;
  - the caption state;
  - the viewport's name, role description, keys description and `aria-keyshortcuts`;
  - the `<figure>` with Escape and `forwardShortcut`;
  - `ExitFullscreen`, `Loading`, `Caption` and the `ErrorBoundary`.

  The copies: `CanvasView.tsx:117-124, 262-298, 345-363, 573-617, 1024-1180, 1273-1284`
  against `SceneView.tsx:167-208, 480-516, 637-757`. Each view keeps only its picture and
  its cluster's contents. This is the "neutral name" AGENTS.md waits for at Canvas's
  renaming, and it makes A3 cheap. Est. −175 lines and −0.8 kB from the Scene chunk;
  Canvas about even. WCAG 4.1.2, 3.1.2, 2.4.11 and 2.5.8 all in one place.

- **A2. `core/painting.ts`, one walk over painting bodies**, a leaf module, so a standalone
  `Thumbnail` still loads no annotations code. It replaces seven walks with drifting rules:
  - `thumbnail.ts:45-61`, `items.ts:41-52`, `region.ts:27-50`, `geo.ts:223-234`;
  - `Body/renderers.ts:41-66`, `Scene/models.ts:122-133`;
  - `Canvas/layout.ts:247-259, 282-295`.

  They differ by accident: only some unwrap Presentation 4 groups, `items.ts` has no
  motivation filter, and `geo.ts` rejects a missing motivation. It holds:
  - `isPainting`, `eachPainted(container, visit)`, `bodiesOf` and `GROUPS` (moved here);
  - `sourceOf` (a SpecificResource's source, written eight times);
  - `partOf(resource, type)` (written five times);
  - **one `asArray`**: defined 21 times today (checked: 19 identical copies, plus
    `toArray` and two `=== undefined` variants).

  Also `supplementingFiles(canvas)`, one pass for captions and text transcripts, which
  Panel and Transcript both run twice, and `regionShare` reading `parseRegion`
  (`lib/renderer/scene/regions.ts`). Est. −100 lines and ~0.5 kB on Default and Document.
  It changes behavior for the better (thumbnails and Items find images inside groups):
  give it a CHANGELOG line.

- **A3. Timeline without the image renderer** (checked). `Timeline` is `CanvasView`
  (`Timeline.tsx:4,66-72`), and CanvasView makes a `CanvasRenderer` on mount, so a page
  that plays sound loads the tile renderer, WebGL2 and the gesture controller up front. In
  view, it also claims one of Clover's six WebGL contexts, while the media player it needs
  is the lazy part. That is why `timelineInitialGzip` equals the Canvas's.
  - CanvasView takes its surface from its caller: `surface(host, options)`, returning the
    `on`, `setImages`, `clear`, `setGestures`, `host`, `dispose`… it uses.
  - `Canvas` and `Body` pass `CanvasRenderer`.
  - `Timeline` passes a ~50-line DOM `PlayerSurface`. A click is a `tap`; it emits `open`,
    so `onReady` and deep links still fire.

  One view is kept, as recorded. Est. **−16 kB** off a Timeline (38.9 → ~23 kB), and about
  as much off `<clover-timeline>`. WCAG 2.1.1, 4.1.2: the viewport's name, keys and focus
  must be the same.

- **A4. `bodyPart()`, one entry router.** Canvas, Timeline, Scene and Map each route the
  same way: `iiifContent` goes to their lazy Loaded part; in a Root, to their lazy
  Connected part; otherwise to the view. The copies: `Canvas/index.tsx:28-47`,
  `Timeline.tsx:50-73`, `Scene.tsx:27-42`, `Map.tsx:18-43`. One
  `bodyPart({ View, loadConnected, loadLoaded, handed })` in `components/Body/`, always
  with the `CanvasPending` fallback. Today Canvas's fallback is `null`
  (`Canvas/index.tsx:41`), an empty box, against `Body/Pending.tsx`'s own rule. Est. −50
  lines.
- **A5. `useConnectedBody`.** It holds the `manifestId` selector, the request merge, the
  label fallback and the language, which `Canvas/Connected.tsx:70-81, 283-310` and
  `Scene/Connected.tsx:28-52` both write. CanvasView already falls back to the Canvas's
  label (`:573`), so the wrappers' `?? canvas.label` goes.
- **A6. `useLoadedContainer` and `useRangeChapters`.** `LoadedCanvas.tsx:15-152` and
  `Scene/Loaded.tsx:9-77` are the same state machine: the key, `loadContent`, pick by
  target or the first, "It has no … to show", and the pending state or the alert. With
  `useRangeChapters`, lifted from Connected, a standalone Timeline gets its chapters (fix 3).
- **A7. One controls vocabulary.**
  - `controlSpec(instance, t, langOf)` and `fullscreenSpec(…)` in `ui/ControlCluster.tsx`,
    plus `resolveControls(controls, all)`. Canvas writes the specs out
    (`Controls.tsx:143-225`); Scene has its own `spec()` (`SceneView.tsx:517-577`). The
    `i` button is written twice too: `Controls.tsx:250-261` and `SceneView.tsx:680-691`.
  - `lib/keys.ts`, `viewKey(event)`, one decoder of viewport keys, today written three
    times: `GestureController.ts:307-348`, `SceneView.tsx:437-477`,
    `MediaBody.tsx:183-198`. `CAMERA_KEYS` and Scene's `KEYS` are one list; derive
    `SHORTCUT_KEYS` (`ui/Tip.tsx:30-46`) from it.

  Est. ~0.4 kB Canvas, ~0.2 kB Scene. WCAG 2.1.1, 2.1.4, 4.1.2 unchanged.

- **A8. One full-screen hook.** `hooks/useFullscreen.ts` and `useWithinFullscreen.ts`
  differ only by `===` against `contains` (checked), and Scene uses both on one element, so
  it holds two listener pairs. One `useFullscreenState(el): { is, within }` on
  `useSyncExternalStore`. Est. ~0.15 kB.
- **A9. One drawing surface and one shader compile.**
  - `makeSurface(host, onLost)`: the class, `aria-hidden`, the geometry and the lost-context
    handler. Today in `CanvasRenderer.ts:933-949`, `cloverEngine.ts:46-57` and
    `engine.ts:63-73`.
  - `buildProgram(gl, vertex, fragment)`, from `WebGL2Backend.ts:314-351` and
    `lib/gltf/renderer.ts:65-83`.
  - `MAX_PIXEL_RATIO` once (it is defined three times).
  - `normalizeWheel` and the pinch distance into `lib/pointer.ts`, from
    `Scene/gestures.ts:17-53` and `GestureController.ts:134-137, 350-364`.

  Est. ~0.2 kB Canvas, ~0.3 kB Scene.

- **A10. One rectangle helper set.** `mapRect(r, from, to)`, `intersection(a, b)` and
  `contains` in `lib/renderer/math/rect.ts` replace about ten inline copies. They are in
  `layout.ts` (`toWorld`, `canvasRectToWorld`, the companion's scaling),
  `CanvasRenderer.itemRectToWorld`, `sceneItem.ts`, `planFrame.ts`, `regions.ts`,
  `core/region.ts`, `canvasRegion`, and `Canvas/Annotations.tsx:296-302`, which
  re-implements `rect.ts`'s `intersects`. Est. ~0.2 kB Canvas.
- **A11. Media.**
  - `media/TransportButton` replaces the transport's buttons, written seven times
    (`Transport.tsx`, `FrameAnimation.tsx:225-318`).
  - Export `chapterAt`, computed in both `Transport.tsx:349-357` and `MediaBody.tsx:319-323`.
  - The player's track list renders times with `CueTime` and plays with `playFrom`, as
    every other time does (Mat, 2026-10-26: "time ranges should be rendered like cues").
  - The caption tracks' names are worked out once (`useMediaElement.ts:99-102` and
    `MediaBody.tsx:119-130`).
  - The HLS types become one regex (`lib/hls.ts`).

  Est. ~0.5 kB in the media chunk.

### Core helpers and state

**A12 to A20: done (2026-10-27), by the same test.** Measured against the Body's end:
Default 69.9 kB (70.0), Document 72.5 (72.6), Gallery 59.9 (60.1), a Map 18.5 (18.5,
−56 B), `<clover-viewer>` 113.8 (114.2) and its entry 94.7 (95.0), the elements' other
pages −0.23 to −0.40; `<clover-canvas>` alone +0.26 (83.5, A17's chunk). Budgets follow.

- **A17: done, the largest.** `annotation-collection.ts` loads on demand
  (`loadAnnotations`, only for a Root given `annotations`); `manifestOfAnnotation`, which
  picking an annotation needs at once, moved to `annotation-sets.ts`; the `search`
  method's body moved into the lazy `core/search.ts` (`searchInto`; a search whose code
  will not load still says so). −0.13 to −0.16 kB a template, −0.22 to −0.27 the element
  pages. `<clover-canvas>` alone loads `LoadedCanvas`, which imports the reader
  statically: there it is now a chunk of its own, +0.25.
- **A19: done.** `useSvgReader` on `useLoaded`; the elements' `later.ts` re-exports
  `hooks/useLoaded` (its copy had no rejection handler). −10 B a Canvas, −0.05 to −0.09
  the element pages.
- **A14: done.** `selectCanvas(manifest, id)` (a Map per Manifest's sequence, the first
  of a repeated id) in `core/selectors.ts`, for the hooks, the elements' API, `Label`,
  the Primitives, `annotation-sets` (`canvasesById` went), the Announcer and the core;
  `navigationOf` in `core/clover.ts`, with `Navigation`. React flat; the element pages,
  where both copies loaded, −0.13 to −0.15.
- **A16: the guards, and `vtt.ts`'s own `fetchOnce`.** A paged Collection's and an
  AnnotationCollection's `next` are followed once each (a loop listed members again); a
  fix, +18 to +21 B a template, since `load.ts` loads up front. `loadVtt` and `loadText`
  share a helper in their one module. No `followPages` or shared `fetchOnce`: the pagers
  and caches sit in up-front and lazy chunks apart (`load.ts`, `annotation-collection`,
  `search`; `vtt`, `imageService`, `gltf`).
- **A18: not merged.** `useResolvedSource` for Items, the Thumbnail, the placeholder, the
  Annotations panel and the player, measured two ways: loading the resolver on demand,
  the templates −0.18 but a Canvas alone +64 B and each part alone +0.13 (a dynamic
  `import()` of a module also imported statically keeps every export of it, even
  through a one-line module re-exporting the one); static, the templates −0.04 to
  −0.06. Either way the element pages +0.1 to +0.2: each element's chunk holds one copy,
  and the hook became a chunk of its own. Its region-key fix was moot (the panel's source
  is rebuilt per region; the others carry none). Undone.
- **A13: not merged.** `useKeptSnapshot` (the selector's cache, shared with the
  elements' `useWatched`) and `useChannel` for the eight channel reads: +31 B a Canvas,
  +37 a Timeline, +25 to +92 the element pages. Undone.
- **A15: not merged.** `onObject` on three of the simple memos measured +18 to +29 B a
  template, +40 to +80 the element pages: gzip had folded the hand-written ones. Undone.
- **A12: not merged.** One `decodeEntities` for `toPlainText` and `cueText` cost +5 to
  +24 B up front (templates, a Map: `text.ts` is there for every Label) to save in the
  lazy media and Transcript chunks, A10's trade. The two tables differ: cues know `&lrm;`
  and `&rlm;`, IIIF HTML does not.
- **A20: not done.** The upgrader turns a Presentation 2 range's `canvases` strings into
  objects whose ids end `/xywh=…` (checked), which no rewrite before upgrading can express
  in Presentation 2's shape, so `rangeItemTarget`'s repair after it stays.

- **A12. `decodeEntities`**, one decoder in `core/text.ts`: `toPlainText` and
  `vtt.ts`'s `cueText` both use it, and `geo.ts:121` uses `toPlainText`. Fixes bug 2. Est.
  ~0.2 kB off the media and Transcript chunks.
- **A13. `useStore(source, select, isEqual)` and `useChannel(channel)`** in
  `react/context.ts`. They replace:
  - eight hand-written `useSyncExternalStore(c.subscribe, c.get, c.get)` calls (Search,
    Contents, Transcript, Annotations, `Canvas/Connected.tsx` three times);
  - the snapshot cache written twice (`context.ts:44-52`, `web-components/elements/nodes.tsx:33-48`);
  - three store selectors (`context.ts:38-76`, `Root/useRootState.ts:173-182`);
  - two element-prop subscriptions (`host.tsx:182-188`, `elements/toggle.tsx:17-25`).

  Est. ~0.2 kB.

- **A14. One set of selectors for React and the elements.** `useActiveCanvas`,
  `useNavigation`, `status`, `sequence` and `visibleCanvases` are each written in both
  `react/hooks.ts` and `web-components/elements/api.ts`. Move them into
  `core/selectors.ts`:
  - `selectCanvas(manifest, id)`, memoized on the Manifest: today a find is written ten
    ways, and `canvasesById` rebuilds a Map on every miss;
  - `selectActiveCanvas`;
  - `navigationOf`.

  WEB-COMPONENTS.md's "one implementation" asks for exactly this. Est. ~0.2 kB, and lookups
  in O(1).

- **A15. `core/memo.ts`: `onObject(compute)` and `onObjectAnd(compute)`** replace sixteen
  hand-written WeakMap memos. They are in `selectors.ts`, `items.ts`, `annotation-sets.ts`,
  `ranges.ts`, `geo.ts`, `layout.ts` and `models.ts`. Est. ~0.2 kB on every Root page.
- **A16. `fetchOnce(cache, key, make)` and `followPages(first, read, max)`** in
  `core/request.ts`.
  - Fetch once: `vtt.ts:97-151` (twice), `imageService.ts:270-307`, `gltf/load.ts:161-178`.
  - Follow pages: `load.ts:115-147`, `annotation-collection.ts:37-53`, `search.ts:30-40`.
    Only search guards against a cycle; every pager gets the guard.
- **A17. `core/clover.ts` stops loading what only some Roots use.** It is one closure, so
  no method tree-shakes. Its static imports bring:
  - `annotation-collection.ts`, used only by the `annotations` prop and `selectAnnotation`
    (`clover.ts:8-12, 566-569, 618-638`): import it on demand, as `./search` already is;
  - the `search` method's body: it moves into the lazy `core/search.ts`.

  Est. ~0.6 kB on every Root page. (Loading the content-state reader on demand is B6.)

- **A18. `useResolvedSource(source, size, request, { near, reset })`**, exported from the
  parts. It replaces one effect written seven times (checked):
  - `Items/Item.tsx:25-49`, `Primitives.tsx:316-331`, `Annotations.tsx:769-793`;
  - `Canvas/Placeholder.tsx:48-69`, `media/Player.tsx:70-94`, `media/useMediaElement.ts:82`;
  - `templates/document/Sheets.tsx:473-489`.

  It loads `core/thumbnail` through `useLoaded`, so a standalone Canvas still does not
  carry it. Its key includes the region. Est. ~0.1 kB Default, ~0.25 kB Document.

- **A19. `useSvgReader` on `useLoaded`.** It keeps its own copy of the module cache and
  `live` effect (`Canvas/useSvgReader.ts:10-43`). The web components' `elements/later.ts:10-35`
  is a third copy of `useLoaded`, without its rejection handler. Est. ~0.15 kB Canvas,
  ~0.15 kB elements.
- **A20. The upgrader's fragment workaround in one place.** `keepFragments` also rewrites
  Range items, and `ranges.ts:38-54` (`rangeItemTarget`, run on every `chaptersOf`) goes.
  Confidence medium-low: check Presentation 2 string items.

### Panel, sections and parts

**A21 to A25: done (2026-10-27), by the same test.** Measured against the core's end:
styles.css −29 B, Default −17, Document −39, Gallery −10, the elements' pages −33 to −77;
a Canvas, Timeline or Scene alone +10 to +17 (A24's Tip). Budgets follow. gzip had
already folded most of these copies, inside a chunk and in the one stylesheet alike, so
the gains are tens of bytes, not DRY.md's hundreds, and a shared piece the elements'
build gives a chunk of its own costs every element page.

- **A25: two families.** The language codes in one sheet, `ui/Codes.css` (owned by
  Annotations and the Transcript in `clover-sheets.mjs`), on the classes they had,
  through `:is()`, so no markup or class changed; each part keeps where its row sits.
  Search's two identical hidden-status rules as one. −29 B styles. Measured ceilings for
  the rest (each family's second copy cut from the built sheet): the codes 60 B, the held
  find field 152 (its rules differ in their custom properties and selectors: a rename of
  both parts' for under 100 B), and under 30 for the quiet text buttons (About's is in
  the lazy `PartOfManifest`, apart from ReadMore), Steps' ends and Scene's fade. Not taken.
- **A21: the language rule only.** `startingLanguage` takes the reader's pick, for both
  scopes: −4 B React, −49 the element. `SetHeader`, the header both scopes write in the
  one module, measured +59 on the part (its props cost more than gzip's fold of the copy).
  Routing "view" through the layers changes what readers see: still Mat's to confirm.
- **A24: `hideUntilBack` only** (`ui/Tip.tsx`, for the Tip and Items' full titles, on
  every template page): −11 to −40 B a template, −21 Items alone; +10 to +17 a Body part
  alone, which has the Tip and not Items. `useSizeProperty`: each copy measures
  differently, and only Sections' and About's load together. The row highlight, "play or
  go" and `AboutSection`: their copies are in separate lazy chunks.
- **A22: not merged.** One `ui/Chevron` for the Pager, Items, Sections and frames: React
  −3 to −5 B, the element pages +121 to +138 (the glyph became a chunk of their own).
  The end rules (`aria-disabled`, out of the tab order, focus kept) already agree.
- **A23: not merged.** Search's and the Transcript's find are separate lazy chunks: a
  shared `FindField`, `useChunks` or `CodeChoice` would be a chunk of its own beside them.

- **A21. Annotations through one tree.** `scope="view"` (`AnnotationGroup`,
  `Annotations.tsx:179-308`) and `scope="all"` (`AnnotationLayers`, `:463-707`) each write
  the set header, the language pick and the list. Route "view" through the layers,
  filtered to the view. Same-labeled pages in view would then share one header and one
  hide toggle, as "all" does (Mat to confirm). At least extract `SetHeader` and
  `useLanguagePick`. Est. −100 lines, ~0.35 kB in the Annotations chunk.
- **A22. `StepButton` and `Count` in `ui/Steps.tsx`.** They serve the Pager
  (`Pager.tsx:84-209`), Steps (`Steps.tsx:40-113`), Items' arrows (`Items.tsx:534-587`) and
  Sections' arrows (`Sections.tsx:407-441`). One `Chevron` serves them and FrameAnimation.
  Shared rules: `aria-disabled` and `tabIndex={-1}` at an end, so the press that reaches it
  keeps focus (2.4.3), and a count that keeps the room of its widest value. Est. ~0.25 kB
  in the Search and Transcript chunk.
- **A23. Search's and the Transcript's find in one place.**
  - `useChunks` (chunked drawing: `Search.tsx:141-175`, `Transcript.tsx:232-267`).
  - A `FindField` wrapper beside FieldPill: the held field, its measured height and the
    status, today written twice.
  - `CodeChoice`, the code radios written in Annotations (`:716-758`) and the Transcript
    (`:333-379`).

  Bytes about even. AGENTS.md says the Transcript follows Search's rules; this makes that
  one implementation.

- **A24. Small shared hooks.**
  - `useSizeProperty`: measure a box and write it to a custom property, written five times
    (Sections, About, Search, Transcript, `useBarHeight`).
  - `hideUntilBack`: Escape hides a popover until the pointer or focus returns, written
    twice (`ui/Tip.tsx:232-252`, `Items/clamped.ts:48-81`; WCAG 1.4.13).
  - `highlightProps` and `playOrGo`: a row's highlight, and "play from here, else go
    there", each written three times (Annotations, Search, Contents, Transcript).
  - `AboutSection`: About's titled section, written three times (`About.tsx:121-140`,
    `Collection.tsx:48-66`, `PartOfManifest.tsx:33-42`).

  Est. ~0.3 kB in all, and AGENTS.md's "A press on a time plays" gets one implementation.

- **A25. CSS families written once (DESIGN.md §4).**
  - The small pill controls: `Annotations.css:79-131` is `Transcript.css:62-116` line for
    line, and `HideToggle.css` and `Steps.css:36-64` draw the same look.
  - The quiet text buttons: `ReadMore.css`, `Panel.css:361-383`, `Annotations.css:208-232`.
  - Search's and the Transcript's held field, `mark`, hidden status and sentinel:
    `Search.css:24-197` against `Transcript.css:123-255`.
  - "Headings scroll with the content", repeated per piece in Sections, Search and the
    Transcript: decide it once as `--clover-sections-stick`.
  - Steps' "a step at an end" (`Steps.css:66-89`), which repeats `Button.css:86-130`.
  - Scene's controls fade and scrim (`Scene.css:18-76`), which repeat `Canvas.css`'s show
    and fade lists.

  Est. ~0.45 kB styles, ~8 KB raw. `build/clover-sheets.mjs`'s `OWNERS` must list each
  family's members, or an element loses rules. Check 1.4.3, 1.4.11, 2.4.7, 2.5.8 and forced
  colors per member.

### Templates

**A26 to A30: done (2026-10-27); A26 and A29 after Decision 7.**
Measured against the parts' end: Default 69.8 kB (−95 B), Document 72.2 (−248),
templates.css 2.0 (−99), styles.css +37, `<clover-viewer>` −94, one in Document −245, its
entry −204; Gallery +6, and element pages with no template +47 to +101. Budgets follow.

**How to read the element pages' figures:** each element's chunk is named by a hash of its
content, and every chunk that imports it names it, so a change in one chunk (Document's)
renames chunks up the chain (the viewer's, the entry's) and the imports in most others.
Pages that load none of the changed code move by tens of bytes (`composedPageGzip` +48 for
a line of Document's sheet). Treat element differences under about 50 B as noise.

- **A27: the drawer and the wash, through `Default.css`.** Both templates set
  `clover-template-panes`, `-drawer` and `-scrim`; the rules are Default's, rewritten on
  those classes (same specificity), and Document's copies went. templates.css −189 B,
  Document's element −133, at +16 B of class names in Default's JS and +5 in styles.css.
  A sheet of their own (`templates/shared/Drawer.css`) was tried first: its rules rode
  apart from the shared styles run (every `templates/` sheet but Default's does), and it
  added a registry entry and five classes: element pages +40 to +100. The title and
  spine families are too small for a class on both templates. Document's washes now honor
  reduced motion, as Default's did. Not taken: Document's docked panel's
  `overscroll-behavior: contain` (Default's has none), which is the docked panes', not the
  drawer's.
- **A28: done.** Each spine is a box of no width in the Split's row after its bar, the
  toggle hung from it (`translate: -50%`, mirrored right to left; Document's thumbnails
  capped by the control's radius; on a phone at their edge, from
  `--clover-template-sidebar-width`, the sidebar's own width). `useSpine` became
  `useSpineTop`, Default's alone (Document's top always measured 0). Default −111 B JS,
  Document −270, for +32 styles and +72 templates.css. Checked: `document.spec.ts`'s 1px
  geometry on all five projects, and Default's toggle against the old formula
  (`offsetLeft` + half the bar) left to right and right to left, equal to the pixel. A
  page whose `lang` turns right to left after it draws keeps the toggle where it was until
  it restyles (Chrome's `:lang()` invalidation; the old code read direction only on a
  resize).
- **A30: the template drawn directly.** `<clover-viewer>` renders its template rather
  than the Viewer's shell: −101 B, −145 its entry. `ONLY` stays a table: moving it into the
  spec costs the spec what it saves.
- **A26: Document's two drawers on `useDrawer`; Default keeps its own.** Decision 7's
  rule, one way in each: `templates/shared/useDrawer.ts` (two choices, beside and over;
  focus on opening over, handed back on closing or narrowing; Escape, the wash, the drag)
  for Document's panel and thumbnails, with one `useFollowFocus` for both (two raced: the
  panel's follow took focus the thumbnails' toggle was owed). On narrowing, each follows
  its toggle only where focus was in its pane or on its toggle, read as the render begins
  (the commit removes the toggle from the spine, and focus with it); Default, with one
  drawer, follows on every narrowing, which also fixes its dropping focus that was on the
  panel's toggle. Default writes the same rule inline. Measured, each against the
  templates round's end:
  - all three on `useDrawer`: Default +80 B, Document +94;
  - Default on its own code: Default −28 to −35, Document +111 before A29.

  Document with the rule written twice in its own code measured +142, so the hook pays
  there (48 B); in Default it only added its generality (74 B). **Lesson:** Default loads
  lazily on Document's page (`<Viewer template={Document}>` keeps the Viewer's default),
  so whatever Default imports from `templates/shared/` is up front on Document's page
  too: a shared helper only Default used (`useFocusOnOpen`) cost Document 73 B, and
  Default's import of `panelFocus` from `useDrawer.ts` put the hook in `<clover-viewer>`'s
  entry (+344 B) until `panelFocus` moved to `useSlide.ts`, which both load anyway.

- **A29: done.** Document's thumbnails float by its own width (`useWideEnough`, under
  40rem), not `matchMedia`; its sheet keys on `data-narrow` instead of
  `@media (max-width: 40rem)`, and their bar is left out while they float (the CSS that
  hid it also hid a docked panel's bar between 31 and 40rem). Measured before paint, so
  no phone paints them open (an earlier note here said it would), and no server render
  mismatches its hydration. Document −99 B, templates.css −8, Document's element −79.
- **A26 and A29 together:** Default 69.7 kB (−44 B), Document 72.3 (+82: the
  thumbnails' new Escape and focus, and focus kept on a toggle as narrowing moves it),
  templates.css −8, `<clover-viewer>` −92 B, one in Document +94, its entry −28. Budgets
  follow.

- **A26 (done, above). `useDrawer` and `Spine`** in `templates/shared/`. Default's panel
  (`Default.tsx:83-273`), Document's panel and Document's phone sidebar
  (`Document.tsx:136-421`) are one drawer written three times: slide, focus on open,
  drag, hand-back, Escape, the scrim, the pane's props and the 16/14/24rem constants. They
  diverge by accident:
  - focus is handed back three ways: `useFollowFocus`, at once, and Panel's `controlOf`;
  - the toggle's selector is written three times, one copy without `[data-button]`;
  - the phone sidebar has no Escape and takes no focus on open;
  - and bug 5.

  `useWideEnough` returns `undefined` until measured, so arrival is never read as
  narrowing. Default calls `useDrawer` once, Document twice. Est. ~0.3 kB Document, −150
  lines. The rules it picks are Mat's (Decision 7).

- **A27. Default.css and Document.css write the drawer, scrim, spine, title, root and
  provider families twice** (rule by rule in the template survey). Write them once in
  `styles.css`, where Default.css is, through `:is()` lists, or through
  `clover-template-drawer` and `clover-template-scrim` classes set by `useDrawer`. Document
  keeps only its own. Document's docked panel contains overscroll and Default's does not;
  Document's scrim ignores reduced motion: pick one. Est. ~0.3 kB templates.css.
- **A28. The spine placed by CSS.** `useSpine` measures on every resize
  (`templates/shared/useSpine.ts:20-60`), and in Document it always measures 0px. An in-flow
  zero-width flex item after the handle places it, right to left for free; Default keeps a
  small effect for its header's `top`. Est. ~0.3 kB Document, ~0.15 kB Default.
  `e2e/specs/document.spec.ts:113-190` checks the geometry to 1px. Re-check 2.4.11 and
  2.5.8.
- **A29 (done, above). Document decides "narrow" by its own width**, as Default and the Split rule do
  (`useWideEnough`), not by `matchMedia` and `@media (max-width: 40rem)`
  (`Document.tsx:81,124-128,158,204-206,427-439`; `Document.css:469-490`). Est. ~0.13 kB.
- **A30. The Viewer element and spec.** Give each spec attribute `templates: [...]`, and
  derive the element's `ONLY` table from it. Today `ONLY` restates what the descriptions'
  "Default and Document:" prefixes already say. Render the template directly
  (`elements/viewer.tsx`). Est. ~0.3 kB `<clover-viewer>`. `docs/lib/compose` reads the
  description pattern: keep it.

## Phase 3: load it when it is needed

Behavior stays, but a first use may wait one request. Each is a decision for Mat, as the
wait is visible, but none drops a feature.

**B1 and B2: done (2026-10-27, Mat's yes).**

- **B1:** `shared/LightboxBody.tsx`, the Body alone, lazy in `Lightbox.tsx`; the pager
  stays up front (Items is the grid's), so the dialog has its title, Close and "2 / 9" at
  once, and a busy box of the Body's height and a Canvas's background holds its place
  (`clover-template-lightbox-pending`, in `Lightbox.css`, so the elements' sheets have it
  with Gallery). The Gallery's Root starts the load on the reader's first pointer or focus
  (`preloadLightbox`), so the wait is usually gone by the press. Gallery 59.9 → 26.8 kB
  (−33.1), templates.css +23 B.
- **B2:** `document/DocumentPanel.tsx`, the Panel, loaded by hand (state, not `lazy`):
  a pointer or focus on its toggle starts it (`reach`, on the Split), opening loads it
  (an effect, for `defaultPanelOpen` or widening), and a first press waits for it, then
  opens the pane whole, so `useDrawer`'s focus finds the section without retrying past a
  Suspense boundary. Document 72.3 → 66.2 kB (−6.1). A `<clover-viewer>` in Document
  +114 B: the viewer element's entry holds Default, and with it the Panel, so the chunk
  saves that page nothing; it would only if the element loaded Default lazily too, which
  costs the default viewer a request. Budget raised to 120.2 kB.
- `bundle.test.mjs` holds both: the Body and the Panel are reached from their templates
  only on demand.

**B3 to B9: done (2026-10-27, Mat's yes), B8 last, on its own.** Each
measured on its own, in order (quick consumer bundles of `dist/` after `vite build`), then
all together by the full build:

- **B3:** the renderer's `overlays` is `null` until `overlaysOf(renderer)` (in
  `OverlayLayer.ts`, which only the hotspots' chunk and `panClearOfControls` import) makes
  it, appended after the renderer's layers as before. Canvas −365 B, Default −408,
  Document −392. `hasCamera` still reads `"overlays" in surface` (the field is `null`, not
  absent).
- **B4:** `useVideoSize` and `containAspect` live in `MediaBody`, which reports the
  fitted rect (`onFit`); CanvasView keeps one state and `fitted ?? media.placement`.
  Canvas −184, Timeline −175, Default −136, Document −133.
- **B6:** `core/content-state-reader.ts` (decode, resolve), loaded by `loadContent` only
  for a content state; `isContentState` and the writer stay. Every page with a Root
  about −0.4 kB (a Root and Label −407, Default −354, Map −415); a lone Canvas, which has
  no loader, unchanged. `decodeContentState` stays a public static export (from the
  reader), so the reader cannot join `LAZY_MODULES`.
- **B9:** `components/Items/StandaloneItems.tsx`, lazy, importing `ItemsView`, `Pager`
  and `stepsOf` back from `Items.tsx` (now exported). Default, Document and Gallery −267
  each. Items standalone with `items` no longer renders in a server's first pass.
- **B7:** Canvas2D's code loads the first time a renderer needs it (one promise for the
  page); the canvas waits, `pending`, given back if the renderer releases meanwhile. The
  DOM layer is made with the first frame holding an element, inserted before the
  hotspots' layer, the canvas before both. Canvas −506, Default −504, Document −495: half
  the estimate, the two modules being ~650 B gzip each alone and less in a bundle.
- **B5:** MapLibre waits for `useNearViewport` on the map's box; `LoadedMap` (lazy) holds
  the standalone Root, a box of the map's height in its place meanwhile. Map 18.0 →
  11.8 kB (−6.2); Canvas, Label and Default unchanged, so the lazy Root hoisted nothing.
  Not done: the Map's `Loading` and `BodyAlert` (a visual change that adds bytes, not
  saves them; the map keeps its own loading status and alert).
- **Together** (full build, against B1 and B2's end): Default 68.1 kB (−1.67), Document
  64.5 (−1.69), Gallery 26.2 (−0.67), Canvas 37.7 (−1.06), Timeline 23.2 (−0.18), Map 11.8
  (−6.65), `<clover-root>` and `<clover-label>` −0.39, all elements 112.0 (−1.54), their
  composed page −1.54, a layout −1.53, `<clover-canvas>` −1.25, `<clover-viewer>` in
  Document −1.54, its entry −1.67. Budgets lowered to each with ~250 B to spare.
- **B8: done.** `components/Canvas/AnnotationState.tsx`, now what CanvasView loads for a
  Canvas with annotations (`loadHotspots`; it imports `Annotations.tsx`, so no cycle),
  holds the state that was CanvasView's: the pages shown and their quiet OCR, the
  hotspots' placing, hover and pick, framing a pick once drawn, seeking on a recording,
  the placeholder's quiet open, the caption's comments. It draws the hotspots (a portal,
  so its place in the tree is free) and reports a model (`onModel`, in a layout effect,
  memoized, `null` as it unmounts); CanvasView reads it through a ref for what outlives
  a render (the surface's dismiss, the `onReady` handle's `zoomToAnnotation`) and keeps
  an empty one until it loads. The host's annotation props reach it as the Canvas's whole
  props (`given`), so CanvasView lists none of them. Canvas −1.47 kB, Timeline −1.40,
  Default −1.50, Document −1.49, all elements −1.56, `<clover-canvas>` −1.58; Gallery
  −19 B. Tests that clicked the moment a Canvas opened now wait for the chunk, as the
  Canvas's own did (`loaded()`); the 2026-10-19 pick and framing held, unit and e2e
  (annotations, hotspots) on all five projects.

|     | What                                                                                                                                                                                                                                                                                                                                                                      | Est.                                        | Wait it adds                                                                                             | Recorded                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| B1  | **(done, above) Gallery's lightbox Body on demand**: `Lightbox.tsx:92` mounts the Body only while open, but imports it statically (checked). A `LightboxBody` module of one re-export, lazy; the dialog's header stays static, so it is named and focus lands on Close at once.                                                                                           | **Gallery −34 kB** (60.8 → ~27)             | The Body appears a moment after the first open                                                           | —                                                                                                                  |
| B2  | **(done, above) Document's Panel on demand**: it starts shut (`defaultPanelOpen = false`, checked) and loads Panel, Sections, About, Primitives, ReadMore and Markup up front. A `DocumentPanel` re-export, lazy, rendered once first opened. PanelToggle and the pane stay, so `aria-controls` resolves. `useFocusOnOpen` waits for the section's button.                | **Document −7.3 kB**                        | The first open                                                                                           | —                                                                                                                  |
| B3  | **(done, above)** **`OverlayLayer` with the hotspots**: built in every renderer's constructor (`CanvasRenderer.ts:35,155,220`, checked), used only by annotations. `setOverlays()`, as `attachNavigator` is.                                                                                                                                                              | −1.0 kB Canvas, Default, Document, Timeline | None: the hotspot chunk loads anyway                                                                     | —                                                                                                                  |
| B4  | **(done, above)** **Video sizing into MediaBody**: `useVideoSize`, `videoPlacement` and `containAspect` (`CanvasView.tsx:515-523, 1351-1397`) run only for video.                                                                                                                                                                                                         | −0.3 kB Canvas                              | None                                                                                                     | —                                                                                                                  |
| B5  | **(done, above)** **The Map near the window**: `import("maplibre-gl")` runs at mount (`MapView.tsx:242-247`), so a Map far down a page loads 290 kB at once. Gate it on `useNearViewport`. Move its `Root` wrapper into a lazy `LoadedMap`, as LoadedCanvas is. Give it `Loading` and `BodyAlert` like the other Bodies.                                                  | **Map −8 kB initial**; 290 kB deferred      | None on a visible map                                                                                    | AGENTS.md records a lazy chunk importing `Root` hoisting the core into a standalone Canvas: check with `sizes.mjs` |
| B6  | **(done, above)** **The content-state reader on demand**: `decodeContentState`, `resolveContentState` and friends (`content-state.ts:40-169`) load on every Root, used only for a non-URL `iiif-content`. Split the writer (stays) from the reader (lazy, fetched alongside the upgrader).                                                                                | −0.6 kB every Root                          | A content-state link (not a URL) waits one small chunk                                                   | —                                                                                                                  |
| B7  | **(done, above)** **Canvas2D and DomLayers on demand**: Canvas2D serves only a 7th context, a lost context or no WebGL2; DomLayers serves only `dom` video and images without CORS. Both load in every Canvas.                                                                                                                                                            | −1.6 kB Canvas, Default, Document           | The fallback, or a no-CORS image's first frame, waits one chunk; the Body shows its background meanwhile | "Canvas2D is a full-fidelity fallback" (Mat, 2026-10-08): kept, only later                                         |
| B8  | **(done, above)** **The Canvas's annotation state into the hotspot chunk**: about a quarter of CanvasView (`:169-344, 620-917, 1253-1272`) runs for every Canvas, though most have no annotations. A lazy `AnnotationsController` owns it and reports a small model back. Its "starts hidden" test is `annotation-sets.ts`'s `startsHidden`, written again at `:182-202`. | −1.5 kB Canvas, Default, Document           | One render more when the model changes                                                                   | The 2026-10-19 pick and framing behaviors must hold; the largest refactor here                                     |
| B9  | **(done, above)** **Standalone Items in its own module**: `StandaloneItems` and its header (`Items.tsx:212-294, 468-627`) ride in every template, where Items is always in a Root.                                                                                                                                                                                        | −0.35 to −0.45 kB Default, Document         | Standalone Items given `items` no longer renders in the server's first pass                              | "Items is the one part for a sequence" (2026-10-16): the API is unchanged                                          |

## Decisions for Mat

Each is a simplification: a behavior or option dropped or narrowed for bytes or
complexity.

1. **Drop `engine="three"`, or move it to an opt-in entry.** **Settled (Mat, 2026-10-27): the
   opt-in entry,** `@nulib/clover/three`, registering the engine as `setMapWorkerUrl`
   registers the worker; `three` an optional peer dependency, out of the install and the
   web components; the docs' comparison kept; the three claims corrected. **Built:**
   `Scene/engines.ts` (a registry on `globalThis`), `@nulib/clover/three`'s
   `registerThreeEngine()`, the elements' `web-components/three.mjs` (one bundled copy
   for both element builds, the Viewer's none); a Scene +14 B for the registry. It costs no page anything, but:
   - every consumer installs `three` (22 MB);
   - every consumer's bundler emits a 158 kB chunk it never loads;
   - the package ships two copies (~1.25 MB raw).

   It adds less than the docs say. Its own header says it carries no Draco, Meshopt or KTX2
   decoders (checked, `Scene/engine.ts:34-36`), and it runs no animation loop. Yet
   `scene.mdx`, `SceneView.tsx:118-119` and `specs/timeline-scene.ts:122` claim compressed
   models and animations. `engine` cannot reach a Scene through `Body` or the Viewer either.
   Options:
   - drop it, keeping `three` as a devDependency for the lighting comparison;
   - or `@nulib/clover/three`, which registers the engine as `setMapWorkerUrl` registers
     the worker.

   Fix the three claims whatever is chosen.

2. **Drop the `texture` video presentation.** **Settled (Mat, 2026-10-27): dropped;**
   `dom` only. A painting over a video, if a recipe ever needs one, is the DOM layer's to
   solve. **Built:** Canvas −328 B, Default −360, Document −331, Timeline −73 (the
   estimate's 0.8 kB was high). The iPhone placement in `fullscreen.ts` stays: sound's
   element, never placed in the scene, needs it too. Nothing in the package, templates or docs
   uses it but one recipe comment. It costs ~0.8 kB in every Canvas plus ~0.2 kB lazy, in
   `CanvasRenderer`, `WebGL2Backend`, `fullscreen.ts`'s iPhone placement and
   `useMediaElement`'s CORS fallback. It is the only way to draw a later painting
   annotation over a video. Reverses Mat's 2026-10-08 decision ("`dom` (default) and
   `texture`").
3. **Accordion headings scroll with the content** **Settled (Mat, 2026-10-27): kept
   as they are,** stacked in sight, the wheel redirect too. instead of stacking at both ends. This
   drops:
   - the ResizeObserver stacks, `keepInSight`, the wheel redirect and the pressed-scroll
     (`Sections.tsx:136-343, 647-689`);
   - their CSS (`Sections.css:165-400, 440-491`, and its echoes in Search.css and
     Transcript.css).

   The cost is ~1.1 kB JS in Default and Document plus ~0.5 kB styles; both templates
   default to the accordion. Nothing is sticky, so nothing can cover focus (2.4.11 by
   construction). Headings no longer stay in sight. Recorded as Mat's ("Accordion headings
   stay in sight", and the wheel redirect of 2026-10-26). The partial option, dropping only
   the wheel redirect, saves ~0.17 kB.

4. **Drop drag-to-close.** **Settled (Mat, 2026-10-27): kept, loaded when needed:**
   the gesture's code loads the first time a drawer floats over the page. **Built:**
   `shared/dragToClose.ts`; Default −671 B, Document −655. `templates/shared/useDragToClose.ts` (the largest shared
   template hook) and the grip's drawing: ~0.85 kB Default, ~0.9 kB Document. The panel
   always closes by its button, Escape, the scrim and the toggle, so dragging was never the
   only way (2.5.7). Loses the app-like swipe.
5. **The drawers' slide in CSS** **Settled (Mat, 2026-10-27): `useSlide` kept.** (`transition-behavior: allow-discrete`, `@starting-style`)
   in place of `useSlide`'s mount and lag states. ~0.13 kB a template. Browsers before
   Chrome 117, Safari 17.4 and Firefox 129 show and hide without the slide.
6. **Timeline as its own view** **Settled (Mat, 2026-10-27): CanvasView kept,** one
   view for recordings. (`TimelineView` on A1's `BodyFrame`, no CanvasView). ~−23 kB
   against A3's −16 kB. Reverses "Timeline renders CanvasView, so every audio recipe that
   played on Canvas plays the same". A3 keeps that and gets most of the bytes.
7. **One rule for the drawers** (A26), for both templates. **Settled (Mat, 2026-10-27):**
   - On arrival, a pane that would float over the Body starts closed, whatever
     `defaultPanelOpen` or `defaultSidebarOpen` say; where it fits beside the Body, they
     decide. The reader opens it with its toggle, and focus goes into it. (Before: both
     templates opened it over the Body without focus, after bug 5.) An open pane on
     arrival covered the Body, focus behind it (2.4.11).
   - Narrowing under an open panel closes it, handing focus in it back to its toggle, and
     widening again puts it back beside the Body: Default's rule, for Document too, which
     floated it and took focus. Zooming in (1.4.10) never covers the page or moves focus.
   - Document's phone sidebar is a drawer like the panel: opening it takes focus to the
     current page's thumbnail; Escape anywhere in the template, the wash, a drag or its
     toggle puts it away, focus back to the toggle (2.4.11: nothing focused stays hidden
     under it).
8. **Annotations' `scope="view"` as layers** **Settled (Mat, 2026-10-27): kept per
   page** (the saving is a few hundred bytes at most, in the panel's lazy chunk). (A21): same-labeled pages in view share one
   header and toggle.
9. **A Timeline view drawn straight by Body.** **Settled (Mat, 2026-10-27): the chunk
   kept** (since A3 it carries `playerSurface`, ~0.75 kB gzip, which every Body page would
   carry instead). `Timeline/Connected.tsx` is ConnectedCanvas
   with a class and `navigator={false}`. ConnectedCanvas is already in Body, yet a Timeline
   view waits behind `Loading` for that 343 B chunk. One request less per Timeline view,
   ~+0.1 kB Body. It reverses a `bundle.test.mjs` entry.
10. **`@iiif/helpers` out of the runtime.** **Settled (Mat, 2026-10-27): replaced**
    by Clover's own `closestLanguage`, held to the original by a parity test (the package
    a devDependency for it), one reading of the reader's languages. **Built:** 1,200
    cases agree; ~−80 B a page with IIIF text (the estimate's 0.25 kB was high). It supplies one function (`getClosestLanguage`,
    `core/value.ts:1`), and its ESM-external import once broke the homepage's server
    render. A ~15-line `closestLanguage` would replace it, held to the original by a parity
    test (there is no `value.test.ts` today). `readerLanguages` (`value.ts:20-26`) and
    i18n's `preferredLanguages` (`i18n/config.ts:67-75`) become one. ~0.25 kB on every page
    with IIIF text. WCAG 3.1.2: which language shows, and its `lang`.
11. **The build target.** **Settled (Mat, 2026-10-27): the default kept;** no
    browser floor raised. `vite.config.mjs` sets none, so Vite lowers optional chaining
    (708 times in `dist/`, checked). At a 2021 floor (Chrome 91, Safari 15) a Default page
    is ~2.5 kB lighter for consumers with modern targets. The budget harness
    (`build/consumer-bundle.mjs`) lowers again on its own, so the budgets move only if it
    moves too.
12. **The undocumented public exports** **Settled (Mat, 2026-10-27):** `readAs`,
    `toPlainText`, `regionSource`, `thumbnailSource` and `buildContentState` documented;
    `createClover` and `isPresentation4` dropped from the exports (`toPresentation4`
    stays). **Built:** the Technical overview's Helpers, `resolveThumbnail` with them. in `parts.ts`: `regionSource`, `thumbnailSource`,
    `readAs`, `toPlainText`, `isPresentation4`, `createClover` and `buildContentState`. No
    bytes either way (they tree-shake), but 4.0 fixes the API: document them or drop them.
13. **`defineCloverElements`' `styles` option.** **Settled (Mat, 2026-10-27):
    dropped;** a page styles Clover with its own stylesheet. **Built:** the elements'
    entry −158 B. Nothing in the package passes it (the
    build hands none; each sheet comes with its code), only tests, but the CHANGELOG
    offers it to a page: a stylesheet handed in whole, or a loader, injected before
    Clover's sheets. Dropping it takes its run-ordering code out of the entry every
    element page loads (~0.15 kB, `elementsEntryGzip`) and changes eight test files.
    Keep it if a host may want its own CSS injected in Clover's place; drop it if a
    page's own `<link>` is enough.

## Package and build (not page weight)

- **The viewer entry repeats 18 of the main folder's files byte for byte** (checked):
  MapLibre and its worker, hls.js, DOMPurify, the upgrader, the seven locales and six small
  leaves. Two Rollup builds cannot share chunks; their names are content hashes, so a
  post-step can delete each identical file in `viewer/` and point its imports at `../`. The
  three.js chunk becomes a shared leaf too. That is ~0.65 to 0.8 MB gzip of the package's
  2.35 MB, with no page change. A page loading both entries then shares one MapLibre and
  one hls.js. The cost is that `viewer/` no longer works copied alone. AGENTS.md records the
  0.8 MB this costs (phase 8) as waiting for release prep. **Done (Mat, 2026-10-27:
  "do it"; nothing is released, so no one copies `viewer/` alone yet):**
  `build/dedupe-viewer.mjs`, run by `build:web-components` after the Viewer's build, takes
  20 files (1.71 MB, 0.49 MB gzip) from the folder above, rewriting what names them in
  `viewer/` and its chunk map, and fails the build if a reference is left. `viewer/` is
  0.18 MB gzip in 45 files, `dist/` 1.55 MB; `viewerEntryGzip` 90,001 B (+5, the longer
  paths). Checked in a browser from the built files: the French strings, the upgrader,
  MapLibre and its worker (a navPlace Manifest's two points drawn) and DOMPurify all load
  from `../`, none missing. The docs' Technical overview tells a host serving the files to
  copy the whole `web-components` folder. `test:build` holds it (Mat, 2026-10-27): from
  the entry's two files it follows every file named (64, 20 of them above) and fails on
  one that is missing or outside `web-components/`, checked by moving a language away,
  putting a `../` back to `./`, and naming a file outside.
- **`no.json` is `nb.json`** (checked with `cmp`). **Not taken (Mat, 2026-10-27):**
  Norwegian has three tags, `no` (Norwegian), `nb` (Bokmål) and `nn` (Nynorsk), and each
  keeps a file of its own, so it can be translated apart; their being alike today is no
  reason to merge them.
- **The i18n lookup chain is rebuilt on every string** (`i18n/config.ts:118-126`), reading
  `navigator.languages` and `<html lang>` each time. Items with hundreds of tiles call `t`
  per tile. Memoize it on the version and the two languages. CPU, not bytes. **Done (Mat, 2026-10-27):**
  `lookupChain` is kept, made again only as the version, `<html lang>` or the browser's
  languages change. 20,000 strings in 31 ms against 46.5 (jsdom), about 0.8 µs a string;
  +54 to +85 B a page gzip, kept at that cost (Mat).

## What it adds up to (est.)

| Entry                | Now          | Phases 1–2         | With phase 3 | With the decisions                             |
| -------------------- | ------------ | ------------------ | ------------ | ---------------------------------------------- |
| Default (the Viewer) | 70.8 kB      | ~−4.5 kB           | ~−8.5 kB     | ~−12 kB, ~−14.5 with the build target (~20%)   |
| Document             | 73.3 kB      | ~−5.5 kB           | ~−16.5 kB    | ~−20 kB (~27%)                                 |
| Gallery              | 60.8 kB      | ~−4 kB             | ~−38 kB      | —                                              |
| Canvas               | 38.9 kB      | ~−3.5 kB           | ~−7 kB       | ~−8 kB                                         |
| Timeline             | 38.9 kB      | ~−16 kB (A3)       | ~−17 kB      | ~−23 kB (Decision 6)                           |
| Map                  | 18.4 kB      | —                  | ~−8 kB       | —                                              |
| Scene, initial       | 15.6 kB      | its chunk ~−1.5 kB | —            | —                                              |
| styles.css           | 15.6 kB      | ~−0.6 kB           | —            | ~−1.1 kB (Decision 3)                          |
| The package          | 2.35 MB gzip | —                  | —            | ~−0.7 MB (viewer chunks), −1.25 MB raw (three) |

## Order of work

1. **Fix first**: done, all eight (2026-10-26 and 27).
2. **Phase 1**, dead code: done (2026-10-27).
3. **A1 to A11 (the Body)**: done (2026-10-27): A2, A3 and A11 merged, A4's fix, the
   rest measured or reasoned not to pay (above).
4. **A12 to A20 (core)**: done (2026-10-27): A14, A17 and A19 merged, A16's guards; the
   rest measured not to pay, or (A20) not possible (above). **A21 to A25 (parts and CSS)**:
   done (2026-10-27): A25's codes and Search's status, A21's language rule, A24's
   `hideUntilBack`. **A27 to A30 (templates)**: done
   (2026-10-27): A27's drawer and wash, A28, A30; then, Decision 7 settled, A26 (Document's
   drawers on `useDrawer`, Default its own) and A29. Phase 2 is done.
5. **Phase 3**, B1 and B2 first (the largest wins), each with Mat's yes: B1 and B2 done
   (2026-10-27), then B3 to B9 the same day. Phase 3 is done.
6. **The decisions**, as Mat makes them.
7. After each step: `npm run build`, compare `build/sizes.json`, lower the budgets to what
   is measured, and note the change under the CHANGELOG's Unreleased.

## Checked and fine

Looked duplicated, and is not worth unifying:

- **Sections' tabs and accordion as one component**: recorded, a runtime layout.
- **Collection's 12.6 kB** is Items plus Summary, ReadMore and Markup. In a template it is a
  0.7 kB lazy chunk.
- **The Panel's default sections as a table**: measured +5 B. Their five `React.lazy` are
  recorded.
- **Sheets as an Items layout or a Body renderer**: either would put a second listbox of the
  same views on the page, or make every Items or Body user carry Sheets' code.
- **The drawer as a `<dialog>`**: the top layer covers the whole window, not the Viewer's box,
  and it would remount the pane at the snap point.
- **`lib/gltf/mat4.ts` against `lib/renderer/math/affine.ts`**: 4×4 float32 for WebGL
  against six float64 numbers in 2D, by design. `CameraAnimator` against Scene's orbit, and
  `GestureController` against Scene's gestures, are different models; only the wheel and
  pinch are shared (A9).
- **`OverlayLayer` against `Canvas/Annotations.tsx`**: layered, not duplicated (only where it
  loads moves, B3).
- **One menu primitive**: `ControlMenu` already serves AnnotationMenu, ChoiceMenu and the
  frames menu.
- **One list-of-entries primitive for the Panel's lists**: AGENTS.md keeps the rows their
  hosts'. Each row is a tab stop; roving focus would change the keyboard. Only the row
  behaviors are shared (A24).
- **Search hits as an Annotations list**: they already share the store's selection and
  highlight.
- **Search against search-service, geo-detect against geo, region apart from thumbnail,
  `markdownToPlainText` apart from `markdown.ts`**: each split is deliberate, to keep the
  heavy half lazy.
- **The Split's own elements**: recorded (a portal would put a box between siblings).
  `splitting.ts` is shared already; only its handle's actions are still written twice
  (`Split.tsx:85-271`, `elements/split.tsx:50-240`): a `handleActions` there is worth ~40
  lines.
- **Transport.css's separate WebKit and Gecko slider rules**: required; gzip folds them.
- **Body's `Play` against the media icons' `PlayIcon`**: different controls, different
  chunks.
- **Trivial repeats** (`useIsomorphicLayoutEffect` seven times, `below()`, `prefersReducedMotion`
  five times, `useUniqueId().replace(…)`): each under 0.1 kB. Fold them as files are touched.
