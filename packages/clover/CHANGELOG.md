# Changelog

All notable changes to `@nulib/clover` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@nulib/clover` is the composable 4.x Clover. It is not published yet. The 3.x line,
`@samvera/clover-iiif`, keeps its own changelog in `samvera-labs/clover-iiif`.

## Unreleased

### Added

- **The package.** One entry, ES modules only, with named exports, so
  `import * as Clover from "@nulib/clover"` gives dot notation and tree-shakes. Styles
  ship as one stylesheet, `@nulib/clover/styles.css`, in `@layer clover`, so your own
  unlayered CSS wins. Import it once; components never inject CSS. Peers: React 18 or 19.
- **`groupViews`, `resolveBehavior` and `resolveDirection`**, the rules that group a
  Manifest's Canvases into views by `behavior` and lay them out by `viewingDirection`.
- **`initCloverI18n`**, as in 3.x. Clover ships en, es, fi, fr, nb, nn, no and pt.
  English is bundled; each other language is its own chunk, loaded the first time Clover
  is to speak it, so a page in English never fetches one. Until it arrives, Clover's
  words show in English, marked `lang="en"`, and change when it does. Unlike 3.x, Clover
  speaks the language of the page around it: without an `lng`, it reads the page's
  `<html lang>` first and the browser's languages after, so a French browser on an
  English page gets English, as the rest of that page is. IIIF text without a Root
  `language` follows the same order. To speak the reader's browser language whatever the
  page's, pass it yourself:

  ```js
  initCloverI18n({ lng: navigator.language });
  ```

  `initCloverI18n` returns the translator, whose `ready()` settles once the language it
  speaks has loaded. Await it where the strings must be in place before anything draws:
  a server render, or a test that reads them at once.

  ```js
  await initCloverI18n({ lng: "fr" }).ready();
  ```

  Twenty-seven of 3.x's strings that no part shows are gone (`sliderNext`,
  `canvasAnimationPlay`, `playerAnnounce…`, `share…` and others); a `resources` entry
  for one does nothing.

- **`Clover.Root` and its parts.** `Root` loads `iiifContent` and holds where the reader
  is; parts read from the nearest `Root`, wherever they sit in your markup.
  - `Content` draws the current view (a page, a spread, a video or sound) with `Canvas`.
  - `Label` shows the Manifest's label, or the current Canvas's with `of="canvas"`, in the
    reader's language and marked with `lang`. Its lines are balanced, so a long title
    breaks into lines of about one length (`.clover-label` sets `text-wrap: balance`; set
    `text-wrap: wrap` on it to undo that).
  - `Previous`, `Next` and `Position` move a view at a time, a spread at a time in a
    paged book; with `of="members"`, a Manifest at a time through the Collection. All
    three together are Items' `pager` layout (below). Their arrows follow
    `viewingDirection`. `Previous` and `Next` are round arrow controls, as Items' arrows
    are: each names itself on hover and focus, and at the first or last item is
    `aria-disabled` and shows disabled: faded, taking no pointer (whole again, its arrow
    faded, while it has focus).
    `Position` shows "2 / 5", the same in every language, in the room of its widest
    count ("17 / 17"), so nothing beside it moves as it grows; assistive technology reads
    "Item 2 of 5", in the reader's language.
  - `Status` shows loading and errors: loading as Clover's loading mark, a 3px line
    in the accent drawn from start to end, fading in as it goes, announced as "Loading…" (your own `loading` is shown
    and announced as it is). `loading={false}` only announces it, for a layout whose
    `Content` shows it; `Default` and `Document` place it so, and a load no longer moves
    the page.
  - **Loading, without anything moving.** While the Root loads (the first Manifest, or
    one chosen from a Collection), `Content` is `aria-busy` and shows the loading mark
    along its top edge, over the Canvas, taking no room. A Canvas does the same while its
    images load: at first, after it is opened from its placeholder, and after a move to
    another view. The Canvas keeps its size and its background; the mark waits a quarter
    of a second, so a quick load never flashes it. Another Manifest (one of a Collection's
    members, say) clears the Canvas at once: the last Manifest's image and its placeholder
    go before the new one starts loading, rather than both showing together while it
    does. A `Canvas` outside the Viewer does the same when its new `manifestId` prop
    changes. A Canvas that paints no image (sound alone) is never busy: it used to stay
    `aria-busy` for good.
  - `Root` announces each move in a polite live region.

  ```jsx
  <Clover.Root iiifContent={url}>
    <Clover.Label as="h1" />
    <Clover.Content />
    <Clover.Items layout="pager" />
  </Clover.Root>
  ```

- **`Viewer`, the default export**: a Manifest (or a Collection, or a content state) in a
  ready-made layout. With no `template` it draws `Default`, Clover 3.x's Viewer layout;
  for another, pass a template from `@nulib/clover/templates`, or a component of your
  own that takes the `Root` props. The Viewer takes its template's props, and TypeScript
  checks them against it. The Viewer is a shell of under 1 kB that holds no layout, so a
  page ships only the template it passes and the parts that template uses; a template is
  passed rather than named for the same reason. Given none, it loads `Default` on first
  render, as a chunk of its own: one request before the Manifest loads, and nothing drawn
  on the server. `template={Default}` has it up front, drawn on the server too. The
  Viewer is `Clover.Viewer` too, and the parts stay named exports beside it, so one
  import serves both ways of building. Its classes are `clover-template-default*`, so
  they never meet 3.x's `clover-viewer*` on a page with both.

  ```jsx
  import Viewer from "@nulib/clover";
  import { Default, Document } from "@nulib/clover/templates";

  <Viewer iiifContent={url} />                      // Default, loaded on demand
  <Viewer iiifContent={url} template={Document} />
  <Viewer iiifContent={url} template={Default} />   // up front, and on the server
  ```

- **`stillSource(canvas, size)`**, a picture to stand in for a Canvas as large as it is
  drawn: the first image it paints, then its placeholder's or accompanying Canvas's, and
  only then its own `thumbnail`, which is often small. `thumbnailSource` keeps the
  `thumbnail` first, for small pictures. Resolve a level 0 service's with
  `resolveThumbnail`. `Document` draws its sheets with it.
- **The descriptive properties as parts:** `Summary`, `Metadata`, `RequiredStatement`,
  `Rights`, `Homepage`, `Rendering`, `SeeAlso`, `PartOf`, `Thumbnail` and `Id`, beside
  `Label`. Each reads the Root's Manifest, or the current Canvas with `of="canvas"`; a
  `value` prop wins, so they work outside a `Root` too. Text is in the reader's language
  and marked with `lang`. `Metadata` and `RequiredStatement` style their own pairs, so
  they look alike wherever they appear (the InformationPanel's About, a Canvas's
  caption): each label over its value, both in the text's colour as the summary is, at
  the same size, the label medium and the value at the text's own weight, the pairs
  stacked `s` apart. About's own headings (Rights, Homepage…) read as the labels do.
- **HTML in IIIF values is sanitised**, allowing only the markup the Presentation API
  permits and `http(s):` or `mailto:` links. Scripts, event handlers, `style`, SVG, and
  `javascript:` or `data:` URLs are removed. A value with markup shows as plain text until
  the sanitiser (DOMPurify) has loaded, which happens only when some value needs it.
- **`Clover.InformationPanel`**, information about the Root's resource in sections, with
  About by default. Give it `Clover.Tab` children (`value`, `label`, and anything as
  content) to choose the sections, including your own; this replaces 3.x's information
  panel plugins. `value` / `defaultValue` / `onValueChange` control which section shows.
  The default sections past About (Collection, Contents, Search, Map, Transcript,
  Annotations) load when first opened, so their content arrives a moment after the
  section opens; in a test, find it with `findBy…`, not `getBy…`.

  `layout` lays the sections out as `"tabs"` (the default) or `"accordion"`: stacked
  boxes, each opened by its heading; opening one closes the others, and one is always
  open, as a tab is. In a
  panel that scrolls, every accordion heading stays in sight: those scrolled past stack
  at the top, those an open section pushes below stack at the bottom, both inside the
  panel's padding, so the first heading holds where it rests from the first pixel of
  scrolling (a heading runs to as many lines as its label needs). An open box's content
  can put controls of its own beside its heading: a `.clover-sections-actions` box after
  each heading, held where the heading is held, over the end of its row, and the
  heading's button keeps that room clear (`--clover-sections-actions`), so its label
  never runs under them. The Transcript's languages sit there. What scrolls under them
  shows faintly: a soft shadow under the open section's heading once the panel has
  scrolled, and over the next heading while there is more below. The headings are
  controls, not links: each label is bold, in the text's colour, over a 3px line as wide
  as the panel's content. A closed one's line is the colour of a split's bar at rest
  (`--clover-color-secondary-alt` at half strength), with a chevron; the open one's is
  the accent, with none, and a closed one's under the pointer the accent at half
  strength, as Items' hover is. The open
  section's content is `m` under its line and over what follows; the heading after it
  is set `s` further apart. A section opened by
  a press scrolls its start into sight, under the headings stacked above it. The open
  section cannot be closed, so its button is `aria-disabled` (as WAI-ARIA's accordion
  has it) and draws no chevron; a closed one's chevron offers it. The scroll drives it
  (scroll-driven animation, no script); browsers without it show no shadow. Both are built from the
  same buttons and panels and the same state, so switching layout keeps what is open, and
  a section's content mounts when it first opens and stays mounted. Each follows its
  WAI-ARIA pattern: a `tablist` whose arrow keys select, or headed buttons with
  `aria-expanded` whose arrow keys move between headings. The templates pass it on as
  `panelLayout`. Style either through `.clover-sections` and its
  `data-layout`, `.clover-sections-button` and `.clover-sections-panel`.

  ```jsx
  <Clover.InformationPanel layout="accordion" />
  <Viewer iiifContent={url} panelLayout="tabs" />
  ```

  Given `onClose`, it has a close button; closing from inside it hands focus back to the
  control whose `aria-controls` names it (or an element around it), so focus never stays
  on something hidden. Give it only to a panel that floats over the page, with
  `closeOnEscape`: Escape closes it too, and the button sits at the panel's inner edge
  (the start, for a panel over the end of the page). A panel docked beside the Canvas
  has no close button; its `PanelToggle` closes it. So `Default`'s docked panel has
  none, while `Default`'s on a phone and `Document`'s, which float, have one, close on
  Escape, and take focus when they open.

- **`Clover.About`**, everything the Manifest says about itself, in the order 3.x's About
  tab shows it, but for the thumbnail, which the layout places: `Default` shows it in
  its header, beside the title. Its Download section lists what `Clover.Download` does: the `rendering`
  of the page in view ("This page") and of the Manifest ("All pages").
- **`Clover.PanelToggle`**, which shows and hides the `InformationPanel`. Given to
  `Clover.Content` as a child, it sits in the Canvas's controls. The controls still fade
  while the panel is open: only a menu open over the Canvas holds them on screen.

  ```jsx
  <Clover.Content>
    <Clover.PanelToggle open={open} onOpenChange={setOpen} controls="panel" />
  </Clover.Content>
  <Clover.InformationPanel
    id="panel"
    hidden={!open}
    onClose={() => setOpen(false)}
  />
  ```

- **`<clover-viewer>`**, the Viewer as a custom element for pages without React, from
  `@nulib/clover/web-components` (`dist/web-components/index.mjs`, and `index.umd.js` for a
  classic `<script>` from a CDN). Built on its own with Preact standing in for React.
  Attributes `iiif-content`, `canvas-id`, `manifest-id`, `language`, `search-query`,
  `items`, `header`, `panel`, `download`; an `iiifContent` property for objects; events
  `canvaschange`, `manifestchange`, `contentstatechange`. Light DOM, as 3.x's. About
  96 kB gzip up front (3.x's element: about 530 kB); MapLibre, its worker and its
  stylesheet load only with a map. Its stylesheet is injected in runs, in the order
  `styles.css` gives them, as `<style data-clover="clover-1">` to `"clover-3"`; the
  rules only video, sound, an animation or a map need (`data-clover="media"`, `"map"`)
  load as one draws, each put in its place among the runs, so the cascade is the
  stylesheet's. Where a page looked for `style[data-clover="clover"]`, look for
  `style[data-clover]`, which finds them all (MapLibre's, `"maplibre"`, too).
  `defineCloverViewer`'s `styles` takes the whole stylesheet or its runs.

  ```html
  <script src=".../web-components/index.umd.js"></script>
  <clover-viewer
    iiif-content="https://example.org/manifest.json"
  ></clover-viewer>
  ```

- **`Clover.Download`**, as 3.x's Viewer offers it: the `rendering` of the Canvases in
  view ("This page") and of the Manifest ("All pages") — a PDF, a text, a full-size file —
  as links behind one button, opening towards the side with room. It is in `Document`'s
  toolbar (`download={false}` removes it, 3.x's `showDownload`); `Default` lists the same
  links in the `InformationPanel`'s About instead. It renders nothing when there is
  nothing to download.
- **Renderers of your own** (3.x's `customDisplays`): `renderers` on `Root` (or one
  `Content`) draws the views it claims — by Canvas id, painted body `format`, or a `match`
  test — with your component instead of `Canvas`. It gets the view's `canvases`, their
  painting `bodies` and `Content`'s children, and can call Clover's hooks. The Viewer and
  templates pass it through to their `Root`. An inline list is kept while it says the
  same, so it never re-renders the parts.

  ```jsx
  <Viewer
    iiifContent={url}
    renderers={[{ format: ["model/gltf-binary"], component: ModelViewer }]}
  />
  ```

- **Animations.** A Canvas whose painting annotations are timed (`canvas#t=0,0.1`, one
  image per frame) plays as an animation, as 3.x's Viewer does: Cookbook-style 0688 (a
  stereo card's two eyes) and NUL's Muybridge plates (16 frames).
  - Read as a timeline: each frame shows until the next starts, the last until the
    Canvas's `duration` ends.
  - Playback controls for the frames, styled as the Canvas's playback controls for video
    and sound, and fading as they do: a seek bar, previous and next (stopping at the
    ends, where they show disabled), play or pause, Repeat, and "Frame 3 of 16".
  - "Frame 3 of 16" opens the frames, as 3.x's row of their thumbnails under the Canvas
    did: the menu a Canvas's Choice opens (one radio button per frame, its picture and
    the Manifest's label for it, the frame showing checked), up from the playback
    controls over the picture. Opening it pauses; choosing a frame shows it. A frame's
    picture is its image as the Canvas paints it, its region cut out where its service
    can size one, else the image the Canvas has already loaded. Choice's menu items can
    carry a picture the same way, and a menu opens with its checked item scrolled into
    view.
  - `auto-advance` (Canvas or Manifest) plays on arrival, `repeat` sets Repeat, and a
    Manifest's `auto-advance` moves to the next Canvas when a non-repeating animation
    ends. Nothing autoplays for a reader asking for reduced motion. The Canvas takes
    `options.animation: { autoplay, loop }` on its own.
  - No blinking: every frame is on the Canvas from the start, its tiles loading, and a
    frame change only shows one and hides the rest, keeping the camera and the
    annotations' regions. A frame not yet loaded is not shown; the current one holds a
    beat longer.
  - The clock and the frames' playback controls load on demand; a Canvas that is not an
    animation never loads them.
- **A region cropped through an image service** is measured in the service's own size,
  not the body's declared one (Image API §4.1). A body declaring a cropped derivative's
  size while carrying the whole image's service (0688) showed a stretched sliver.
- **Annotations.** The comments, tags, transcriptions and descriptions on a Manifest's
  Canvases are listed in `Clover.Annotations` (and an Annotations tab when there are any)
  and drawn on the Canvas, each over the region it targets.
  - Pressing an entry frames it on the Canvas, moving to its Canvas first. An entry has
    no button of its own to see: for the keyboard, a button inside it ("Find on the
    image: …", `annotationsShow`) does the same out of sight, and its focus is drawn
    round the entry. Hovering an entry or its region on the Canvas highlights both,
    through the Root, with no timers or polling.
  - Each set's header is its hide toggle, an eye (`label.clover-hide`: a checkbox,
    checked while hidden, the eye struck through), then a heading only when its
    AnnotationPage has a `label` of its own: the `InformationPanel`'s Annotations section
    names the rest. The toggle's popover says "Hide" (`annotationsHideTip`); its name is
    that and the set's label, or "Hide Annotations" (`annotationsHide`) for a set without
    one. It takes the set's annotations off the Canvas only: the list, and the Canvas's
    annotations menu, keep them. HTML bodies are
    sanitised; image bodies (Cookbook 0377) show as images. Caption files are left to the
    video or sound they caption.
  - `annotations` on `Root` adds AnnotationPages or AnnotationCollections (followed from
    `first` through `next`), as URLs or objects.
  - The Canvas takes `selectedAnnotation`, `highlightedAnnotation` and
    `onAnnotationSelect`, so a host can drive its annotations' regions too.
  - The picked annotation names itself on the Canvas: its popover shows while it is the
    active one, without the pointer on it, until another is hovered or focused.
  - A pick made outside the Canvas (an entry pressed in the list, a content state's
    note) opens it past its placeholder, once the annotation is in its view, to show it.
    A recording opened so is not played, as a press of its play button would.
  - A pick is framed in one cut, once its view is drawn: on another Canvas, the move
    comes first (the spread fitted, none of its hotspots laid over the last view while
    it loads), then the annotation. `animateAnnotations` on the Canvas (or `Content`)
    glides there instead, as the camera eases elsewhere; reduced motion cuts either way.
    The handle's `zoomToAnnotation` and a hotspot's click follow the same choice. Before,
    every pick glided, and one on another Canvas glided over the last view, then jumped.
  - **Linking annotations** (`motivation: "linking"`, Cookbook 0022) go where they link.
    Pressing the hotspot shows the Canvas it leads to, in this Manifest or the one its
    target is `partOf` (opened in its place), with focus moved to the Canvas, since the
    hotspot goes; its entry in the list gains "Open the link" (`annotationsOpenLink`, in
    every locale), which does the same. A link to a page on the web is a link (`<a>`),
    opening the page in a new tab; only `http(s)` addresses are followed. A standalone
    `Canvas` given `onAnnotationLink` hands you the link instead of zooming to it:

    ```jsx
    <Clover.Canvas
      canvases={[canvas]}
      annotations={annotations}
      onAnnotationLink={({ canvasId, manifestId }) =>
        show(manifestId, canvasId)
      }
    />
    ```

    Inside a `Root`, or loading its own (`iiifContent`), the Canvas follows them itself
    unless you pass it. Before, the hotspot only zoomed to its region.

  - **Annotations on a recording's time** (`#t=start,end`, Cookbook 0103) show as cues
    while their stretch plays, among the captions and above them, under their
    AnnotationPage's `label` when it has one (`.clover-canvas-captions-cue` with
    `data-kind="annotation"`, its label a `.clover-canvas-captions-cue-label`). One on a
    moment (`#t=start`) shows for three seconds. The Canvas's annotations control lists
    them by the time they start, now over a lone video or sound too, and picking one goes
    there, playing or paused as it was; so does pressing one in `Clover.Annotations`,
    whose entry shows its start where an image's has its region, and whose button is
    "Find in the recording" (`annotationsShowTime`, in every locale) rather than "Find on
    the image". Before, the Canvas showed nothing of them, and a press in the list did not
    seek.
  - **Annotations that follow a recording.** An annotation whose targets each give a
    region and a time, `xywh=x,y,w,h&t=start,end` (both dimensions of a Media Fragment,
    as a FragmentSelector or a URI), is a track: a person followed through a film. Its
    hotspot is there only while the recording is within one of its stretches (`hidden`
    otherwise, so out of the Tab order and the accessibility tree), and moves with the
    recording, frame by frame (`requestVideoFrameCallback`; each display frame for
    sound), through the overlay layer, with no render. Stretches that meet in time glide
    from one region to the next; across a gap the hotspot is gone. It is listed where it
    starts, in the annotations control and in `Clover.Annotations`, and a pick goes there
    only when it is not on the recording now; it is never zoomed to. A hotspot that holds
    focus as its region goes hands focus to the viewport. Tracked hotspots carry
    `data-track` and a pointer cursor. The active hotspot always wins: those beneath it
    that it meets are masked where it is now, again on each frame either moves, and none
    is raised over a tracked one, nor a tracked one over the active. Masks are now set on
    each hotspot by the layer, not in its rendered `style`. The docs publish a mock of
    them, `/mocks/rudolf-hess-nuremberg/`: Rudolf Hess, and the defendants around him,
    through the Nuremberg tribunal's judgment.
  - **Several targets.** An annotation's targets are read through Presentation 4's
    `Independents`, `List` and `Composite` (the upgrader makes `Independents` of a
    Presentation 3 array), and a fragment's `xywh=` and `t=` together. Before, an
    annotation with more than one target drew no hotspot (it named no region), and a
    fragment with both kept the region and lost the time. Where one target is read (a list
    entry's region, a content state, a link), it is the first. An annotation with
    `xywh=…&t=…` on a recording, which showed throughout, now shows only through its
    time; one on an image, which has no time, shows as before.
  - **A page hidden from the Canvas's annotations menu.** Each page in the menu has the
    list's eye before its label (a page without one, the eye alone over its items). The
    Canvas takes every page's annotations, each with its page's id
    (`CanvasAnnotation.pageId`), and draws all but those of `hiddenPages`;
    `onPageVisibilityChange(pageIds, visible)` reports the reader's toggles, and without
    `hiddenPages` the Canvas keeps its own. In a `Root` these are its hidden sets
    (`setSetVisible`), so the menu and `Clover.Annotations` hide and show together.
    Hiding hides only what is drawn: a hidden page's annotations stay in the menu as they
    were, and a pick still frames one, or goes to it on its recording. Before, a hidden
    set's annotations never reached the Canvas, so its menu lost them, and hiding every
    set took the annotations control away. Opening a menu focuses its checked item,
    never a checked hide toggle.
  - **The chapter under the pointer on the seek bar.** Its stretch of the bar is drawn
    out, and its start and title show over it in a popover, as a control's name does
    (Escape puts it away, and the pointer can rest on it; WCAG 1.4.13), the transport
    over the captions meanwhile, and the caption cues move up clear of it
    (`--clover-transport-preview-top`), and back as it goes. Keyboard focus on the bar shows the chapter playing,
    and the bar's value names it (`aria-valuetext`, "0:30 / 11:11, Opening"). The
    Canvas takes `highlightedChapter` and `onChapterHighlight` (chapters take an `id`),
    and in a `Root` they are one highlight with `Clover.Contents` (`clover.chapter`):
    hovering an entry there draws its chapter out on the bar, without a popover, and the
    chapter under the pointer on the bar marks its entry. `Chapter` from `chaptersOf`
    carries its Range's `id`.
  - **The annotations menu groups by AnnotationPage**, under each page's `label`, as the
    list does; a page with none is named by the control. `CanvasAnnotation` takes
    `pageLabel` for a host's own annotations; inside a `Root`, and loading its own, the
    Canvas gives each its page's.
  - **Each caption cue carries its language**, rather than the box around the cues
    (`.clover-canvas-captions`), so an annotation's cue beside it can carry its own. A
    page reading `lang` from `.clover-canvas-captions` reads it from
    `.clover-canvas-captions-cue` instead.
  - **An image an annotation carries** (Cookbook 0377) shows in its hotspot's popover,
    above its words, fetched only once the popover shows. `Tip` takes `image`.
  - **Annotations on a whole Canvas** (Cookbook 0266), with no region to mark, are in the
    Canvas's information box (the `i`), under its metadata, under "Annotations", as the
    list shows them: HTML (0019) sanitised with its links and images kept, Markdown and
    plain text by their `format`. A Canvas with only such annotations now has the `i`.
    Before, the Canvas showed nothing of them. The bodies' renderer is shared with the
    list (`components/Annotations/EntryBodies.tsx`).
    To keep the glide:

    ```jsx
    <Clover.Content animateAnnotations />
    ```

  - The reader lets go of a pick with a click or tap on the Canvas off every hotspot,
    which then does nothing more (it does not zoom; the next one does), or with Escape
    anywhere in the Canvas, unless a menu or the caption is open, which Escape closes
    first. With annotations, the viewport's `aria-keyshortcuts` ends in `Escape`, and its
    description says so, in a new string, `canvasKeysAnnotations` ("Press Escape to
    clear the selected annotation."). Escape that lets go is `preventDefault`ed, so a
    dialog or panel around the Canvas stays open; a host's own Escape handler should
    leave such an event alone:

    ```js
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) closeMyPanel();
    });
    ```

    `onAnnotationSelect` is now `(id: string | null) => void`, and is called with
    `null` when the reader lets go; a controlled `selectedAnnotation` should follow it:

    ```jsx
    <Clover.Canvas
      selectedAnnotation={picked}
      onAnnotationSelect={(id) => setPicked(id)}
    />
    ```

  - An annotation's region on the Canvas takes its target's shape: a rectangle
    (`xywh`), a point (PointSelector, a marker that frames a 40-unit box when pressed,
    Cookbook 0135), or a shape (SvgSelector, drawn as itself and pressed only within it,
    Cookbook 0261). Shapes are redrawn from their geometry — `path`, `polygon`,
    `polyline`, `rect`, `circle`, `ellipse`, `line`, numeric attributes only — never
    from the selector's markup. The SVG reader (1.3 kB) loads only when a shape is in
    view.
  - The `InformationPanel`'s Annotations section lists every annotation in the
    Manifest, not only the view's, as `<Clover.Annotations scope="all" />` does wherever
    it sits. They are grouped by layer (AnnotationPages that share a label, or have
    none), each layer with one hide toggle for all its pages, and under
    that by Canvas, under the Canvas's label: `section.clover-annotations-canvas`, named
    by its `.clover-annotations-canvas-label` heading, one level under the layer's. A
    Manifest of one Canvas has no Canvas labels, so its notes' headings keep their level. The
    listing is `data-scope="all"`. Before, `scope="all"` gave one flat list per page.
    - The Canvases in view are `aria-current="true"`, and as the reader moves, the list
      scrolls to bring them up under its headings, and a picked entry into sight. It
      never moves under the pointer or while focus is in it, so a press in the list
      moves the Canvas, not the list.
    - Each entry with a rectangle (`xywh`) shows what it marks beside its text: its
      region, cut by the image server and fetched at no more than 52px a side
      (`{service}/{region}/!52,52/0/default.jpg`), shown as an `l` square
      (`img.clover-annotations-thumbnail`, decorative, `alt=""`, lazily loaded). The
      region is read in the image's pixels from where it is painted. A level 0 service,
      which cannot cut, gives none, so no image larger than that is ever fetched for
      it; nor does an entry that shows an image of its own. `regionSource` builds the
      URL, from a Canvas, the rectangle and a size.
    - The listing fetches every Canvas's referenced pages while it shows, as
      `annotationPages="all"` does, and lets them go when it unmounts.
    - Picking an annotation in the Canvas's menu, on its region or in the list picks it
      in all three, and hiding a layer takes it off the Canvas and out of the menu: one
      choice, through the Root, as the captions' language is.

- **Content state out.** `onContentStateChange` on `Root` reports where the reader is,
  as a IIIF content state (`{ json, encoded }`), whenever it settles after a move, a pan
  or zoom, or a pause or seek: the Canvas holding most of the view, and its region or
  the media time. A link carrying it in `iiif-content` opens a Root given that value
  at the same place. `buildContentState`,
  `encodeContentState` and `decodeContentState` are exported.

  ```jsx
  <Clover.Root
    iiifContent={url}
    onContentStateChange={({ encoded }) =>
      history.replaceState(null, "", `?iiif-content=${encoded}`)
    }
  >
  ```

- **Transcripts and chapters.**
  - `Clover.Transcript` lists the WebVTT captions of the video or sound in view, marks
    the cue playing (found by binary search) and seeks to a cue when it is pressed. It
    reads a transcript as plain text (`text/plain`) too, untimed, as its paragraphs in
    the file's language (`.clover-transcript-body`): one a Canvas has as its `rendering`
    (Cookbook 0017) or a `supplementing` annotation provides (0253), after
    any caption files: in the row of choices it shows "TXT" after their language codes
    ("TXT EN" and so on where there are several), and the row is then named
    "Transcript". Of a recording, that is what is said; of an image, what is written on
    it (a page's OCR, a letter's transcription), the page in view's. A file that is not
    UTF-8 is read as Windows-1252, as 0017's is
    encoded, so its apostrophes are not lost. The information panel offers the
    Transcript for either kind. With
    several caption files it offers them as a row of their language codes ("EN", "IT"),
    native radios each named by its code and its file's label (in that label's
    language), the label shown as its popover (a `Tip`). In an information panel's
    accordion the row sits beside the Transcript's heading, held there as the heading is
    (`useSectionActions`, below); elsewhere it is over the cues. It replaces a `<select>`
    and its `.clover-transcript-track` label: style `.clover-transcript-languages`,
    `.clover-transcript-language` and `.clover-transcript-code` instead. Its language and
    the Canvas's captions are one choice: a file chosen in either is the one the other
    shows, through the Root (`clover.captions`), except that the Transcript changes the
    captions' language, never whether they show (Off stays off). It appears as a Transcript tab
    when the view's media has captions. Playback re-renders it only when the cue changes
    and writes nothing to the Root's state. Its cues share one grid
    (`.clover-transcript-cues`, with each row and button a `subgrid`): the times' column
    is as wide as the list's widest time, and every cue's text starts `s` past it. The
    time no longer has a `2xl` minimum width.
  - Captions and the transcript share one fetch of each file, read by Clover's own
    WebVTT parser (`parseVtt`, `cueAt`), with voice and styling tags handled.
  - Chapters come from the Manifest's Ranges (`chaptersOf`): marked on the seek bar of
    the Canvas's playback controls, listed in a Chapters menu that seeks, and named
    beside the time. `Canvas` takes them as `chapters` too.
  - Range items read correctly from `@iiif/parser` 4.0.3, whose upgrader turns a Range
    item's `#t=` into `/t=`.
- **`Clover.Contents`**, the Manifest's table of contents from its Ranges, nested as they
  nest (a single top Range is unwrapped, `no-nav` Ranges skipped). The entry the reader
  is in is marked with `aria-current`, following playback through a time-based Canvas;
  choosing one goes to its Canvas, region or moment. It is a Contents tab when the
  Manifest has Ranges. `tableOfContents()` and `currentContents()` give the same data to
  a part of your own.
- **`Map`**, from a third entry, `@nulib/clover/map`: where a IIIF resource is, on a map.
  - navPlace places on the Collection, Manifest, Canvases and annotations (and GeoJSON
    annotation bodies, Cookbook 0139), named by their label in the reader's language and
    drawn in the accent color or their own simplestyle.
  - Georeference Extension annotations, on a Canvas or an image service, drawn as the
    affine fit of their control points (exact for three), clipped to their mask. No
    Allmaps: no thin-plate spline, and the image is laid on the map as one picture, not
    in tiles.
  - Standalone with `iiifContent`, `navPlace` or `georeferences`; inside a `Root` it maps
    the Root's resource and the view's georeferenced image, and pressing a place goes to
    its Canvas.
  - The Viewer, its templates and a default `InformationPanel` add a Map tab by
    themselves when the Manifest, its Collection, a Canvas or an annotation has navPlace
    or a georeference. Nothing to pass.
  - `maplibre-gl` is a dependency, downloaded only when a map is first shown (about
    287 kB gzip); a Manifest without places never loads it. Import
    `maplibre-gl/dist/maplibre-gl.css` beside Clover's stylesheet. If your bundler moves
    MapLibre's files (Next and webpack do), serve its worker and call
    `setMapWorkerUrl(url)` once; a standalone `Map` also takes `workerUrl`. Wheel zoom is
    off by default.

  ```jsx
  import "maplibre-gl/dist/maplibre-gl.css";

  <Viewer iiifContent={url} />; // a Map tab when there are places
  ```

- **`Clover.Search`**, IIIF Content Search 1 and 2. A Manifest with a search service gets
  a Search tab: a field, then the hits listed by page with the words around each match
  (version 1's `hits`, version 2's TextQuoteSelectors), following further pages of
  results. The hits are drawn on the Canvas as their own annotation set
  (`SEARCH_SET_ID`), not listed among the Annotations; choosing one goes to its page and
  frames it. `Root`'s `searchQuery` searches as the Manifest opens (3.x's
  `iiifContentSearchQuery`), and `clover.search(query)` searches from your own part.
  Emptying the field clears the hits, and another Manifest starts without them.

  ```jsx
  <Viewer iiifContent={manifestUrl} searchQuery="bird" />
  ```

- **Collections.** A Collection's members are browsable within one `Root`.
  - The `InformationPanel` shows a Collection section, after About, whenever the
    Manifest was reached through a Collection or says it is `partOf` one: the
    Collection's name and summary over its members as
    `<Clover.Items of="members" layout="list">` (square thumbnails, `xl` on a side, and
    their names and summaries at the panel's size, in full: a long one makes its member
    taller than its thumbnail), set 1.618rem (`l`) from what is above and below it, then
    its homepage and its id.
    Choosing one shows it. A `partOf` Collection is fetched only when the section first
    opens, never before. This is where the Viewer's `Default` template lists them.
  - `Clover.Collection` is that section as a part of its own, for a layout that shows
    the Collection anywhere: `<Clover.Collection headingLevel={4} />` (its headings at
    `h3` by default). The Presentation 4 Collection type is exported as
    `Presentation4Collection`, as the Canvas type is `Presentation4Canvas`, since the
    part takes the name `Collection`.
  - `Clover.CollectionSelect`, a native `<select>` of the members labelled by the
    Collection, is the same choice as a menu (in `Document`'s toolbar). Choosing a
    Manifest shows it; choosing a nested Collection enters it. A pointer, a phone's
    picker or the menu's own list chooses at once. From the keyboard, the arrows only
    move through the members, Enter opens the one shown, and Escape or leaving the menu
    takes the step back. `onChange` is called when a member is chosen, not on each
    step.
  - `<Clover.Items of="members">` is the same choice as a listbox of thumbnails.
  - `Root` takes `manifestId` (controlled, with `onManifestChange`) to open and follow a
    member, and `clover.goToManifest(id)` moves there from a part of your own.
  - `clover.openCollection(id)` shows a Collection the Manifest is part of beside it,
    fetching only the Collection, and keeping the Manifest and the reader's place.
  - Paged Collections are followed from `first` through `next`.

  ```jsx
  <Clover.Root
    iiifContent={collectionUrl}
    manifestId={id}
    onManifestChange={setId}
  >
    <Clover.CollectionSelect />
    <Clover.Content />
  </Clover.Root>
  ```

- **Templates**, layouts for the Viewer from a second entry, `@nulib/clover/templates`,
  with their own stylesheet, `@nulib/clover/templates.css`. Each is built only from the
  package's public parts, so it can be copied into an app and changed.
  - `Default`: the Viewer's own, drawn when no `template` is given. It ships with the
    Viewer, and its styles are in `styles.css`. Clover 3.x's Viewer layout: the
    Manifest's `Label` over the Canvas, after its `Thumbnail` (`xl` high, at its own
    shape up to 5rem wide, a wider one cropped to fill); `Items` under the Canvas, whose
    arrows are Previous and Next, headed by the labels of the view's Canvases (a dot
    between a spread's two) and `Position` ("2 / 70"); the `InformationPanel` to the
    right of all three, the layout's full height, scrolling within. `fill` lays it out
    in the box it sits in, as tall as that box, the Canvas taking what the title and
    `Items` leave (never under 16rem; a shorter box scrolls), for a box of a set height,
    the window under a page's own header say; without it, the Canvas is
    `--clover-content-height` tall:

    ```jsx
    <div style={{ height: "calc(100dvh - 4rem)" }}>
      <Viewer iiifContent={url} fill />
    </div>
    ```

    The panel never stacks: it has its own space beside the Canvas, and a `SplitHandle` between them
    shares the width (remembered under `storageKey`). While it is open there, its
    `PanelToggle` sits on that bar, centred, level with the Canvas's controls; closed,
    it is back among them, and focus moves with it.
    Where there is no room for both (a phone), it slides over the Canvas instead, leaving
    a band of the page (`2xl`) that closes it on a press, as Escape and its close button
    do. It can be dragged back off too, as a side menu in a phone app can: it follows a
    finger or pen toward its edge, and let go past a third of its width, or flicked, it
    closes; short of that it springs back. A drag up or down still scrolls it, and a
    mouse still selects text. A short line on its inner edge shows it can be dragged.
    Document's floating panel does the same, with a band of the page to press, and on a
    phone so does `Items`' pane, dragged back to the start. The close button is filled,
    so it reads as the way out, and sits above the accordion's headings where they stack
    at the top, which had covered it so that a press on it opened About instead. It is
    one of the round controls, with the Canvas's cross and its accent under the pointer.
    While the panel floats, the button sits on its spine, the inner edge, half over the
    page, level with the first heading, and stays there however far the panel scrolls.
    `defaultPanelOpen` now defaults to open only when the panel fits beside the Canvas.
    Its panel's sections are stacked boxes by default (`panelLayout="accordion"`), as
    Document's are; `panelLayout="tabs"` gives tabs. `items` picks `Items`' layout
    (`"carousel"`, `"list"` or `"grid"`), or `false` for none. `header={false}` leaves
    out the `Thumbnail` and `Label` over the Canvas (3.x's `showTitle: false`), and
    `panel={false}` the `InformationPanel` and its `PanelToggle`.

  - `Document`: reads like a PDF viewer. A toolbar (the `Label`, and `Download`),
    `Items` down the left (the Manifest's Canvases as page thumbnails), and the
    pages down one column, as a PDF reader's continuous view: a sheet for each view (a
    spread is one), fitted whole on the grey ground with `--clover-inset` round it, and
    at most the stage less twice the inset tall, so the top of the next always shows
    under the one at rest. The column scrolls as any page does (wheel, trackpad, a
    finger, the scrollbar), and at either end the web page scrolls on. The top of the
    stage is the one place a sheet is active: where the scroll rests, the next sheet is
    brought there once the active one has been scrolled a quarter of its height on, the
    previous once a quarter of it is in sight, and otherwise the active one settles back.
    A press on a sheet, a thumbnail, and PageUp and PageDown bring theirs. Sheets not
    active are muted (0.618 opacity, 0.809 under the pointer). Each sheet is a still of
    its pictures; the one Canvas, with its zoom, annotations and media, lies over the
    active sheet's still, and shows, its controls sliding in, only once that sheet is in
    place and drawn; while the column scrolls the controls slide away. Zoomed in or out,
    or moved, the active sheet fills the stage, pushing the others down, and they
    dissolve, until the Canvas is home again or another sheet comes in. A finger scrolls
    the column until then; after, it moves about the page. Pinch and Ctrl-wheel zoom.
    The page thumbnails' toggle is a pill drawn as the round controls are (the control's
    dark fill and light glyph, the accent under the pointer or focused): the glyph of a
    list of thumbnails, its pictures filled while they show, and `Position` ("3 / 17",
    `text-xs`). It reads "Show Items" and then the place ("Item 3 of 17"), and their
    pane "Items": what they list need not be pages. While they show, it sits on the bar
    between them and the page, over them but for its far rounded end, which hangs over
    the page, so the thumbnails have their pane's whole height; put away, over the
    page's top left, `--clover-inset` in, level with the Canvas's controls. On a phone,
    where they float over the page, it sits on their inner edge, and is dragged off with
    them. A `SplitHandle` between `Items` and the page resizes them; a one-page document
    has neither, nor the toggle. To change Collection member, use the panel's Collection
    section. The `InformationPanel` sits to the right of the page in its own `SplitPane`, with a
    `SplitHandle` between them that shares the width (remembered under `storageKey`),
    where there is room for both, as `Default`'s does, its toggle on that bar while it
    is open; where there is not, it slides out over the page, taking focus and closing
    on Escape or its own button. Each toggle moves as it is pressed, and focus goes with
    it. Spaced as
    `Default` is: the toolbar, `Items`, the page and the panel each keep
    `--clover-inset` at their sides, so the toolbar's first and last controls, the
    thumbnails, the page and the Canvas's controls share one edge; the Manifest's
    `Label` is `text-l`, `Items`' pane starts at 13rem (its thumbnails as wide as
    before), and the panel is as wide as `Default`'s floating one. The page keeps the
    inset clear round it on its grey background.
  - `Gallery`: `Items` as a grid of the views, opening one in a lightbox (a native
    `<dialog>`) with the Canvas and Items' pager.

  ```jsx
  import Viewer from "@nulib/clover";
  import { Document } from "@nulib/clover/templates";
  import "@nulib/clover/styles.css";
  import "@nulib/clover/templates.css";

  <Viewer iiifContent={url} template={Document} />;
  ```

- **`visuallyHidden`**, the inline styles Clover hides labels with, for parts of your own
  that must read plainly without the stylesheet.
- **Text is read strictly by its `format`.** `text/html` is IIIF's HTML, sanitised to
  the tags and attributes the Presentation API allows; `text/markdown` is Markdown;
  `text/plain`, and any other media type, is shown as written, a `<` included, with its
  line breaks kept. A value with no `format` (IIIF's `summary`, `metadata` and
  `requiredStatement` values, and annotation bodies that declare none) follows IIIF's
  rule: it is HTML only when it runs from a first `<` to a last `>`, whitespace aside, and
  plain text otherwise. 3.x, and Clover until now, read any value holding a tag or an
  entity as HTML, and a `text/plain` annotation body as HTML in the Annotations list
  (though not in its hotspot's name). If your HTML values do not begin and end with a
  tag, wrap them in one, or declare the body's `format`:

  ```json
  {
    "type": "TextualBody",
    "value": "Written in <b>1849</b>.",
    "format": "text/html"
  }
  ```

  `readAs(format, value)`, exported beside `toPlainText`, says how Clover reads one, for
  a `renderEntry` of your own.

- **Markdown annotation bodies** (`format: "text/markdown"`) are read as Markdown —
  paragraphs, emphasis, links, lists (nested), headings, footnotes — and sanitised like
  HTML. `Clover.Value`
  shows any language map (with `format`); `useAnnotationSets`, `useT` and `toPlainText`
  are exported; `Root` takes `annotationPages="all"` to fetch every Canvas's referenced
  annotation pages, not only the view's. `Thumbnail` takes any resource as `value`, and
  image attributes such as `alt`.
- **`Clover.Items`**, thumbnails of a sequence as a `carousel` (the default), `list` or
  `grid`, or one item at a time as a `pager`. It succeeds 3.x's `Slider` and the row of
  thumbnails under 3.x's Viewer.
  - `layout="pager"` is the count, then Previous and Next (mirrored in a right-to-left
    book), in a `nav` named "Items" (`itemsLabel`), stepping through what the strip
    lists: the Root's views, its Collection's members (`of="members"`, telling
    `onSelect` of each), or a standalone list's selection. A strip and a pager follow
    each other. It is a flex row, `.clover-items.clover-pager[data-layout="pager"]`:
    move a piece with `order`, or compose `Previous`, `Next` and `Position`, which take
    `of` too. It replaces a `Pager` part, and its `pagerLabel` string ("Pages"), which
    are gone.
  - Inside a `Root` it is a listbox of the Root's views, a spread as one item (and
    nothing at all for a single view): one tab
    stop, and as in a radio group the arrows, Home and End select as they move (where a
    held arrow stops, not each page it passes). Enter, Space or a click is a choice,
    reported by `onSelect`. A Collection's members are still chosen with Enter, as each
    loads a Manifest. The selection follows the pager
    and stays in view — in a list or grid too, scrolling only the box it scrolls in,
    never the page. Arrows follow a right-to-left book.
  - On its own, given `iiifContent` or `items`, it lists a Collection's members as links
    to their `homepage`, with the Collection's label, summary and homepage link above.
    `onSelect(item, event)` hears each choice; `event.preventDefault()` keeps the reader
    on the page.
  - `renderItem` replaces an item's figure.
  - The carousel is the browser's own scrolling with CSS snap points, with no carousel
    library: wheel, trackpad, touch and keyboard all scroll it, and a mouse can drag it.
  - A carousel's arrows choosing between views (inside a `Root`) are Previous and Next:
    they step the selection, and the carousel follows it into view. A carousel of links
    has no selection, so its arrows scroll it, as "Show previous items" and "Show more
    items".
  - Thumbnails load lazily, asked of each image service at `thumbnailSize` (200 by
    default). A level 0 service's `info.json` is read for the sizes it lists. Video and
    sound show their duration. A view or member with no image keeps its picture's box,
    at its shape (square for sound, which has none), so its cell never collapses to its
    caption; sound with nothing to picture shows a speaker in it.
  - Size it with `--clover-items-height`, `--clover-items-size` and `--clover-items-gap`.
    A carousel's or grid's titles run to three lines and are cut short after
    (`--clover-items-lines`), as the thumbnails under 3.x's Viewer cut their captions at
    five.

  ```jsx
  <Clover.Root iiifContent={manifestUrl}>
    <Clover.Content />
    <Clover.Items layout="grid" />
  </Clover.Root>

  <Clover.Items iiifContent={collectionUrl} />
  ```

- **What `iiifContent` takes.** A URL, or a IIIF object in Presentation 2, 3 or 4: a
  Manifest, a Collection (its first Manifest is shown, or `manifestId`), a Canvas, or a
  content state as JSON or base64url. A Canvas is shown on its own, as a Manifest of
  one that says what the Canvas says of itself (its label, summary, metadata, required
  statement, rights, homepage, see also, rendering, thumbnail), so the InformationPanel's
  About is the Canvas's, its address under "IIIF Canvas" (`aboutCanvas`). Where it is
  `partOf` a Manifest, About opens with "Part of" (`aboutPartOf`): the Manifest's label
  and a button, "Open the full Manifest" (`aboutOpenManifest`), that shows it in place,
  at that Canvas where it holds it, focus moving to About's heading. Before, a Canvas
  `partOf` a Manifest loaded that Manifest at once, and its own metadata was not shown.
  `goToManifest(id, canvasId?)` takes the Canvas to open at. A content state opens
  at its Canvas, framing its region or seeking to its time, past any placeholder. One
  with a `body` (a note its sharer wrote, as Digital Collections' shared links carry)
  shows that note there as an annotation, in a set of its own after the host's
  `annotations`, and picked, so it names itself on the Canvas and in the list; its body
  is read by its declared `format`, as any annotation's is. A
  Manifest it names that is `partOf` a Collection (directly, or as its Canvas's Manifest)
  opens that Collection on that Manifest, so its members are there to choose from. Then
  comes `defaultCanvasId`, then the Manifest's `start`, then its first Canvas.
  `iiifContent` also takes annotations made apart from any Manifest: an AnnotationPage
  (and any pages its `next` leads to) or an AnnotationCollection (its pages from `first`
  through `next`), as a URL or an object, as 3.x did. Each annotation names its Canvas's
  Manifest (`partOf`); the Root opens the first one's Manifest at its Canvas, that
  annotation picked, and keeps all of them, as added sets, while the reader moves
  between the Manifests they name, until the next `iiifContent`. Picking one on another
  Manifest opens it there (through `onManifestChange` where the host holds the
  Manifest, picking it on arrival). The Annotations list names a group on another
  Manifest by its label (and its Canvas's, where it has several), fetching each such
  Manifest once, when the list first shows, never on load; and keeps the annotations'
  own order, whichever is open. Annotations that name no Manifest are an error
  ("The annotations name no Manifest"). `canvasId`
  with `onCanvasChange` makes the Canvas controlled.
- **One data shape: IIIF Presentation 4.** Everything is upgraded to Presentation 4 as it
  loads, with `@iiif/parser`'s upgrader, which is fetched only when something needs
  upgrading. Every part reads that one shape. `toPresentation4()` does the same for data
  you hold yourself. Referenced annotation pages are fetched when their Canvas is shown.
- **`request`** on `Root`: `{ credentials, headers, fetch }` for every request any part
  makes, including the Manifest, annotation pages, `info.json`, tiles, captions and HLS.
- **Hooks for parts of your own:** `useStatus`, `useManifest`, `useSequence`,
  `useVisibleCanvases`, `useActiveCanvas`, `useNavigation` and `useLocalized`. Each
  re-renders only when what it reads changes. The viewport and the media element are
  passed through channels, not state, so panning and playback re-render nothing.
  `createClover()` gives the same state without React.
- **Space and type on one scale, from your page.** Every space in Clover is a step of
  the golden ratio from your page's own `1rem` (`--clover-space-3xs` to
  `--clover-space-2xl`, and `--clover-control` for the round controls), and every text
  size is that `1rem` plus or minus a space step: `--clover-text-xs` 0.764rem (a video's
  or sound's duration on its thumbnail), `-s` 0.854rem (secondary text), `-m` 1.146rem
  (the `InformationPanel`'s section headings) and `-l` 1.236rem (titles). Those four and
  your page's own size are the only sizes Clover's text takes; video captions step
  through them as the Canvas widens rather than growing smoothly. There is no larger
  display size: a page's headings are the page's. All are
  defined in `styles.css` and yours to override. Clover sets no font
  family, base size or line height: its text, buttons and fields read in your page's
  type. Spacing follows how closely things belong together, as `DESIGN.md` sets out.
  Round controls are 2.236rem (a 1rem icon with 0.618rem around it), the Canvas's
  controls sit 0.618rem apart, and the panel has 1rem inside. A `.clover-canvas-controls`
  no longer carries `data-has-information-toggle` or `data-panel-open`, which nothing
  set.
- **Round controls are dark, with white icons, in light and dark mode alike.** The
  Canvas's controls, its placeholder toggle, its playback controls, the way out of full
  screen, `Items`' scroll arrows, the `InformationPanel`'s close button and Document's
  page-turn chevron read two new tokens of their own: `--clover-color-control` (the
  background, default `#1a1d1e`) and `--clover-color-control-glyph` (the icon, default
  `#fff`). They no longer read `--clover-color-secondary` and `--clover-color-primary`,
  which a page swaps for its dark mode, and which turned them light there, with the
  accent behind a dark icon under the pointer. Under the pointer, or focused, they take
  the accent; the icon stays white. A page with a dark mode has nothing to set for them.
  To change them, set the two tokens:

  ```css
  .my-viewer {
    --clover-color-control: #102a43;
    --clover-color-control-glyph: #f0f4f8;
  }
  ```

- **Highlights are the accent's, whatever the accent is.** The selected row in the
  `InformationPanel` (an annotation, a Range, a cue, a search hit), the fill of a
  selected annotation drawn as a shape on the Canvas, and the words that matched in
  `Search`'s hits are `--clover-color-accent`, faintly (8%, 18% and 20%). They were a
  fixed blue and a fixed yellow, so they kept those colours under any other accent.

- **`Clover.Items`' hover, selection and focus rings take no room.** They were outlines
  outside each thumbnail, so a carousel cut off the first thumbnail's ring and a list or
  grid's rings reached past the edge of the content. Now they take no room, nothing cuts
  them, and the thumbnails line up with what is beside them (see the ring round the whole
  item, below). A grid's cells now stay square for a tall picture too. The items in
  `Items` are `--clover-space-m` (1rem) apart in every layout (`--clover-items-gap`):
  each is a group, a picture with its caption. In `Default`, `Items` has the region's
  inset round it (`--clover-inset`, 1.618rem), as its header has. Each Canvas in an item has its own picture with its own
  label under it: a spread from `behavior: paged` (or the Canvases of a continuous
  Manifest) is one item whose Canvases meet with no gap, labels and all, rather than one
  label "Frontispiece – Title page" across both pages. `ItemModel.label` still joins
  them, for a name of the whole item.
- **A Canvas stays open from page to page.** Once a reader opens a Canvas from its
  placeholder, the next view opens too, its placeholder in view until it draws, and
  closing it brings the placeholders back for every view after. It used to show each new
  view's placeholder again, so a reader paging through a book opened every page by hand.
  Video and sound still start at their placeholder each time, since opening one plays it.
- **The selected thumbnail is clearer.** Hover, selection and focus ring an item's
  pictures from outside, 1px clear of them, rather than inside their edge. It is always
  3px and transparent at rest, so it never grows: the accent for the selection, the text
  colour for keyboard focus, and the accent at half strength for hover. Focus adds a
  second ring inside the pictures' edge, `secondary` beside `primary`, so it shows on
  any picture. It is an outline
  on `.clover-items-pictures`, in 4px of room the item keeps round itself
  (`--clover-items-ring-room`) and gives back with a negative margin, so items are still
  `--clover-items-gap` apart and the edge of `Items` never cuts a ring. Only a carousel,
  which scrolls across, keeps that room at its sides: a list or a grid keeps it above and
  below alone, so it never reaches past its own sides, which had put a scrollbar across a
  scrolling box with no padding round it. Clover now draws focus's inner ring on
  `.clover-items-pictures::after`. A stylesheet that styled that pseudo-element should
  style `.clover-items-pictures`'s outline instead, and leave `::after` to Clover. The thumbnails' corners are rounded to match, `--clover-radius` (3px), a
  spread's outer corners only: each picture now clips its image, where only a grid's did.
- **Every region keeps what it holds 1.618rem in, the Canvas's controls too, and steps
  down from there.** A region's inset is a new token, `--clover-inset`
  (`--clover-space-l`): `Default`'s header and `Items`, the `InformationPanel` and the
  Gallery's lightbox. They were 1rem in (the panel's accordion text 1.6rem). The picture
  on the Canvas is not inset: it fills the Canvas edge to edge (below). Inside a region, each level is a
  step less: its parts are 1rem apart (the header's title and actions, the view's
  Canvas labels and `Position` over `Items`, About's parts, which were 0.618rem for the
  header and `Items`), what is within a part 0.618rem, and a metadata label 0.382rem
  over its value (was 0.236rem). The Canvas's controls, its placeholder's toggle and its
  navigator sit the region's inset in from the Canvas's edges
  (`--clover-canvas-chrome-inset`, `--clover-inset` by default), so they line up with
  the header's title and `Position` over `Items`; they were 1rem in. The playback
  controls for video and sound are unchanged.
  - At home, a Canvas fills the space it is given edge to edge, and its placeholder the
    same, so the placeholder hands over to it without moving. `--clover-canvas-inset`
    (default `0px`) keeps a margin clear round the picture at home instead, the region's
    inset for instance:

    ```css
    .clover-canvas {
      --clover-canvas-inset: var(--clover-inset);
    }
    ```

    The renderer takes the inset from its viewport's padding, so whatever padding a
    stylesheet gives `.clover-canvas-viewport` is kept clear at home.

  - For a tighter layout everywhere, set `--clover-inset: var(--clover-space-m)` on
    `:root` or any ancestor.
  - In the `InformationPanel`, the accordion's headings and content sit on the panel's
    inset, as its tabs' content does: the boxes reach out over the panel's padding.
  - A carousel's thumbnails slide under a shadow at either end, as the
    `InformationPanel`'s headings do: at the start once the carousel has scrolled, at
    the end while there is more, and at neither when all its thumbnails fit. Each shadow
    is as tall as the pictures and level with them, not the captions under them. The
    carousel's own scroll drives them (a named scroll timeline); browsers without
    scroll-driven animation show none. Its items snap to the carousel's start rather
    than to the ring's room before them, so a carousel at rest has not scrolled.
  - `Default`'s thumbnails run on past the end padding round `Items` to the edge of
    their `SplitPane`, as the Canvas does, while the labels and `Position` over them
    keep the padding. `Items`' arrows line up with what is above them: the left one `s`
    past the line the labels start on, the right one under the Canvas's controls,
    `--clover-inset` in from the pane's edge, as they are.

- **Phones.** iPhone Safari can put a video full screen, but no other element. There, the
  Canvas offers no full-screen control for images, and a video's full-screen button opens
  the system player. That includes a video drawn into the `<canvas>` element
  (`presentation: "texture"`). The same applies inside an `<iframe>` that is not allowed
  full screen, where the button used to do nothing. Other browsers are unchanged.
- **The playback controls for video and sound keep their size.** The play, volume, time,
  chapters, captions and full-screen controls hold their size, and the current chapter's
  title gives way to them, shortening with an ellipsis. Where they still do not fit, the
  bar wraps (see Fixed).
- **Captions show once on iPhone.** iOS Safari turns a caption track on by the reader's
  caption settings, and drew its own copy of each cue in the picture, under Clover's. The
  tracks Clover draws stay `hidden`, and the media's own stay `disabled` until chosen, so
  the page shows one copy: Clover draws the cues and fills the transcript. In the system
  player the chosen track is `showing` (see Fixed).
- **Without the stylesheet**, the Canvas keeps its size, because its geometry is set inline.
  The exit full-screen button stays hidden until the page goes full screen, and icons keep
  their own size.
- **Server rendering.** `Root`, `Label` and `Items` render with `renderToString` when
  `iiifContent` is an object. Nothing reads `window` before the component mounts.
- **Checked in browsers.** Every change is checked in Chromium, WebKit and Firefox, in
  WebKit at iPhone size with touch, and on React 18 and 19. The checks include axe and a
  Manifest of 1,000 Canvases.

- **Summaries are cut to five lines, with "Read more".** `Summary`, which shows every
  summary Clover does (About's, a Collection's, a Canvas's in its information box), clamps
  its text to `--clover-summary-lines` lines (default `5`) and puts a "Read more" button
  under it when it runs longer (`aria-expanded`, "Read less" to cut it again; new
  strings `readMore` and `readLess`). Set the property for more or fewer lines, or
  `none` for the whole text:

  ```css
  .my-layout .clover-summary {
    --clover-summary-lines: 3;
  }
  ```

  `Clover.ReadMore` gives text of your own the same button: it wraps one element, which
  its own CSS clamps, and marks it `data-read-more="open"` while open. A summary now sits
  in a `.clover-read-more` box with its button, and an empty one renders nothing.

- **Popups open one at a time.** The Canvas's information and its menus (annotations,
  Choice, an animation's frames), the playback controls' menus and `Download`'s list:
  opening one closes whichever other is open, anywhere on the page, however it was
  opened. A key opens one without the press outside that closes a menu, so the
  information box and the annotations menu could both be open, one over the other. Each
  still closes itself as it did (Escape, a press outside). `Clover.useOneOpen` joins a
  popup of your own:

  ```jsx
  const [open, setOpen] = useState(false);
  Clover.useOneOpen(open, () => setOpen(false));
  ```

- **Every control that shows an icon alone names itself in a `Tip`**, on hover and on
  keyboard focus, with its keyboard shortcut when it has one: "Zoom in (+)", "Mute (M)".
  The text is the control's accessible name, from the same translation (WCAG 2.5.3); the
  shortcut's format is a string of its own, `controlShortcut`, for each language. Escape
  hides it, the pointer can move onto it, and it stays until the pointer or focus leaves
  (WCAG 1.4.13). Controls with a key carry `aria-keyshortcuts`, and the Canvas now takes
  its keys while any of its own controls has focus, not only the image: `+`, `−`, `0`,
  `R`, `⇧R`, and `K`, `M`, `J`, `L` for video and sound.
  - `Clover.Tip` shows the name for controls of your own:
    `<Clover.Tip label={label} shortcut={shortcut} />`, last inside the control. It takes
    `lang` for a name in another language than its control's, and a `<label>` around a
    radio or checkbox can hold one: it shows while the input has keyboard focus, and
    Escape hides it there too.
  - A `Tip` is always on top. The popups the Canvas's controls open (its information, its
    menus) hang below the controls and under them, so no popup covers a control's name;
    a `Tip` had shown behind an open menu, all but hidden. The information box's close
    button shows its `Tip` below it, inside the box, which had cut it off above.
  - `Previous` and `Next` are the arrow alone: the name is hidden for sight (inline, so
    without the stylesheet too) and shown in their `Tip`. They take no `iconOnly` and no
    children for a visible label; to rename them, set `commonPrevious` and `commonNext`
    in your i18n resources.
  - A `controlButtons` replacement gets `tip` to render inside its button, and
    `aria-keyshortcuts` in `buttonProps`.
  - Rotate left mirrors only its icon, not the whole button, so its `Tip` reads the
    right way round; on hover its icon turns a little the other way. A stylesheet that
    relied on `transform: scaleX(-1)` on `[data-button="rotate-left"]` now finds the flip
    on its `svg` (`scale: -1 1`).
  - The Canvas's controls are named by `aria-label` rather than by their icon's SVG
    `<title>`, which browsers also showed as a tooltip of their own. A test or stylesheet
    that looked for the `<title>` should use the button's name.

- **`Clover.Split`, `Clover.SplitPane` and `Clover.SplitHandle`**, panes side by side and
  the bar the reader drags between them. One pane beside each bar has a `size` (with
  `min` and `max`, in px, rem or %); the other takes what is left. The bar is a focusable
  `separator`: the arrow keys move it (Shift for bigger steps), Home and End go to the
  limits, and a click or tap steps the pane through its narrowest, its own `size` and its
  widest. A pane's `min` holds in the
  layout too, not only under the bar: where the Split is narrow, a sized pane gives way
  down to its own `min` before the others go below theirs. Docked beside the Canvas at
  about 580px, `Default`'s `InformationPanel` had kept its full 24rem and left the Canvas
  171px; it now shrinks toward 14rem, and the Canvas keeps 16rem. With `storageKey` the
  reader's sizes are remembered. Not tied to any part: the templates use it, and so can
  your own layouts. Dragging the bar does not blink the picture: a `Canvas` redraws in
  the same frame it is resized, wherever it sits.

  ```jsx
  <Clover.Split storageKey="my-layout">
    <Clover.SplitPane min="16rem">
      <Clover.Content />
    </Clover.SplitPane>
    <Clover.SplitHandle />
    <Clover.SplitPane size="24rem" min="14rem">
      <Clover.InformationPanel />
    </Clover.SplitPane>
  </Clover.Split>
  ```

- **The Canvas's controls tuck away and spring back.** Its round controls, the navigator
  and a video or sound's playback controls move as they fade: leaving, they accelerate
  0.618rem toward their edge (up, or down for the playback controls); coming back, they
  spring out, a touch past and back. They faded on two timings before (the navigator's
  150ms, the rest 200ms, on a curve that popped on the way out); now they share one and
  move as one. Captions rise and fall with the playback controls, by `translate` rather
  than `bottom`.
  - Whether they show is decided once, on `.clover-canvas`: `--clover-chrome-shown` (0
    or 1), `--clover-chrome-events` and `--clover-chrome-timing`, which each of them
    reads. Set `--clover-chrome-enter`, `--clover-chrome-leave` or `--clover-chrome-tuck`
    there to change the motion. With reduced motion, the controls still come and go,
    without moving.
  - The navigator hides by `opacity` and `pointer-events`, as the controls do, no longer
    by `visibility`.
- **The `InformationPanel`'s toggle, `PanelToggle`, never fades.** The Canvas's other
  controls fade when the pointer leaves; the toggle stays, in the Canvas's top corner (in
  `Default` and `Document`, on the bar beside the Canvas while the panel is open there),
  on wide screens and phones alike. That includes a lone video or sound, which shows no
  image controls, and a placeholder, whose own toggle steps aside for it. Beside the
  other controls it keeps their own gap. The controls now fade one by one rather than
  all together: a stylesheet that faded `.clover-canvas-controls` itself should fade its
  buttons instead.

- **`Canvas` (experimental).** Clover's own 2D pan-and-zoom renderer for images, video
  and sound, drawn with WebGL2 and falling back to Canvas2D. It replaces OpenSeadragon
  and Vidstack, which this package does not use.

  ```jsx
  import * as Clover from "@nulib/clover";
  import "@nulib/clover/styles.css";

  <Clover.Canvas
    body={paintingBody}
    label="A letter"
    onReady={(canvas) => canvas.zoomBy(2)}
    onViewportChange={({ x, y, width, height }) => {}}
  />;
  ```

  It covers what 3.x `Image` does, apart from OpenSeadragon's own configuration:
  - **Image services.** IIIF Image API 3.0, 2.1.1 and 2.0, tiled from `tiles`, from a
    level 0 tree's `sizes`, or from tiles Clover cuts itself. Requests use each version's
    canonical URLs.
  - **Images and regions.** `body` and `src` arrays, `isTiledImage`, and `body.region`
    clips.
  - **Light on the network and the main thread.** While the view moves, tiles are
    fetched for where it will land rather than for each view on the way, and new tiles
    reach the GPU a few per frame, so a burst of them never stalls one.
  - **Annotations, drawn over their regions on the Canvas.**
  - **Controls:** the same as 3.x `Image`'s, with `controlButtons`.
  - **Full screen, rotation and keyboard control**, and a **navigator** (an overview in
    the top left). Reset turns the image upright the short way: after four turns right
    it does not spin back a whole turn, and after three it turns one more quarter. The
    navigator is off by default, and its code loads only once it is on; turn it on with
    `navigator`:

    ```jsx
    <Clover.Canvas src={src} isTiledImage navigator />
    ```

  - **Loading its own.** `iiifContent` on a `Canvas` outside any `Root` loads what it
    draws, as a `Root` would: a Canvas, a Manifest's first Canvas, a Collection's first
    Manifest's, or the Canvas a content state names, by URL or as an object, in any
    Presentation version, fetched with `options.request` and upgraded as it loads. Until
    it arrives the Canvas shows its background and the loading bar; if it cannot be
    loaded, or has no Canvas, it says so (`role="alert"`) with the reason. It draws the
    Canvas's own annotations (its `annotations` pages, embedded or referenced) and a
    content state's, unless you pass `annotations`, and its information control shows the
    Canvas's label, summary and metadata. The loading is its own chunk, fetched only by a
    Canvas given it.

    ```jsx
    <Clover.Canvas iiifContent="https://example.org/canvas.json" />
    ```

  - **For hosts.** The `onReady` handle gains `zoomToAnnotation(id)`, which zooms to an
    annotation's region on the Canvas and focuses it, `fitCanvasRect(canvasId, rect)`,
    which frames a region of a shown Canvas, and `getCanvasRegion()`, the visible part of
    the Canvas filling most of the view in its own coordinates, and `atHome`, whether the
    view is still fitted whole (false once the reader zooms, pans or turns it, true again
    on `home()`; a resize keeps it). `options.request` sets
    credentials, headers and `fetch` for every request the Canvas makes.
    `placeholder={false}` opens a Canvas past its placeholder, and children render with
    the Canvas's controls, after its own (a host's own controls).
  - **An annotations menu.** With `annotations`, a comment control among the Canvas's
    controls lists them by their text. Picking one zooms to it and keeps its region
    highlighted, as clicking the region on the Canvas does.
    `controls={{ annotations: false }}` hides it.
  - **One place for what the controls open.** The information box (below) and the menus
    (annotations, Choice) hang `s` below the Canvas's controls, lined up with their end
    (`--clover-canvas-chrome-inset`), no wider than 22rem or taller than the Canvas leaves
    room for, with one look; on a phone, beside the controls' column. The information box
    had hung at its own distance, 1rem in from the edge, out of line with the menus. The
    menus are now the Canvas's own children, as the box is, not the controls': a
    stylesheet that reached them through `.clover-canvas-controls .clover-canvas-menu`
    selects `.clover-canvas > .clover-canvas-menu` instead.
  - **A caption of Canvas information.** When a shown Canvas has a `summary` or
    `metadata` (Cookbook 0029, "metadata anywhere"), an `i` control among the Canvas's
    controls slides out a closable box over the picture with each Canvas's label,
    summary and metadata.
    `Canvas` renders as a `<figure>` (it was a `<div>`), and the box is its `<figcaption>`;
    the captioned Canvases' labels name the figure. Values keep IIIF's limited HTML,
    sanitised as 3.x's Primitives do, and the sanitiser loads only when the box first opens.
    `controls={{ information: false }}` hides it. Its close button is the round control
    every other is.
  - **Placeholder Canvases.** A Canvas with a `placeholderContainer` (Presentation 3's
    `placeholderCanvas`) shows its image first,
    fitted and centred, with a toggle in the top right (the Viewer's magnifier) to open
    the Canvas; clicking the image opens it too. Once open, the toggle is a magnifier with
    a minus, which goes back to the image. Until then the Canvas is held back: no
    tiles, pan or zoom, hotspots, `Choice`, or video and sound. The information control
    and the annotations menu are not held back: a pick from the menu opens the Canvas and
    frames the annotation once it is drawn, as a pick from a list beside it does. Closing
    the Canvas back to its placeholder lets go of the pick (`onAnnotationSelect(null)`),
    so picking it again opens it again. The toggle goes back to the placeholder, and each new set of
    `canvases` starts from its placeholder. For video and sound the toggle is a large play
    button in the middle of the image, its icon in the proportion a control's has (1rem
    of 2.236), and opening starts playback; since the whole still plays it, pointing
    anywhere on the still lights the button, as pointing at it does. Once open it is the
    close control in the top right, like the image's. The close control stays in sight
    while the other controls fade, and so do the information control (the `i`), the
    annotations control, over a picture or a recording, and, while paused, a recording's
    (or an animation's) Play, at the start of its bar, so what a Canvas says of itself,
    what is said of it, and playing are always a press away; hovering any of them never
    brings the others back. Playing, its Pause fades with the rest. The transport's scrim, seek bar and other controls still fade:
    each fades on its own now, rather than the transport's box, and the scrim is the
    transport's `::before`. A rule of yours setting `opacity` on `.clover-canvas-transport`
    no longer fades it; one setting its `background` styles the box, not the scrim.

  It also draws IIIF Canvases, in Presentation 4: pass one, or the few shown together (a
  spread), as `canvases`. Upgrade older IIIF with `toPresentation4()` first. Inside a
  `Root`, given nothing to draw, it shows the Root's current view instead.
  - **Several images on one Canvas.** Each painting annotation's image is placed at its
    target. A `Choice` paints its first item, and a Canvas larger than its image is
    filled.
  - **Several Canvases** are laid out in reading order by `viewingDirection`, in any of
    the four directions.
  - **Choice.** A control with a bullet-list icon, beside the Canvas's other controls,
    lists a Canvas's `Choice` items and swaps between them, keeping the reader's view.
    It is added to `ControlButtons` as `choice`, so it can be replaced like the others.
  - **Controls on demand.** The Canvas's controls, the navigator (when on) and a dark
    shade behind them appear on pointer activity or keyboard focus inside the Canvas,
    and fade after `options.hideDelay` (2000 ms), as the bar of 3.x's Player does. Under
    a finger, a tap on the picture shows and hides them instead.
  - **No Manifest awareness.** `Canvas` does not step through a Manifest. Grouping
    Canvases by `behavior` (`individuals`, `paged` spreads with `facing-pages` and
    `non-paged`, `continuous`) and moving between them is the host's job.

  ```jsx
  <Clover.Canvas
    canvases={[leftPage, rightPage]}
    viewingDirection="right-to-left"
  />
  ```

  - **Video and sound.** A Canvas painting a `Video` or `Sound` body plays with Clover's
    own playback controls, styled as the bar of 3.x's Player: play, seek, volume, time
    and captions, with no Vidstack.
    - **Video.** A single video or sound Canvas is always fitted to the space it is
      given, at the video's own aspect. It does not pan, zoom or rotate. Full screen
      moves into the playback controls at the bottom, and the controls at the top and
      the dark shade behind them are not shown. Click the picture to play or pause, and
      use <kbd>Space</kbd>/<kbd>k</kbd>, <kbd>j</kbd>/<kbd>l</kbd> and <kbd>m</kbd> on
      the focused Canvas.
    - **Shared controls.** The playback controls show and fade with the Canvas's other
      controls, through the same `hideDelay`, pointer-leave and focus rules. They all now
      linger for a second after the pointer or focus leaves the Canvas, rather than
      vanishing at once. Mouse focus (a click on the picture) no longer keeps them
      showing; keyboard focus still does.
    - **Sliders.** The seek bar and the volume are solid and edgeless: the rail 65% white
      where nothing is loaded, 90% where it is, the played span in the accent, the thumb
      white, with no dark ring round rail or thumb (`--clover-player-track-shadow` is
      `none` by default). The scrim keeps them at 3:1 over the lightest picture (WCAG
      1.4.11): it is at least 60% black up to the seek bar and fades out above it, for
      video and sound alike (sound's own softer scrim is gone). A focused thumb keeps its
      ring.
    - **Inset as the image controls are.** The playback controls and the caption cues
      sit in from the stage's sides and foot by `--clover-canvas-chrome-inset` (`l` by
      default), as the Canvas's other controls do, rather than `m`; set that property to
      move them all together. On a stage narrower than 28rem the bar's controls are `xs`
      apart rather than `s`, so they keep to two rows at 320px.
    - **`navigable` gesture option.** `options.gestures.navigable: false` holds the
      camera still for any Canvas.
    - **Captions.** WebVTT files from `supplementing` annotations, one per language for
      a `Choice`, become caption tracks. Clover draws them on the scale, from the page's
      own text size, so a reader's larger default text makes them larger. Style them
      with `--clover-player-caption-surface` (the box), `--clover-player-caption-text`
      and `--clover-player-caption-edge` (a `text-shadow`, `none` by default), and set
      their size or font on `.clover-canvas-captions-cue`. A system's own caption
      settings apply where its player shows them (an iPhone's full screen, picture in
      picture). The Captions control's glyph tells whether they show: an outlined "CC"
      card while they are off, a filled one while they are on. The bar that marked it
      under the glyph is gone (Repeat keeps its own); a rule of yours for
      `.clover-canvas-transport-button[data-active]::after` no longer applies.
    - **Poster.** A `placeholderContainer` image is the video's poster.
    - **HLS** plays through `hls.js` wherever the browser supports it, Chromium's native
      HLS included, and natively only where it does not (older iOS).
    - **Sound** plays with the same playback controls, over the
      accompanying (or placeholder) Canvas's image. It has no waveform.
    - **New props and options.** `onMediaElement` hands a host the element, and
      `onEnded` fires at the end. `onCaptionChange` tells a host the caption file the
      reader picks in the Captions menu (`{ id, language }`, or `null` for Off), and
      `caption` (a file's `id`) chooses the one shown while captions are on, for a
      transcript of a host's own to lead and follow; inside a `Root` the Canvas reads it
      from the Root's new `clover.captions` channel, which `Transcript` sets. `options.media.presentation: "texture"` draws video
      frames into the WebGL canvas instead of positioning a `<video>`. This needs CORS,
      and a video without it falls back.

    ```jsx
    <Clover.Canvas
      canvases={[videoCanvas]}
      onMediaElement={(video) => {}}
      onEnded={next}
    />
    ```

  Nothing is fetched until a `Canvas` comes within half a screen of view: no image
  service, tiles, video, sound or captions. A hidden `Canvas` waits until it is shown.

  Viewport coordinates are in the image's own coordinates, ready to use as an `xywh=`
  region. An image served without CORS is still displayed, as a real `<img>` placed by
  the same camera.

  A standalone `Canvas` is 33.0 kB of JavaScript gzipped, translations included, and the
  whole `Viewer` is 39.3 kB, plus 3.9 kB for the stylesheet. 3.x `Image` with
  OpenSeadragon is 121 kB. Video and sound add a separate 4.2 kB chunk, loaded only when
  a Canvas paints them. `hls.js`, DOMPurify and the Presentation 4 upgrader load only when
  needed. The budgets in `build/size-budget.json` were raised for `Root` (Canvas 34 kB)
  and then for `Items`, the `InformationPanel`, annotations and transcripts (Canvas
  36 kB, Viewer 54 kB, stylesheet 5.8 kB), and again for Contents and Collections
  (Viewer 56 kB, Classic 55 kB), for the Document template's stylesheet
  (`templates.css` 2.2 kB), and for Content Search (Viewer 58 kB, Classic 57 kB, Document
  58 kB, stylesheet 6.2 kB). Search loads with the panel: split into a lazy chunk it
  measured larger, not smaller (Viewer 58.9 kB against 56.9). The Map tab adds 0.8 kB to
  the Viewer and 0.7 kB to a standalone Canvas: through esbuild, its lazy chunk splits
  the modules it shares with the parts into more chunks, each gzipped and wired on its
  own (the code itself is about 100 bytes). The Canvas budget was raised to 37 kB for it,
  and the Viewer's, Classic's and Document's by 1 kB for annotations on a point or a
  shape (0.4 kB on a Canvas, 0.5 kB on a Viewer, the SVG reader itself loading on
  demand), then each by 1 kB for animations (0.8 kB on a Canvas: frame detection and the
  renderer's `setHidden`/`isReady`, the clock and the frames' playback controls loading
  on demand), and by 1 kB for Download and renderers (Viewer 0.7 and 0.4 kB; the
  stylesheet's budget to 6.5 kB).
  The Classic and Document budgets were raised to 62.5 and 63 kB for `Split` (2.1 kB:
  pointer and keyboard resizing, the separator's value, limits and remembered sizes) and
  the panel sliding over the page, and the stylesheet's to 6.8 kB for the `SplitHandle`
  and controls that fade one by one.
  The Viewer's budget was raised to 61.5 kB and the stylesheet's to 7 kB for the
  `InformationPanel`'s accordion layout (the Sections that hold tabs and boxes alike).
  The Canvas budget was raised to 38.5 kB for full screen on iPhone (0.5 kB: the check
  for whether an element can go full screen, and handing a video, even one drawn into the
  `<canvas>` element, to the system player).
  The budgets were raised for the controls' `Tip`s, their keys and Escape (0.7 kB on a
  standalone `Canvas`, 34.7 to 35.4; about 0.8 kB on each template; 0.3 kB of CSS, the
  stylesheet 6.9 to 7.2): `Canvas` 35.8 kB, the Viewer with `Default` 61.0,
  `Document` 61.6 and `Gallery` 53.6, the stylesheet 7.5.
  `<clover-viewer>`'s was raised to 92.5 kB, for the Canvas's inset at home,
  `Position`'s two texts and the reader's open-or-closed choice, which brought it to its
  92.0.
  The stylesheet's budget was raised to 7.6 kB for the accordion's headings staying in
  sight, which brought it to 7.5 kB (7,513 B), and to 7.7 kB for the type scale's two
  new steps and stepped captions, and for those headings holding inside the panel's
  padding, which brought it to 7,647 B, then to 7.9 kB for the faint shadows that show
  content passing under them (7,891 B), and to 8 kB for a lone section that cannot be
  closed (7,905 B), then to 8.1 kB for the same shadows at a carousel's ends (8,082 B). For that, and for a content state opening a Collection on one of its
  members, `Document`'s budget was raised to 61.7 kB (61,609 B), then to 61.9 kB for the
  `InformationPanel`'s Collection section beside its own `CollectionSelect` (61,784 B),
  and `<clover-viewer>`'s
  to 92.7 kB (92,603 B), then to 92.8 kB for the carousel's shadows in its inlined
  stylesheet (92,710 B). For the `InformationPanel`'s Collection section fetching a
  `partOf` Collection when it opens (`openCollection`), `Document`'s was raised to 62 kB
  (61.92 kB) and `<clover-viewer>`'s to 93 kB (92.9 kB).
  For the Collection section's summary, homepage and id, `Default`'s header thumbnail, a
  pressed section scrolling its start into view and the accordion's closed headings in
  the accent, `Default`'s budget was raised to 61.2 kB (61,027 B), `Document`'s to
  62.4 kB (62,190 B), the stylesheet's to 8.3 kB (8,191 B) and `<clover-viewer>`'s to
  93.4 kB (93,232 B).
  The sizes are now measured as a Vite app builds them for production (Rollup, minified),
  where they were measured with esbuild. Through the package entry, esbuild's code
  splitting counts a module as reachable from the page by its re-export alone, even once
  tree shaking drops it. So a lazy chunk sharing modules with the entry drags them up
  front: with the Viewer's on-demand `Default`, every import from `@nulib/clover`
  measured as the whole Default template, a standalone `Canvas` included (62.4 kB).
  Rollup and webpack split by what is used. Rollup numbers are smaller, so every budget
  was set again from them: a standalone `Canvas` 34.7 kB (budget 35.2), the Viewer
  shell 0.9 kB (1.2), and the Viewer with `Default` 59.6 kB (60.2), `Document` 60.2 kB
  (60.8) and `Gallery` 52.2 kB (52.8). Before the shell, every template paid for
  `Default`'s parts: Gallery about 10 kB. MapLibre on
  a map is 289.7 kB and `@nulib/clover/map` 18.0 kB before it. `<clover-viewer>` draws
  `Default` up front (budget 92 kB; measured from its own build, as before). `Default`'s
  styles moved from `templates.css` (budget 1.9 kB) to the stylesheet (budget 7.2 kB). A
  page bundled with esbuild and code splitting still gets the up-front `Default` parts
  described above.
  MapLibre is 286.8 kB on a map (budget 300 kB), and `@nulib/clover/map` 17.4 kB before
  it (budget 20 kB). The whole Viewer, everything included, is 60.2 kB, a standalone
  Canvas 37.6 kB, the Classic template 59.0 kB, the Document template 60.0 kB, the
  stylesheet 6.3 kB and `templates.css` 1.8 kB. Bundled through the package entry with esbuild, a
  standalone Canvas measures 34.7 kB; imported directly it is 32.9 kB, as Rollup bundles
  it.
  The accessibility work of October 2026 brought a standalone `Canvas` to 44.5 kB, the
  Viewer with `Default` to 74.1, `Document` to 76.0, `Gallery` to 63.6, the map before
  MapLibre to 24.1 and `<clover-viewer>` to 111.3. Most of it was won back by loading on
  demand what not every page uses: the seven languages after English (5.6 kB); the panel
  sections past About (Collection, Contents, Search, Transcript, Annotations); the
  hotspots and the Canvas's annotations and Choice menus, fetched as soon as a Canvas has
  annotations or a Choice, so they are there before they are pressed (`.clover-canvas`
  now carries `data-animated` on an animation, as it does `data-media`); the navigator;
  the Content Search client, with the first search; and, in `<clover-viewer>`, the
  styles for media and maps. Twenty-seven unused strings went too. What remains is the
  accessibility work itself, and the budgets were set from the new sizes: a standalone
  `Canvas` 35.6 kB (budget 35.8, unchanged), the Viewer with `Default` 61.3 (61.5),
  `Document` 63.3 (63.5), `Gallery` 54.4 (54.6), `@nulib/clover/map` 17.2 before
  MapLibre (lowered from 20.0 to 17.3), the stylesheet 10.4 (10.6), `templates.css` 1.9
  (2.1; at 1,916 B it had passed its 1.9 unnoticed, the test stopping at the first page
  over) and `<clover-viewer>` 95.7 (95.9). Scrolling a hotspot's note longer than the
  stage then brought `<clover-viewer>` to 95.9 kB (95,934 B), 34 B over that, and its
  budget was set to 96.1. Items' pager, which replaced the `Pager` part (stepping a
  Collection's members, and a count that keeps its widest room), then added about
  0.4 kB to each template: the budgets were set to the Viewer with `Default` 62.0 kB
  (61,882 B), `Document` 64.0 (63,884 B), `Gallery` 55.1 (54,931 B) and
  `<clover-viewer>` 96.9 (96,709 B). Document's continuous column of sheets, the toggles
  on the spine (placed by `useSpine`, focus following them with `useFollowFocus`), the
  thumbnails' toggle dragged with their pane, and the spine's Tips then raised the
  Viewer with `Default` to 62.5 kB (62,418 B), `Document` to 65.2 (65,085 B), the
  stylesheet to 10.7 (10,657 B) and `<clover-viewer>` to 97.6 (97,437 B);
  `templates.css` is 2.0 kB (2,032 B), within its 2.1. The Transcript's language row
  beside its heading (the accordion's slot for it, the codes, their popovers), the
  captions menu's codes, one caption choice for the Canvas and the Transcript, and
  balanced labels then raised a standalone `Canvas` to 35.9 kB (35,878 B), the Viewer
  with `Default` to 62.9 (62,775 B), `Document` to 65.6 (65,460 B), `Gallery` to 55.2
  (55,154 B), the stylesheet to 11.1 (11,036 B) and `<clover-viewer>` to 98.3
  (98,200 B). Plain-text transcripts (the panel reading whether a Canvas has one) then
  raised the Viewer with `Default` to 63.0 kB (62,945 B), `Document` to 65.7 (65,626 B),
  `Gallery` to 55.4 (55,319 B) and `<clover-viewer>` to 98.5 (98,439 B). Every
  annotation in the panel, by layer and Canvas and kept in step with the view, then
  raised the stylesheet to 11.2 kB (11,104 B) and `<clover-viewer>` to 98.6
  (98,584 B); the Viewer with `Default` is 63.0 kB (62,966 B), within its 63.0. Masking
  the hotspots beneath the active one then raised `<clover-viewer>` to 98.7 kB
  (98,642 B); the stylesheet is 11.2 kB (11,168 B), within its 11.2. Letting go of a pick (a
  click off it, Escape, and their description) and the picked hotspot's name then raised
  a standalone `Canvas` to 36.1 kB (36,070 B), the Viewer with `Default` to 63.2
  (63,139 B), `Document` to 65.9 (65,840 B), `Gallery` to 55.6 (55,511 B) and
  `<clover-viewer>` to 99.0 (98,954 B); the stylesheet is 11.2 kB (11,179 B). A content state's note, and the
  Canvas opening for a pick made outside it, then raised a standalone `Canvas` to
  36.2 kB (36,177 B), the Viewer with `Default` to 63.5 (63,462 B), `Document` to 66.2
  (66,158 B), `Gallery` to 55.9 (55,830 B), `@nulib/clover/map` before MapLibre to 17.5
  (17,425 B) and `<clover-viewer>` to 99.4 (99,296 B). Reading text strictly by its `format`
  then raised the Viewer with `Default` to 63.7 kB (63,624 B), `Document` to 66.4
  (66,319 B), `Gallery` to 56.0 (55,977 B) and `<clover-viewer>` to 99.6 (99,482 B). Default's `fill`,
  framing a pick once its view is drawn, and `animateAnnotations` then raised a standalone
  `Canvas` to 36.3 kB (36,229 B), the Viewer with `Default` to 63.8 (63,715 B),
  `Document` to 66.5 (66,397 B), `Gallery` to 56.1 (56,062 B), the stylesheet to 11.3
  (11,224 B) and `<clover-viewer>` to 99.7 (99,645 B). The annotations menu over a
  placeholder then raised the Viewer with `Default` to 63.9 kB (63,788 B), `Gallery` to
  56.2 (56,120 B) and `<clover-viewer>` to 99.8 (99,732 B); a standalone `Canvas` is
  36.3 kB (36,283 B), within its 36.3. Annotations as the content
  (pages followed through `next`, the Manifest each names, the move between them, kept
  across moves) then raised the Viewer with `Default` to 64.2 kB (64,107 B), `Document`
  to 66.9 (66,781 B), `Gallery` to 56.5 (56,445 B), `@nulib/clover/map` before MapLibre
  to 17.8 (17,738 B) and `<clover-viewer>` to 100.2 (100,139 B). The rest of it, the
  annotations' own loading and the list's other Manifests, loads only when used. A
  Canvas shown on its own, a `Canvas` loading its own (`iiifContent`), the CC glyph, the
  `i` in sight and the upgrader's fragment fix then raised a standalone `Canvas` to
  36.6 kB (36,508 B), the Viewer with `Default` to 64.5 (64,383 B), `Document` to 67.2
  (67,092 B), `Gallery` to 56.7 (56,605 B), `@nulib/clover/map` before MapLibre to 17.9
  (17,876 B), the stylesheet to 11.4 (11,348 B) and `<clover-viewer>` to 100.6
  (100,537 B). About's "Part of", the Canvas's loading and the fix load only when used.
  Rationing WebGL contexts, following links (0022), images in popovers (0377), comments
  on a whole Canvas (0266), annotations on a recording's time (0103) and the transport
  fading by its parts then raised a standalone `Canvas` to 37.3 kB (37,298 B), the Viewer
  with `Default` to 65.3 (65,340 B), `Document` to 68.0 (68,014 B), `Gallery` to 57.5
  (57,519 B), `@nulib/clover/map` before MapLibre to 17.9 (17,929 B), the stylesheet to
  11.6 (11,586 B) and `<clover-viewer>` to 102.1 (102,132 B). Reading the links, the
  comments and the timed annotations loads only for a Canvas with annotations.
  Annotations that follow a recording, and reading an annotation's several targets,
  then raised a standalone `Canvas` to 37.6 kB (37,473 B), the Viewer with `Default` to
  65.6 (65.51 kB), `Document` to 68.3 (68.18 kB), `Gallery` to 57.8 (57.71 kB) and
  `<clover-viewer>` to 102.6 (102,501 B). What a Canvas loads up front is the reading of
  `xywh=…&t=…` and of groups of targets, a pick that follows the recording left unframed,
  and the overlay layer's `move`; the track itself, following it frame by frame, and
  going to a pick load with the hotspots, for a Canvas with annotations. Placing each
  hotspot on whole device pixels (under Fixed) then raised a standalone `Canvas` to
  37.7 kB (37,630 B), the Viewer with `Default` to 65.7, `Document` to 68.4 (68,338 B),
  `Gallery` to 57.9 and `<clover-viewer>` to 102.7 (102,635 B): 29 B on a Canvas.
  Hiding a page from the Canvas's menu (the hidden pages' state and the one filter of
  what is drawn), the seek bar's chapter under the pointer and its highlight shared with
  `Contents`, and their styles, then raised a standalone `Canvas` to 38.0 kB (37,925 B),
  the Viewer with `Default` to 66.1 (66,073 B), `Document` to 68.8 (68,771 B),
  `Gallery` to 58.4 (58,314 B), `<clover-viewer>` to 103.3 (103,270 B) and the
  stylesheet to 11.8 (11,783 B). The menus, the eye, the transport and `Contents` load
  on demand; what a Canvas loads up front is the pages' state and the props it passes.

  The API is experimental and may change in any release.

### Fixed

- **A recording's still keeps no empty place in the top right.** The control cluster
  moved in from the corner to leave room for the placeholder's toggle even where that
  toggle was the play button in the middle, so the annotations control, and the `i`,
  sat a control's width from the corner with nothing beside them. Over a recording's
  still they now take the corner; once it opens, the close control takes it and they
  sit beside it, as before.
- **Hotspots no longer shimmer as they move.** Each was placed at the fraction of a
  pixel its region falls on, so its hairlines were shared between two rows or columns of
  pixels, and a hotspot gliding with a recording pulsed from crisp to soft and back, each
  at its own speed, several at once over a film. While the view is upright, a hotspot's
  edges, and its size, are now on whole device pixels (half a CSS pixel on a 2× screen):
  its lines stay crisp and it moves a pixel at a time. A turned view is placed as before.
  The `--clover-overlay-top` and `--clover-overlay-bottom` a popover keeps within are the
  edges as placed. Nothing to change.
- **A transport menu's long options no longer overlap.** In a list taller than its room
  (the Chapters menu with long titles), each option shrank to one line's height and its
  words ran over the next; options now keep their height and the list scrolls. The
  Chapters menu is as wide as the Captions menu with its codes (16rem, within the stage),
  so a title of a few words takes a line or two.
- **A Canvas never shows the browser's picture of a lost WebGL context** (Chrome's face in
  a box). Browsers cap a page's WebGL contexts (about 16 on desktop, 8 on Android) and
  kill the oldest past the cap, and every `Canvas` used to take one as it was made, in
  view or not, so a page of them (the docs' Canvas page has 28) lost the ones at the top.
  Now a `Canvas` takes a context only while in view, Clover holds at most six on a page
  (one out of view gives its back at once to one coming into view; with six in view, the
  next draws with Canvas2D), and a context the browser takes anyway, for a map or the
  host's own, is dropped at once: the Canvas shows its background and draws on with
  Canvas2D from what it has loaded, and tries WebGL again when it next comes into view.
  Nothing for you to do. An offscreen Canvas drawn with Canvas2D now also gives its
  canvas back after `releaseAfterMs`.
- **Annotations whose target is a Canvas object with a fragment in its `id`** (valid
  Presentation 3) are drawn again. `@iiif/parser`'s upgrader
  read the fragment as part of the path (`…/canvas/1/xywh=…`), so they named no Canvas
  and never showed. Clover rewrites such a target as the SpecificResource it means
  before upgrading (`core/keep-fragments.ts`, loaded with the upgrader).

WCAG 2.2 AA, from an audit of the whole package. What it found and the plan for the rest
are in the repository's `ACCESSIBILITY.md`.

- **Canvas.**
  - The viewport's focus ring is a dark edge, the accent and a light band, at full
    strength: `--clover-color-primary` and `--clover-color-secondary` either side of
    `--clover-color-accent`, 9:1 apart by default, so one of them keeps 3:1 over any
    picture. It was the accent beside white at 75% opacity, which fell to about 2.4:1 on
    a mid-tone picture. The map's ring is the same. If you set `primary` and `secondary`,
    keep them 9:1 apart.
  - The viewport always has a name: the `label` given, else the Canvas's, the
    Manifest's, a painting body's, then "Image" (a new string, `canvasImage`).
  - The viewport says it can be operated: `aria-roledescription` ("zoomable image"),
    `aria-keyshortcuts`, and `aria-describedby` pointing to a hidden list of its keys,
    the player's for a lone video or sound. The role description is left out where its
    string is not in the page's language, and with `options.gestures.navigable: false`,
    which also drops the camera keys.
  - A control under a resting pointer, its Tip with it, no longer fades after
    `hideDelay`, so a press there no longer falls through to zoom the picture or play
    the media.
  - Under a finger, or a pen that does not hover, the controls, navigator and transport
    no longer hide on a timer. A tap on the picture shows them and the next tap hides
    them; a double tap zooms and leaves them as they were. `hideDelay` now applies only
    to a mouse and a pen that hovers. If you relied on touch chrome fading by itself, it
    no longer does.
  - A press where faded chrome sits only shows the chrome: neither the press nor its
    click reaches the picture or a hotspot beneath.
  - Focus that no press brought (the keyboard's, a screen reader's) shows the chrome and
    holds it until focus leaves.
  - A pen that does not hover works as a finger: a single tap no longer zooms or plays
    and pauses, and a double tap zooms. A touch double tap no longer zooms when
    `clickToZoom` and `dblClickToZoom` are both off.
  - At the largest zoom, a click, a double click or a double tap goes home, so one
    pointer can always zoom back out. If you turn off both the click zooms and the zoom
    controls, give readers a way out through the handle (`home()`, `zoomBy(0.5)`).
  - `options.gestures.navigable: false` now holds the camera still beside video or sound
    too, drops the grab cursor, and sets the figure's `data-navigable`.
  - Without the stylesheet, the controls take their presses again: the viewport is
    `z-index: -1` (was `0`), inline and in `Canvas.css`, in a figure that is
    `isolation: isolate` inline. Restack anything you placed against the old `0`. A rule
    that sets the viewport's own `z-index` now needs `!important`:

    ```css
    .my-page .clover-canvas-viewport {
      z-index: 0 !important;
    }
    ```

  - The information box and the Canvas's menus sit below every row of the controls, or
    beside every column on a phone, however the controls wrap on a short stage. The
    Canvas writes `--clover-canvas-controls-width` and `--clover-canvas-controls-height`
    inline on `.clover-canvas` for them. On a phone they have no minimum width. The
    controls' own box takes no presses; only the controls do.
  - Escape returns focus to a menu's control (Choice, annotations, frames) only when it
    is pressed in the menu or on the control. From elsewhere it closes the menu and
    leaves focus where it is. Escape now closes the information box from anywhere in
    the figure, also leaving focus where it is.
  - A menu or the information box that handles an Escape calls `preventDefault()`, so a
    `<dialog>` around the Canvas (the Gallery's lightbox) or a floating panel stays open
    until the next Escape. A host's own Escape handler should return early on
    `event.defaultPrevented`.
  - A hotspot with no text of its own is named by its number, as the annotations menu
    lists it. A hotspot reached by Tab pans into view just far enough to clear the
    controls, navigator, transport, information box and menus; one already clear does
    not move. The overlay layer is `overflow: clip`, so focus no longer scrolls the
    hotspots off their regions.
  - A hotspot's name is now a `Tip`, not a `<label>`. It shows on hover after a moment
    and at once on keyboard focus, takes the pointer, hides on Escape, wraps, and stays
    inside the stage, over the hotspot where neither side has room. Move your rules:

    ```css
    /* before */ .clover-canvas-annotation label { … }
    /* after  */ .clover-canvas-annotation > .clover-tip { … }
    ```

  - A hotspot's note taller than the stage is capped inside it and scrolls: by wheel or
    touch over it, and by the arrows, the page keys, Home and End from its hotspot. Where
    `scrollToZoom` is on, the wheel over a note that can scroll scrolls it rather than
    zooming. The gap between hotspot and note is now a clear `--clover-space-xs` border
    of the note's own (`background-clip: padding-box`), so the pointer still crosses
    onto it; the hotspot's `.clover-tip::before` bridge is gone. The note has
    `tabindex="-1"`, and a press on it focuses its hotspot: hidden
    from assistive technology, it never takes focus. `Clover.Tip` takes the same as
    `scrolls` for a popover of your own that may outgrow its room; give it a
    `max-height` and `overflow-y: auto`.

  - Hotspots are outlined in two tones, `--clover-color-primary` round
    `--clover-color-secondary`. Hovered, focused or picked, an accent band runs between
    them; nothing covers what it marks, and the picture round a rectangle dims a little
    (as 3.x's did, more lightly). Another hotspot beneath it shows none of its lines where the active one
    lies (its rectangle, or its shape's own outline), as a vector editor hides what a
    shape covers; those inside it and over it stay whole. It is a `mask-image` from
    `--clover-annotation-mask`, set inline on the hotspots beneath; a rule of yours that
    sets `mask` on `.clover-canvas-annotation` replaces it. In forced colours a rectangle has a
    `CanvasText` edge round a `Canvas` line, and an active one a `Highlight` ring.
  - Hotspots are in the DOM in the annotations' order, so Tab and screen readers follow
    the menu's order, not size. Stacking is a `z-index` from `--clover-annotation-depth`,
    set inline: smaller over larger, the active one over the rest, the later of two on
    one region on top. `.clover-canvas-overlays` is now `isolation: isolate` and
    `container-type: size`. Update selectors and tests that relied on the old order.
  - The picked hotspot has `aria-current="true"`.
  - While the view is upright, the overlay layer writes `--clover-overlay-x`,
    `--clover-overlay-top`, `--clover-overlay-bottom` and `data-overlay-room` (`above`
    or `below`) on each element it pins, and removes them while the view is turned.
  - Previous and Next frame stay focusable at the first and last frame: they are
    `aria-disabled` there, not `disabled`. A selector or test for `:disabled` on them
    should use `[aria-disabled="true"]`.
  - An animation's frames bar sits in a `.clover-canvas-media[data-kind="frames"]` layer,
    as a video's transport does: it fades with the chrome, and its menu fits the stage.
    Rules on `.clover-canvas > .clover-canvas-transport[data-kind="frames"]` should
    target `.clover-canvas-media > .clover-canvas-transport`.
  - The Gallery's lightbox is named by the Canvas's label, else the Manifest's.

- **Media.**
  - Captions carry their track's `lang` and decode numeric character references
    (`&#39;`, `&#x2019;`), as `parseVtt`, and so `Transcript`, now do.
  - Caption tracks the media carries itself (an HLS stream's subtitles, CEA-608/708, a
    file's own tracks) are offered in the Captions menu after the Manifest's, and drawn
    as the Manifest's are. They stay `disabled` until chosen.
  - In the iPhone's system player and in picture in picture, the chosen track is
    `showing`, and a choice made in the system's own menu is kept when the video comes
    back.
  - The Captions button describes the track in use, and in forced colours shows
    Highlight while captions are on.
  - Captions on, or Repeat pressed, draws a bar under the button's glyph (an `::after`
    border), in forced colours too. The transport's buttons take the accent fill under
    the pointer or on focus only, as Clover's other round controls do: no longer while
    captions are on, Repeat is pressed or their menu is open. A stylesheet that relied
    on that fill should mark `[data-active]`, `[aria-pressed="true"]` or
    `[aria-expanded="true"]` itself.
  - The Captions menu leads each track with the code of its cues' language ("EN",
    "IT"), in a column of its own (`.clover-canvas-transport-code`), so a reader who
    cannot read a track's name can still tell its language; the menu is a little wider
    with them (16rem).
  - The transport bar wraps rather than running off a narrow stage. Under 28rem of stage
    width (37.5rem with chapters), the time and chapter take a row above the buttons.
    They sit in a new `.clover-canvas-transport-status`, and
    `.clover-canvas-transport-spacer` is gone. Retarget rules on the spacer, or on
    `.clover-canvas-transport-bar > .clover-canvas-transport-chapter`, to
    `.clover-canvas-transport-status` and its `.clover-canvas-transport-chapter`.
  - Chapters, Captions and Full screen sit together in a new
    `<div class="clover-canvas-transport-end">`, at the end of the bar's last row. Rules
    that selected them as children of `.clover-canvas-transport-bar` should select them
    in `.clover-canvas-transport-end`.
  - The transport writes its bar's height inline on `.clover-canvas` as
    `--clover-transport-bar-height`, and `--clover-transport-room` includes it. If you
    override `--clover-transport-room`, use
    `var(--clover-transport-bar-height, var(--clover-control))` for the bar.
  - `.clover-canvas-media` is now `container-type: size`, so the menus and captions are
    sized to the stage. The Captions and Chapters menus place themselves when they open
    and on resize: no taller than the room above their button, no wider than the stage,
    and moved along to stay inside the bar's inset. They write
    `--clover-transport-menu-above` and `--clover-transport-menu-shift` inline. On a
    stage too short to clear the transport, the information box and the Canvas's menus
    may cover it.
  - The volume slider no longer hides below a 575px window. It narrows on a narrow
    stage, and is left out only where a page cannot set the volume (iOS).
  - The media stage stays mounted from one recording to the next (auto-advance), so
    focus stays on the transport. If the focused control goes with the recording
    (Captions, Chapters, Full screen), Play/Pause takes focus. A `texture` recording
    whose CORS request fails falls back to `dom` for that recording only.
  - While one of its controls has keyboard focus, the transport sits above the captions,
    so a cue never covers the focused control.
  - The Captions and Chapters menus stay open while the arrow keys move through them.
    They close on a choice, Escape or a press outside, with focus back on their button,
    and when focus moves out of them, leaving it where it went. An Escape in one closes
    only the menu, never a dialog around the Canvas.
  - `chapters` entries take `lang`, the language of their label, which Clover sets on the
    chapter's title and its menu option. Inside a `Root` it comes from the Range's label.

    ```tsx
    <Canvas
      chapters={[{ label: "Atto Primo", lang: "it", start: 0, end: 302 }]}
    />
    ```

  - An open video or sound's toggle reads "Close player" (`playerClose`, a new string),
    not "Close", in its name and its Tip. Tests that found it as "Close" should look for
    "Close player".
  - The full-screen button reads `imageFullScreen` and `imageExitFullScreen`, as the
    Canvas's own does. Move any `playerFullScreen` or `playerExitFullScreen` translation
    to those keys.
  - In forced colours the seek and volume sliders draw in system colours: a `CanvasText`
    rail and thumb, the played part in `Highlight`, and an outline on focus. The
    transport's buttons keep a 1px `ButtonText` border.

- **Previous and Next.** `Previous`, `Next` and Items' carousel arrows keep keyboard focus
  at the first and last view. There they are `aria-disabled`, not `disabled`: they leave
  the tab order, a press does nothing, and while focused they stay in sight with the
  arrow faded. Once focus leaves they show disabled, faded (`opacity: 0.38`) and taking
  no pointer, where they used to vanish: the pager keeps its shape, and a press on the
  strip's faded arrow reaches the picture under it. An animation's previous and next
  frame show disabled the same way at its first and last frame. The rule is one, in
  `ui/Button.css`. A `disabled` you pass is still the native attribute. Selectors and tests
  for `:disabled` on `.clover-pager-previous`, `.clover-pager-next`,
  `.clover-items-scroll-prev` or `.clover-items-scroll-next` should use
  `[aria-disabled="true"]`:

  ```css
  /* Before */
  .clover-pager-next:disabled {
    visibility: hidden;
  }
  /* After */
  .clover-pager-next[aria-disabled="true"]:not(:focus-visible) {
    visibility: hidden;
  }
  ```

  ```ts
  // Before
  expect(next).toBeDisabled();
  // After
  expect(next).toHaveAttribute("aria-disabled", "true");
  ```

- **Items.**
  - An item with no label is named by its place ("Item 2 of 5"). Options and links take
    their name from the item's label in every browser: the figure is `role="none"`, so
    give a `renderItem` figure the same. A `renderItem` item now shows a focus outline.
  - Keyboard focus adds a second ring inside the pictures' edge, in two tones
    (`--clover-color-secondary` at the edge, `--clover-color-primary` inside it, 2px
    each), so a focused item differs from a selected one by more than colour. It is a
    `CanvasText` outline in forced colours. Clover draws it on
    `.clover-items-pictures::after`; leave that pseudo-element to Clover.
  - On Enter and Space, `onSelect` gets the key's own event, as a click passes its own.
    `preventDefault()`, `stopPropagation()` and a `defaultPrevented` guard now work for
    keys as for clicks; before, a stand-in object threw on `preventDefault()`. Clover
    still keeps Space from scrolling the page.
  - Entering a nested Collection keeps focus in the list, on the new list's selected
    member or else its first.
  - A carousel's or grid's title cut short at three lines shows in full while its item is
    hovered or focused, over the picture above it, so nothing around it moves. Escape
    hides it until the pointer comes back or focus leaves. The label's markup changed:
    `.clover-items-label` now holds `.clover-items-label-text`, which carries `lang` and
    takes the clamp, and, when the title is cut, `data-clamped` and a hidden copy,
    `.clover-items-label-full`, kept out of the item's name. Only a clamped title can be
    cut: a list's titles (a Collection's members) never get the copy, in Firefox too,
    which measured their inline text as cut. Move a clamp or `lang` selector to the
    inner span.

    ```css
    /* Before */
    .clover-items-label {
      -webkit-line-clamp: 2;
    }
    /* After */
    .clover-items {
      --clover-items-lines: 2;
    }
    ```

- **Collections.**
  - In `Clover.Collection` and the panel's Collection section, member titles and
    summaries wrap in full. A long one makes its member taller than its thumbnail.
  - `CollectionSelect` no longer loads a Manifest on every arrow key or typed letter.
    From the keyboard, the arrows move through the members and Enter loads the one
    shown; Escape or leaving the menu takes the step back. A choice from the menu's own
    list (a pointer, a phone's picker, Alt+↓, the list macOS opens) loads at once.
    `onChange` fires on a choice, not on each step. Its Escape is `preventDefault`ed, so
    a dialog or floating panel around it stays open. After a failed load, Enter tries
    again.
- **Information panel.**
  - In the accordion, the default sections' own headings sit a level under the section
    headings: h4 under h3 by default (About's download groups h5). Style them by class,
    not by tag.
  - Accordion labels wrap onto as many lines as they need, never cut short. `Sections`
    measures the headings, and the stuck stacks follow.
  - What is focused or scrolled to in the open section stays clear of the stuck
    headings: its content keeps a `scroll-margin-block` as tall as the stacks, and
    keyboard focus moves the pane to show it. A press never scrolls the pane.
  - Headings stop sticking when the window is 32rem tall or less, or where their stacks
    would leave the open section less than two lines of text, which sets
    `data-stacks="off"` on the list.
  - `--clover-sections-heading-height` is gone, and the heading has no fixed `height`:
    size headings with padding. `--clover-sections-step` is now on `.clover-sections` and
    `--clover-sections-index` on `.clover-sections-item`, both only a fallback until the
    headings are measured. `Sections` writes `--clover-sections-before` and
    `--clover-sections-after` inline on each item, and `--clover-sections-total` on the
    list. For one line anyway, set `white-space: nowrap`, `overflow: hidden` and
    `text-overflow: ellipsis` on
    `.clover-sections[data-layout="accordion"] .clover-sections-label`; it cuts any label
    that text spacing widens.
  - In forced colours the current row (an annotation, a Range, a cue, a search hit, a
    place on the map) keeps its edge, in `Highlight`, and the other rows' edges are drawn
    in `Canvas`.
  - Escape puts away a floating panel even with focus on a control under it, and
    `Default` and `Document` never leave focus on a pane they hide.
  - Download's menu closes when focus leaves it. Its Escape is `preventDefault`ed, so a
    modal `<dialog>` around it stays open.
- **Annotations.**
  - An image annotation with no text beside it takes its alt from the image's `label`,
    else the annotation's, else "Image" (`annotationsImage`, a new string). An image
    with text beside it keeps `alt=""`. `AnnotationBodyEntry` has a new optional
    `label`.
  - Each entry's "Find on the image" button carries that label, or the entry's number
    ("Find on the image: 2"), so no two read alike.
  - A Markdown annotation is named by its words, without the syntax, in its button, its
    hotspot, the hotspot's Tip and the annotations menu.
- **Search.**
  - The status region stays in the accessibility tree while empty (visually hidden, not
    `display: none`), so its first message is announced.
  - Matched words are bold as well as tinted, and take `Mark` and `MarkText` in forced
    colours. If you restyle `.clover-content-search-hit mark`, keep a sign besides
    colour.
- **Status.** `Status` keeps one `role="status"` element, `p.clover-status`, for its whole
  life: empty and visually hidden once ready, only its words changing, so "Loading…" is
  announced on every load. An error renders the `role="alert"` box beside it. A test or
  style that expected no `.clover-status` once ready should select `[data-status]` (set
  only while loading, and on the alert) or `[role="alert"]`:

  ```js
  // Before
  expect(container.querySelector(".clover-status")).toBeNull();
  // After
  expect(container.querySelector(".clover-status[data-status]")).toBeNull();
  ```

- **Split.**
  - A click or tap on a `SplitHandle` steps its sized pane from its narrowest to its own
    `size` to its widest, and round again. A press is a click until it moves 4px (8px
    for a finger); past that it is a drag. `event.preventDefault()` in your `onClick`
    skips the step.
  - A double click no longer resets the pane: it steps once, and its second click, which
    lands on what the step uncovered, is ignored for half a second or until the pointer
    moves away. Your `onDoubleClick` still runs. Reaching its own `size` forgets the
    stored size. Where you told readers to double-click the bar, tell them to click it.
  - A pane's widest is what it shares with the pane across the bar, less that pane's
    `min`, so in `Document` neither bar squeezes the third pane.
  - At rest the bar has a grip at its middle, in `--clover-color-primary-muted`, 3:1
    against either pane, 1px wider than the bar on each side. The bar's faintness is now a `background-color`, not `opacity`,
    which would fade the grip too. `::after` draws the grip and `::before` is the grab
    area, now `l` wide; use a child element for anything else. If you restyled the
    handle:

    ```css
    /* Before */
    .clover-split-handle {
      background-color: …;
      opacity: …;
    }
    /* After: the bar, and its grip (keep the grip 3:1 against both panes) */
    .clover-split-handle {
      background-color: …;
    }
    .clover-split-handle::after {
      background-color: …;
    }
    ```

  - The handle names itself in a Tip beside its grip, on hover and focus: "Resize
    panels", or its own `aria-label`. A press on the Tip neither steps nor drags. The
    handle now renders its `children` and the `.clover-tip` span, so a test that read
    its `textContent` should read its accessible name. Without the stylesheet the name
    shows, so the focus stop has a box.
  - In forced colours the bar and grip are `CanvasText`, and `Highlight` while hovered,
    held or focused. Focus adds a 2px outline.

- **Popovers.**
  - A `Tip` dismissed with Escape fades (`opacity: 0`) and takes no pointer, so a click
    where it was reaches what it covered. It shows again when the pointer next enters
    its control, or when focus leaves and comes back.
  - Each time a Tip shows, it is measured against what clips it (the stage, a scrolling
    panel, the window). One that would pass an edge wraps to the room there is and
    moves in, `xs` clear. `.clover-tip` is now `width: max-content` and wraps, and sets
    `transform: translateX(var(--clover-tip-shift, 0px))`; Clover writes
    `--clover-tip-room` and `--clover-tip-shift` inline. Give your own offset with
    `translate`, not `transform`, and drop any reliance on `white-space: nowrap`.
- **Text.**
  - Links in IIIF text are underlined, not only coloured. To opt out, set your own
    unlayered `text-decoration: none`.
  - Long unbroken values in Summary, Metadata and RequiredStatement wrap.
  - "Read more" appears when text spacing or a late font pushes a summary past its clamp.
  - Document's title wraps. For one line, set `white-space: nowrap`, `overflow: hidden`
    and `text-overflow: ellipsis` on `.clover-template-document-title`.
  - `Default`'s titles over `Items` (a spread's, joined by a dot) wrap, as Document's
    title does, never cut short with an ellipsis.
  - The search field's placeholder meets 4.5:1.
  - Each link in the `Homepage`, `Rendering`, `SeeAlso` and `PartOf` lists is at least
    24px tall (`min-block-size`).
- **Markdown and HTML.**
  - Markdown lists (`format: "text/markdown"`, in an annotation body or `Clover.Value`)
    are `ul` and `ol` with `li` items. A numbered list keeps its first number as
    `start`, an indented item nests under the one before, and a list may follow a line
    of text with no blank line (a numbered one only when it starts at 1). Clover gives
    them markers and an `l` indent.
  - Markdown headings are `<p role="heading" aria-level="N"><b>…</b></p>`, never
    `h1`–`h6`. The first takes the part's level, and each later one sits a level under
    the nearest shallower heading before it, never skipping one. In `Annotations` they
    sit a level under the set's heading.
  - Before, bullets were `<p>• a<br>• b</p>`, numbered lines one `p`, and headings
    `<p><b>…</b></p>`; restyle with `ul`, `ol` and `[role="heading"]`. A page's list
    reset (Tailwind's preflight) removes the markers, and with them VoiceOver's lists in
    Safari. Put them back:

    ```css
    :is(.clover-annotations-body, .clover-value) ul {
      list-style: disc;
      padding-inline-start: var(--clover-space-l);
    }
    :is(.clover-annotations-body, .clover-value) ol {
      list-style: decimal;
      padding-inline-start: var(--clover-space-l);
    }
    ```

  - IIIF HTML loses `aria-*` and `data-*` attributes, which the Presentation API does not
    allow.
  - Clover sanitises with a private DOMPurify instance, so your page's own
    `DOMPurify.sanitize` no longer drops relative `href` and `src` once Clover has run.

- **Headings.**
  - `headingLevel` (2 to 6) fits Clover's headings into your page's outline. `Default`,
    `Document` and `Gallery`, and so the Viewer, take it for the title (default 2), and
    the headings inside sit a level below: the panel's sections, Document's Download
    groups, Gallery's lightbox title. `<clover-viewer>` takes `heading-level`.
    Standalone `Clover.Items` takes it for its title (default 2),
    `Clover.InformationPanel` for its accordion headings (default 3), `Clover.Download`
    for its groups (default 3) and `Clover.Value` for a Markdown value's first heading
    (default 3). Under a heading of your own, pass the level below it:

    ```jsx
    <h3>Opening at a place</h3>
    <Viewer iiifContent={url} headingLevel={4} />
    ```

  - `Default` with `header={false}` has no title, so its panel's sections take the
    title's level: `h2` by default, where they were `h3`. Pass `headingLevel={3}` to keep
    `h3`.
  - Select these headings by class, not tag (`h2.clover-template-default-title`,
    `h2.clover-items-title`, `.clover-template-lightbox-header h3`), so a rule holds at
    any level.

- **Language.**
  - IIIF HTML keeps `lang` and `dir`, and an image its `width` and `height`. Contents,
    the caption-track menu, annotation set headings, a Thumbnail's default alt and the
    Root's announcement carry their label's `lang`. The error box carries `lang="en"`
    until it is translated.
  - Where Clover's interface language differs from the page's (a host's `lng`, or a
    page in a language Clover has no strings for), each of Clover's strings carries `lang` on the element that shows it
    or is named by it. The page's language is a `lang` you give the root, else the
    nearest `lang` around the `Root`, or around a standalone `Canvas`, `Items` or `Map`,
    read after mount. No Clover root carries a `lang` of its own, so your content inside
    a `Root`, and IIIF text in `none`, keep the page's language.
  - A container named in another language than the page's (Items' pager's `nav`, the
    panel's tabs and Sections, Contents, the Items list, the Canvas viewport, the
    Canvas's and the transport's menus) is named by `aria-labelledby` and a hidden
    element carrying `lang`, not by `aria-label`. Standalone `Items` with a heading is
    named by that heading. Query the accessible name instead:

    ```js
    // Before
    container.querySelector('nav[aria-label="Pages"]');
    // After
    screen.getByRole("navigation", { name: "Pages" });
    ```

  - A custom control in `controlButtons` receives `lang` in its props. Spread it with
    the rest, or its name loses its language:

    ```jsx
    controlButtons={{ zoomIn: ({ props, icon }) => <button {...props}>{icon}</button> }}
    ```

  - `Clover.useLangOf()` gives `langOf(key)`: the language of one of Clover's strings
    where it differs from the page's, else `undefined`, for parts of your own. The value
    `initCloverI18n` returns also has `resolve(key, values)` (`{ text, lang }`),
    `langOf(key, hostLanguage)` and `resolvedLanguage`.

    ```jsx
    const t = Clover.useT();
    const langOf = Clover.useLangOf();

    <button aria-label={t("commonClose")} lang={langOf("commonClose")}>
      <CloseIcon aria-hidden="true" />
      <Clover.Tip label={t("commonClose")} />
    </button>;
    ```

  - `<clover-viewer>` can set its interface language: `initCloverI18n` is exported from
    `@nulib/clover/web-components`, and is a static on the element's class
    (`customElements.get("clover-viewer").initCloverI18n({ lng: "fr" })`).
  - `Canvas` takes `language`, the language to read its IIIF text in: labels, Choices,
    hotspots, chapters and the information box. Inside a `Root` it defaults to the
    Root's.
  - es, fi, fr, nb, nn, no and pt have every string, so none falls back to English
    partway through. In nb, nn and no, `informationPanelTabsClose` is "Visning" (was
    "Viewer"); in nn, `informationPanelTabsAnnotations` is "Annoteringar" and
    `contentSearchLoading` "Lastar inn...". Tests that find controls by the old words
    need the new ones. `pt` is European Portuguese, which Brazilian readers get too. The
    new translations await review by native speakers.
  - New strings: `canvasRoleDescription`, `canvasKeysImage`, `canvasKeysMedia`,
    `playerClose`, `annotationsImage`, `mapAttribution`, `mapPlaceUntitled`, `mapOverlay`,
    `mapPlacesListed`, `canvasKeysAnnotations`, `aboutCanvas`, `aboutPartOf` and
    `aboutOpenManifest`. If you pass your own `resources` to `initCloverI18n`,
    translate them.

- **Map.**
  - Focus shows on the map and its controls. Popups take `--clover-color-secondary` and
    `--clover-color-primary`. Lines and outlines have a white casing, a new
    `geomap-navplace-casing` layer under `geomap-navplace-line`. The credits button
    reports collapsed while the credits are closed.
  - A list of places, `ul.clover-geomap-places`, renders under every map, the Map tab's
    included. It has a button for each navPlace feature, named by its title in its own
    `lang` ("Place 2" when it has none), and one for each georeferenced image drawn,
    named by its Canvas's label. A button frames its place, opens its popup and calls
    `onSelect`; inside a `Root` it also goes to the place's Canvas, and the places of the
    Canvases in view are `aria-current="true"`. The list shows even when MapLibre cannot
    start.
  - MapLibre's canvas is the map's only region, named by `mapLabel` and described by a
    count ("Places listed after the map: 2"). `.clover-geomap-canvas` no longer has
    `role="region"` or `aria-label`; a test that found it should find
    `getByRole("region", { name: "Map" })`. In the information panel the canvas is a
    `group`, since the section is the region. MapLibre's own labels (the map, zoom, the
    credits) come from Clover's strings and follow `initCloverI18n`.
  - Popups carry their title's `lang`. `MapFeature.properties.titleLang` and
    `Georeference.label` are new, and `onSelect` also fires from the list.
  - `.clover-geomap` is now a grid of the map's box (its first `div`, sized by
    `--clover-map-height`, default `24rem`) and the list under it. `style` and
    `className` go on that wrapper, so a `height` there no longer sizes the map. Move
    rules for the box (`border-radius`, `overflow`, a background) to
    `.clover-geomap > div`, and size it with the property:

    ```tsx
    // Before
    <Map style={{ height: 400 }} />
    // After
    <Map style={{ "--clover-map-height": "400px" } as React.CSSProperties} />
    ```

- **Size.** Measured as a Vite app builds them, with every fix here but the last
  transport changes: a standalone Canvas is 44.3 kB gzip, the Viewer with `Default`
  73.3, `Document` 75.2 and `Gallery` 62.8, the Map before MapLibre 24.1, `styles.css`
  10.2 and `<clover-viewer>` 110.1 kB up front. The last transport changes add about
  0.4 kB to a Canvas and 0.2 kB to `styles.css`. The largest costs: the completed
  locales, about 3.2 kB on each entry (3.0 kB on `<clover-viewer>`); Tips kept inside
  what clips them, 0.5 kB; hotspots, 0.7 kB, with 1 kB more loaded on the first hotspot
  focus.
