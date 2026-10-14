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
- **`initCloverI18n`**, as in 3.x. Translations are bundled for en, es, fi, fr, nb, nn,
  no and pt.
- **`Clover.Root` and its parts.** `Root` loads `iiifContent` and holds where the reader
  is; parts read from the nearest `Root`, wherever they sit in your markup.
  - `Content` draws the current view (a page, a spread, a video or sound) with `Canvas`.
  - `Label` shows the Manifest's label, or the current Canvas's with `of="canvas"`, in the
    reader's language and marked with `lang`.
  - `Previous`, `Next`, `Position` and `Pager` move a view at a time, a spread at a time
    in a paged book. Their arrows and order follow `viewingDirection`. `Previous` and
    `Next` are round arrow controls, as Items' arrows are: each names itself on hover and
    focus, and is hidden on the first or last view, keeping its room so `Position` stays
    put. `Position` shows "2 / 5", the same in every language; assistive technology reads
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
    <Clover.Pager />
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

- **The descriptive properties as parts:** `Summary`, `Metadata`, `RequiredStatement`,
  `Rights`, `Homepage`, `Rendering`, `SeeAlso`, `PartOf`, `Thumbnail` and `Id`, beside
  `Label`. Each reads the Root's Manifest, or the current Canvas with `of="canvas"`; a
  `value` prop wins, so they work outside a `Root` too. Text is in the reader's language
  and marked with `lang`.
- **HTML in IIIF values is sanitised**, allowing only the markup the Presentation API
  permits and `http(s):` or `mailto:` links. Scripts, event handlers, `style`, SVG, and
  `javascript:` or `data:` URLs are removed. A value with markup shows as plain text until
  the sanitiser (DOMPurify) has loaded, which happens only when some value needs it.
- **`Clover.InformationPanel`**, information about the Root's resource in sections, with
  About by default. Give it `Clover.Tab` children (`value`, `label`, and anything as
  content) to choose the sections, including your own; this replaces 3.x's information
  panel plugins. `value` / `defaultValue` / `onValueChange` control which section shows.

  `layout` lays the sections out as `"tabs"` (the default) or `"accordion"`: stacked
  boxes, each opened and closed by its heading; opening one closes the others. In a
  panel that scrolls, every accordion heading stays in sight: those scrolled past stack
  at the top, those an open section pushes below stack at the bottom, both inside the
  panel's padding, so the first heading holds where it rests from the first pixel of
  scrolling (a heading is one line, cut short if it must be). What scrolls under them
  shows faintly: a soft shadow under the open section's heading once the panel has
  scrolled, and over the next heading while there is more below. A closed section's
  heading is in the accent at the text's own weight, faintly underlined, and the open
  one's in the text's colour, bold;
  the heading after the open section is set `s` apart from its content. A section opened
  by a press scrolls its start into sight, under the headings stacked above it. A lone section stays
  open: there is nothing else to open in its place, so its button is `aria-disabled`
  (as WAI-ARIA's accordion has it) and draws no chevron. The scroll drives it
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
  86 kB gzip up front (3.x's element: about 530 kB); MapLibre, its worker and its
  stylesheet load only with a map.

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
    ends), play or pause, Repeat, and "Frame 3 of 16".
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
  - Picking an entry frames it on the Canvas, moving to its Canvas first. Hovering an
    entry or its region on the Canvas highlights both, through the Root, with no timers
    or polling.
  - Each set starts with a "Hide Annotations" checkbox (`annotationsHide`) that takes its
    regions off the Canvas, and under it a heading only when its AnnotationPage has a
    `label` of its own: the `InformationPanel`'s Annotations section names the rest. HTML bodies are
    sanitised; image bodies (Cookbook 0377) show as images. Caption files are left to the
    video or sound they caption.
  - `annotations` on `Root` adds AnnotationPages or AnnotationCollections (followed from
    `first` through `next`), as URLs or objects.
  - The Canvas takes `selectedAnnotation`, `highlightedAnnotation` and
    `onAnnotationSelect`, so a host can drive its annotations' regions too.
  - An annotation's region on the Canvas takes its target's shape: a rectangle
    (`xywh`), a point (PointSelector, a marker that frames a 40-unit box when pressed,
    Cookbook 0135), or a shape (SvgSelector, drawn as itself and pressed only within it,
    Cookbook 0261). Shapes are redrawn from their geometry — `path`, `polygon`,
    `polyline`, `rect`, `circle`, `ellipse`, `line`, numeric attributes only — never
    from the selector's markup. The SVG reader (1.3 kB) loads only when a shape is in
    view.
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
    the cue playing (found by binary search) and seeks to a cue when it is pressed. With
    several caption files it offers a choice of language. It appears as a Transcript tab
    when the view's media has captions. Playback re-renders it only when the cue changes
    and writes nothing to the Root's state.
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
    their names at the panel's size, a name and its summary a line each, cut short if they
    must be), set 1.618rem (`l`) from what is above and below it, then its homepage and
    its id.
    Choosing one shows it. A `partOf` Collection is fetched only when the section first
    opens, never before. This is where the Viewer's `Default` template lists them.
  - `Clover.Collection` is that section as a part of its own, for a layout that shows
    the Collection anywhere: `<Clover.Collection headingLevel={4} />` (its headings at
    `h3` by default). The Presentation 4 Collection type is exported as
    `Presentation4Collection`, as the Canvas type is `Presentation4Canvas`, since the
    part takes the name `Collection`.
  - `Clover.CollectionSelect`, a native `<select>` of the members labelled by the
    Collection, is the same choice as a menu (in `Document`'s toolbar). Choosing a
    Manifest shows it; choosing a nested Collection enters it.
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
    arrows are Previous and Next, headed by the labels of the view's Canvases and
    `Position` ("2 / 70"); the `InformationPanel` to the right of all three, the
    layout's full height, scrolling within. The panel never stacks: it has its own space
    beside the Canvas, and a `SplitHandle` between them shares the width (remembered
    under `storageKey`).
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
  - `Document`: reads like a PDF viewer. A toolbar, `Items` down the left (the
    Manifest's Canvases as page thumbnails), and one whole page at a time: a scroll
    turns the page (one gesture, one page, past any trackpad momentum), as do PageUp and
    PageDown, and at either end the wheel scrolls the web page on. A turn takes a
    deliberate scroll (100px of wheel), and a long swipe's momentum never turns a second
    page, however strong it stays; a wheel still spun after a second turns one more. A
    scroll short of a turn shows how near it is: the page leans the way it is scrolled,
    by up to `l`, and a chevron rises in from the edge the next (or previous) page comes
    from. Let go and the page springs back, the chevron lingering a beat before it
    fades; after a turn its chevron stays a moment in full, then fades. For less motion,
    only the chevron shows. A `SplitHandle` between `Items` and the page resizes the
    thumbnails; a one-page document has neither, nor their toggle. The toggle reads
    "Show Items" and their pane "Items": what they list need not be pages. The
    `InformationPanel` sits to the right of the page in its own `SplitPane`, with a
    `SplitHandle` between them that shares the width (remembered under `storageKey`),
    where there is room for both, as `Default`'s does; where there is not, it slides out
    over the page, taking focus and closing on Escape or its own button. Spaced as
    `Default` is: the toolbar, `Items`, the page and the panel each keep
    `--clover-inset` at their sides, so the toolbar's first and last controls, the
    thumbnails, the page and the Canvas's controls share one edge; the Manifest's
    `Label` is `text-l`, `Items`' pane starts at 13rem (its thumbnails as wide as
    before), and the panel is as wide as `Default`'s floating one. The page keeps the
    inset clear round it on its grey background.
  - `Gallery`: `Items` as a grid of the views, opening one in a lightbox (a native
    `<dialog>`) with the Canvas and the `Pager`.
  - `Text`: a Manifest read as text, as 3.x's Scroll reads it. One article per Canvas,
    its image beside its annotations in a column per language, with a search and a
    lightbox.

  ```jsx
  import Viewer from "@nulib/clover";
  import { Document } from "@nulib/clover/templates";
  import "@nulib/clover/styles.css";
  import "@nulib/clover/templates.css";

  <Viewer iiifContent={url} template={Document} />;
  ```

- **`visuallyHidden`**, the inline styles Clover hides labels with, for parts of your own
  that must read plainly without the stylesheet.
- **Markdown annotation bodies** (`format: "text/markdown"`) are read as Markdown —
  paragraphs, emphasis, links, lists, footnotes — and sanitised like HTML. `Clover.Value`
  shows any language map (with `format`); `useAnnotationSets`, `useT` and `toPlainText`
  are exported; `Root` takes `annotationPages="all"` to fetch every Canvas's referenced
  annotation pages, not only the view's. `Thumbnail` takes any resource as `value`, and
  image attributes such as `alt`.
- **`Clover.Items`**, thumbnails of a sequence as a `carousel` (the default), `list` or
  `grid`. It succeeds 3.x's `Slider` and the row of thumbnails under 3.x's Viewer.
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
  - `filter` adds a search field; `renderItem` replaces an item's figure.
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
  Manifest, a Collection (its first Manifest is shown, or `manifestId`), a Canvas (its `partOf` Manifest,
  or a Manifest of one), or a content state as JSON or base64url. A content state opens
  at its Canvas, framing its region or seeking to its time, past any placeholder. A
  Manifest it names that is `partOf` a Collection (directly, or as its Canvas's Manifest)
  opens that Collection on that Manifest, so its members are there to choose from. Then
  comes `defaultCanvasId`, then the Manifest's `start`, then its first Canvas. `canvasId`
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
  3px, transparent at rest, so only its colour changes: the accent for the selection, the
  text colour for keyboard focus (so the two tell apart where they part, as a
  Collection's members do), and the accent at half strength for hover. It is an outline
  on `.clover-items-pictures`, in 4px of room the item keeps round itself
  (`--clover-items-ring-room`) and gives back with a negative margin, so items are still
  `--clover-items-gap` apart and the edge of `Items` never cuts a ring. Only a carousel,
  which scrolls across, keeps that room at its sides: a list or a grid keeps it above and
  below alone, so it never reaches past its own sides, which had put a scrollbar across a
  scrolling box with no padding round it. A stylesheet that
  styled `.clover-items-pictures::after` should style `.clover-items-pictures`'s outline
  instead. The thumbnails' corners are rounded to match, `--clover-radius` (3px), a
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
- **The playback controls for video and sound stay on one row.** The play, volume, time,
  chapters, captions and full-screen controls keep their size, and the current chapter's
  title gives way to them, shortening with an ellipsis, rather than the row wrapping.
- **Captions show once on iPhone.** iOS Safari turns a caption track on by the reader's
  caption settings, and drew its own copy of each cue in the picture, under Clover's. Every
  track now stays `hidden`. Clover draws the cues and fills the transcript.
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
    `<Clover.Tip label={label} shortcut={shortcut} />`, last inside the control.
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
  limits, and a double click puts the pane back to its size. A pane's `min` holds in the
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
  controls fade when the pointer leaves; the toggle stays, in the Canvas's top corner, on
  wide screens and phones alike. That includes a lone video or sound, which shows no
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
    navigator is off by default; turn it on with `navigator`:

    ```jsx
    <Clover.Canvas src={src} isTiledImage navigator />
    ```

  - **For hosts.** The `onReady` handle gains `zoomToAnnotation(id)`, which zooms to an
    annotation's region on the Canvas and focuses it, `fitCanvasRect(canvasId, rect)`,
    which frames a region of a shown Canvas, and `getCanvasRegion()`, the visible part of
    the Canvas filling most of the view in its own coordinates. `options.request` sets
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
    tiles, pan or zoom, annotations, `Choice`, or video and sound. The information control
    is not held back. The toggle goes back to the placeholder, and each new set of
    `canvases` starts from its placeholder. For video and sound the toggle is a large play
    button in the middle of the image, and opening starts playback; once open it is the
    close control in the top right, like the image's. The close control stays in sight
    while the other controls fade.

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
    and fade after `options.hideDelay` (2000 ms), as the bar of 3.x's Player does.
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
    - **`navigable` gesture option.** `options.gestures.navigable: false` holds the
      camera still for any Canvas.
    - **Captions.** WebVTT files from `supplementing` annotations, one per language for
      a `Choice`, become caption tracks.
    - **Poster.** A `placeholderContainer` image is the video's poster.
    - **HLS** plays through `hls.js` wherever the browser supports it, Chromium's native
      HLS included, and natively only where it does not (older iOS).
    - **Sound** plays with the same playback controls, over the
      accompanying (or placeholder) Canvas's image. It has no waveform.
    - **New props and options.** `onMediaElement` hands a host the element, and
      `onEnded` fires at the end. `options.media.presentation: "texture"` draws video
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
  `Document` 61.6, `Gallery` 53.6 and `Text` 49.8, the stylesheet 7.5.
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
  (60.8), `Gallery` 52.2 kB (52.8) and `Text` 48.5 kB (49.1). Before the shell, every
  template paid for `Default`'s parts: Gallery about 10 kB, Text about 14 kB. MapLibre on
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

  The API is experimental and may change in any release.
