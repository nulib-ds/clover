# Changelog

All notable changes to `@nulib/clover` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@nulib/clover` is the composable 4.x Clover. The 3.x line,
`@samvera/clover-iiif`, keeps its own changelog on the repository's
[`v3` branch](https://github.com/nulib-ds/clover/blob/v3/CHANGELOG.md).

## Unreleased

### Added

- **A higher-contrast mode, `highContrast`.** For an accent that cannot carry white text
  at 4.5:1 (an orange such as Princeton's, 3.0:1), set `highContrast` on the `Root`, the
  Viewer, or a part standing alone (`Canvas`, `Timeline`, `Scene`, `Items`, `Map`); as web
  components, the `high-contrast` attribute. Default `false`. The parts inside follow it.
  In it, the accent paints only rings, outlines, lines and marks: what it filled under a
  glyph or words (a control under the pointer or focused, the chosen language code, the
  search field's submit, a Download menu open) takes the round controls' dark fill and
  glyph color (`--clover-color-control`, `--clover-color-control-glyph`), with no ring at
  rest; under the pointer, the accent's ring at half strength, 3px, 1px clear, as Items
  rings an item; chosen or open, the ring whole; focused, the control's own focus ring.
  Nothing eases in it: its controls change at once (`--clover-transition` is `none`).
  Text in the accent is `--clover-color-accent-text` where the page sets it, else the
  text's own color. Clover turns the mode on by itself where the reader's system asks for
  more contrast (`prefers-contrast: more`), following it as it changes. It is written as
  `data-high-contrast` on the root's element.

  ```jsx
  <Viewer iiifContent={url} highContrast />
  ```

  ```html
  <clover-viewer iiif-content="…" high-contrast></clover-viewer>
  ```

- **Timed text is what its annotation `provides`.** Presentation 4 puts `provides` on a
  `supplementing` annotation to say what its file is for, and Clover now reads it for
  WebVTT (Cookbook 0219): `closedCaptions` is a captions track, as before; `subtitles` or
  `translation` a subtitles track (`<track kind="subtitles">`), still in the Captions
  menu; a `transcript` alone is read in the Transcript, which lists its cues as ever, and
  is no longer shown or offered as captions, which a transcript is not. A file whose
  annotation provides nothing, as in Presentation 3, or only what timed text is not, is
  captions, so nothing changes for it.

- **An image turned by its Image API selector.** A painted image whose
  `ImageApiSelector` gives a `rotation` (Cookbook 0040: a page scanned sideways, `"90"`,
  painted on a landscape Canvas) is drawn turned: degrees clockwise, mirrored first where
  it starts with `!` (`"!90"`), after its `region`, the turned picture's bounding box
  filling its target. Before, it was drawn as served, stretched to the target. Clover turns
  it itself, from the tiles as the server gives them (rotation `0` in every request), so it
  works with any image server, whatever its `info.json` offers, and deep zoom, Rotate and
  Reset are unchanged. A resource's CSS is still never applied (`styleClass`, 0045's rule),
  so the recipe's other way, a stylesheet's `transform`, draws the image as served. The
  renderer's `SceneImage` takes the same `rotation`, as the Image API writes it. A
  thumbnail of such a Canvas (Items, the Panel) still shows the image as served.

- **Links say their page's language.** A link Clover draws to an external resource, a
  `homepage` (Homepage, a provider's link, Items' links to a member's or a Collection's
  homepage), a `rendering` (Rendering, Download), `seeAlso` or `partOf`, now carries
  `hreflang` where the resource's `language` gives one tag (Cookbook 0047: the Getty's
  page, `["en"]`), the language Presentation 3.0 says its content is in. The link's words
  keep the label's language as their `lang`, as before; the label never stands in for the
  page's. Where `language` gives none, or several, there is no `hreflang`.

- **AnnotationCollections, and annotations given as the content, are walked as
  Collections are.** Where a Manifest's annotation pages are `partOf` an
  AnnotationCollection (Cookbook 0309: layout markup across a newspaper's pages), or the
  Root's content is an AnnotationPage (tags across several Manifests) or an
  AnnotationCollection, Clover reads it as one whole. The difference: a Manifest's
  Collection loads its pages as the reader reaches them, while the content's are in hand.
  - its annotations are one layer in Annotations and the Body's annotations menu, named by
    the Collection's `label` (where the page has none of its own) and hidden or shown
    together. The label is read from the Manifest's references too, as the recipe gives
    it, so it shows before a page is fetched;
  - `Items of="annotations"` lists or steps them, each a picture of its region, what it
    says and its Canvas's label (its Manifest's title, where they are on several);
    choosing one picks it, and the Root goes to its Canvas, opening its Manifest where it
    is in another, and frames it. A list reads the other Manifests it names, for their
    pictures and titles; a pager reads none. Its count is the Collection's `total`, and its pages load as the reader
    reaches them, never all at once: in order up to the one in view (or the one picked),
    the next as a step goes past the last loaded, or as its list's end comes into view;
  - the Default template's header gives, under the Manifest's title, the Collection's
    label and a small pager among its annotations, its count opening their list, as for a
    Collection's members, and picks the first as the Manifest opens on its Canvas
    ("1 / 569");
  - `useAnnotationCollection()` gives it to a part of your own (its `id`, `type`, `label`,
    `total`, `pages` and `entries`, or `null`), and `root.clover.annotationCollection()` to a page's
    script; `clover.fetchAnnotationPages(ids)` fetches the pages a part of your own reaches.

  ```jsx
  <Clover.Items of="annotations" layout="pager" size="small" />
  ```

- **The Default template shows a Collection it was opened on.** Where the Root's content is
  a Collection (Cookbook 0032, 0030), the header gives, under the Manifest's title, a
  line of the Collection's own: its title, muted, at the page's size
  (`.clover-template-default-collection`, in `.clover-template-default-collection-row`),
  then a pager among its members, small: where the reader is ("1 / 2"), Previous and
  Next, the count opening the members listed as the Panel's Collection section lists
  them, the one shown selected and given focus. The list opens over the pager, from its
  corner, the count and steps staying on top of it and the list scrolling under them;
  stepping keeps it open, and it follows. Choosing one opens it and closes the list, focus
  back on the count. The provider's logo sits beside both lines. The Collection
  section stays. A Collection read only from the Manifest's `partOf` changes nothing in
  the header (`state.throughCollection`, new, says which). `Items of="members"
layout="pager"` anywhere takes the same count, and its `nav` is named "Collection" (it
  was "Items"); a content state's targets' count opens their list the same way. Items
  takes `size="small"` (`<clover-items size="small">`): the pager's steps and count as
  Search's are (`ui/Steps`), for a header's line, as the Default header's pagers are.

- **A content state's several targets are a set to go through.** A content state naming two
  or more targets (Cookbook 0540: two Canvases from two Manifests, to compare) opened on the
  first and dropped the rest. It now opens on the first and holds them all, in order
  (`state.targets`, `clover.goToTarget(index)`), each going to its Manifest's Canvas and
  its region or time. The Default template's header gives where the reader is among them,
  "1 / 2", after the title, with Previous and Next; the count opens a menu of them all, as
  an animation's frames' count does, each by its Canvas's name and, where that is not
  enough to tell two apart, its Manifest's title. The Panel lists them in a section of its
  own, Views (`targets`, after About; the new string `informationPanelTabsTargets`), as a
  Collection's members are listed, with a picture of each target's region, and Previous,
  the place and Next beside its label. Both are `Items of="targets"` (`layout="pager"` and
  `layout="list"`, `<clover-items of="targets">`), and `Previous`, `Next` and `Position`
  take `of="targets"`, for a layout of your own. A target is matched to its Manifest by the
  address it names as well as the id the Manifest gives itself, as 0540's differ. Nothing
  changes for a content state with one target, or any other content, whose code loads
  only for one with two or more. Annotations given as the content (an Annotation Page of
  tags across Manifests) are unchanged.

- **Dates for navigation are shown.** A resource's `navDate` (Cookbook 0230, 0318) is
  shown in the reader's language, to the precision it is likely written to: an
  `xsd:dateTime` must give a time, so exactly midnight on January 1 shows as its year
  ("1776"), midnight on the 1st as its month ("February 1925"), any other midnight as its
  day ("February 16, 1925"), and any other moment as its day and time. Every part is read
  as written, never moved to the reader's time zone, in a `time` whose `datetime` says
  the same ("1776"). It shows under each of a Collection's members' labels, a step
  smaller and muted, before its summary (`.clover-items-date`), and in About, a section
  of its own after the required statement (`.clover-about-date`, its heading the new
  string `aboutDate`, "Date"), and on a Map, under a place's name in its list and on
  its popup, the date of what it locates: its member, Manifest or Canvas
  (`.clover-geomap-place-date`, `.clover-geomap-popup-date`; `navDate` in the feature's
  `properties`). A value that is not a date shows nothing. Nothing to
  change on a page.

- **A Map maps a Collection's members.** Inside a `Root` opened on a Collection, the Map
  shows each member's `navPlace` as well as the Manifest's (Cookbook 0318: five views of
  Rome, each where it is), listed in the Collection's order, the member open the current
  one (`aria-current`), its place its own Manifest's where it gives one. Pressing another
  member's place, on the map or in the list, opens that member, as its row in the
  Collection does, and focus stays on the place pressed. A member's feature carries its id
  (`manifestId` in its `properties`). Nothing to change on a page.

- **The reader can choose the language a resource reads in.** Where what a Manifest says
  of itself comes in several languages, one of its label, summary, metadata or required
  statement given in two or more (Cookbook 0006, 0118), the information panel offers
  their codes ("EN", "FR") beside About's heading, drawn as an annotation set's languages
  are, and shown whichever section is open. The Root's `language` is chosen to start,
  else the reader's. A choice is the whole Root's: the title over the Viewer, Items, About
  and every other part read IIIF text in it, each marked with its `lang`. `About` placed
  outside a Panel offers the row itself. Nothing changes for a resource in one language.

  `languages={false}` on `Panel`, `About`, or a Viewer in its Default or Document
  template (`languages="false"` on `<clover-panel>`, `<clover-about>` or
  `<clover-viewer>`) leaves the choice out. A Root's `language` still wins: a reader's
  choice lasts until the page gives the Root another `language`. The row is
  `.clover-about-languages`, each choice `.clover-about-language`, styled as the
  Transcript's and Annotations' rows are. Its name, "Language", is the new string
  `readingLanguage`. The check runs for every resource, and the row loads only for one
  with languages to offer: the Viewer in its Default template loads 0.5 kB more to its
  first view (89.4 to 89.9 kB), and its budgets are raised to match. A page with strings
  of its own for Clover adds the new one:

  ```ts
  initCloverI18n({
    resources: { de: { clover: { readingLanguage: "Sprache" } } },
  });
  ```

- **A Body says when what it draws could not be loaded.** An image whose address answers
  with an error (Cookbook 0118's, a Wikimedia thumbnail at a size Wikimedia no longer
  serves), a video or recording the browser cannot load, or a model that will not load
  showed an empty Body, or for a model an alert at its foot with the error's own English
  words. Each now shows a small note in the middle of the Body, "This image could not be
  loaded." (or video, audio, model), in a live region, so it is announced (WCAG 4.1.3).
  A Scene whose graphics the browser takes back keeps its alert. The note is
  `.clover-body-unloadable`; its strings are `bodyUnloadableImage`,
  `bodyUnloadableVideo`, `bodyUnloadableAudio` and `bodyUnloadableModel`, which a page
  with strings of its own for Clover adds. It adds 0.3 kB to a Canvas's first view (41.5
  to 41.8 kB) and 0.4 kB to the Viewer's in its Default template (89.9 to 90.3 kB), and
  the budgets are raised to match.

- **Contents' nested entries open and close.** An entry with entries under it (a book's
  chapter of sections, an opera's act of scenes) has a button at the end of its row, a
  disclosure (`aria-expanded`) named "Sections in" and the entry's own label, that opens
  and closes them. They start closed, but for the entries holding the current one: those
  are open from the top down to it, and set in bold, so the way to it shows. A branch
  opens again as the current entry comes into it, by choosing, by Items or by playback;
  one the reader closed stays closed while the current entry moves within it. Every
  nested entry was shown before: a layout that counted on that sees the top level first.
  New classes: `.clover-contents-row` around each entry and its button,
  `.clover-contents-toggle`, and `data-trail` on the entries holding the current one. The
  button's words are the new string `contentsSectionsIn`. An entry and the entries under
  it are now as far apart as any two entries, and the current entry is marked by its tint
  and weight, without the accent edge at its start (kept in forced colors).
- **Contents steps through an article in parts, and the Canvas draws its regions.** A
  Range that reads parts of pages, or pages out of the Manifest's order (Cookbook 0025:
  a newspaper's article in two columns on page 2, then two on page 5), has, while it is
  the current entry, a step in its row, after its label (under it where the panel is too
  narrow for both): its place among its parts ("2 / 4", read so too, in no language) and
  Previous and Next, drawn as Search's are. Each step goes to the next part in the
  Range's order, its region selected, framed and marked as a search's hit is; a region
  picked on the Canvas is the place too. The regions any Range names are drawn on their
  Canvases as annotations, each named for its Range and, in its tag, its place
  ("Tagesneuigkeiten 1 / 4", its name too), in a set of their own (`CONTENTS_SET_ID`,
  `"contents"`), which the Annotations list and the Canvas's menu leave out, as they
  leave a search's hits; `clover.setSetVisible(CONTENTS_SET_ID, false)` hides them. Of
  two Ranges of `behavior` `sequence` that cover the same pages (Cookbook 0027), the
  first is current to start, the default, and the one the reader chooses stays current
  while its pages are shown, stepping through its own order (`currentContents` takes the
  chosen entry, its fourth argument; `ContentsNode`'s `sequence` marks one). A region
  picked on the Canvas opens the Panel's Contents section, its article current there and
  its step at that part, as a search opens Search: only the open section changes, never
  focus, and a shut Panel stays shut. The Root reads them only for a Manifest whose
  Ranges name one, loading their code then (`regions` in its state). A `Tip` takes
  `after`, a figure after its words. `tableOfContents`' entries have `parts` (type
  `ContentsPart`; and `root.clover.contents()`'s, on `<clover-root>`), and
  `AnnotationSet`'s `source` may be `"contents"`. It adds 0.5 kB to the Viewer's first
  view in its Default template (90.6 to 91.1 kB) and 0.3 kB to a page of a
  `<clover-root>` and a `<clover-label>` (32.4 to 32.7 kB), the Ranges' reader grown by
  its parts. A Manifest whose Ranges name regions loads their code, 2 kB, as it is
  shown: the Gallery's figure, measured on the catalog, goes from 51.4 to 53.4 kB. The
  budgets are raised to match.
- **The information panel's chevrons are one, in one column.** A box's heading in the
  accordion and an entry in Contents draw the same chevron (`.clover-chevron`, its
  heading's still `.clover-sections-chevron`), at the end of the row, so every chevron
  in the panel lines up. The open box now shows its chevron too, pointing up, in the
  accent of the line under its heading, its button disabled (one box is always open).
  Controls beside a heading, About's languages and the Transcript's, now sit before its
  chevron rather than after it. Together with Contents' toggles, they add 0.3 kB to the
  Viewer's first view in its Default template (90.3 to 90.6 kB), most of it the
  stylesheet, and 0.5 kB to Contents as it loads; the budgets are raised to match.
- **A chapter shows its Range's `thumbnail`.** A Range with a `thumbnail` (Cookbook
  0229's `thumbnail-nav`, a frame of each stretch of the opera) shows it over its title
  in the seek bar's popover as the pointer crosses it or the bar has focus, and
  under the chapter playing, at the same size, in Contents and the chapters' menu, the
  other entries keeping to their words (`--clover-picture`, a new measure in the scale,
  four `xl`). The picture is decorative, its words naming it, and is asked of its image
  service only as its `info.json` allows, as every thumbnail is. `chaptersOf`' chapters
  and `tableOfContents`' entries carry the Range's first `thumbnail` as written (and
  `root.clover.contents()`'s, on `<clover-root>`), and the Canvas's `chapters` take one, a
  URL or a IIIF image. A picture with an entry's words in a list, an annotation's region
  too, is `.clover-entry-thumbnail` now; an annotation's keeps
  `.clover-annotations-thumbnail`, which no longer styles it. The popover now gives, under
  the picture, the time under the pointer (or the time playing while the bar has focus)
  rather than the chapter's start, in bold, and the chapter's title under it, muted
  (`--clover-color-secondary-alt`; `Tip` takes that line as `lead`). The chapters' menu
  is drawn as the Canvas's other menus are, the annotations' among them, on Clover's
  ground (`.clover-canvas-menu`), each chapter's time muted in a column and its title at
  the page's size. The chosen option there and in the captions' menu is marked as
  Contents marks its current entry, by a tint of the accent and bold words, no longer the
  accent's full fill; the chapter
  playing beside the time is muted (85% of the bar's white, as far as 4.5:1 allows over
  a white frame); and where a chapter begins the seek bar has a gap cut out of it,
  `--clover-space-2xs` wide, through which the picture shows, in place of a white notch
  over it (`.clover-canvas-transport-chapter-marker` is gone; a page that styled it can
  set `--clover-transport-gap` on `.clover-canvas-transport-seek-area` instead). The seek
  bar's and volume's tracks are `--clover-space-xs` high now, a step of the scale (they
  were 4px; `--clover-transport-track` on `.clover-canvas-transport`), and a chapter's
  stretch drawn out over the seek bar `--clover-space-s`, a step above it. With them,
  the Viewer's first view in its Default template is 91.7 kB (91.1 before), a Timeline
  alone 40.7 kB (40.1) and the stylesheet 16.3 kB (15.9); the budgets are raised to
  match.

- **About's downloads are a button beside its heading, and a press saves the file.** In a
  Panel, About's heading now holds a Download button (`.clover-about-download-button`,
  round, named "Download"), before the languages, which keep the end of the row. It
  opens a popover under it, drawn as the Canvas's menus are (`.clover-canvas-menu`),
  listing the `rendering` of the page in view ("This page") and of the Manifest ("All
  pages"); Escape, a press outside or focus moving on closes it, Escape handing focus
  back. About in a Panel no longer lists them in a section of its own; alone, it still
  does. The Panel's `download` (and the Default template's) now says whether the button
  is offered. Wherever Download's links are, a press on one saves its file, fetched with
  the Root's `request`, rather than opening it, and opens it in a new tab only where its
  server does not let it be fetched (no CORS); a press with a key held stays the
  browser's.
  `DownloadGroups` takes `inPopover`, its groups then named groups rather than sections.
  The button adds 1.0 kB to the Viewer's first view in its Default template (91.7 to
  92.7 kB); its popover and the saving load only when first used. The budgets are raised
  to match.

- **One choice of language.** Where the Root offers the languages to read the resource
  in (About's, beside its heading in a Panel), the Transcript and an annotation set offer
  none of their own: the Transcript reads its file in the chosen language, and the set
  shows its annotations in it, so a page has one choice (Cookbook 0074 showed About's IT
  | EN beside the Transcript's EN | IT). The Root's language also picks the Canvas's
  caption file, as it changes or another recording plays, while captions are on; one
  chosen in the Captions menu holds until then. Where the Root offers no choice, each
  keeps its own row, as before.
- **A recording in several files plays as one.** A Canvas that paints two or more videos
  or sounds one after another on its time (Cookbook 0064: an opera's two acts, the second
  from where the first ends) plays them through its one element as one recording: its
  time, duration, seek bar, buffered stretch and chapters run across them all, seeking
  into a later file loads it and goes there, a file's end runs on into the next, and only
  the last one's `ended` is heard (`onEnded`). Its captions keep their moments on the
  Canvas's time. The element itself reads the Canvas's time (its `currentTime`, `duration`
  and `buffered`), so a host's own controls see the same. Before, only the first file
  played, the second taken for an animation's frame. HLS keeps to its first file. It
  adds 0.4 kB to a Canvas's first view alone (42.0 to 42.4 kB) and to the Viewer's in its
  Default template (92.7 to 93.1 kB); the code that plays the files in turn loads only for
  a Canvas that has them. The budgets are raised to match.

- **An image's own annotations, shown with their layer.** An annotation an image carries
  itself (Cookbook 0326: the X-ray of a `Choice` of two images, tagged "A group of
  skulls."), on a region of that image (an `ImageApiSelector`'s `region` or an `xywh`), is
  read, placed on the Canvas through where the image is painted, and listed in Annotations
  under its page's label or else the image's ("X-ray"), with a thumbnail cut from that
  image. One on an item of a `Choice` is drawn while that item is the one chosen, and
  chosen in the list, it chooses it, so it is drawn and framed. Its entry's `layer` says
  which (`AnnotationEntry`), and its `target` is given in the Canvas's terms. A `Choice`'s
  first image now gives a region's thumbnail too. The Root holds such sets among
  `addedSets`, after the Manifest's own pages, their `source` still `"manifest"`, and reads
  them with code that loads only for a Manifest whose images carry annotations. With the
  fixes below for Cookbook 0021, 0135, 0258, 0261 and 0306, it adds 0.5 kB to the Viewer's
  first view in its Default template (93.1 to 93.6 kB) and 0.2 kB to a Canvas's alone
  (42.4 to 42.6 kB). The budgets are raised to match.

- **A Map control, where a Canvas or its Manifest has a place.** A Canvas whose
  `navPlace` (else its Manifest's, Cookbook 0154: the Laocoön bronze at the Getty Center)
  names where it is offers a Map control among its controls, a map pin, which opens a box
  as its information does: a Map of the place, the whole box, its name out of sight naming
  the box, and its Close in the map's top corner, the map's controls' inset in from it. It
  closes by its Close (focus back on the control), by Escape, or as another popup opens. Its code and MapLibre load
  only as it first opens. `controls` takes `map: false` to leave it out; a Canvas outside a
  Root reads its Manifest's place too (`navPlace`, a new prop on `Canvas`).

### Changed

- **A lighter first view.** The Viewer with its Default template loads 94.6 kB gzip to
  its first view, from 101.5 (Document 90.8, from 97.3; Gallery 53.5, from 60.1; a
  `<clover-viewer>` page 101.2, from 108.4). What only some resources need now loads
  with the first of them:
  - Presentation 2's reader. Presentation 3 is upgraded by `@iiif/parser`'s
    `upgradePresentation3To4` alone, and Presentation 2 is read as 3 first
    (`convertPresentation2`), the steps its `upgradeToPresentation4` takes, so every
    resource is upgraded exactly as before (checked against `upgradeToPresentation4` for
    every fixture and over a hundred Presentation 2 resources from Mirador's and the
    Universal Viewer's examples). `toPresentation4` is unchanged.
  - Items' `pager` layout and its count's menu (a Collection's members, a content
    state's targets, an AnnotationCollection's pages, the Gallery's lightbox), a
    placeholder Canvas's still and toggle, a `navDate`'s written date in Items and
    About, and Download's links where About offers them in its popover.

  Each shows a moment after the rest on the first resource that has one, as its code
  arrives. Nothing to change on a page; a test that looks for one at once waits for it
  (`findBy…`).

- **Size budgets set to the sizes measured on 2026-10-30** (`build/size-budget.json`,
  each the measured size and about 250 B more). Raised where this release's features
  grew a page: a Canvas up front to 39.4 kB (from 37.2), a Timeline to 24.6, the Viewer
  with Default to 94.9 to first view (from 94.0, which it had passed at 101.5), the
  stylesheet to 19.0 (from 16.6), a Map to 25.0 to first view, and the element pages.
  Lowered where the lighter first view took bytes off: the Gallery to first view to
  53.8 (from 54.7), the web components' entry to 121.7 (from 122.2) and a
  `<clover-viewer>` page to 101.5 (from 101.9). The higher-contrast mode's sheet, which
  every element loads, rides apart as the scale's does, so a page of web components
  loads only the sheets of what it draws (it had brought the whole stylesheet to a page
  of labels, 14 kB).

- **Items' durations count as the player does.** A sound or video item's duration in
  `Items` (`.clover-items-duration`) is now its whole seconds, rounded down, as the
  transport writes the same recording's length and every time on it: a recording of
  59.6 seconds reads "0:59" in both places, where Items said "1:00". Nothing to change on
  a page.

- **Links away from the viewer open in a new tab.** The links the property parts draw,
  `homepage`, `rendering`, `seeAlso` and `partOf` (Homepage, Rendering, SeeAlso, PartOf,
  as About shows them), a resource's own `id` (Id: "IIIF Manifest") and a provider's link
  to its homepage, now open in a tab of their own (`target="_blank"`, with
  `rel="noopener noreferrer"`), as Download's files and an annotation's links to the web
  already did. Items' links to members' homepages, a page's own navigation, open where
  they are, as before. Nothing to change on a page.

- **An annotation's image is no taller than Items' pictures.** In Annotations and in its
  hotspot's popover, an image an annotation gives (Cookbook 0377: a fountain at night)
  was shown as wide as there was room, at any height; it is now held to the height of
  Items' pictures, `--clover-items-height` (8rem by default), its width following at its
  own aspect (`.clover-annotations-image`, `.clover-tip-image`). An annotation's bodies
  (the picture and its caption) are now `xs` apart in the list, and the popover's picture
  `xs` over its words, where it was `2xs`. The Body's annotations menu now shows the
  picture over its words too, its words in `.clover-annotations-text`, which carries their
  `lang`. A hotspot's popover sets its words from the start of the line (left, or right in
  a language written right to left), where the hotspot's button had centered them. Set
  `--clover-items-height` around the list to change both:

  ```css
  .clover-panel {
    --clover-items-height: 10rem;
  }
  ```

- **Annotations loads its pages as the reader reaches them.** With `scope="all"` (the
  default, and the Panel's), Annotations fetched every Canvas's referenced annotation
  pages as it mounted, which for a Manifest of many pages is many requests at once. It now
  fetches them in order up to the Canvas in view (or the annotation picked), and the next
  as the list's end comes into view, so the list grows as it is read. A page whose own
  script needs every annotation at once can still call `clover.holdAllAnnotationPages()`,
  or give the Root `annotationPages="all"`.

- **Full screen ends the view's controls.** In the control cluster over a Canvas, Full
  screen now comes after Zoom, Rotate, Reset and Choice, left of the Canvas's own
  (Annotations, Place, About) and a page's own; it came after Zoom out. A stylesheet or
  test that reads the controls by their order (`.clover-canvas-controls > :nth-child(…)`)
  should read them by `data-button` instead:

  ```css
  .clover-canvas-controls > [data-button="full-page"] {
    /* … */
  }
  ```

- **A member's summary is muted.** Under a Collection member's label, in Items' lists (the
  Panel's Collection section, a pager's popup, a content state's targets), its summary now
  takes the muted text color (`--clover-color-primary-muted`), as its date does; it was
  the text's own color. Nothing to change on a page.

- **A list's pictures sit at the top of their rows.** In `Items layout="list"` (a
  Collection's members, Document's pages) each picture now lines up with the top of its
  label, where it was centered beside it, so a long label, or a member's date and summary,
  runs down beside it. Nothing to change on a page.

- **An animation runs on its Canvas's time.** A Canvas whose paintings are timed (a
  Muybridge plate's frames; Cookbook 0489's image, video and texts over three minutes) now
  plays over its own `duration`, as a recording does: its bar's slider seeks over that
  time ("Seek", where it was "Frame", saying the time and the frame showing), each frame's
  start is a gap in it, as a chapter's is, and the time shows beside the buttons. The bar
  reads as a video's: Play first, then Repeat, Mute where a frame plays sound, and the
  time; at its end which frame shows, as a figure ("4 / 5", shown and read alike, its
  menu, named Chapters, opening within the Body as the chapters' does), then Previous and
  Next, named so (Clover's `commonPrevious` and `commonNext`, as Search's steps are), which
  step to where the frame before or after starts. Over the seek bar, the time under the
  pointer shows in the chapters' popover, alone; where the whole runs under ten seconds (a
  Muybridge plate's second), times show their tenths ("0:00.6 / 0:01.0"). The word
  "frame" is gone from the bar:
  so are the `framePosition`, `framePrevious`, `frameNext` and `frameSeek` strings from
  Clover's locales; a page that gave its own can drop them. Each frame shows for its own
  span (`#t=start,end`), so frames timed together show together (0489's image and video,
  11 s to 42 s); one with no end shows until the next starts, as before. The frames menu is
  unchanged. A frame that paints a video or sound plays on that clock, from its own start
  when its frame begins, and in its region (0489's clock over the image), with a Mute in
  the bar; one that starts itself (`auto-advance`) starts muted (WCAG 1.4.2). Text painted
  at a time (0489's "Press Play") is drawn in its region, as large as fits it, since IIIF's
  HTML keeps no `style`, and is read outside the picture by assistive technology. Nothing
  to change on a page; a test that looked for the slider named "Frame" looks for "Seek".
  It adds 0.1 kB to the Viewer's first view in its Default template (93.8 to 93.9 kB) and
  less to a Canvas's (42.9 kB still); the video and the text load with the animation's own
  code. The budgets are raised to match.

### Fixed

- **A chapter's stretch meets its gaps on the seek bar.** The stretch drawn out for the
  chapter under the pointer, or marked from `Contents`, and the popover over it were
  placed across the whole bar, while the gaps between chapters, and the time read under
  the pointer, follow the thumb's travel (the bar less the thumb's width). The two parted
  toward either end, up to half a thumb, so late chapters were marked short of their gaps
  and early ones past them. All of them are now placed as the thumb travels, as is the
  popover a frame animation's bar shows for keyboard focus. Nothing to change on a page.

- **A start time is kept.** A Manifest's `start` that points into a recording with a
  `PointSelector` (Cookbook 0015: `"t": 120.5`, which the upgrader writes as Presentation
  4's `instant`) opened at the beginning, as a `PointSelector` was read as a point in space
  only. Its time is now read, with or without `x` and `y`, so the recording opens there,
  as a `start` naming a Canvas opens that Canvas. An annotation's `PointSelector` with a
  time keeps it too. Nothing to change on a page.

- **A video on a Canvas with no size shows.** A Canvas that gives a `duration` and no
  `width` or `height` (Cookbook 0015, which Presentation 4 reads as a Timeline) gave its
  video nowhere to be drawn: its sound played over an empty Body. It is now drawn at its
  own frame size, framed in the Body as any video is. Nothing to change on a page.

- **No paragraph inside a paragraph, a span or a heading.** Where a part drew a value in
  an element that may hold only inline content (Summary's `p`, Value's `span`, a heading
  given as `as`) and the value, IIIF HTML or Markdown, brought blocks of its own
  (Cookbook 0007: a summary of `<p>…</p>`), the page held a `p` inside a `p` or a `span`.
  Such a value is now drawn in a `div`, its class and props unchanged (`.clover-summary`,
  `.clover-value`), its paragraphs inside; a value of inline markup keeps its element. A
  page styling the element by its tag (`p.clover-summary`) styles the class instead:

  ```css
  .clover-summary {
    /* … */
  }
  ```

- **Malformed IIIF HTML is tidied after it is repaired.** Clover's sanitizer reads a value
  with the browser's own HTML parser, which closes what is left open and drops stray
  closings, then keeps only IIIF's allowed markup. Three things that left behind are now
  tidied: a stray `</p>` no longer makes an empty paragraph; where a block IIIF does not
  allow is dropped (`<h1>`, `<div>`, a list), a space keeps its words apart from the next
  ("Heading emph", not "Headingemph"); and an image whose address was removed (not
  `http(s)`) goes, with a paragraph it alone filled. Space runs are one space, and a value
  has none at either end. An image its publisher gave no `alt` (Cookbook 0007: a license
  badge beside its link) is given an empty one, decorative, so a screen reader no longer
  reads it by its file name; an `alt` given is kept. But an image that is all a link
  holds (Cookbook 0008: the badge as the license's link) names the link, so it is never
  decorative: it takes the link's `title` (which IIIF does not allow, and which is then
  dropped), else the host the link goes to (a mail link's address), so no link is left
  without a name. Nothing to change on a page.

- **A Choice of recordings skips the formats the browser cannot play.** Where a Canvas
  paints a `Choice` of recordings of one sound or film (Cookbook 0434: ALAC, MP3, FLAC,
  Ogg, MPEG-2 and WAV), its control now lists disabled, faded (`label[data-disabled]`),
  each item the browser says it cannot play (`canPlayType` on its `format` answering
  neither "probably" nor "maybe": ALAC, in Chrome), and the Choice starts on its first
  item, or, where that one is disabled, walks down to the next that is not (MP3 here),
  where it started on the first and said "This audio could not be loaded." An item with
  no `format`, HLS (which Clover plays itself) and every item where the browser has no
  `canPlayType` stay offered. An item the browser says it can play may still fail (0434's
  MPEG-2, given as `audio/mpeg`); it says so when chosen, as before. Nothing to change on
  a page.

- **No key warning from the annotations menu.** Opening the Body's annotations menu in a
  page built with Next logged React's "Each child in a list should have a unique key"
  warning, as Next's compiler made each of its groups with `createElement`. Nothing to
  change on a page.

- **Full screen takes the whole Viewer again.** Since 4.0.0-beta.0, Full screen over a
  Canvas in a template put the Canvas alone in full screen, so the reader could not go on
  to other pages in Items or read the Panel there. It now takes the Root the Canvas (or a
  Scene, or a recording's transport) is in: a template's Viewer, its header, Items and
  Panel included, or a page's own layout. A Canvas on its own goes full screen itself, as
  before, and a Canvas in a dialog in the Root (the Gallery's lightbox) too. In full
  screen the Root has Clover's background and scrolls where the screen is too short, the
  Default template fills the screen, and the first Body in it shows "Exit full screen" at
  its top left, as a Canvas full screen on its own does (marked `data-exit` on the
  Canvas's figure, which reveals it). A recording's Full screen in its transport now
  reads "Exit full screen" in full screen there too. A page that styles its full-screen
  Canvas (`.clover-canvas:fullscreen`, `[data-fullscreen="true"]`) inside a Root styles
  the Root instead:

  ```css
  .clover-root:fullscreen {
    /* … */
  }
  ```

- **A Canvas full screen keeps its ground.** A Canvas full screen on its own took the
  page's plain background, losing the translucent wash it has on the page. It keeps the
  wash now, over the page's background, as it looks on the page. The wash is a custom
  property, `--clover-canvas-wash` (default `#0001`), set on `.clover-canvas`: a page
  that sets the Canvas's `background-color` can set it there instead, so full screen
  keeps that too:

  ```css
  .clover-canvas {
    --clover-canvas-wash: #0002;
  }
  ```

- **A Canvas that paints nothing is held still and named in its Body.** A lone Canvas with
  nothing painted on it (Cookbook 0283: a page missing from a book, its `items` empty) was
  offered as a picture to explore: a "zoomable image" with the camera's keys, and Zoom,
  Rotate and Reset over nothing. It is now held still, as a lone recording is: no camera
  keys, gestures or role description, and only About and Annotations among its controls:
  no way into full screen. Reached in full screen, it keeps full screen, and its control
  as the way out; pressed, the control goes and focus moves to the Canvas. Its name, its label else its Manifest's, shows in the middle of the Body,
  drawn as the note a Body that could not load shows (a new class, `clover-body-note`),
  and nothing shows where it has none. Nothing to change on a page.

- **An annotation whose body is a `SpecificResource` shows its words.** Where an
  annotation's body is a `SpecificResource` holding its words as its `source` (Cookbook
  0045: each comment given a `styleClass`), the words were not read, so the annotation was
  neither listed nor drawn. They are now read as any `TextualBody` is (and an image or
  place so held, as one given directly). Its `styleClass` and the annotation's
  `stylesheet` are not applied, on purpose: a resource's CSS could override Clover's
  interface, and the page around it, and with them the accessibility the interface keeps.
  Nothing to change on a page.

- **Another Manifest's Canvas opens fitted, though it shares an id.** Two Manifests may
  give their Canvases one id (Cookbook 0230's two maps are each `…/canvas/p1`, one 1286
  pixels wide, the other 5212): moving from one to the other kept the first's view, so the
  second opened zoomed in four times. A Canvas is now told apart by its Manifest too, and
  framed afresh. Nothing to change on a page.

- **A place an annotation tags is listed and framed on its page.** An annotation whose body
  is a GeoJSON `Feature` (Cookbook 0139: a map in a pamphlet, tagged with where it shows)
  drew on the Map alone: no text, so the Annotations list and the Canvas left it out. It
  is now an entry named by its feature's `label` (else its annotation's), its region drawn
  and named on the Canvas, and pressing its place on the Map, or in the list under it,
  selects it, so the Canvas frames its region. Picked on the Canvas (or anywhere), the
  Canvas opens a box of it as it opens its information, one popup at a time: its name
  over a Map of just its place, framed on it, closed by its Close, by Escape, or as
  another popup opens, and open again as a place is picked, the same one too; its code and MapLibre
  load only as a first place is picked. Its body reads as a place
  (`AnnotationBodyEntry`'s new `place`, with its `label`); a feature without a name stays
  the Map's alone. A Map's feature carries its annotation's id (`annotationId` in its
  `properties`). Nothing to change on a page.

- **The Map's controls are Clover's.** MapLibre's zoom buttons, its credits' ⓘ and a
  place's popup were MapLibre's own (white squares, the browser's tooltips): they are now
  drawn as Clover's round controls, each with Clover's glyph and popover (`Tip`, in the
  reader's language, in place of MapLibre's `title`), the credits and a place's name on a
  popover's ground, and the controls `--clover-inset` in from the map's edges and `s`
  apart, as the Canvas's are: zoom in and out in a row at its lower left (they were a
  column at its upper right), the credits' ⓘ at its lower right. The credits' ⓘ is smaller, About's Download's size, in the
  map's lower right corner at that inset; opened, their words show beside it on a
  popover's ground, level with its foot, so the ⓘ never moves, and its own popover is put
  away meanwhile. A new `credits` prop (`credits="false"` on `<clover-map>`) leaves them
  out: a basemap's license may ask for its credits, so give them on the page yourself
  first. A place's name behaves
  as a hotspot's on the Canvas: shown while the pointer is over the place, hung `xs` off
  the side of it with more room, with no arrow, kept inside the map, and held for the
  place picked until another is pointed at, a press off the places, or Escape (WCAG
  1.4.13), or until the places change (another Canvas or member opened), but for a place
  the new ones still hold; where neither side has room, it moves over the place, to its edge in sight. A
  place is drawn as a hotspot is: at rest a dark edge under a light line, with nothing laid
  over it (simplestyle's `fill` and `stroke` still color what they name); active (pointed
  at, picked, or its annotation pointed at or picked on the Canvas or in Annotations) a
  wider dark edge and light line with the accent on them, and a point an accent dot in a
  light ring, banded in the accent while active, found by a press within 24px (WCAG 2.5.8).
  Pointing at a place points at its annotation too, so its hotspot and its entry light.
  The map takes the page's type, as every part does, over MapLibre's own 12px
  Helvetica, and its links the accent's text. A polygon's ring written open (0139's four
  corners) is closed, so its edge goes all the way round. Nothing to change on a page.

- **A chapter ends where its Range does.** A recording's chapter stayed the one playing
  until the next began, so past the last one's end (the Nuremberg reel's last Range ends
  at 10:00.4, the film at 11:11) the seek bar's title, its popover and the stretch drawn
  out, and the entry marked in Contents, all named it still. Past its end, with no other
  begun, none plays now: the popover over that stretch shows its time alone, and the seek
  bar is cut where a chapter begins or ends with none to follow, so the stretch no chapter
  covers stands apart (the reel's first, before 0:12.5, too). A chapter with no end of its
  own plays until the next begins, as before. Nothing to change on a page. With the seek
  bar's reading of the pointer (below), it adds 0.2 kB to the transport a Canvas or
  Timeline draws for its recording, loaded with it: measured, a Timeline's first view
  (41.6 to 41.8 kB), whose transport draws at once; a Canvas's, measured on an image,
  loads none. The budget is raised to match.

- **The seek bar reads the time under the pointer where its thumb would stand.** A
  recording's seek bar read the pointer across its whole width, while its thumb travels
  it less its own width, so the time and chapter in its popover ran a little early toward
  the end. Its chapters' gaps are placed the same way now, and the disk kept around the
  thumb is the thumb's own size (its focus ring's while focused), so a gap no longer
  narrows as the thumb comes near. Nothing to change on a page.

- **Text in a language written right to left is written so.** Wherever Clover marks
  text with its `lang`, its own strings in a language it is given (through
  `initCloverI18n`'s `resources`) and IIIF text alike (the parts' labels, summaries and
  metadata, Items, Contents, annotations, chapters, the Map's names), a language written
  right to left (Arabic, Hebrew, Persian, Urdu…, or a script so written, `ku-Arab`) now
  carries `dir="rtl"` too. Only Markup's values did before. Text in a language written left
  to right still takes the page's direction, and fields (the search field, the seek and
  volume sliders) keep theirs. Nothing to change on a page. It adds up to 0.2 kB where
  parts show text (a page of a `<clover-root>` and a `<clover-label>`, 33.3 to 33.5 kB; a
  Canvas's first view 42.7 to 42.9 kB; the Viewer's in its Default template 93.7 to
  93.8 kB); the budgets are raised to match.

- **A Collection's `viewingDirection` orders its members.** Items listing a Collection's
  members, in a `Root` or alone, ran them left to right whatever the Collection said; a
  standalone Items ignored a Manifest's too. They now run right to left where the
  resource is read so, as a Root's views do, the arrow keys and the pager's steps with
  them.

- **An annotation written in several languages reads in the reader's.** A body that is a
  `Choice` of the same words in several languages (Cookbook 0346: a comment in English and
  in Japanese) showed its first item, whatever the language. It now shows the item in the
  Root's language, chosen as any IIIF text is: in the Annotations list, the hotspot's name
  and tip, and the Canvas's caption, each marked with its `lang`. `entry.bodies` now holds
  every item of a `Choice`, each with the choice's place (`choice`, on
  `AnnotationBodyEntry`). A `renderEntry` that draws every body now draws each language;
  draw one body of each `choice`:

  ```jsx
  const renderEntry = (entry) =>
    entry.bodies
      .filter((body) => body.value)
      .filter(
        (body, index, all) =>
          body.choice === undefined ||
          all.findIndex((each) => each.choice === body.choice) === index,
      )
      .map((body, index) => <p key={index}>{body.value}</p>);
  ```

  Keeping the items adds less than 0.1 kB to every first view (the Viewer's in its Default
  template 93.6 to 93.7 kB); the budgets are raised to match.

- **A chapter on another Canvas arrives at its moment, playing.** Choosing an entry in
  Contents that starts on a Canvas other than the one shown (Cookbook 0065: an opera's
  acts on two Canvases) went there at 0:00: its time was set on the element of the
  Canvas being left, emptied as it went. It now waits for the new Canvas's own, and plays
  from there, as a press on a time does on the Canvas already playing. A Transcript cue
  pressed behind a placeholder plays from its time too. Nothing to change on a page.
- **A point annotation is pressed within 24px.** A `PointSelector`'s marker on the Canvas
  (Cookbook 0135) is a 16px dot, which was all a press could find; it now takes presses in
  an `l` circle around it (25.9px at the default size, a `::before` on
  `.clover-canvas-annotation-point`), however close another point is (WCAG 2.5.8). It
  looks the same.
- **"Find on the image" finds the annotation again.** Pressed for the annotation picked
  already, once the view had moved (zoomed, panned, reset), it did nothing; it frames it
  again, as the first press did, focus staying on it (Cookbook 0021). The Root has a
  channel for it, `found` (`clover.found`, on `<clover-root>` too): the annotation asked
  for, each time it is asked for (`selectAnnotation`), the one picked already among them.
- **A tag links to what it names.** A `tagging` (or `identifying`) annotation with a body
  that is a resource on the web, as Cookbook 0258 tags a fountain with its Wikidata
  entity beside its name, lists that resource as a link ("Open the link", in a new tab),
  as a linking annotation's web page is. On the image the tag stays a tag.
- **A shape's annotation has its picture.** In Annotations, an annotation on a region
  shows a thumbnail of it; one on a shape (an `SvgSelector`, Cookbook 0261's outline of a
  fountain) had none. It now shows the box the shape fills, cut by the image server as a
  region is; the shape's reader loads only for one.
- **An Annotation Page added that the Manifest holds is listed once.** Opened by its
  Annotation Page (Cookbook 0306), whose Canvas's Manifest names that page too, Clover
  listed and drew every annotation twice: the page as added, and as the Manifest's. A page
  the Manifest holds already keeps its place there and is not added again.
- **A `no-nav` Range is no chapter.** Contents left a Range of `behavior` `no-nav` out
  (Cookbook 0229: a video's first 9 seconds), but the seek bar and its Chapters menu
  offered its stretch as an unnamed chapter at 0:00. `chaptersOf` now leaves it out too,
  keeping any Ranges under it, as Contents does. Nothing to change on a page.

- **`root.clover.contents()` is typed.** A `<clover-root>`'s `root.clover` has had
  `contents()`, the Manifest's table of contents as `Contents` draws it, but
  `@nulib/clover/web-components`' types left it out of `CloverRootApi`, so a typed page
  that called it failed to compile. It is declared now, with its entries' type,
  `CloverContentsEntry`: each Range's `id`, `label`, `canvasId`, `canvasIds`, its `time`
  or `region`, and its `children`. A page that calls it has nothing to change:

  ```ts
  const { clover } = document.querySelector("clover-root")!;
  for (const entry of clover?.contents() ?? []) console.log(entry.canvasId);
  ```

## [4.0.0-beta.1] - 2026-10-28

### Documentation

- **Sizes are now what a page fetches to its first view.** The figures the docs state
  counted only the chunks a page imports up front. A Viewer also loads the upgrader as
  it opens any Presentation 2 or 3 resource (7.8 kB gzipped), and the stylesheet was
  never counted. Each figure is now measured on the plainest resource of its kind (an
  image, MP4 audio, a model, a navPlace point) and leaves out React and the engines
  others make that load on demand (MapLibre and its worker, hls.js, three.js). In React,
  a template's figure includes the upgrader and its stylesheets, and a part's is its
  script alone. The Viewer in its Default template showing an image is 89.4 kB (was
  stated as 65.6 kB); a `<clover-viewer>` from its own entry is 97.9 kB (was 90.1 kB).
  Nothing in what the package ships changed. New budgets hold the first-view figures
  (`*FirstViewGzip` in `build/size-budget.json`), and the Viewer's element pages' budgets
  rise by the upgrader. `npm run check:first-view -w @nulib/clover` opens each page in
  Chrome and fails if a figure differs from what it fetched.

### Fixed

- **A map draws its places in any bundler, with no setup.** In an app built with Vite,
  webpack, Next or Turbopack, `Map` and the Viewer's Map section drew only the basemap,
  at world zoom: MapLibre's worker could not find the module it imports once the
  bundler had moved MapLibre's files, so every navPlace place and georeferenced overlay
  silently went missing. Clover now brings the worker, bundled into one script, and
  starts it from a `blob:` URL the first time a map shows (it loads with MapLibre, never
  before). Remove the `setMapWorkerUrl` call and the worker files you copied, unless
  your Content Security Policy refuses `blob:` workers, in which case keep serving the
  worker yourself as before:

  ```js
  // Only where `worker-src` does not allow blob:
  import { setMapWorkerUrl } from "@nulib/clover";
  setMapWorkerUrl("/static/maplibre-gl-worker.mjs");
  ```

- **The Document template's page count stays on one line.** The thumbnails' toggle
  broke "1 / 17" in two and grew over the first thumbnail.
- **The type declarations compile with `skipLibCheck: false`.** They declared `Canvas`,
  `Collection` and `Json` twice, and `@nulib/clover/map`'s used `Manifest` and
  `Collection` without importing them, so a project that skips library checks read
  `hasMapData`, `navPlaceOf` and `georeferencesOf`'s arguments as `any`. The
  `Presentation4Canvas`, `Presentation4Collection`, `Presentation4Scene` and
  `Presentation4Timeline` types, documented but missing from the declarations, are now
  exported.
- **No more "ResizeObserver loop completed with undelivered notifications."** A Viewer's
  pages raised that error as they loaded, so error trackers logged it: the Panel's About
  and `ReadMore` rewrote their layout within the browser's resize report, and `Split`'s
  separator set its value there, which the web components (Preact) render at once. All
  three now measure a frame later.

### Changed

- **`maplibre-gl` is pinned to 6.11.1**, the MapLibre the bundled worker is built from,
  whose messages it reads. A page that brings another MapLibre serves that one's worker
  with `setMapWorkerUrl`; Clover says so in the console.

## [4.0.0-beta.0] - 2026-10-27

### Added

- **Finding in a transcript (Mat, 2026-10-26).** `Transcript` has a field over its
  captions that finds words as they are typed: the cues with them marked (case aside) and
  counted, the first current, and Previous, Next or Enter going through them, each
  seeking the recording there, as a press on a cue does, and bringing it into view.
  Nothing moves while typing. It is drawn as Search's field and steps are (the same
  component, `clover-field-pill`, its size and its Search button; what it found inside
  it, "1 / 1" for one, "No results" for none). A long transcript is drawn 40
  cues at a time, the next as the list's end nears the view or focus reaches its last
  few, the cue playing and the match current always among them. It speaks in Search's
  own words ("Search", "Result 2 of 7", "7 results"), so no strings are new. A new prop,
  `find` (the element's `find` attribute), leaves the field out with `find={false}`;
  another, `sticky`, holds the field in view as the cues scroll under it, as Search's
  does; and `size`, as Search's. The Panel's Search and Transcript sections ask for
  both, the field `small` there, in the templates (Mat, 2026-10-26); alone, each part's
  field is `large`.

- **A search's hits show while its section is open (Mat, 2026-10-26).** In a `Panel`
  with a Search section, the hits are drawn on the Canvas only while that section is
  open: another section opened, they go, the query and its list kept, and they come back
  with it. The Panel sets the search set's visibility as its section opens and closes,
  so `clover.setSetVisible(SEARCH_SET_ID, …)` holds only until it next does.

- **Search takes focus as its section opens (Mat, 2026-10-26).** In an accordion, a
  press that opens Search's section puts focus in its field, there to type into. A
  section opened any other way (a search from elsewhere, a controlled `value`) leaves
  focus where it is. `Sections` gives its content `useSectionOpened()`, a count of the
  reader's presses that opened it.

- **A search opens the Panel's Search section (Mat, 2026-10-26).** A search started
  anywhere but that section (the Root's `searchQuery`, given or changed, or
  `clover.search()`) opens Search in a `Panel`, ahead of `defaultValue`, so the hits
  drawn on the Canvas come with their list. Only the open section changes: focus stays
  where it is, a Panel that is shut stays shut and opens on Search when it shows, a
  section the reader leaves stays left until another query, and a controlled `value` is
  never changed. Nothing to do, unless a `defaultValue` should win over a query: control
  the section with `value` and `onValueChange` instead.

- **Previous and Next through a search's results (Mat, 2026-10-26).** `Search` shows,
  inside its field before its clear, what the search found: the hit current over the
  total ("3 / 11"; one is "1 / 1"), then Previous and Next, small, drawn as Annotations'
  language codes are; or "No results". They go in order, across Canvases, each to its
  hit, framing it and bringing it into view in the list. Results go to their first hit
  as they arrive, as find in a page does (the Canvas moves, never focus), so the count
  reads "1 / 11". The status under the field ("11 results") is for assistive technology
  alone, still announced; "Loading…" and a failure show. Assistive technology hears
  "Result 3 of 11" as the current hit changes, a new string, `contentSearchPosition`, in
  every locale. A new prop, `sticky` (an attribute of `<clover-search>` too), holds the
  field in view as the hits scroll under it, under the accordion's headings or at the
  top of the box that scrolls them (`--clover-content-search-top` to set it lower), the
  hits fading into it as they pass under. The Panel's own Search section uses it. A long answer (a common word: hundreds of hits) is drawn 40 hits at
  a time, the next as the list's end nears the view or focus reaches its last few, the
  current hit always among them; each laid out and painted only near view.

- **Annotations in several languages (Mat, 2026-10-25).** Where a layer gives the same
  words as separate annotations, one per language (a transcription and its translation,
  as Northwestern's Maktaba publishes them), `Annotations` lists one language at a time,
  offered by their codes at the end of the layer's header ("AR", "EN"), drawn as the
  Transcript's are: native radios in a group named "Language", each named by its code
  and then its language's own name in that language ("AR العربية"), which its popover
  shows. It starts on the Root's `language`, else the reader's, as IIIF text is chosen;
  annotations in no language show whichever is chosen. Nothing changes where a layer is
  in one language, or where each annotation holds all of its languages. One string,
  `annotationsLanguage`, in every locale. With right-to-left text (below), it adds about
  0.18 kB gzip wherever Annotations is, so budgets are raised for it: Default's page to
  68.9 kB, Document's to 71.4, Gallery's to 59.9, a layout of the containers to 110.4, a
  `<clover-viewer>` page to 111.3 (its own entry 92.8), and
  `<clover-viewer template="document">` to 117.6.

  ```jsx
  <Clover.Root iiifContent={manuscript} language="ar">
    <Clover.Body />
    <Clover.Annotations />
  </Clover.Root>
  ```

- **Right-to-left text (Mat, 2026-10-25).** IIIF text in a language written right to
  left (Arabic, Hebrew, Persian, Urdu…, or a right-to-left script subtag) carries
  `dir="rtl"` beside its `lang`, wherever Clover shows a value (`Summary`, `Metadata`,
  annotations, captions' information), so it aligns and orders as it is written. Other
  text carries no `dir` and takes the page's.

- **`partOf` on `Canvas` and `Timeline` (Mat, 2026-10-24).** What the view is part of,
  named under its title where a lone recording plays as a player (below): the Manifest's
  label by default, inside a `Root` or given `iiifContent`.

- **`Provider` and `Logo`: IIIF's `provider`, and the `logo` on each (Mat, 2026-10-24).**
  `Clover.Provider` (`<clover-provider>`) lists who provided the resource, each
  provider's logo and name linked to its homepage. It is a compound part: what it holds is
  drawn once for each provider, and the parts in it read that provider rather than the
  resource: `Logo` its logo, `Label` its name, `Homepage`, `SeeAlso` and `Id` its links. A
  part of your own reads it with `useProvider()`. `Clover.Logo` (`<clover-logo>`) draws a
  provider's logo, `--clover-logo-height` tall (1.618rem), its `alt` the provider's name.
  About shows the providers, under "Provider", after the required statement, and the
  Default template's header and the Document template's toolbar end with each one's logo,
  linked. Two strings, `aboutProvider` and `logo`, in every locale. Budgets raised for
  them, about 1.1 kB gzip wherever About is and 0.25 kB where the property parts read a
  provider: Default's page to 68.1 kB, Document's to 70.4, a layout of the containers to
  109.2, the four parts' page to 94.5, a Label's to 32.7, a `<clover-viewer>` page to
  110.1 (its own entry 91.8), `<clover-viewer template="document">` to 116.2, the
  elements' entry to 5.55 (two more elements), and `styles.css` to 12.76 (with the
  Scene's cel-shaded disc).

  ```jsx
  <Clover.Provider>
    <Clover.Logo />
  </Clover.Provider>
  ```

  ```html
  <clover-provider><clover-logo></clover-logo></clover-provider>
  ```

- **`Timeline` and `Scene`, Presentation 4's other containers.** `Body` draws a Timeline
  view with `Timeline` and a Scene view with `Scene`, each loaded the first time such a
  view shows, so the Viewer's templates play sound and draw 3D with no prop; a renderer of
  yours (`renderers`) still goes first. Both work alone too, and as elements,
  `<clover-timeline>` and `<clover-scene>`:

  ```jsx
  <Clover.Timeline iiifContent="https://iiif.io/api/cookbook/recipe/0002-mvm-audio/v4/manifest.json" />
  <Clover.Scene iiifContent="https://iiif.io/api/cookbook/recipe/0608-mvm-3d/v4/manifest.json" />
  ```

  - `Timeline` plays a Timeline (sound) in Canvas's view, with its transport, captions,
    chapters, annotations on its time and its accompanying or placeholder Canvas: what
    Canvas gave sound before, so a page of sound loads what a Canvas alone does (38.1 kB
    gzip). A Presentation 3 Canvas of sound alone upgrades to a Timeline, so it plays
    with it too. Sound with no picture, nor a placeholder showing, shows its label in the
    Body, which was blank (`.clover-canvas-sound-label`, hidden from assistive
    technology, as the Body is named by the same words).
  - `Scene` draws a Scene's glTF models (`model/gltf-binary`, `model/gltf+json`), each at
    its target's `PointSelector`, after its transforms, lit as a neutral room lights them
    and framed by a default camera, as Cookbook 0608 asks. A drag turns them and a pinch
    zooms; so do its controls and its keys on the focused view (the arrows, R, Shift+R,
    plus, minus, 0). Its controls are in the Body's lower right
    (`.clover-scene-navigation`), over a shade rising from its foot, coming and going as
    Canvas's do: zoom and full screen in a row, ending beside a pad that turns them
    (`.clover-scene-rotate`, a group named "Rotate"): at its center a disc to drag, as the
    view is dragged (`.clover-scene-rotate-disc`, a ball in the accent, cel-shaded, flat
    tones with crisp edges, a step lighter and larger while it is pointed at, held, or the
    view turns, a globe across it that
    turns with the models and shows where their front is), around it each way on the side
    it turns toward, Clover's caret pointing its way, a press a step and held to keep
    turning, and in its last corner Reset view, as Canvas's. The top right keeps the `i`
    and a host's own controls. `controlButtons` replaces any of its buttons as it does the
    cluster's. It loads 15.6 kB gzip up front, and its drawing the first time a Scene
    comes near the window. It takes its WebGL context in turn with the page's Canvases.
  - `three` is a dependency, imported only by the drawing `engine="three"` loads.
  - Its drawing is Clover's own WebGL2 glTF renderer (`lib/gltf/`), as Canvas draws
    images: 8.0 kB gzip, loaded when a Scene first comes near the window. It draws glTF
    2.0's core, unlit materials and a material's IOR and specular; a model that requires
    anything else (Draco, Meshopt, KTX2) says so in an alert. Scenes showing one model at
    once share one download of it, and the camera frames the model's points as placed,
    not its boxes turned. **`engine="three"`**
    (`<clover-scene engine="three">`) draws with three.js instead, 158.3 kB loaded only
    for a Scene that asks for it, for compressed models, animations and glTF's material
    extensions.

    ```jsx
    <Clover.Scene iiifContent={url} engine="three" />
    ```

  - Budgets: `timelineInitialGzip` 38.2, `sceneInitialGzip` 14.4, `sceneOnDemandGzip`
    160 and `sceneCloverOnDemandGzip` 8.3 kB; and, for the label a sound with no picture
    shows, `webComponentsGzip` 108.8 (`<clover-viewer>` 108,533 B), `canvasElementGzip`
    79.3 (`<clover-canvas>` alone, 79,061 B) and `documentElementGzip` 114.9 kB (114,636
    B).

- **Sound's Presentation 4 body, `Audio`, plays**, as Presentation 3's `Sound` did. The
  Cookbook's recipes in Presentation 4 paint `Audio`; until now a Canvas or Timeline
  painting one showed nothing.

- **`root.clover.contents()`: the table of contents, for a page's script.** The same
  entries React's `tableOfContents` gives and `Contents` draws (each its `label`, the
  `canvasId` it goes to, its `time` or `region`, and its `children`), so a web components
  page can draw a table of contents of its own:

  ```html
  <script type="module">
    const root = document.querySelector("clover-root");
    root.addEventListener("clover-ready", () => {
      root.clover.subscribe(() => {
        const entries = root.clover.contents();
      });
    });
  </script>
  ```

  The root carries the table of contents' code now, which a page with only labels, or a
  `<clover-canvas>` alone, did not load: 0.9 kB more on each (budgets 32.1 and 77.7 kB),
  and a little less on the pages that draw `Contents`, which shared it later.

- **`@nulib/clover/web-components/viewer`: `<clover-viewer>` alone, built whole.** A page
  that shows a Viewer and nothing else of Clover's can load this entry instead of the one
  for every element: 90.6 kB gzip in four files, where the other loads 107.5 kB in 39 for
  the same page, its code cut into the chunks the elements share. Load one entry on a
  page, not both: each brings its own copy of Clover. `index.umd.js` loads it from a
  classic script, as the main entry's does; `sizes.json` records it
  (`viewerEntryGzip`), held to 90.6 kB. `viewer/` holds only the Viewer's own files and
  loads the 20 it has in common with the main entry (MapLibre and its worker, hls.js,
  DOMPurify, the languages and a few small modules) from the folder above, so the package
  is 0.49 MB gzip lighter and a page loads what it did. If you serve Clover's files
  yourself, copy the whole `web-components` folder, not `viewer/` alone.

  ```html
  <script src=".../web-components/viewer/index.umd.js"></script>
  <clover-viewer
    iiif-content="https://example.org/manifest.json"
  ></clover-viewer>
  ```

- **`<clover-read-more>`, `oneOpen` and more of React's on the elements.** Every part
  `@nulib/clover` exports is now an element too: `<clover-read-more>` gives text of your
  own (its one child, clamped by your CSS) the "Read more" `ReadMore` gives, and
  `root.clover.oneOpen(close)` joins a popup of yours to Clover's, which open one at a
  time, as `useOneOpen` does (it returns what to call as yours closes). `controls` is a
  property of `<clover-body>` and `<clover-canvas>` too, for the object Canvas takes
  (`{ rotation: false }`), and `<clover-viewer>` takes `annotations` (an attribute, or a
  property) and `request`, as the Viewer does.

  ```html
  <clover-read-more>
    <p class="my-note">…</p>
  </clover-read-more>
  ```

- **Parts of your own, as elements.** A page's script reads a `<clover-root>` as a React
  part reads its `Root` with Clover's hooks: once the root has loaded, `root.clover` is its
  Clover (sent with `clover-ready`), each hook a method of the same name
  (`useNavigation()` is `navigation()`), with `state` and `subscribe`, the actions, the
  channels, and `localize`, `t` and `langOf`. `<clover-canvas>` and `<clover-body>`
  keep their Canvas's handle as `handle` once the view is laid out, as `onReady` hands it
  in React, and send `clover-ready` too; a `clover-ready` does not bubble. `renderers` on
  a `<clover-root>`, `<clover-body>` or `<clover-viewer>` draws views of your own
  without React: each claims views by `canvasId`, `format` or `match`, and
  `render(container, view)` draws one, returning what undoes it. `controlButtons` on a
  `<clover-body>` or `<clover-canvas>` replaces a control with a button you make,
  which Clover names, keys, wires and gives its popover; a `<button>` in a
  `<clover-body>` is one of its controls; and `<clover-tip label keys>`, in a button
  of yours, shows Clover's popover, as `<Clover.Tip>` does. `<clover-body>` also takes
  `placeholder`, `animate-annotations`, `options` and the Canvas's events. The types
  declare `CloverRootApi`, `CloverCanvasHandle`, `CloverRenderer` and
  `CloverControlButtons`.

  ```js
  root.addEventListener("clover-ready", () => {
    root.clover.subscribe(() => {
      const { position, total } = root.clover.navigation();
      where.textContent = `View ${position + 1} of ${total}`;
    });
  });
  ```

- **`<clover-canvas>`, and `<clover-viewer>` in every template.** `<clover-canvas>` is
  Clover's renderer as an element. Alone, it draws what it is given: a IIIF resource by
  `iiif-content` (a Manifest gives its first Canvas), an image by `src` (with `tiled`, a
  IIIF Image service), or Canvases as its `canvases` property; inside a `<clover-root>`,
  given nothing, the root's view. It takes `label`, `controls`, `navigator`,
  `placeholder`, `viewing-direction` and `animate-annotations`, and sends
  `clover-annotation-select`, `clover-annotation-active`, `clover-caption-change` and
  `clover-ended`. `<clover-viewer template="document">` or `"gallery"` shows that
  template, which loads the first time one is shown, its styles beside it (Default's
  come with the element), with each template's own attributes: `panel-open`,
  `panel-layout` and `storage-key` (Default and Document; `"false"` forgets the widths),
  `fill` (Default), `sidebar-open` (Document) and `size` (Gallery). A template ignores
  another's.

  ```html
  <clover-viewer
    template="gallery"
    size="12rem"
    iiif-content="…"
  ></clover-viewer>
  <clover-canvas iiif-content="…" style="height: 60vh"></clover-canvas>
  ```

- **The containers as elements**: `<clover-panel>` and its `<clover-tab>`s,
  `<clover-panel-toggle>`, and the Split's `<clover-split>`, `<clover-split-pane>` and
  `<clover-split-handle>`, so a layout as `Default`'s is written in HTML too. The panel
  has the sections Clover has data for, or a tab for each `<clover-tab value label>` in
  it, in their order; a tab's content moves into its section when the section first
  opens, and a `slot="label"` child gives its label markup. `value` is the tab it opens
  on (changed later, it shows that tab), the reader's choice sends
  `clover-value-change`, and `closable` gives it a close button, which sends
  `clover-close` (cancelable) and hides what its toggle shows. A `<clover-panel-toggle
controls="id">` in a `<clover-body>` is one of the Body's controls; elsewhere, a
  button of its own. Its target is open while it is not `hidden` (write `hidden` on the
  panel to start it shut), and each press sends `clover-open-change` (cancelable). The
  Split's elements are the panes and bars themselves, with `Split`'s sizes, storage,
  clicks, drags and keys (`storage-key`; a pane's `size`, `min`, `max`, `name`); a
  handle is named "Resize panels", or by its own `aria-label`, and hides with the pane it
  sizes.

  ```html
  <clover-split storage-key="my-layout">
    <clover-split-pane min="16rem">
      <clover-body>
        <clover-panel-toggle controls="panel-pane"></clover-panel-toggle>
      </clover-body>
    </clover-split-pane>
    <clover-split-handle></clover-split-handle>
    <clover-split-pane id="panel-pane" size="24rem" min="14rem">
      <clover-panel></clover-panel>
    </clover-split-pane>
  </clover-split>
  ```

- **Slots and function properties on the elements.** `<clover-status>` shows a
  `slot="loading"` child while its root loads and a `slot="error"` child if it fails, in
  place of Clover's words, as copies kept in step. `renderValue` on `<clover-metadata>`,
  `renderEntry` on `<clover-annotations>` and `renderItem` on `<clover-items>` take a
  function that returns a node or text, as the React parts take one that returns an
  element. The manifest lists each element's slots.
- **Types and a Custom Elements Manifest for the web components.** The module declares
  every element in `HTMLElementTagNameMap` and every event, so
  `document.querySelector("clover-root")` is typed, and
  `@nulib/clover/web-components/custom-elements.json` (the package's `customElements`)
  gives each element's attributes, properties and events to editors and tools. Both are
  written from the elements' own specs.
- **Parts as elements,** from `@nulib/clover/web-components`, which defines
  them beside `<clover-viewer>`: `<clover-root>`, `<clover-body>`, `<clover-items>`,
  `<clover-previous>`, `<clover-position>`, `<clover-next>`, `<clover-status>`; a
  property each, `<clover-label>`, `<clover-thumbnail>`, `<clover-summary>`,
  `<clover-metadata>`, `<clover-required-statement>`, `<clover-rights>`,
  `<clover-homepage>`, `<clover-see-also>`, `<clover-rendering>`, `<clover-part-of>`,
  `<clover-id>` and `<clover-value>`; the panel's sections, each on its own,
  `<clover-about>`, `<clover-annotations>`, `<clover-collection>`,
  `<clover-collection-select>`, `<clover-contents>`, `<clover-search>`,
  `<clover-transcript>` and `<clover-download>`; and `<clover-map>`. They compose in a page's own HTML as the parts do in JSX: each
  draws its part into itself, inside the nearest `<clover-root>`, and the page's markup
  around and between them stays as written. One render tree serves every element on the
  page, so they share their root's state wherever they sit in it, and each element's ids
  are its own. `canvas-id` and `manifest-id` on a root say where it opens, and move the
  reader when changed; it sends `<clover-viewer>`'s events, `<clover-items>` and
  `<clover-map>` send `clover-select` (cancel it to keep a link from being followed), and
  `<clover-collection-select>` sends `clover-change`. A part of a root draws nothing
  outside one and says so in the console, as it does of an `aria-label` or `role` put
  on an element, a box no reader is told of. Data an attribute can
  carry is a URL or JSON in it (`annotations` on a root, `label` on a label), and
  anything else a property. The attributes are on Get started.
  The elements add `style[data-clover="elements"]`, their display rules, in
  `@layer clover`.

  ```html
  <clover-root iiif-content="https://example.org/manifest.json">
    <clover-label as="h2"></clover-label>
    <clover-body style="height: 60vh"></clover-body>
    <clover-items></clover-items>
  </clover-root>
  ```

- **`defaultManifestId` on `Root`, and so on the Viewer and every template:** in a
  Collection, the member to open first, as `defaultCanvasId` is the Canvas to start on.
  The reader moves on from it; `manifestId` still holds them there, for a host that
  moves them itself.

  ```jsx
  <Viewer iiifContent={collection} defaultManifestId={letter} />
  ```

- **`download` on `About`, `Panel` and `Default`.** `false` leaves the downloads out of
  About, as `Document`'s `download` leaves them out of its toolbar. On `<clover-viewer>`,
  `download="false"` passes it, and so does what Get started said: it did nothing, since
  `Default` has no Download of its own.

  ```jsx
  <Viewer iiifContent={url} template={Default} download={false} />
  ```

- **`Clover.useUniqueId()`, for a part of your own.** An id unique on the page across
  Clover's roots, React's or `<clover-viewer>`'s, which Clover's parts now use where they
  used React's `useId`. Use it for an id your part's labels or `aria-controls` point at.

  ```jsx
  const id = Clover.useUniqueId();
  ```

- **`Clover.titled(level, id)`, for a layout of your own.** A title at a heading level
  and the group it heads: to `h6`, the heading (`as`); past it, a `p` with `id`, and
  `role="group"` with `aria-labelledby` for the element around what it heads, as Clover's
  own parts and templates do (see Changed).

  ```jsx
  const title = Clover.titled(headingLevel, "my-title");
  <Clover.Root iiifContent={url} {...title.group}>
    <Clover.Label as={title.as} {...title.title} />
  </Clover.Root>;
  ```

- **`--clover-color-accent-text`, the accent for text.** Links, Read more, the selected
  item's label, Download's links and the other text Clover draws in the accent read it,
  falling back to `--clover-color-accent`, so nothing changes unless you set it. On a
  dark page no one accent reads as text (4.5:1 on the ground) and stays dark enough
  under the round controls' white glyphs (4.5:1 on the accent): set this one lighter
  for text, and keep `--clover-color-accent` for rings and fills.

  ```css
  .dark {
    --clover-color-accent: #0f62fe;
    --clover-color-accent-text: #8fb4ff;
  }
  ```

  What Clover draws on the accent (a text button's label and the lightbox's close under
  the pointer, the Transcript's chosen file, and the eye that hides a set of annotations)
  is now `--clover-color-control-glyph` rather than `--clover-color-secondary`: the same
  white by default, and the pair a dark mode keeps 4.5:1 apart.

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
  - `Body` draws the current view (a page, a spread, a video or sound) with `Canvas`.
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
    `Body` shows it; `Default` and `Document` place it so, and a load no longer moves
    the page.
  - **Loading, without anything moving.** While the Root loads (the first Manifest, or
    one chosen from a Collection), `Body` is `aria-busy` and shows the loading mark
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
    <Clover.Body />
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
  they look alike wherever they appear (the Panel's About, a Canvas's
  caption): each label over its value, both in the text's color as the summary is, at
  the same size, the label medium and the value at the text's own weight, the pairs
  stacked `s` apart. About's own headings (Rights, Homepage…) read as the labels do.
- **HTML in IIIF values is sanitized**, allowing only the markup the Presentation API
  permits and `http(s):` or `mailto:` links. Scripts, event handlers, `style`, SVG, and
  `javascript:` or `data:` URLs are removed. A value with markup shows as plain text until
  the sanitizer (DOMPurify) has loaded, which happens only when some value needs it.
- **`Clover.Panel`**, information about the Root's resource in sections, with
  About by default. (It was `Clover.InformationPanel` in development builds before
  2026-10-20, with `InformationPanelProps` and `InformationPanelLayout`, now `PanelProps`
  and `PanelLayout`, and the class `clover-information-panel`, now `clover-panel`.) Give it `Clover.Tab` children (`value`, `label`, and anything as
  content) to choose the sections, including your own; this replaces 3.x's information
  panel plugins. `value` / `defaultValue` / `onValueChange` control which section shows.
  The default sections past About (Collection, Contents, Search, Map, Transcript,
  Annotations) load when first opened, so their content arrives a moment after the
  section opens; in a test, find it with `findBy…`, not `getBy…`.

  `layout` lays the sections out as `"tabs"` (the default) or `"accordion"`. The tabs
  keep to one row and never wrap: where they do not fit the row scrolls sideways (touch,
  a wheel, a mouse's drag, or the tab focus moves to), fades out at an end while tabs lie
  past it (`.clover-sections-tabs[data-more]`), and shows a round arrow there that pages
  it ("Show more tabs", "Show previous tabs" on hover). The keyboard reaches every tab
  already, so the arrows are for a pointer, out of the tab order and the accessibility
  tree; a tab brought into view comes to rest clear of them. That row put the Viewer's
  budgets up by 0.4 kB gzip (`Default` 66.5 kB, `Document` 69.2 kB, `<clover-viewer>`
  104 kB) and `styles.css`'s by 0.2 kB (12.0 kB); its two strings put the Map's up to
  18.1 kB. The accordion: stacked
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
  controls, not links: each label is bold, in the text's color, over a 3px line as wide
  as the panel's content. A closed one's line is the color of a split's bar at rest
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
  <Clover.Panel layout="accordion" />
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
- **`Clover.PanelToggle`**, which shows and hides the `Panel`. Given to
  `Clover.Body` as a child, it sits in the Canvas's controls. The controls still fade
  while the panel is open: only a menu open over the Canvas holds them on screen.

  ```jsx
  <Clover.Body>
    <Clover.PanelToggle open={open} onOpenChange={setOpen} controls="panel" />
  </Clover.Body>
  <Clover.Panel
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
  `clover-canvas-change`, `clover-manifest-change`, `clover-status-change`,
  `clover-content-state-change`. Light DOM, as 3.x's. A page with one loads 95.4 kB gzip
  (3.x's element: about 530 kB); MapLibre, its worker and its stylesheet load only with
  a map. Its stylesheet loads by part, each sheet with the code that draws what it
  styles: a page of labels loads only theirs, and most sheets load together, as a few
  runs, with the first part that draws any of them, since they compress best as one.
  Video, sound, an animation, a map and the other templates bring theirs as they draw.
  Each is a `<style data-clover>` in `<head>`, keyed by its sheet (`"ui/ReadMore"`), a run
  (`"styles-1"`) or MapLibre's (`"maplibre"`), with its place in `styles.css`'s order
  (`data-clover-index`), which keeps the cascade the stylesheet's. Where a page looked for
  `style[data-clover="clover"]`, look for `style[data-clover]`, which finds them all.

  ```html
  <script src=".../web-components/index.umd.js"></script>
  <clover-viewer
    iiif-content="https://example.org/manifest.json"
  ></clover-viewer>
  ```

- **`Clover.Download`**, as 3.x's Viewer offers it: the `rendering` of the Canvases in
  view ("This page") and of the Manifest ("All pages") — a PDF, a text, a full-size file —
  as links, each with its format. It is in `Document`'s toolbar, and `Default` lists the
  same links in the `Panel`'s About; in either, `download={false}` leaves them out (3.x's
  `showDownload`). It renders nothing when there is nothing to download.
- **Renderers of your own** (3.x's `customDisplays`): `renderers` on `Root` (or one
  `Body`) draws the views it claims — by Canvas id, painted body `format`, or a `match`
  test — with your component instead of `Canvas`. It gets the view's `canvases`, their
  painting `bodies` and `Body`'s children, and can call Clover's hooks. The Viewer and
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
    around the entry. Hovering an entry or its region on the Canvas highlights both,
    through the Root, with no timers or polling.
  - Each set's header is its hide toggle, an eye (`label.clover-hide`: a checkbox,
    checked while hidden, the eye struck through), then a heading only when its
    AnnotationPage has a `label` of its own: the `Panel`'s Annotations section
    names the rest. The toggle's popover says "Hide" (`annotationsHideTip`); its name is
    that and the set's label, or "Hide annotations" (`annotationsHide`) for a set without
    one. It takes the set's annotations off the Canvas only: the list, and the Canvas's
    annotations menu, keep them. HTML bodies are
    sanitized; image bodies (Cookbook 0377) show as images. Caption files are left to the
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
    it loads), then the annotation. `animateAnnotations` on the Canvas (or `Body`)
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
    list shows them: HTML (0019) sanitized with its links and images kept, Markdown and
    plain text by their `format`. A Canvas with only such annotations now has the `i`.
    Before, the Canvas showed nothing of them. The bodies' renderer is shared with the
    list (`components/Annotations/EntryBodies.tsx`).
    To keep the glide:

    ```jsx
    <Clover.Body animateAnnotations />
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
  - The `Panel`'s Annotations section lists every annotation in the
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
  - The Viewer, its templates and a default `Panel` add a Map tab by
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
  - The `Panel` shows a Collection section, after About, whenever the
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
  - `Clover.CollectionSelect`, a native `<select>` of the members labeled by the
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
    <Clover.Body />
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
    between a spread's two) and `Position` ("2 / 70"); the `Panel` to the
    right of all three, the layout's full height, scrolling within. `fill` lays it out
    in the box it sits in, as tall as that box, the Canvas taking what the title and
    `Items` leave (never under 16rem; a shorter box scrolls), for a box of a set height,
    the window under a page's own header say; without it, the Canvas is
    `--clover-body-height` tall:

    ```jsx
    <div style={{ height: "calc(100dvh - 4rem)" }}>
      <Viewer iiifContent={url} fill />
    </div>
    ```

    The panel never stacks: it has its own space beside the Canvas, and a `SplitHandle` between them
    shares the width (remembered under `storageKey`). While it is open there, its
    `PanelToggle` sits on that bar, centered, level with the Canvas's controls; closed,
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
    (`"slider"`, `"list"` or `"grid"`), or `false` for none. `header={false}` leaves
    out the `Thumbnail` and `Label` over the Canvas (3.x's `showTitle: false`), and
    `panel={false}` the `Panel` and its `PanelToggle`.

  - `Document`: reads like a PDF viewer. A toolbar (the `Label`, and `Download`),
    `Items` down the left (the Manifest's Canvases as page thumbnails), and the
    pages down one column, as a PDF reader's continuous view: a sheet for each view (a
    spread is one), fitted whole on the gray ground with `--clover-inset` around it, and
    at most the column less twice the inset tall, so the top of the next always shows
    under the one at rest. The column scrolls as any page does (wheel, trackpad, a
    finger, the scrollbar), and at either end the web page scrolls on. The top of the
    column is the one place a sheet is active: where the scroll rests, the next sheet is
    brought there once the active one has been scrolled a quarter of its height on, the
    previous once a quarter of it is in sight, and otherwise the active one settles back.
    A press on a sheet, a thumbnail, and PageUp and PageDown bring theirs. Sheets not
    active are muted (0.618 opacity, 0.809 under the pointer). Each sheet is a still of
    its pictures; the one Canvas, with its zoom, annotations and media, lies over the
    active sheet's still, and shows, its controls sliding in, only once that sheet is in
    place and drawn; while the column scrolls the controls slide away. Zoomed in or out,
    or moved, the active sheet fills the column, pushing the others down, and they
    dissolve, until the Canvas is home again or another sheet comes in. A finger scrolls
    the column until then; after, it moves about the page. Pinch and Ctrl-wheel zoom.
    The page thumbnails' toggle is a pill drawn as the round controls are (the control's
    dark fill and light glyph, the accent under the pointer or focused): the glyph of a
    list of thumbnails, its pictures filled while they show, and `Position` ("3 / 17",
    `text-xs`). It reads "Show items" and then the place ("Item 3 of 17"), and their
    pane "Items": what they list need not be pages. While they show, it sits on the bar
    between them and the page, over them but for its far rounded end, which hangs over
    the page, so the thumbnails have their pane's whole height; put away, over the
    page's top left, `--clover-inset` in, level with the Canvas's controls. On a phone,
    where they float over the page, it sits on their inner edge, and is dragged off with
    them. A `SplitHandle` between `Items` and the page resizes them; a one-page document
    has neither, nor the toggle. To change Collection member, use the panel's Collection
    section. The `Panel` sits to the right of the page in its own `SplitPane`, with a
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
    inset clear around it on its gray background.
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
- **Text is read strictly by its `format`.** `text/html` is IIIF's HTML, sanitized to
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
  paragraphs, emphasis, links, lists (nested), headings, footnotes — and sanitized like
  HTML. `Clover.Value`
  shows any language map (with `format`); `useAnnotationSets`, `useT` and `toPlainText`
  are exported; `Root` takes `annotationPages="all"` to fetch every Canvas's referenced
  annotation pages, not only the view's. `Thumbnail` takes any resource as `value`, and
  image attributes such as `alt`.
- **`Clover.Items`**, thumbnails of a sequence as a `slider` (the default), `list` or
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
  - The slider is the browser's own scrolling with CSS snap points, with no slider
    library: wheel, trackpad, touch and keyboard all scroll it, and a mouse can drag it.
  - A slider's arrows choosing between views (inside a `Root`) are Previous and Next:
    they step the selection, and the slider follows it into view. A slider of links
    has no selection, so its arrows scroll it, as "Show previous items" and "Show more
    items".
  - Thumbnails load lazily, asked of each image service at `thumbnailSize` (200 by
    default). A level 0 service's `info.json` is read for the sizes it lists. Video and
    sound show their duration. A view or member with no image keeps its picture's box,
    at its shape (square for sound, which has none), so its cell never collapses to its
    caption; sound with nothing to picture shows a speaker in it.
  - Size it with `--clover-items-height`, `--clover-items-size` and `--clover-items-gap`.
    A slider's or grid's titles run to three lines and are cut short after
    (`--clover-items-lines`), as the thumbnails under 3.x's Viewer cut their captions at
    five.

  ```jsx
  <Clover.Root iiifContent={manifestUrl}>
    <Clover.Body />
    <Clover.Items layout="grid" />
  </Clover.Root>

  <Clover.Items iiifContent={collectionUrl} />
  ```

- **What `iiifContent` takes.** A URL, or a IIIF object in Presentation 2, 3 or 4: a
  Manifest, a Collection (its first Manifest is shown, or `manifestId`), a Canvas, or a
  content state as JSON or base64url. A Canvas is shown on its own, as a Manifest of
  one that says what the Canvas says of itself (its label, summary, metadata, required
  statement, rights, homepage, see also, rendering, thumbnail), so the Panel's
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
- **Space and type on one scale, from your page.** Every space in Clover is a step of
  the golden ratio from your page's own `1rem` (`--clover-space-3xs` to
  `--clover-space-2xl`, and `--clover-control` for the round controls), and every text
  size is that `1rem` plus or minus a space step: `--clover-text-xs` 0.764rem (a video's
  or sound's duration on its thumbnail), `-s` 0.854rem (secondary text), `-m` 1.146rem
  (the `Panel`'s section headings) and `-l` 1.236rem (titles). Those four and
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
  screen, `Items`' scroll arrows, the `Panel`'s close button and Document's
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
  `Panel` (an annotation, a Range, a cue, a search hit), the fill of a
  selected annotation drawn as a shape on the Canvas, and the words that matched in
  `Search`'s hits are `--clover-color-accent`, faintly (8%, 18% and 20%). They were a
  fixed blue and a fixed yellow, so they kept those colors under any other accent.

- **`Clover.Items`' hover, selection and focus rings take no room.** They were outlines
  outside each thumbnail, so a slider cut off the first thumbnail's ring and a list or
  grid's rings reached past the edge of the content. Now they take no room, nothing cuts
  them, and the thumbnails line up with what is beside them (see the ring around the whole
  item, below). A grid's cells now stay square for a tall picture too. The items in
  `Items` are `--clover-space-m` (1rem) apart in every layout (`--clover-items-gap`):
  each is a group, a picture with its caption. In `Default`, `Items` has the region's
  inset around it (`--clover-inset`, 1.618rem), as its header has. Each Canvas in an item has its own picture with its own
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
  color for keyboard focus, and the accent at half strength for hover. Focus adds a
  second ring inside the pictures' edge, `secondary` beside `primary`, so it shows on
  any picture. It is an outline
  on `.clover-items-pictures`, in 4px of room the item keeps around itself
  (`--clover-items-ring-room`) and gives back with a negative margin, so items are still
  `--clover-items-gap` apart and the edge of `Items` never cuts a ring. Only a slider,
  which scrolls across, keeps that room at its sides: a list or a grid keeps it above and
  below alone, so it never reaches past its own sides, which had put a scrollbar across a
  scrolling box with no padding around it. Clover now draws focus's inner ring on
  `.clover-items-pictures::after`. A stylesheet that styled that pseudo-element should
  style `.clover-items-pictures`'s outline instead, and leave `::after` to Clover. The thumbnails' corners are rounded to match, `--clover-radius` (3px), a
  spread's outer corners only: each picture now clips its image, where only a grid's did.
- **Every region keeps what it holds 1.618rem in, the Canvas's controls too, and steps
  down from there.** A region's inset is a new token, `--clover-inset`
  (`--clover-space-l`): `Default`'s header and `Items`, the `Panel` and the
  Gallery's lightbox. They were 1rem in (the panel's accordion text 1.6rem). The picture
  on the Canvas is not inset: it fills the Canvas edge to edge (below). Inside a region, each level is a
  step less: its parts are 1rem apart (the header's title and actions, the view's
  Canvas labels and `Position` over `Items`, About's parts, which were 0.618rem for the
  header and `Items`), what is within a part 0.618rem, and a metadata label 0.382rem
  over its value (was 0.236rem). The Canvas's controls, its placeholder's toggle and its
  navigator sit the region's inset in from the Canvas's edges
  (`--clover-canvas-controls-inset`, `--clover-inset` by default), so they line up with
  the header's title and `Position` over `Items`; they were 1rem in. The playback
  controls for video and sound are unchanged.
  - At home, a Canvas fills the space it is given edge to edge, and its placeholder the
    same, so the placeholder hands over to it without moving. `--clover-canvas-inset`
    (default `0px`) keeps a margin clear around the picture at home instead, the region's
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
  - In the `Panel`, the accordion's headings and content sit on the panel's
    inset, as its tabs' content does: the boxes reach out over the panel's padding.
  - A slider's thumbnails slide under a shadow at either end, as the
    `Panel`'s headings do: at the start once the slider has scrolled, at
    the end while there is more, and at neither when all its thumbnails fit. Each shadow
    is as tall as the pictures and level with them, not the captions under them. The
    slider's own scroll drives them (a named scroll timeline); browsers without
    scroll-driven animation show none. Its items snap to the slider's start rather
    than to the ring's room before them, so a slider at rest has not scrolled.
  - `Default`'s thumbnails run on past the end padding around `Items` to the edge of
    their `SplitPane`, as the Canvas does, while the labels and `Position` over them
    keep the padding. `Items`' arrows line up with what is above them: the left one `s`
    past the line the labels start on, the right one under the Canvas's controls,
    `--clover-inset` in from the pane's edge, as they are.

- **Phones.** iPhone Safari can put a video full screen, but no other element. There, the
  Canvas offers no full-screen control for images, and a video's full-screen button opens
  the system player. The same applies inside an `<iframe>` that is not allowed
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
  Choice, an animation's frames) and the playback controls' menus:
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
    right way around; on hover its icon turns a little the other way. A stylesheet that
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
  about 580px, `Default`'s `Panel` had kept its full 24rem and left the Canvas
  171px; it now shrinks toward 14rem, and the Canvas keeps 16rem. With `storageKey` the
  reader's sizes are remembered. Not tied to any part: the templates use it, and so can
  your own layouts. Dragging the bar does not blink the picture: a `Canvas` redraws in
  the same frame it is resized, wherever it sits.

  ```jsx
  <Clover.Split storageKey="my-layout">
    <Clover.SplitPane min="16rem">
      <Clover.Body />
    </Clover.SplitPane>
    <Clover.SplitHandle />
    <Clover.SplitPane size="24rem" min="14rem">
      <Clover.Panel />
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
  - Whether they show is decided once, on `.clover-canvas`: `--clover-controls-shown` (0
    or 1), `--clover-controls-events` and `--clover-controls-timing`, which each of them
    reads. Set `--clover-controls-enter`, `--clover-controls-leave` or
    `--clover-controls-tuck` there to change the motion. With reduced motion, the
    controls still come and go, without moving.
  - The navigator hides by `opacity` and `pointer-events`, as the controls do, no longer
    by `visibility`.
- **The `Panel`'s toggle, `PanelToggle`, never fades.** The Canvas's other
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
    (`--clover-canvas-controls-inset`), no wider than 22rem or taller than the Canvas
    leaves room for, with one look; in a short Body, beside the controls. The information
    box had hung at its own distance, 1rem in from the edge, out of line with the menus.
    The menus are now the Canvas's own children, as the box is, not the controls': a
    stylesheet that reached them through `.clover-canvas-controls .clover-canvas-menu`
    selects `.clover-canvas > .clover-canvas-menu` instead.
  - **A caption of Canvas information.** When a shown Canvas has a `summary` or
    `metadata` (Cookbook 0029, "metadata anywhere"), an `i` control among the Canvas's
    controls slides out a closable box over the picture with each Canvas's label,
    summary and metadata.
    `Canvas` renders as a `<figure>` (it was a `<div>`), and the box is its `<figcaption>`;
    the captioned Canvases' labels name the figure. Values keep IIIF's limited HTML,
    sanitized as 3.x's Primitives do, and the sanitizer loads only when the box first opens.
    `controls={{ information: false }}` hides it. Its close button is the round control
    every other is.
  - **Placeholder Canvases.** A Canvas with a `placeholderContainer` (Presentation 3's
    `placeholderCanvas`) shows its image first,
    fitted and centered, with a toggle in the top right (the Viewer's magnifier) to open
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
      white, with no dark ring around rail or thumb (`--clover-player-track-shadow` is
      `none` by default). The scrim keeps them at 3:1 over the lightest picture (WCAG
      1.4.11): it is at least 60% black up to the seek bar and fades out above it, for
      video and sound alike (sound's own softer scrim is gone). A focused thumb keeps its
      ring.
    - **Inset as the image controls are.** The playback controls and the caption cues
      sit in from the Body's sides and foot by `--clover-canvas-controls-inset` (`l` by
      default), as the Canvas's other controls do, rather than `m`; set that property to
      move them all together. In a Body narrower than 28rem the bar's controls are `xs`
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
      from the Root's new `clover.captions` channel, which `Transcript` sets.

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
  and then for `Items`, the `Panel`, annotations and transcripts (Canvas
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
  `Panel`'s accordion layout (the Sections that hold tabs and boxes alike).
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
  closed (7,905 B), then to 8.1 kB for the same shadows at a slider's ends (8,082 B). For that, and for a content state opening a Collection on one of its
  members, `Document`'s budget was raised to 61.7 kB (61,609 B), then to 61.9 kB for the
  `Panel`'s Collection section beside its own `CollectionSelect` (61,784 B),
  and `<clover-viewer>`'s
  to 92.7 kB (92,603 B), then to 92.8 kB for the slider's shadows in its inlined
  stylesheet (92,710 B). For the `Panel`'s Collection section fetching a
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
  Body then brought `<clover-viewer>` to 95.9 kB (95,934 B), 34 B over that, and its
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

### Changed

- **Lighter, from a pass over dead code (Mat, 2026-10-27; `DRY.md`, Phase 1).** What a
  page loads, measured by the build: the Default template's page 70.3 kB gzip (70.8
  before), Document's 72.8 (73.3), Gallery's 60.2 (60.8), a Canvas's or a Timeline's first
  load 38.7 (38.9), the stylesheet 15.5 (15.6), a `<clover-viewer>` 113.9 (114.4) and its
  own entry 95.2 (95.9). What went, none of it reachable from a page: the renderer's
  path for a WebGL context restored (the renderer lets a lost context go at once), its
  members and options no caller used, the scroll track's vertical axis and numeric
  paging, the Panel sections' uncontrolled state, two icons, the media controller's
  unread state, and rules in `Canvas.css` and `Canvas/Annotations.css` that the
  elements' inline geometry always overrode (a host's own rules for those classes were
  overridden too, so none changes). The Default template's root no longer carries
  `data-panel-open`, which nothing read: a page that styled by it can read
  `[data-open]` on the panel's pane. The budgets in `build/size-budget.json` follow:
  each one that fell, to its measured size and about 250 B more, and a `<clover-canvas>`
  alone, which a Canvas loading its own chapters and deep links (Fixed, below) grew to
  82.8 kB, raised to 83.0. The Ranges' reader loads only for a Canvas that plays, and an
  annotation's name only with its hotspots, so neither weighs on a still image.

- **A Timeline no longer loads the image renderer (Mat, 2026-10-27; `DRY.md`, A3).**
  Sound has no picture to draw, so a `Timeline` (standalone, loading its own, or a
  Root's view, `Body`'s too) now draws on a small surface of its own in place of Canvas's
  WebGL renderer: nothing of the tiles, the camera or the gestures loads for it, and in
  view it no longer holds one of the page's WebGL contexts. It plays as before: the same
  player, transport, captions, chapters and notes; a click on its view plays and pauses
  and a finger's tap shows the controls; its view keeps its name, its keys and its
  focus. A Timeline alone now loads 23.4 kB gzip up front (38.7 before), a
  `<clover-timeline>` page 66.9 kB (81.5). A Root's shared content state now names a
  Timeline view with no region, where it carried an `xywh` a Timeline cannot have. A
  `Canvas` handed a Timeline still draws it with the renderer. The elements' Canvas view
  and its renderer are now two chunks, fetched together, so a Timeline can take one
  without the other; that costs an element page holding a Canvas about 0.56 kB, of which
  reading what a container paints one way (below) wins back 0.1 to 0.33 kB. A React
  page, whose bundler makes its own chunks, changes by under 50 B.
  `build/bundle.test.mjs` now fails if a Timeline can reach the renderer. Nothing to do
  when upgrading.

- **What a container paints is read one way (Mat, 2026-10-27; `DRY.md`, A2).** A
  thumbnail, Items' kind of each item, the Body's renderer, a region's image, the
  Canvas's layout, the Map's overlay and the Scene's models now read painting
  annotations by one rule (`core/painting.ts`, `core/painted-bodies.ts`): `painting`
  among the motivations, or none said; Presentation 4's groups (`Composite`,
  `Independents`, `List`) unwrapped; a `Choice`'s first item; a `SpecificResource`'s
  source. So a Canvas that paints its image inside a group now has that image as its
  thumbnail and still, and Items calls it an image (it called it `Composite`); Items no
  longer takes a body from an annotation that does not paint; and the Map draws the
  image of a georeferenced Canvas whose painting annotation names no motivation. The
  package's twenty copies of one helper are one (`lib/asArray.ts`). Measured: the
  Default template's page 70.0 kB gzip (70.3 after Phase 1), Document's 72.6 (72.8),
  Gallery's 60.1 (60.2), a Scene's first load 15.3 (15.6), a Map's 18.5 (18.6), a
  `<clover-viewer>` 114.2 and its own entry 95.0 (95.2). The budgets follow, each to its
  measured size and about 250 B more; the budgets of the elements' pages that hold a
  Canvas end 0.2 to 0.55 kB over Phase 1's (`webComponentsGzip` 114.4 kB, `composedPageGzip` 97.6,
  `layoutPageGzip` 113.5, `canvasElementGzip` 83.55, `documentElementGzip` 120.75), the
  rest of the Timeline's split, and Timeline's budget falls to 23.65 kB.

- **Six decisions on what Clover keeps (Mat, 2026-10-27; `DRY.md`, decisions 1, 2, 4, 10,
  12, 13).**
  - **three.js is opt-in.** The Scene's `engine="three"` draws with three.js only once a
    page registers it, and `three` is no longer installed with Clover (an optional peer
    dependency): install it, and register it once, before a Scene draws. The web
    components bring theirs bundled, in a module a page loads beside the elements. A
    Scene asked for an engine no one registered draws with Clover's own, and says so in
    the console. The docs no longer say it draws compressed models or animations: it
    does neither (no Draco, Meshopt or KTX2 decoder, and no animation loop).

    ```js
    // npm install three
    import { registerThreeEngine } from "@nulib/clover/three";
    registerThreeEngine();
    ```

    ```html
    <script
      type="module"
      src="https://cdn.jsdelivr.net/npm/@nulib/clover/dist/web-components/three.mjs"
    ></script>
    ```

  - **Video is always the browser's own element.** `options.media.presentation`
    (`"texture"`, drawing frames into the canvas) is gone with the `media` option: a
    video is the `<video>` itself, placed by the camera, so it asks for no CORS. Remove
    `options.media` where you passed it.
  - **A floating drawer's drag loads when one first floats.** Swiping a panel or
    Document's thumbnails away works as before, its code loaded the first time a drawer
    slides over the page; a wide layout never loads it.
  - **`@iiif/helpers` is no longer a dependency.** Which language a IIIF value shows in is
    Clover's own `closestLanguage`, held by a test to give the answers `@iiif/helpers`'
    `getClosestLanguage` gives, and Clover's strings and IIIF text read the reader's
    languages one way (`navigator.language` after `navigator.languages`).
  - **The public helpers, settled.** `readAs`, `toPlainText`, `thumbnailSource`,
    `regionSource`, `resolveThumbnail` and `buildContentState` are documented (Technical
    overview, Helpers). `createClover` and `isPresentation4` are no longer exported:
    a `Root`'s state is read through `useClover` and the hooks, and `toPresentation4`
    stays.
  - **`defineCloverElements` takes no `styles`.** A page styles Clover with its own
    stylesheet, which outranks Clover's `clover` layer; nothing in the package handed one.

  Measured, gzip, against before them: the Default template's page 65.5 kB (66.6),
  Document's 62.0 (63.0), a Canvas alone 35.8 (36.2), a Timeline 21.7 (21.8), the
  elements' entry 5.4 (5.6), all the web components 109.0 (110.4), `<clover-viewer>`'s
  entry 89.9 (91.2), one in Document 115.5 (116.9); a Scene alone +14 B, for the
  engines' registry. The package ships one copy of three.js where it shipped two. The
  budgets follow.

- **More of Clover loads only when a page needs it (Mat, 2026-10-27; `DRY.md`, B3 to
  B9).** Nothing draws differently; a few things a page did not use now wait for it.
  - **Annotations' state.** What a Canvas keeps of its annotations (which pages show,
    the hotspots' places, the hovered and the picked one, framing a pick, going to one
    on a recording's time, opening the Canvas past its placeholder for a pick) loads
    with the hotspots, only for a Canvas with annotations. A pick made before they
    arrive, a host's `selectedAnnotation` say, is framed once they have, as one made
    before its view was drawn always was.
  - **Hotspots' layer.** A Canvas makes its `.clover-canvas-overlays` layer, and loads
    its code, with its first hotspot. A Canvas with no annotations has none, so a script
    or style that reached for it there finds nothing.
  - **Video sizing.** How a video is fitted at its own aspect is read by the media's own
    code, which only a recording loads.
  - **Content state.** Reading a content state handed to a Root (JSON or base64url, not
    a URL) loads a small chunk of its own; writing one, and `decodeContentState` imported
    from `@nulib/clover`, are as before.
  - **Items outside a Root.** Standalone Items (given `iiifContent` or `items`) is a
    chunk of its own, so a template, whose Items are always in a Root, never carries it.
    It draws a moment later, and no longer in a server's first pass.
  - **The renderer's fallbacks.** Canvas2D, which draws when WebGL2 cannot be had (a
    context past the page's share, a lost one, or none), loads the first time it is
    needed, the Body's background showing meanwhile. The DOM layer
    (`.clover-canvas-dom-layer`, for `dom` video and images served without CORS) is made
    with the first frame that holds one; until its code arrives, such an image's first
    frame waits.
  - **Maps.** MapLibre loads only as a map comes within half a screen of view, as a
    Canvas's images do, so a map far down a page, or in a tab not yet open, loads none
    of it. A `Map` given its own `iiifContent` loads its Root's code as a chunk of its
    own, its box holding its place meanwhile, so a map handed its places, or inside a
    Root, never carries the loader.

  Measured, gzip: the Default template's page 66.6 kB (69.7), Document's 63.0 (66.2),
  Gallery's 26.1 (26.8), a Canvas alone 36.2 (38.7), a Timeline 21.8 (23.4), a Map 11.8
  (18.5), a page of `<clover-root>` and `<clover-label>` 32.5 (32.9), all the web
  components 110.4 (113.5), `<clover-viewer>`'s entry 91.2 (94.4), one in Document 116.9
  (120.0). The budgets follow.

- **Gallery and Document load what starts hidden when it is first wanted (Mat,
  2026-10-27; `DRY.md`, B1, B2).**
  - Gallery's lightbox Body is a chunk of its own, loaded the first time the lightbox
    opens, or sooner, as the reader's pointer or focus first comes to the gallery. The
    dialog's title, Close and the pager are there at once, so it is named and takes focus
    as before; until the Body's code arrives, its box holds the Body's place, busy, with
    a Canvas's background (`clover-template-lightbox-pending`).
  - Document's information panel is a chunk of its own, loaded as the reader points at
    or focuses its toggle, or as it opens (`defaultPanelOpen`, or beside the page again).
    A first press waits for it, then opens the panel whole, so focus still goes to its
    section over the page. Until then its pane is empty, so a page's script or style that
    reaches into `.clover-panel` before the panel first opens finds nothing, and a
    server render with `defaultPanelOpen` draws the pane without its sections.

  Measured: the Gallery template's page 26.8 kB gzip (59.9), Document's 66.2 (72.3),
  `templates.css` +23 B. A `<clover-viewer>` in Document gains 114 B: its entry already
  holds the Panel, with the Default template, so the chunk saves it nothing. The budgets
  follow, that one's raised to 120.2 kB.

- **One rule for what floats over the page (Mat, 2026-10-27; `DRY.md`, Decision 7, A26,
  A29).** Default's panel and Document's panel and page thumbnails now behave alike where
  there is no room for them beside the page (a phone, a narrow column, a reader zoomed
  in):
  - They start closed there, whatever `defaultPanelOpen` or `defaultSidebarOpen` (the
    `panel-open` and `sidebar-open` attributes) say: open, they covered the Body the
    reader came for, with focus behind them (WCAG 2.4.11). Both props now say whether the
    pane starts open beside the page; `defaultPanelOpen` defaults to `true` in Default
    and `false` in Document, `defaultSidebarOpen` to `true`. A host that wants the panel
    in view on a phone can no longer open it on arrival; the reader opens it with its
    toggle.
  - Narrowing under an open one closes it, and focus in it, or on its toggle on the
    spine, follows the toggle to its new place; widening brings it back beside the page.
    Document's panel used to float over the page and take focus instead, and Default
    dropped focus that was on the panel's toggle as the toggle moved (WCAG 2.4.3).
  - Document's thumbnails over the page now behave as the panel does: opening them puts
    focus on the thumbnail of the page the reader is on, and Escape anywhere in the
    template puts them away (focus in them back to their toggle, focus elsewhere left
    where it is), as a press on the wash or a drag does. Before, Escape did nothing, and
    Tab could reach page controls hidden under them.
  - Document decides that its thumbnails float by its own width (under 40rem), as both
    templates decide for the panel, not the window's: in a narrow column of a wide page
    they now float too. Its stylesheet keys this on `data-narrow` on
    `.clover-template-document-panes` rather than `@media (max-width: 40rem)`, and their
    bar is left out while they float rather than hidden; a page that styled the narrow
    thumbnails under that media query needs the attribute instead. A server render no
    longer draws them open on a phone's first paint and closed on its hydration.
  - Document's drawers share `templates/shared/useDrawer.ts`; Default keeps the same rule
    in its own code, lighter so.

  Measured: the Default template's page 69.7 kB gzip (−44 B), Document's 72.3 (+82 B,
  the thumbnails' new Escape and focus, and focus kept on a toggle as it moves),
  `templates.css` −8 B, a `<clover-viewer>` 113.5 (−92 B), one in Document +94 B, and
  its own entry −28 B. The budgets follow.

- **The templates share their drawer, and place their spines by CSS (Mat, 2026-10-27;
  `DRY.md`, A27, A28, A30).**
  - Default's and Document's panel over the Body, the wash beside it and their
    reduced-motion rule are written once, in `styles.css` (`Default.css`), on classes both
    templates now set beside their own: `clover-template-panes` on the Split,
    `clover-template-drawer` on the panel's pane, `clover-template-scrim` on each wash.
    Document's copies left `templates.css`. A page's rules for the old selectors still
    apply as before; Document's washes now also go without their fade where the reader
    asks for reduced motion, as Default's did.
  - Each panel toggle's spine (`.clover-template-default-spine`,
    `.clover-template-document-spine`) is now a box of no width in the Split's row, right
    after its bar, which the toggle hangs from (`position: relative`, no inline `left`):
    centered on the bar, or for Document's thumbnails all over them but for its far
    rounded end, and on a phone at their edge (`--clover-template-sidebar-width`). It
    follows a dragged bar and right to left with nothing measured; Default measures only
    how far down its Body begins. A page that placed the spine itself needs updating.
  - `<clover-viewer>` draws its template directly, not through the Viewer's shell.

  Measured: the Default template's page 69.8 kB gzip (69.9), Document's 72.2 (72.5),
  `templates.css` 2.0 (2.1), `styles.css` 15.5 (+37 B), a `<clover-viewer>` 113.6 (113.7),
  one in Document 119.8 (120.0), and its own entry 94.5 (94.7). The budgets follow.

- **The parts' shared rules written once (Mat, 2026-10-27; `DRY.md`, A21 to A25).** The
  language codes of a Transcript's files and an annotation set's languages are drawn by
  one sheet, `ui/Codes.css`, on the classes they had (`clover-transcript-language`,
  `clover-annotations-language`), each part placing its row as before; Search's hidden
  status is one rule; an annotation set's language and a popover hidden by Escape until
  the reader comes back (a Tip's, an item's full title) are each decided in one place.
  Measured: the stylesheet 15.5 kB gzip (29 B less), the Default template's page 69.9
  (17 B less), Document's 72.5 (39 B less), the elements' pages 33 to 77 B less; a Canvas,
  Timeline or Scene alone 10 to 17 B more, which loads the Tip's shared code without
  Items'. Budgets follow. Nothing to do when upgrading: no class, rule or behavior a page
  reads changed.

- **A Root loads less of the core (Mat, 2026-10-27; `DRY.md`, A12 to A20).** The
  reader of a host's own annotations (`annotations` on `Root`, an AnnotationCollection
  or pages) now loads only for a Root given some, and the rest of a search with the first
  search; the Canvas's SVG reader and the elements' modules on demand load as every
  other part's do (`useLoaded`), so one that will not load no longer leaves an unhandled
  rejection; and the elements' root reads the active Canvas and builds the navigation
  with the React hooks' own code (`selectCanvas`, a lookup made once per Manifest where
  each read searched the Canvases; `navigationOf`). Measured: the Default template's
  page 69.9 kB gzip (70.0), Document's 72.5 (72.6), Gallery's 59.9 (60.1), a Map's 18.5,
  a `<clover-viewer>` 113.8 (114.2) and its own entry 94.7 (95.0), the elements' other
  pages 0.23 to 0.40 kB lighter. A `<clover-canvas>` that loads its own content is
  0.26 kB heavier (83.5 kB), as the annotations' reader it loads is now a chunk of its
  own; its budget rises to 83.8 kB, and the budgets that fell follow, each to its measured
  size and about 250 B more. Nothing to do when upgrading: `Navigation` is exported as
  before.

- **The player's tracks play from where they start (Mat, 2026-10-27; `DRY.md`, A11).**
  A press on a track in the player's list now plays from its start, as a press on any
  time Clover lists does (a Transcript's cue, an annotation's, a Range's), where it moved
  there and left a paused recording paused. Its time is written as theirs are
  (`CueTime`, `clover-cue-time` beside `clover-canvas-player-chapter-time`), in the
  player's muted white. The transport's and the animation bar's buttons are one
  component, named and keyed as before. HLS is now found by a playlist's MIME type in
  any case, and by a `.m3u8` path with a fragment after it.

- **Size budgets raised to what the package now loads (Mat, 2026-10-26).** Fifteen
  budgets in `build/size-budget.json`, each to its measured size and about 200 B more:
  among them a Canvas's first load to 39.2 kB, the Default template's page to 71.0 kB,
  the stylesheet to 15.9 kB, a `<clover-viewer>` to 114.6 kB and its own entry to
  96.1 kB. The growth is the features added since 2026-10-25 (Search's field, finding
  in a transcript, the catalog's search, About's head, shared times); a cleanup before
  the 4.x release is to win some back. Nothing to do when upgrading.
- **Annotations' hide toggle is at the end of its set's heading (Mat, 2026-10-26).** In
  `Annotations` and in a Canvas's annotations menu, the eye now follows the page's label
  (and any languages), at the header's end, in the DOM as on screen, so focus reaches the
  label's heading first. Pointed at or focused, it lights every entry of its set, as one
  is under the pointer. The menu's groups take `clover-annotations-set` too. Styles that
  placed `.clover-hide` first in `.clover-annotations-set-header` need updating.
- **Choosing a hidden annotation shows its page again (Mat, 2026-10-26).**
  `clover.selectAnnotation` (and so a press in `Annotations` or in a Canvas's menu)
  shows the set an annotation belongs to when it was hidden, the reader's or one that
  starts hidden (a still image's OCR); Search's hits stay the Panel's. A standalone
  `Canvas` does the same for its own pages, and tells a host that controls them through
  `onPageVisibilityChange`.
- **Pressing a time plays from it (Mat, 2026-10-26).** A Transcript cue, a Contents
  Range on the recording's time and a timed annotation (in `Annotations` and in a
  Canvas's menu or on its hotspot) now go to their time and start playing, where they
  only went there before. One on another Canvas is gone to, unplayed, as before; a
  recording still behind its placeholder opens there quietly; stepping through what a
  Transcript's find found moves without playing; and a selection made in code (a
  content state, a host's `selectAnnotation`) seeks without playing.
- **The wheel over an accordion's headings scrolls the page (Mat, 2026-10-26).** Over a
  `Sections` heading in an accordion, stuck at the container's foot or top, and across
  the container's gutters beside it (`clover-sections-reach`, as wide as
  `--clover-sections-gutter`, the Panel's gutter), the wheel scrolls what holds the
  sections, never the open section's content. A wheel over the content scrolls it as
  ever.
- **Times are one piece, on their words' first line (Mat, 2026-10-26).** A Transcript
  cue's time, an annotation's (in `Annotations` and in a Canvas's menu) and a Contents
  Range's on the recording's time are drawn alike (`clover-cue-time`, beside the part's
  own `clover-transcript-time`, `clover-annotations-time` or `clover-contents-time`, the
  words beside it `clover-cue-text`; a timed Range's button is `data-timed`, its label's
  `lang` on its text): at the smaller text
  size (`--clover-text-s`; a cue's was the page's), muted, in even figures, on the first
  baseline of its words. A cue's time now counts from the second it starts in, as the
  transport and annotations do (a cue at 12.7s reads 0:12, where it read 0:13). The
  unused `.clover-canvas-menu-time` rule is gone.
- **The Scene's rotate disc is simply lit (Mat, 2026-10-26).** One soft light from its
  upper left across the accent, a darker rim, a faint highlight and a cast shadow, in
  place of the flat tones, glint and ink outline.

- **The thumbnail and title are About's (Mat, 2026-10-26).** `About` opens with the
  resource's label as a heading at its `headingLevel` (`clover-about-label`), the
  Manifest's thumbnail floated at the end of its lines, small (a golden step under Items'
  thumbnails' height, `--clover-items-height` × 0.618, at its own shape up to twice as
  wide), the summary under them both (`clover-about-head`, `clover-about-thumbnail`).
  The thumbnail is decorative beside the label, and named by it where the label is left
  out. Two new props, `thumbnail` and `label` (the element's `thumbnail` and `label`
  attributes), leave either out. The Default template's header no longer has a
  thumbnail: it holds the title and the provider's logo, and
  `.clover-template-default-thumbnail` is gone. To keep a thumbnail in a header of your
  own, place `Clover.Thumbnail` there.

- **The templates' titles are set closer (Mat, 2026-10-26).** Default's, Document's and
  Gallery's titles take a line height of 1.25 rather than the page's, as a heading's
  lines are. A reader's own text spacing still wins. Set `line-height` on
  `.clover-template-default-title` (and its Document and Gallery twins) to change it.

- **`Split`'s bar shows as the pointer reaches it (Mat, 2026-10-26).** At rest, the line
  between the panes is hidden and its grip alone shows, in the muted primary
  (`--clover-color-primary-muted`), 6px wide and centered on the line. The line comes
  in, in the
  accent, as the pointer reaches anywhere in the area to grab (about 26px wide), while
  it is held, or with keyboard focus. In forced colors it always shows. The Default
  template centers the line and grip on the Body's edge, and ends its Items strip at
  the main pane's edge on the handle's side, its rings' room kept inside, so neither the
  strip nor its end shadow lies over the panel. Nothing to do; to keep the
  line at rest, give `.clover-split-handle` its background color back.

- **Search is one pill (Mat, 2026-10-26).** Its field and submit are one pill, as a
  search field often is: the query, then a round Search button in the accent, its name
  a tip, at the pill's end, the pill lifted by a soft gray shadow, and before it, while
  there is a query, Clear: round, named "Clear search" (a new string,
  `contentSearchClear`, in every locale), a tint of the accent under the pointer and
  pressed, focus going back to the field. The browser's own clear (×), which the
  keyboard cannot reach, is hidden. A new prop, `size` (`"large"`, the default, or
  `"small"`, a tad smaller for a narrow column; the element's `size` attribute too),
  sets the pill's size. Both corners follow
  `--clover-radius-pill`, the round controls'. The text button `button.clover-content-search-submit` is now round, so
  a stylesheet that styled it as a text button should be looked at; the form is wrapped
  in a new `clover-content-search-field`.
- **Fields' edges are lighter (Mat, 2026-10-26).** Search's query, the Collection's
  member menu and a transcript's track menu are edged in the muted text mixed 80% into
  the ground, as light as keeps 3:1 for any muted color that is itself 4.5:1, rather
  than the muted text itself. Set `--clover-field-edge` for your own, 3:1 or more.

- **A still Canvas's OCR starts hidden, and is not listed (Mat, 2026-10-26).** An
  annotation page whose annotations all are `supplementing` text on regions of a Canvas
  that does not play (a newspaper's OCR, line by line or word by word, as Cookbook
  recipe 0068 publishes it) is no longer drawn over the image to start: it is at the
  ready, and what shows is a search's hits (`highlighting`). Nor is it listed by
  `Annotations`, or counted for the Panel's Annotations section, which a resource with
  only OCR no longer has, nor offered by the Canvas's annotations menu, which leaves out
  a search's hits too (Search lists them); with nothing else to offer, the Canvas shows
  no menu control. `clover.setSetVisible(id, true)` draws it, and the menu then offers
  it to hide again. A standalone `Canvas` takes `unlistedPages`, the pages its menu never
  offers. A transcription of the whole page (as
  Northwestern's Maktaba publishes one, a `supplementing` annotation on the Canvas
  itself) is drawn and listed as ever. Captions and transcripts are unchanged: caption
  files (WebVTT) are never annotation sets, and a recording's `supplementing` text is
  drawn as before. `state.hiddenSets` still holds the sets switched off; those hidden to
  start are not in it, and a set switched on is in the new `state.shownSets`. To draw a
  page of OCR from the start:

  ```js
  clover.setSetVisible("https://example.org/page-1/ocr", true);
  ```

- **`Items`' `layout="carousel"` is now `layout="slider"` (Mat, 2026-10-25).** The
  scrolling row of thumbnails, still the default, is named a slider everywhere: the
  `layout` value, the Default template's `items`, the elements' `layout` and `items`
  attributes, and the `data-layout` your CSS selects. `"carousel"` is no longer read: TypeScript
  rejects it in React, and `<clover-viewer items="carousel">` shows the slider with a
  warning in the console. Rename it where you set it:

  ```diff
  - <Clover.Items layout="carousel" />
  + <Clover.Items layout="slider" />
  - <Viewer iiifContent={url} items="carousel" />
  + <Viewer iiifContent={url} items="slider" />
  - .clover-items[data-layout="carousel"] { … }
  + .clover-items[data-layout="slider"] { … }
  ```

- **A recording plays as a music app plays one (Mat, 2026-10-24: Apple Music's and
  Spotify's players).** A lone recording of sound (a Timeline, or a Canvas of sound
  alone) no longer draws its accompanying or placeholder image over the Body under the
  transport. It plays as a player: its artwork beside its title (its label) and what it
  is part of (`partOf`), on a ground of the artwork's own colors under a dark wash that
  keeps every word and control at AA; the transport under them, always shown, Play
  large and white; its captions and the annotations on its time as lyrics; and, where
  it is tall enough, its chapters listed as tracks, the one playing marked, a press
  going to it (the Chapters menu stays). Its artwork is its placeholder Canvas until it
  first plays, then its accompanying Canvas, each standing in for the other, else its
  thumbnail, at its own shape and asked of its image service as its `info.json` allows.
  It lays itself out for its Body: one row when short, the transport across it when
  taller, one centered block when large, the artwork over the rest when narrow. The
  renderer draws nothing for it, and the placeholder no longer holds it back: its image
  is the artwork until it plays. The figure carries `data-player`; the player's classes
  are `clover-canvas-player` and its `-ground`, `-art`, `-note`, `-head`, `-title`,
  `-part-of`, `-chapters` and `-chapter` (with `-number`, `-label`, `-time`);
  `.clover-canvas-sound-label` is drawn no longer for a lone recording. Its styles are in
  `styles.css` (1.5 kB gzip more), and the web components load them with the player's
  code, only for a recording. Budgets raised by 0.2 to 0.4 kB gzip for the rest: a
  Canvas or Timeline alone to 38.5, the Default, Document and Gallery templates to 68.8,
  71.3 and 59.8, `styles.css` to 14.4, and the web components' pages (`<clover-viewer>`
  111.1, its own entry 92.6, in Document 117.4, a `<clover-canvas>` alone 79.9, the four
  parts 95.5, a layout of containers 110.2). To keep the chapters to the menu:

  ```css
  .clover-canvas-player-chapters {
    display: none !important;
  }
  ```

- **A placeholder's still, and a video's poster, read their image service's `info.json`
  first (Mat, 2026-10-24),** as every other picture Clover asks for does: asked as it
  allows, never larger than the image, where they were asked for `!1280,1280` whatever
  the server said it could answer. The resolver loads with the first placeholder that
  needs one.

- **Document draws no border around itself (Mat, 2026-10-24).** Its root,
  `.clover-template-document`, had a 1px `--clover-color-secondary-muted` border and
  `--clover-radius` corners; it sits in its page as Default does. A page that wants the
  frame draws it:

  ```css
  .clover-template-document {
    border: 1px solid var(--clover-color-secondary-muted);
    border-radius: var(--clover-radius);
  }
  ```

- **Pictures are asked of image servers as their own `info.json` allows, never larger
  than the image (Mat, 2026-10-24).** Clover asked a service the manifest called level 1
  or 2 for a size at once (`!w,h`): Document's stills at 1600, thumbnails at 200,
  Annotations' regions at 52, the Map's overlay at 2048. A server that will not scale an
  image up left them blank (the University of Washington's answers 403 past 200%, and
  its manifests call a level 2 server level 1). Now every one reads the service's
  `info.json` first (cached, shared with the Canvas) and asks for no more than the image
  or region has (the whole image at its own size, `full` or `max`, where it would be
  larger), within `maxWidth`, `maxHeight` and `maxArea`, in the size form every level 1
  server answers (`w,` in 2.x, `w,h` in 3.0), at level 0 only a size it lists, and no
  region of a server that cannot cut one. The frames menu's and Annotations' pictures
  appear once `info.json` is read. So that a long strip does not read a thousand, Items'
  thumbnails read theirs as they come within half a screen (or half their slider or
  pane) of view, and Document's stills within a column's height. Budgets raised for it, by
  0.1 to 0.7 kB gzip: a Canvas alone to 38.2, the Default, Document and Gallery
  templates to 68.4, 70.9 and 59.4, and the web components' pages (`<clover-viewer>`
  110.8, its own entry 92.2, in Document 117.0, a `<clover-canvas>` alone 79.6, the four
  parts 95.2, a layout of containers 109.9).

  `thumbnailSource(resource)` and `stillSource(resource)` take no size, and a source
  with an image service no longer has a `src`; `regionSource(canvas, rect)` takes no
  size and returns such a source, not a URL. Size them with `resolveThumbnail`:

  ```tsx
  // Before
  const source = thumbnailSource(manifest, 200);
  const url = source?.src; // set at once for a level 1 or 2 service
  const region = regionSource(canvas, rect, 52);

  // Now
  const source = thumbnailSource(manifest);
  const url = source && (await resolveThumbnail(source, 200, request));
  const cut = regionSource(canvas, rect);
  const region = cut && (await resolveThumbnail(cut, 52, request));
  ```

- **Document's toolbar has more room above and below its controls (Mat, 2026-10-24):**
  `--clover-space-m`, was `--clover-space-s`.

- **Document's thumbnails' labels start at their pictures' edge (Mat, 2026-10-24),** as
  Items' own do, no longer centered. To center them again:

  ```css
  .clover-template-document-sidebar .clover-items-caption {
    text-align: center;
  }
  ```

- **Named for the components (Mat, 2026-10-23): the Body and its controls.** What was
  "the stage" is the Body, and what came and went over it, "the chrome", is the
  controls, in the CSS, the attributes and the templates' classes as in the docs. Rename
  what your CSS or scripts name:

  | Before                                                                                     | Now                                    |
  | ------------------------------------------------------------------------------------------ | -------------------------------------- |
  | `--clover-chrome-*` (`-shown`, `-events`, `-timing`, `-enter`, `-leave`, `-tuck`, `-edge`) | `--clover-controls-*`                  |
  | `--clover-canvas-chrome-inset`                                                             | `--clover-canvas-controls-inset`       |
  | `data-chrome="visible"` / `"hidden"`                                                       | `data-controls="visible"` / `"hidden"` |
  | `.clover-template-default-stage` (its `Body`)                                              | `.clover-template-default-body`        |
  | `.clover-template-default-body` (its `Split`)                                              | `.clover-template-default-panes`       |
  | `.clover-template-document-stage` (the pages' scrolling column)                            | `.clover-template-document-column`     |
  | `.clover-template-document-content` (its `Body`)                                           | `.clover-template-document-body`       |
  | `.clover-template-document-body` (its `Split`)                                             | `.clover-template-document-panes`      |
  | `.clover-template-lightbox-stage` (its `Body`)                                             | `.clover-template-lightbox-body`       |
  | `.clover-template-lightbox-body` (its dialog's content)                                    | `.clover-template-lightbox-content`    |

  Each template's `-body` class is now on its `Clover.Body` alone. The order matters
  where you rename by search: the old `-body` classes first, then `-stage` and
  `-content`.

  ```diff
  - .clover-template-default-stage { --clover-chrome-timing: 0s; }
  + .clover-template-default-body { --clover-controls-timing: 0s; }
  ```

- **Scenes are in the sequence.** `useSequence().canvases`, `Items` and the pager count a
  Manifest's Scenes with its Canvases and Timelines (before, they were left out); a part
  of your own that reads `canvases` meets `type: "Scene"`, which has no `width` or
  `height`. `Body`'s `data-renderer` is `canvas`, `timeline`, `scene` or `custom`.
- **The Presentation 4 types are `Presentation4Timeline` and `Presentation4Scene`**, as
  `Presentation4Canvas` is: `Timeline` and `Scene` are the parts now.

  ```diff
  - import type { Timeline } from "@nulib/clover";
  + import type { Presentation4Timeline } from "@nulib/clover";
  ```

- **`ControlButtons` takes `rotateUp` and `rotateDown`**, a Scene's.
- **Budgets for routing Timeline and Scene and their strings**: the templates' up front
  0.2–0.3 kB more (Default 67.4, Document 69.7, Gallery 59.0 kB), the Map's 0.1 (18.2, the
  strings every page carries), `styles.css` 12.1. The elements' pages 1.1–1.3 kB more, as
  the Body's code that Canvas and Scene share is a chunk of its own there:
  `<clover-viewer>` 108.5, labels alone 32.4, the four parts 94.0, a layout of the
  containers 107.7, `<clover-canvas>` alone 79.0, Document 114.6, the Viewer's own entry
  91.0 and the entry 5.5 kB. Scene's controls in their corner (the rotate pad and its
  disc, its two strings, zoom and full screen beside it) take Scene's up front to 15.7 kB, `styles.css` to 12.65, the four parts' page to 94.1 and a layout of the containers to
  107.8.

- **`Content` is `Body`** (Mat, 2026-10-22), ahead of the containers it will draw
  besides Canvas (Presentation 4's Scene and Timeline): `Clover.Body` and `<clover-body>`,
  its class `clover-body`, its height `--clover-body-height`, its renderers' types
  `BodyRenderer` and `BodyRendererProps`. What it does is unchanged; the Document page's budget
  goes up 0.1 kB (113.7), as the new name gzips 5 bytes larger there. Rename as you upgrade:

  ```diff
  - <Clover.Content style={{ "--clover-content-height": "24rem" }} />
  + <Clover.Body style={{ "--clover-body-height": "24rem" }} />
  ```

- **`.clover-link-format`**, the format after a link ("(application/pdf)"), is in
  `Primitives.css`, beside the links that write it, not `Panel.css`: it comes earlier in
  `styles.css`, which changes nothing it styles, and a page of elements' property parts
  no longer loads the panel's sheets for it.
- **Clover's English is in sentence case** (`DESIGN.md` §8), as its other names and
  menus already were, and its other languages: "More information"
  (`informationPanelToggle`), "View all" (`commonViewAll`), "No results"
  (`contentSearchResultsNone`), "Show items" (`templateSidebarToggle`) and "Hide
  annotations" (`annotationsHide`). A test or script that finds one of these by its
  words needs the new ones. Strings you give `initCloverI18n` keep theirs.

  ```diff
  - screen.getByRole("button", { name: "More Information" });
  + screen.getByRole("button", { name: "More information" });
  ```

- **`@nulib/clover/web-components` loads only the elements a page uses.** The script is
  5.3 kB gzip and defines every element; an element's code, Preact (in one chunk with
  Clover's core) and its sheets load the first time one is on the page. A page with a
  `<clover-viewer>` loads 107.5 kB, up from 86.7 kB: its code now comes in chunks the
  other elements share, 39 files gzipped apart. In Document it loads 113.6 kB, the
  template and its styles with it. A page of `<clover-root>` and `<clover-label>` loads
  31.2 kB, with only the light parts' sheets; of the root, the label, the Body and the
  items 92.9 kB; a layout of the containers, as `Default`'s, 106.6 kB; and a
  `<clover-canvas>` alone, once it draws, 76.7 kB. The adapters for a page's own renderers and control
  buttons load only on a page that gives them. `sizes.json` records each
  (`elementsEntryGzip`, `webComponentsGzip`, `documentElementGzip`, `labelPageGzip`,
  `composedPageGzip`, `layoutPageGzip`, `canvasElementGzip`), held to budgets of 5.4,
  107.5, 113.7, 32.1, 93.0, 106.7 and 77.7 kB. `Root` now shares what it holds with
  `<clover-root>`, `SplitHandle` its logic with `<clover-split-handle>`
  (`components/Split/splitting.ts`), and `ReadMore` and `useOneOpen` theirs with the
  elements (`useReadMore`, `openOne`), which put `Default`'s budget up to 67.1 kB,
  `Document`'s to 69.4 kB, `Gallery`'s to 58.7 kB and a Canvas's to 38.1 kB, under 0.1
  kB each.
- **`<clover-viewer>`'s events are named `clover-` and what happened**, as every
  element's are, and bubble out of a shadow root too (`composed`). It also sends
  `clover-status-change`.

  ```diff
  - viewer.addEventListener("canvaschange", show);
  + viewer.addEventListener("clover-canvas-change", show);
  ```

  `manifestchange` is `clover-manifest-change`, and `contentstatechange`
  `clover-content-state-change`.

- **`defineCloverViewer` is gone:** `defineCloverElements` defines every element, and the
  module calls it on import. **`initCloverI18n`** from the module now returns a promise:
  it loads Clover's translator the first time it is called.
- **`<clover-viewer>` is drawn by the page's one host**, as the other elements are: its
  ids start `clover-<n>-` (they were `clover-viewer-<n>-`).

- **`Clover.Download` is its links, not a button that opens them.** Wherever it is, it
  shows "This page" and "All pages", each with its links, as About's section always has;
  `Document`'s toolbar lays them in a row. Its `children`, the button's text, is gone,
  and so are `.clover-download-button` and `.clover-download-panel`, with the
  `data-open` and `data-align` on `.clover-download`. Drop the `children`, and restyle
  the groups (`.clover-download-groups`, `-group`, `-title`, `-list`, `-link`) instead.

  ```diff
  - <Clover.Download>Download the text</Clover.Download>
  + <Clover.Download />
  ```

- **The web components' chunks are stripped of their whitespace.** Vite leaves an ES
  library's whitespace in, for a bundler to read its annotations; the elements are
  loaded as built, so it goes: 16.6 kB gzip on a `<clover-viewer>` page. The parts' ids
  (see `useUniqueId`) put `Default`'s budget up to 66.7 kB and `Gallery`'s to 58.5 kB.

- **No heading past `h6`: a title that would be an `h7` names what it heads instead.**
  Every part capped its headings at 6, so under a page's `h3` or deeper a template's
  deepest titles were drawn as `h6`, siblings of the heading they belong under: in
  `Document` at `headingLevel={4}`, About's Download was an `h6` and its "This page"
  another (WCAG 1.3.1). An `aria-level` past 6 is no answer, since JAWS, and TalkBack
  with Chrome, announce it as level 2. Now a title past 6 is a `p` (the accordion's, a
  `div`), drawn as before, and the group it heads takes its name from it: About's and
  Collection's sections, and a template's Root, become `role="group"`, named by their
  title; a section already named by its title (Download's, Search's and Annotations'
  groups, Items' list, the accordion's panels, the lightbox) keeps that name. Markdown's
  headings past 6 are bold paragraphs that name the group of what follows them. Every
  `headingLevel` now takes any level, `2` and up (`heading-level` on
  `<clover-viewer>` too), so under your own `h6` pass `7`:

  ```jsx
  <h6>Plates</h6>
  <Clover.Annotations headingLevel={7} />
  ```

  If you style Clover's titles by tag (`h6`), style them by class.

- **`Annotations` lists every annotation by default.** Its `scope` defaults to `"all"`:
  every Canvas's annotations, by layer and then by Canvas, as the Viewer's panel lists
  them, wherever the part is placed. It was `"view"`, so `Annotations` placed on its own
  showed only the view's, and nothing on a view without any. To keep the view's alone:

  ```jsx
  <Clover.Annotations scope="view" />
  ```

  The `Panel` no longer passes `scope` itself; its Annotations section is unchanged.

- **A summary is no longer muted.** `Gallery`'s summary and the summary under each of
  Items' members were drawn in `--clover-color-primary-muted`; they are now in the text's
  own color (`--clover-color-primary`, or what they inherit), as `Clover.Summary` always
  was, since a summary is the resource's own words, not a caption. To mute them again:

  ```css
  .clover-template-gallery-summary,
  .clover-items-summary {
    color: var(--clover-color-primary-muted);
  }
  ```

- **Long annotation lists render lazily.** Each entry of `Annotations`
  (`.clover-annotations-entry`, in the list and in the menu) now has
  `content-visibility: auto`, so a list of hundreds (a page's lines of OCR) lays out and
  paints only the entries near view. Every entry stays in the page, for find-in-page and
  assistive technology, and keeps its place (`contain-intrinsic-size: auto 2.618rem`).
  Nothing to do; a style of yours that draws outside an entry's box (a shadow on its
  children) is now clipped to it, so draw it on the entry itself.

### Fixed

- **A paged Collection or AnnotationCollection whose `next` leads back is read once
  (Mat, 2026-10-27; `DRY.md`, A16).** A Collection's pages, and an AnnotationCollection's
  (or a page's `next`), are followed until one comes again, as Content Search's results
  already were: a loop listed a Collection's members again, up to 50 pages of them, and
  an AnnotationCollection's annotations up to 100 times.
- **A Canvas in a Root is never an empty box while it loads (Mat, 2026-10-27; `DRY.md`,
  A4).** A `Canvas` placed in a `Root` (not through `Body`) now shows its box busy, with
  the loading mark, while its part for the Root loads, as `Timeline`, `Scene` and a
  Canvas loading its own do; it showed nothing. And while a Canvas loads, its loading mark
  comes before its caption, so the `<figcaption>` is last in its `<figure>` again.
- **A Canvas or Timeline loading its own plays as a Root's does (Mat, 2026-10-27).** Given
  `iiifContent`, it now plays with the chapters its Manifest's Ranges give what it plays
  (marked on the seek bar, in the Chapters menu, and listed by the player), and a content
  state's region or time opens it there, past its placeholder; before, both were read
  only inside a `Root`. A deep link's time into a recording with nothing to draw (a
  Timeline of sound alone) now applies in a `Root` too: it waited for the Canvas to be
  laid out, which such a recording never is. The two share one module,
  `components/Canvas/fromManifest.ts`.

- **Document lists its downloads once (Mat, 2026-10-27).** Its toolbar has Download, and
  its panel's About listed them again. The About of Document's panel now lists none, and
  `download={false}` (`<clover-viewer download="false">`) leaves the toolbar's out, as
  the attribute's description now says.

- **A panel asked to start open on a narrow layout no longer takes focus (Mat,
  2026-10-27).** On a layout too narrow for the panel beside the page, `defaultPanelOpen`
  (the `panel-open` attribute) slid the panel open and moved focus into it as the page
  loaded, in Default and Document alike (WCAG 2.4.3). Default then closed it, as if the
  layout had narrowed, leaving focus on the hidden panel. The first measure of the
  layout's width is now arrival, never a narrowing or an opening, and the panel starts
  closed there (see "One rule for what floats over the page", under Changed). A panel the
  reader opens takes focus as before.

- **Full screen looks the same in the transport as in the controls (Mat, 2026-10-27).**
  The media transport drew its own exit-full-screen glyph, a different one from the
  controls' over a Canvas or a Scene. It now draws the controls' glyphs, to enter and to
  exit (WCAG 3.2.4).

- **An annotation is named alike wherever it shows (Mat, 2026-10-27).** Its hotspot and
  the Canvas's menu took the first text body in each language and read HTML with
  `DOMParser`; the Annotations list took the last and read HTML with `toPlainText`. Both
  now use `annotationName` (`core/annotation-name.ts`): the first body in each
  language, HTML read as `toPlainText` reads it, Markdown without its syntax, an image's
  label where it has no text (WCAG 3.2.4). The list's button still cuts its name to 120
  characters, the full text beside it. A hotspot's name may change where an annotation
  had several bodies in one language, or HTML with named entities other than `&amp;`,
  `&lt;`, `&gt;`, `&quot;`, `&apos;` and `&nbsp;`.

- **Small reading fixes (Mat, 2026-10-27).** A Manifest whose `partOf` is one Collection
  rather than a list of them threw in the Panel and `Collection`; it is now read as its
  Collection. A caption file whose `language` is `null` is read as in no language. A map
  feature's title is plain text with its entities decoded, so "Smith &amp; Co" reads
  "Smith & Co".

- **The Transcript's find field reads as Search's does (Mat, 2026-10-26).** Its
  placeholder was the browser's own, which Safari draws in a pale gray and Firefox at half
  opacity, under 4.5:1 (WCAG 1.4.3). Its typed words were the browser's field text, not
  the theme's, so on a dark theme they could all but vanish. The fields' rules
  (`styles/scale.css`) keyed on Search's query alone, `.clover-content-search-query`; they
  now key on `.clover-field-pill-query`, which every field pill's query carries, Search's
  and the Transcript's alike. The placeholder is the theme's text mixed into its ground
  at full opacity (5.3:1 on white, 7.4:1 on a dark theme), and the words are
  `--clover-color-primary`. Search's field looks as it did. A page that styled the
  placeholder through `.clover-content-search-query` still can: Search's query keeps that
  class. The rules no longer name `.clover-transcript-track select`, which nothing has
  drawn since the Transcript's track menu became its language codes.

- **A label with a character reference outside Unicode no longer breaks the part (Mat,
  2026-10-26).** `toPlainText` decoded any numeric reference, and
  `String.fromCodePoint` throws past U+10FFFF, so a label holding `&#x110000;` threw as
  `Label`, `Thumbnail`'s alt, a link part's words (`Homepage`, `SeeAlso`, `Rendering`…),
  `Provider` or the Annotations list rendered it. A reference outside Unicode (`&#0;`, `&#x110000;`) now stays as written,
  as a caption's already did.

- **A logo that fails to load draws nothing (Mat, 2026-10-25).** `Logo` drew the
  browser's broken picture, its alt text in it, when its image did not load, as on
  Maktaba's manuscript, whose provider's logo its host refuses (HTTP 403). Inside a
  `Provider` that drew only the logo (`<Provider><Logo /></Provider>`, the Default and
  Document templates' title line), that broken picture was the provider's link. A logo
  that fails now draws nothing, as one the resource does not give. A provider left with
  nothing to show draws nothing either, so no empty link is left as a tab stop with no
  name (WCAG 2.4.4, 4.1.2), and a `Provider` left with none is hidden
  (`.clover-provider:empty`). Beside the provider's name (`Provider` as it comes, About),
  the name stays, linked. A logo that failed before Clover could listen, on a page drawn
  on the server, is caught as it mounts. `<clover-logo>` and `<clover-provider>` do the
  same, and an `onError` given to `Logo` is still called. It adds about 0.25 kB gzip
  wherever `Provider` is, so budgets are raised for it: Default's page to 69.2 kB,
  Document's to 71.7, a layout of the containers to 110.8, a `<clover-viewer>` page to
  111.6 (its own entry 93.0), and `<clover-viewer template="document">` to 118.0.

- **A Canvas's open popups are over its play button (Mat, 2026-10-25).** On video or
  sound waiting behind its placeholder, the large play button in the middle sat on the
  controls' layer, over the Canvas's popups, so an annotations menu or the information
  open over the middle of a small Canvas had the button on top of its words. The button
  now sits between the still and the popups. The layers, for a page that stacks its own
  over them: the scrim and the still are at 0 (were 1), the play button at 1 (was 3),
  the popups at 2 and the controls at 3, as before.

- **Document's thumbnails no longer move as their pictures arrive (Mat, 2026-10-24).** A
  picture waiting for its image was a sliver one control tall (`--clover-space-xl`), and
  grew to the sidebar's width as its image came in, so the thumbnails below it moved, and
  a press could start on one and end on another, choosing neither. Each is now its
  Canvas's shape at the sidebar's width, waiting or loaded, its image contained in it.
  Items keeps `--clover-items-ratio` on a loaded picture whose resource has a size, for a
  layout that holds to it.

- **Two copies of Clover on one page keep their ids apart.** A page with React's Clover
  and the elements', or with both of the elements' entries (`@nulib/clover/web-components`
  and `/web-components/viewer`), has two copies, and three of Clover's counts started
  again in each: the elements' (`clover-1-…`), a Canvas's for its controls
  (`zoomIn-clover-canvas-1`) and Markdown's for its groups past h6 (`clover-md-1`). A
  control or a description could name the other copy's element (WCAG 4.1.2). Every copy
  of the elements counts the page's elements together now; a Canvas's controls take
  their ids from `useUniqueId`, as every other part's do, so they carry an element's
  prefix; and Markdown's groups are counted on the page. The second copy of the elements
  says in the console that Clover is loaded twice: load one entry, as each keeps its own
  language and popups. A Canvas's control ids change shape with it
  (`zoomIn-clover-canvas-` and an id of React's): find a control by its `data-button`,
  or give the Canvas an `instanceId` for ids of your own. React's pages are a few bytes
  smaller; a page of elements loads under 0.1 kB more.
- **`<clover-split-handle>` says where its bar is from the start.** Drawn before the
  pane it sizes was marked (each element draws in its own order), it measured nothing
  and had no `aria-valuenow` until the reader moved it (WCAG 4.1.2). It measures again
  when a pane in its split is marked.
- **The information panel's landmark is named "Information panel"**
  (`informationPanelTabs`, as its tabs are), so a list of landmarks tells it from
  another, as the Document template's thumbnails ("Items"). An `aria-label` or
  `aria-labelledby` you give `Panel` names it instead; rendered `as` an element that is
  no landmark (a `div`), it takes no name. It adds under 0.1 kB to a page with a panel.

- **An element the page hides stays hidden.** The elements' display rules (a root or
  `<clover-items>` a block, `<clover-label>` no box of its own) are author styles, which
  beat the browser's own `[hidden] { display: none }`, so `<clover-items hidden>` showed.
  Each rule now leaves a `hidden` element alone.
- **`<clover-viewer manifest-id>` lets the reader move through the Collection.** It set
  `manifestId`, which leaves every choice of member to the page, and a page that did not
  answer `manifestchange` left the reader on that member, the choice doing nothing. It is
  `defaultManifestId` now: where the Viewer opens.
- **`import "@nulib/clover/web-components"` defines `<clover-viewer>` in any bundler.**
  The package's `sideEffects` named only its CSS, so a bundler could drop an import made
  for its effect, and esbuild did. It names `dist/web-components/**` too.
- **Two `<clover-viewer>`s on one page make ids of their own.** Preact, which draws the
  element, starts `useId` again in each root, so the second viewer's labels,
  `aria-controls` and `for` named the first's controls (WCAG 1.3.1, 4.1.2). Each element
  now prefixes its ids with its own number.
- **`<clover-viewer>` takes an `iiifContent` set before it is defined.** Its script loads
  async, so a page could set the property first, and the value hid the element's own.
- **`<clover-viewer>` reads `"false"` in any case, and checks `items`.** `FALSE` or
  `" false "` turns a part off. An `items` that is not `slider`, `list`, `grid` or
  `false` shows the slider, with a warning in the console, rather than passing on.
- **Clover's elements never mark their words `lang=""`.** Where Clover drops a `lang`
  after the language changes, React removes the attribute but Preact empties it, and
  `lang=""` says the language is unknown (WCAG 3.1.2). The page's host removes it
  wherever it draws, never from the page's own markup.

- **The Lightbox's title keeps its look at any level.** It was styled by tag
  (`.clover-template-lightbox-header :is(h2, h3, h4, h5, h6)`); it is now
  `.clover-template-lightbox-title`, bold as its heading was, and so is Gallery's title
  (`.clover-template-gallery-title`). A copied template takes the class on its
  `Clover.Label`.

- **An annotation's thumbnail no longer asks for more pixels than its region has.** The
  small picture of each entry's region (`Annotations`) was asked for at `!52,52`, which
  an Image API 3 server refuses for a region smaller than that, since it would have to
  scale up (Northwestern's answers 400), so the entry showed none. It is now asked for
  at no more than the region's own size on either side. Nothing to do.
- **The Annotations list stays where it is while it is hidden or in use.** It brings the
  Canvases in view to the top of the box it scrolls in, and one picked on the Canvas into
  view. It did so in a closed accordion section, where it measures as nothing and threw
  its pane about, and with focus elsewhere in its box, such as on a panel's tabs, which
  it pushed out of sight (WCAG 2.4.11). It now leaves the list still when it is not
  shown, when the pointer or focus is anywhere in its box, and, for a Manifest of one
  Canvas, always: there is no group to bring up, only the layer's title to hide.
  Nothing to do.

- **`Transcript` follows the playing cue within its own box, never the page.** With
  `follow` on, it brought the cue into view with `scrollIntoView`, which scrolls every
  scrolling box around it, the page too: a reader who had scrolled away while a recording
  played was pulled back to the Transcript at each cue. It now scrolls only the box the
  Transcript scrolls in, as `Annotations` does; with none (a Transcript in the page's
  flow), the page is left where the reader put it. Nothing to do.

- **Clover's own links read as links under a page's reset.** `Homepage`, `Rendering`,
  `SeeAlso` and `PartOf` (their lists' links), `Id` and `Rights` now underline their links
  in `--clover-color-accent-text`, and an address with nowhere to break wraps. A reset
  such as Tailwind's took the browser's underline and color away, so on their own they
  read as plain text (WCAG 1.4.1), and a long address pushed the page sideways (1.4.10).
  Nothing to do; a link style of your own still wins over Clover's layer.

- **A press beside a floating panel hands focus back to its toggle.** In `Default` on a
  narrow screen, and in `Document`, closing the information panel (or Document's page
  thumbnails) by a press on the page beside it left focus on the page itself, since the
  press moved it there before the panel went. The scrim now takes no focus, so focus in
  the panel goes to its toggle, as the close button and Escape already did (WCAG 2.4.3).
  Nothing to do; a copied template takes the fix by adding
  `onMouseDown={(event) => event.preventDefault()}` to its scrim and closing through the
  same hand-back as its close button.

- **`Download` keeps its own key handling when you pass `onKeyDown`.** Your handler
  replaced the one that closes its list on Escape and hands focus back to its button. Both
  now run, yours first. Nothing to change.
- **The Panel's tabs are named for what they are.** Its row of tabs was named
  "Select" (copied from 3.x), which said nothing of what it holds (WCAG 2.4.6). It is now "Information panel", as the panel's
  close button names it, in every language Clover ships ("Panel de información",
  "Panneau d’informations"…). A screen reader landing on the first tab says "About,
  selected, tab, 1 of 4, Information panel, tab group". If you override the
  `informationPanelTabs` string in `initCloverI18n`'s `resources`, your words still win:
  check they name the panel, not an action.
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
  Chapters menu is as wide as the Captions menu with its codes (16rem, within the Body),
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
    to a mouse and a pen that hovers. If you relied on the controls fading by themselves
    under touch, they no longer do.
  - A press where faded controls sit only shows them: neither the press nor its click
    reaches the picture or a hotspot beneath.
  - Focus that no press brought (the keyboard's, a screen reader's) shows the controls
    and holds them until focus leaves.
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

  - The information box and the Canvas's menus sit below every row of the controls,
    however the controls wrap. In a Body too short to leave them room to read there
    (under about 7rem), and with room beside the controls, they sit beside them from
    the top instead, with no minimum width: the Canvas says so with
    `data-popups="beside"`. The Canvas writes `--clover-canvas-controls-width` and
    `--clover-canvas-controls-height` inline on `.clover-canvas` for them. The controls'
    own box takes no presses; only the controls do.
  - **The controls in a narrow Body** (a phone) are rows, never a column: the row at
    the top end wraps onto more rows below, each at the end, read and reached in the
    order they show. A column used to wrap onto more columns in a short Body, out of
    order, with the panel's toggle among them. The panel's toggle now keeps the top
    right corner at every size, out of the row (pinned to the cluster's top end, the
    room for it kept), with a placeholder's toggle beside it. A stylesheet that relied
    on the column (below 575px wide) or on the toggle's `order` no longer applies.
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
    inside the Body, over the hotspot where neither side has room. Move your rules:

    ```css
    /* before */ .clover-canvas-annotation label { … }
    /* after  */ .clover-canvas-annotation > .clover-tip { … }
    ```

  - A hotspot's note taller than the Body is capped inside it and scrolls: by wheel or
    touch over it, and by the arrows, the page keys, Home and End from its hotspot. Where
    `scrollToZoom` is on, the wheel over a note that can scroll scrolls it rather than
    zooming. The gap between hotspot and note is now a clear `--clover-space-xs` border
    of the note's own (`background-clip: padding-box`), so the pointer still crosses
    onto it; the hotspot's `.clover-tip::before` bridge is gone. The note has
    `tabindex="-1"`, and a press on it focuses its hotspot: hidden
    from assistive technology, it never takes focus. `Clover.Tip` takes the same as
    `scrolls` for a popover of your own that may outgrow its room; give it a
    `max-height` and `overflow-y: auto`.

  - Hotspots are outlined in two tones, `--clover-color-primary` around
    `--clover-color-secondary`. Hovered, focused or picked, an accent band runs between
    them; nothing covers what it marks, and the picture around a rectangle dims a little
    (as 3.x's did, more lightly). Another hotspot beneath it shows none of its lines where the active one
    lies (its rectangle, or its shape's own outline), as a vector editor hides what a
    shape covers; those inside it and over it stay whole. It is a `mask-image` from
    `--clover-annotation-mask`, set inline on the hotspots beneath; a rule of yours that
    sets `mask` on `.clover-canvas-annotation` replaces it. In forced colors a rectangle has a
    `CanvasText` edge around a `Canvas` line, and an active one a `Highlight` ring.
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
    as a video's transport does: it fades with the rest of the controls, and its menu
    fits the Body.
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
  - The Captions button describes the track in use, and in forced colors shows
    Highlight while captions are on.
  - Captions on, or Repeat pressed, draws a bar under the button's glyph (an `::after`
    border), in forced colors too. The transport's buttons take the accent fill under
    the pointer or on focus only, as Clover's other round controls do: no longer while
    captions are on, Repeat is pressed or their menu is open. A stylesheet that relied
    on that fill should mark `[data-active]`, `[aria-pressed="true"]` or
    `[aria-expanded="true"]` itself.
  - The Captions menu leads each track with the code of its cues' language ("EN",
    "IT"), in a column of its own (`.clover-canvas-transport-code`), so a reader who
    cannot read a track's name can still tell its language; the menu is a little wider
    with them (16rem).
  - The transport bar wraps rather than running off a narrow Body. In a Body under 28rem
    wide (37.5rem with chapters), the time and chapter take a row above the buttons.
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
    sized to the Body. The Captions and Chapters menus place themselves when they open
    and on resize: no taller than the room above their button, no wider than the Body,
    and moved along to stay inside the bar's inset. They write
    `--clover-transport-menu-above` and `--clover-transport-menu-shift` inline. In a
    Body too short to clear the transport, the information box and the Canvas's menus
    may cover it.
  - The volume slider no longer hides below a 575px window. It narrows in a narrow
    Body, and is left out only where a page cannot set the volume (iOS).
  - The player stays mounted from one recording to the next (auto-advance), so focus
    stays on the transport. If the focused control goes with the recording
    (Captions, Chapters, Full screen), Play/Pause takes focus.
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
  - In forced colors the seek and volume sliders draw in system colors: a `CanvasText`
    rail and thumb, the played part in `Highlight`, and an outline on focus. The
    transport's buttons keep a 1px `ButtonText` border.

- **Previous and Next.** `Previous`, `Next` and Items' slider arrows keep keyboard focus
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
    each), so a focused item differs from a selected one by more than color. It is a
    `CanvasText` outline in forced colors. Clover draws it on
    `.clover-items-pictures::after`; leave that pseudo-element to Clover.
  - On Enter and Space, `onSelect` gets the key's own event, as a click passes its own.
    `preventDefault()`, `stopPropagation()` and a `defaultPrevented` guard now work for
    keys as for clicks; before, a stand-in object threw on `preventDefault()`. Clover
    still keeps Space from scrolling the page.
  - Entering a nested Collection keeps focus in the list, on the new list's selected
    member or else its first.
  - A slider's or grid's title cut short at three lines shows in full while its item is
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
  - In forced colors the current row (an annotation, a Range, a cue, a search hit, a
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
    colors. If you restyle `.clover-content-search-hit mark`, keep a sign besides
    color.
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
    `size` to its widest, and around again. A press is a click until it moves 4px (8px
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
  - In forced colors the bar and grip are `CanvasText`, and `Highlight` while hovered,
    held or focused. Focus adds a 2px outline.

- **Popovers.**
  - A `Tip` dismissed with Escape fades (`opacity: 0`) and takes no pointer, so a click
    where it was reaches what it covered. It shows again when the pointer next enters
    its control, or when focus leaves and comes back.
  - Each time a Tip shows, it is measured against what clips it (the Body, a scrolling
    panel, the window). One that would pass an edge wraps to the room there is and
    moves in, `xs` clear. `.clover-tip` is now `width: max-content` and wraps, and sets
    `transform: translateX(var(--clover-tip-shift, 0px))`; Clover writes
    `--clover-tip-room` and `--clover-tip-shift` inline. Give your own offset with
    `translate`, not `transform`, and drop any reliance on `white-space: nowrap`.
- **Text.**
  - Links in IIIF text are underlined, not only colored. To opt out, set your own
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
  - Clover sanitizes with a private DOMPurify instance, so your page's own
    `DOMPurify.sanitize` no longer drops relative `href` and `src` once Clover has run.

- **Headings.**
  - `headingLevel` (2 and up) fits Clover's headings into your page's outline. `Default`,
    `Document` and `Gallery`, and so the Viewer, take it for the title (default 2), and
    the headings inside sit a level below: the panel's sections, Document's Download
    groups, Gallery's lightbox title. `<clover-viewer>` takes `heading-level`.
    Standalone `Clover.Items` takes it for its title (default 2),
    `Clover.Panel` for its accordion headings (default 3), `Clover.Download`
    for its groups (default 3) and `Clover.Value` for a Markdown value's first heading
    (default 3). Under a heading of your own, pass the level below it:

    ```jsx
    <h3>Opening at a place</h3>
    <Viewer iiifContent={url} headingLevel={4} />
    ```

  - `Default` with `header={false}` has no title, so its panel's sections take the
    title's level: `h2` by default, where they were `h3`. Pass `headingLevel={3}` to keep
    `h3`.
  - Select these headings by class, not tag (`.clover-template-default-title`,
    `.clover-items-title`, `.clover-template-lightbox-title`), so a rule holds at any
    level, and past `h6`, where a title is no heading at all.

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
