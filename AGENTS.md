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
- The documentation site is Next.js 16 (App Router) with Nextra 4 (see "Nextra 4" below):
  its pages are MDX in `content/`, ordered by `_meta.ts` files; its frame is `app/`
  (`layout.tsx`, the page route `[[...mdxPath]]/page.tsx`, `not-found.tsx`); and its
  components, helpers and styles are in `docs/`. `pages/` holds only the dev-only API
  routes (`pages/api/`).
  - The docs lead with Clover 4, `@nulib/clover` (`packages/clover`): its pages are
    `content/docs/*` (URLs `/docs/…`), and the homepage shows it. Clover 3.x,
    `@samvera/clover-iiif`, is kept at `content/docs/3.x/` (URLs `/docs/3.x/…`), one
    sidebar group titled "Clover 3.x", collapsed, under "Earlier versions" at the bottom.
    Its page titles end in "(3.x)" so search results tell the two apart.
  - The 3.x pages are for reference, never the standard (Mat, 2026-10-20). They document
    an earlier version: never take their API, behavior, wording or patterns as how
    Clover 4 works or should work. The package's source, its tests, its own AGENTS.md
    and DESIGN.md, and the 4.x pages are the authority. Every 3.x page says so to
    readers, search engines and agents: a notice opening the page and a "(3.x)" title,
    a description saying what it documents, schema.org data (`version: "3.x"`,
    `creativeWorkStatus: "Superseded"`), and in the site's search a "(3.x)" title, a
    `version` filter and half the weight of Clover 4's pages (`app/[[...mdxPath]]/page.tsx`,
    `docs/lib/site.ts`). `llms.txt` (`docs/lib/agents.ts`) tells agents the same. A new 3.x page gets all
    of it from its place under `content/docs/3.x/`.
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
    that as `DOCS_BASE_PATH` (`next.config.mjs`) and `NEXT_PUBLIC_SITE_URL` (canonical
    links, `docs/lib/site.ts`). Without them, a build is for `nulib-ds.github.io/clover`.
  - The site is a static export, so there are no server redirects. URLs that moved
    (3.x pages from `/docs/…`, 4.x pages from `/docs/4.x/…`, the demo, the Panel's page)
    are sent on by the 404 page (`app/not-found.tsx`, exported as `404.html`, which Pages
    serves for any missing path), from the table in `docs/components/Moved.tsx`, query
    and hash kept. Move a page
    again, and add its old URL there. A 3.x page whose name 4.x now uses (`viewer`,
    `map`) shows the 4.x page, which links to its 3.x version.
  - How to compose a layout (`Root`, the parts, the property parts, the information
    panel's `Tab`s, `Split`, hooks, renderers, styles) lives on one page,
    `content/docs/composing.mdx` ("Composing Layouts", under Templates). The Viewer page
    covers what the Viewer handles and links there; add composition material there, not
    to the Viewer page.
  - Every part the homepage shows has a page under "Components" (Mat, 2026-10-20):
    Content, Canvas, Items, Panel, the Panel's sections (Annotations, Collection with
    CollectionSelect, Contents, Search, Transcript), Download and Map, then Primitives
    (`content/docs/primitives/`, an overview and a page per property part: Label,
    Thumbnail, Summary, Metadata, RequiredStatement, Rights, Homepage, SeeAlso,
    Rendering, PartOf, Id, Value). Each reads as Radix Themes' component pages do (Mat,
    2026-10-21): a lede (`docs-lede`), one example at the top, "API Reference" (what it
    reads and renders, then one table per component, Prop, Type, Default and Description,
    from the source), "Examples" (an `###` each: one sentence and an `<Example>`, the demo
    with its code attached, `ViewerDocs.tsx`), and "Previous versions" where 3.x had it:
    a link and a few words of direction, never a mapping of the differences. No other
    tables, and no table of contents (`reference()` in `content/docs/_meta.ts`), so the
    examples have the width. Live examples are
    `<PartDemo part="…" />` (`docs/components/Clover4/PartDemo.tsx`): the part named, its
    props plain values, in a `Root` over a mock (`resource`), with a `Content` above it
    (`content`) where it follows the view; several parts in the one `Root` (`parts`, on
    a line with `row`); a tall part in a box that scrolls (`box`), as the templates
    scroll the Panel, the box in the example's code too. The homepage's tiles link to these pages
    (`DOCS` in `docs/components/Home/PartsLive.tsx`); a new part gets a page and a link.
    `content/docs/panel.mdx` holds the Panel's layouts and keys, its default sections
    and when each shows, `Tab`s, headings, showing and closing it, the open section, its
    props (and `Tab`'s, `PanelToggle`'s, `About`'s), and 3.x's
    `options.informationPanel`; Composing keeps a short section with the `Tab` example
    and links there. Its demos are each in a 24rem box (`box`), so the page stays
    scannable (the catalog's About is long), each `headingLevel` one
    below the heading it sits under. `canvas.mdx` says when to place `Content` rather
    than `Canvas`.
  - Use Clover: Get Started (`/docs`, which holds the web component, `<clover-viewer>`,
    in its own section), Viewer (`/docs/viewer`, the templates on it: their old page,
    `/docs/viewer/templates`, forwards to `#templates`), Composing Layouts, Cookbook
    Recipes.
  - The Viewer page reads as Radix Themes' component pages do (Mat, 2026-10-21): the
    title and a lede (`docs-lede`), one example at the top (the template, switched
    by a large segmented control, its code following), then "API Reference" (the
    Viewer's props, then each template's: Prop, Type, Default, Description), then
    "Examples", an `h3` each with one sentence, a live example and its code. Its
    examples are `ViewerExample` and `OptionsExample` (`docs/components/Clover4/
ViewerDocs.tsx`): a Viewer over one of the homepage's resources (`resources` in
    `playground-config.ts`, never a Cookbook recipe; the one exception is Content
    Search, the newspaper mock, as none of those has a search service), mounted only
    near the window (a browser keeps only so many WebGL contexts), in a hairline frame
    with little room at its sides, its code attached under it. The page has no table of
    contents, so the examples have the width; its prose keeps a reading measure, and
    its sections more room (`layout.css`).
  - Under Viewer, the Default template's page (`/docs/viewer/default`; Mat, 2026-10-21,
    an experiment he may drop) walks through Default region by region: a live example,
    its regions where it lays them out (`DefaultAnatomy.tsx`, an ordered list in reading
    order), each region with its real code, its styles, what it does for accessibility,
    how to copy it, and its full source. Every quote is `SourceFile`
    (`docs/components/SourceFile.tsx`): the package's file, or a stretch of it from one
    line to another, read and highlighted as the page is built, so a quote that no
    longer matches fails the build rather than going stale.
  - A Viewer or standalone `Items` on a docs page takes the `headingLevel` one below the
    heading it sits under (`docs/components/Clover4/Demos.tsx`: 3 under an `h2`, 4 under
    an `h3`), so the page's outline stays true. Move a demo, and check its level. The DC
    item mock's Explore Further rows take 3.
  - The homepage is Clover 4's demo (Mat, 2026-10-20): its playground opens what
    `?iiif-content=` names. iiif.io's recipe pages link to
    `…/docs/viewer/demo?iiif-content=<manifest>`, the demo's old address, which the 404
    table forwards to the homepage with its query: never drop that forward. Cookbook
    Recipes (`/docs/cookbook`, last under Use Clover) lists every IIIF Cookbook recipe to
    open in the Viewer, which slides in over the page, handled or not
    (`docs/components/Clover4/CookbookDemo.tsx`); it has no field of its own, as the
    homepage has one. `/docs/viewer/progress` is
    unlisted (hidden in the sidebar, out of search): each recipe's status in 4.x beside
    3.x, and what is missing. Its data is `docs/components/CookbookRecipes/progress4.ts`;
    when a recipe starts working, or stops, record it there with the date.
  - The site banner (`app/layout.tsx`) says Clover 4 is in development. Retire it, or
    change its `storageKey`, when 4.0 ships.
  - The homepage (`docs/components/Home/`) opens with its headline, "A viewer as distinctive /
    as your collections." (two lines, its stroke under "distinctive") (`Hero.tsx`, the page's `h1`), and one sentence, on one line where it fits
    (Mat, 2026-10-20): "Design the user experience that you imagine for your IIIF resources." It has two halves: the templates live under it
    (`docs/components/Playground/`), and below them the same resource shown one IIIF
    property at a time by the components the templates are made of (`Parts.tsx` and
    `PartsLive.tsx`), with no heading of its own in sight. Each half has one hidden, for
    the page's outline (Mat, 2026-10-21): the playground's `h2`, "Try the templates", over
    its Viewer's title (`headingLevel` 3), and the parts' `h2`, "Parts". Between the two, under the playground's
    stage, is the choice, one thing, centered and floating on the page with room all
    round (Mat, 2026-10-20): a headline, "Use a template or build your own." (its last
    words under the stories' stroke), then one sentence in the summary's size, "Start with a [Default ▾]
    template or build your own layout.", the dropdown in it naming the template on the
    stage (as wide as the longest name, so the sentence holds still), and under it two
    calls to action (Mat, 2026-10-21): Get Started (`/docs`, the solid one) and Viewer
    Documentation (`/docs/viewer`); the navbar has no link to the docs. No boxes, no figure, no code. The parts follow the playground: `Homepage` holds the resource the playground reports
    (`onResourceChange`) and hands it down, and the section's chips put another of the
    playground's resources on its stage (`pickResource`).
  - After the parts, "Why Clover" tells five stories, one at a time: Accessible, Seamless,
    Composable, Lightweight, Coverage, on the code editor's black and the page's ground in
    turn, black first (Mat, 2026-10-20). Set apart from the parts by size, not colors of
    its own; its accent is `--accent-9` itself, never a shade or a fill: the hero's marker stroke under every figure, the figures themselves in the text's color (black on the page's ground; on black, white, `--code-bright`, never the editor's tinted text; Mat, 2026-10-20 and 2026-10-21). Its
    words are Apple-style marketing, by way of Strunk and White: plain and conversational,
    as one person speaking to another, never terse bursts (Mat, 2026-10-21); titles short, each ending in a period,
    US English, every claim one Clover keeps. A size is what a reader's browser loads,
    never what a page "ships" (jargon; Mat, 2026-10-21), and only for what draws something:
    no figure for the Viewer before its template. OpenSeadragon goes unmentioned in Clover
    4's copy (Mat, 2026-10-21). Every figure is the code's own: sizes from
    `sizes.json` (measured by the package's build), the parts counted from the
    Components menu (`counts.ts`), the Cookbook's counts and date from `progress4.ts`,
    all through `docs/lib/figures.ts`, which what agents read shares (`llms.txt`, the
    structured data), so the two never disagree. Never write a figure into the copy.
  - It sits in the parts' grid, beside the held example viewer (`Homepage` passes it to
    `Parts` as children; the Root draws no box). `StoryLines.tsx` drives it from the
    scroll, only where the viewer is held: one 3px line from the story at the middle to
    the part it names (`data-point`, or `viewer` for the frame); `data-lit` on that part
    and on the tiles crossing the middle; Accessible (`data-turn`) shows the viewer's
    inspector (`AccessibilityTree.tsx`: WCAG checks measured on the viewer, then an ARIA
    snapshot with tab stops) and Coverage (`data-recipe`) a Cookbook recipe (0261, a
    polygon annotation), each crossfading with the viewer (no flip), inert, and given
    up when focus comes to the viewer (2.4.7); Seamless (`data-brand`) previews Northwestern
    purple without keeping it, on what is in view as it begins (the navbar, the viewer,
    the stories and their line, the tiles and chips on screen; `previewPageTheme`'s
    elements, marked `data-page-theme` so the accent's steps mix again there,
    `tokens.css`), which looks site-wide and spares the page a restyle of every element
    (about 2,400, 15ms) mid-scroll (Mat, 2026-10-21) (never the font, which would shift
    the layout; not on a dark page, where it would fail 1.4.3); it points at the
    thumbnails (`items`), whose Next shows meanwhile as the pointer would find it, in the
    accent with its name showing (`data-hovered`, shown only, nothing focused or pressed;
    Mat, 2026-10-21); Composable (`data-compose`) has the
    example viewer's own code editor (a portal into `data-composer`) change the layout
    Mat set (Content first at 400, then Label, Summary, Items larger), the code
    crossfading with its new lines lit at a fixed 15 lines, the viewer fading out and in
    around it, and puts it back after. Each change starts with its story's line (Mat,
    2026-10-21: in sync) and waits `BAND` past its edge before undoing; the line draws in
    from the moment its end can be shown (a part on a face the viewer is turning to is
    looked for each frame), and the page's foot ends the last story too, its line fading
    (`data-gone`), still drawn to it, and its change undone. Where the viewer is held, a
    story's figure strokes draw as its line reaches it too (`data-drawn`), and elsewhere
    as it scrolls in. Seamless has the site's Font family and Color (`BrandPicker.tsx`),
    which set the whole site and are remembered (`page-theme.ts`), in the column the other
    stories give their figures, and under its words its figures, smaller and side by
    side, then the CSS a page would write (Mat, 2026-10-21): `1rem` and `CSS` ("variables
    for simple styling"), a word, never a count (Mat, 2026-10-21). The navbar's one
    control is the code switch (below); it has no settings (its gear was removed on
    2026-10-20), appearance being in the footer, and no Documentation link (Mat,
    2026-10-21: hidden in `layout.css`, as hiding the docs' folder in `_meta.ts` empties
    their sidebar).
  - Scrolling there stays smooth (Mat, 2026-10-20: "everything should VERY SMOOTH"; and
    2026-10-21: "really dial in the smoothness"). Keep it so: nothing the scroll drives
    re-renders React (lights are `data-lit`, written by `StoryLines`; the rest are a
    handful of state changes, each once per story); nor does the page scrolling under a
    resting pointer: a part's hover (`point`, `Tile`) takes the pointer's moves, not what
    passes under it (`docs/lib/scrolling.ts`), and a tile's list in a box of its own
    (`.scroll`) lets the wheel pass to the page until the reader points into it or
    focuses in it (`data-armed`), so a trackpad's gesture is never spent on a box the
    page brought under the pointer; `Tile`, the viewer's parts, `ViewerCode`,
    `RecipeFace` and `AccessibilityTree` are memoized on what they show; animations are opacity or transform only (no `background-color` or
    `clip-path`, which the main thread redraws every frame); the recipe and the
    inspector's snapshot load while the page is idle, never mid-scroll; a change of the
    viewer renders as a React transition; no `:has()` on the page's root or its
    ancestors (attributes instead: `data-bar-stuck`, `data-banner`, and
    `docs/lib/full-width.ts`'s rules); no view transitions (their snapshot costs frames).
    Measure with a scroll in a current Chrome (`npx playwright` with
    `channel: "chrome"`), since Playwright's bundled Chromium is slower to restyle, and
    on a production build (`next dev`'s React is several times slower at each story's
    change), by wheel (as a trackpad scrolls) at Mat's size too, about 1876 × 1960:
    there, on October 21, 2026, main-thread tasks were 1.7ms at the median, the Seamless
    story's restyle 6ms, and the only long frames the headless browser's own software raster.
  - That section is one `Root` for that resource. On the left its parts make a small
    viewer, held in view (by its foot, once taller than the window), and held so that
    at the page's end its foot meets the npm block's (Install's, where the grid ends;
    lower on a window too tall for the page to scroll so far, `--assembled-end`), with
    no caption (it
    is a region named "Example Viewer" for assistive technology; never `<Clover.Root />`),
    its parts in the order its code gives them. The code control under it opens that code
    below, as an editor (Prism's Material colors on black, `--code-*` in
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
    part is a tile, live, an `article` named by its heading (never a `section`: as regions,
    the page's landmarks ran to dozens), named as it is written (`<Clover.Label />`), with what it reads
    (a property; for `Content`, the Canvas) and a fact from the resource (a count, a size,
    a name). Pointing at a tile outlines the part in the viewer. A part the resource gives
    nothing to is a chip at the end, naming what it would read and the playground resource
    that has it (`SHOWN_IN`). Every value shown is the resource's own: no illustrations,
    made-up figures or copy. Golden-ratio spaces, hairline edges, no gray fills.
  - The playground shows how far one Viewer stretches: any layout with any kind of
    resource. Two pickers, each changing the stage without the other. Over it, centered,
    the resource (`ResourceField.tsx`): one field, its label, "Select an item", joined to its start outside its edge (Mat,
    2026-10-20; a tab on its top edge on a phone; its `<label>`), for the
    address or content state of the reader's own, with ours listed under it (`resources`
    in `playground-config.ts`: a catalog, a print, a Collection, a photo, a map, a film, a
    recording…), each by its thumbnail, its own label, and a few words on one thing it has
    that the others do not (`description`: concise, only what the resource has). The
    list's first item, always, is "View your own" (a dashed slot with a plus, as the old
    "Your own" tile was), which empties the field for an address. Each of the reader's
    own joins the list as they open it, after that, by its root `label` and
    `thumbnail` (never a Canvas's or member's) over its address, so they can switch
    between theirs and ours; held in memory only, never stored, gone with the page. The
    field shows the label of the one on the stage, never our word for its kind (`name`,
    which only the parts' chips use). It is a WAI-ARIA editable combobox: typing narrows the
    list, Down and Up open and move through it, Enter opens the one marked or what is
    typed, Escape closes the list and then puts the field back; focus stays in the field.
    On a touch screen a press lists ours and brings no keyboard (`inputMode="none"` while
    it shows one of ours; Mat, 2026-10-21), nor selects the label as a mouse's press does;
    "View your own" brings the keyboard, for an address, by focusing the field again
    within the press.
    Its edge, and the Template button's, is 3:1 (`--pg-edge`): controls only, while the
    stage and the parts' tiles keep their hairlines (Mat, 2026-10-16; the tiles at 3:1
    was tried and put back). Under the stage, in the choice's sentence, the template's
    dropdown listing the templates by name (named "Default template", its visible name
    first, WCAG 2.5.3). No drawings of the layouts, no
    fills of light gray, spaces on Clover's golden-ratio scale. Each template shows with its own defaults: no props, no generated code (a
    Customize drawer with both was removed on purpose). The section is wider than the
    reading sections but held off the screen's edges; the stage keeps one height for
    every pairing, with a hairline edge and a small, soft gray shadow (never the accent).
    Keep the playground itself about layout and UX: names and those few words, no
    marketing lines; the marketing is in the choice under it and in Why Clover.
  - The homepage's three sections after the playground open alike, with `SectionIntro`
    (`docs/components/Home/SectionIntro.tsx`): no rule over it and room round it (Mat,
    2026-10-21), a title ending in a period under the hero's stroke, one short note (`--text-lede`, as the hero's sentence and the choice's), and one call to action (`cta-solid` or `cta-outline`,
    `tokens.css`). And more (the parts counted, "See them all"; the Collection's tile the first under it, and Annotations beside Contents; Mat,
    2026-10-21), Why Clover ("Read the
    docs"; its note the five stories in brief, a short sentence each, in their order) and Install ("Get started"), the last in the gap after Coverage, beside the
    held viewer, the grid ending with its npm block, and a few rem under it, no more
    (`4.236rem`, the page's own; Nextra's empty room under the article hidden on full
    pages, `full-width.ts`), before the footer (Mat, 2026-10-21).
  - The footer (`docs/components/SiteFooter.tsx`, inside Nextra's `Footer`, styled in
    `layout.css`; Mat, 2026-10-20 and 2026-10-21) is one column on the page's white
    (`--color-background`), set off by white space alone, no line over it, its text at
    the sidebar's size (1rem) and black (`--nav-text`), but who made it and the legal line
    muted (`--gray-11`: 5.9:1 on white, 9:1 on the dark ground; Mat, 2026-10-21): the wordmark,
    then what Clover is in the homepage hero's words, a sentence a line (the headline's
    in bold, a step up, `1.618rem`; the sentence at `--text-lede`, muted as the hero's is), then one paragraph in
    Mat's words, whose project Clover is (the Academic Innovation team at Northwestern
    University Libraries), since when (2021) and at which version ("version 4.x"), and how widely it is used and built on, a
    variety of implementations and the institutions that contributed, never a person
    (Mat, 2026-10-21: people are credited elsewhere; its maturity shown, never claimed),
    its "more" linking to the repository's contributors; the two across 61.8% of the
    footer's width (all of it on a phone). No history, and no titles. Under it, `3xl`
    away, that it is MIT licensed and fully open source, the holder as `LICENSE` names
    it: Northwestern University Libraries, from 2026, and the site's links (Source code
    and License; never the earlier version, Mat, 2026-10-21), with the
    appearance after them (Light, Dark or System, `ThemeSwitch.tsx`, Nextra's `Select`) on
    every page (Mat, 2026-10-21). Nextra's own switch is off (`darkMode={false}`), so
    none is in the sidebar's foot (its Collapse button kept at the end), the phone's menu
    or a band over the footer. Keep each fact the record's.
  - The wordmark (`docs/components/Logo.tsx`, the navbar's and the footer's) is the text's
    color, the hero's stroke always under it (Mat, 2026-10-21: no longer drawn on hover),
    sized and set in `em` of the wordmark's height as the marks are (`--wordmark-height`),
    never a fade or a fill. Every stroke on the site is one shape,
    `--swoosh` (`tokens.css`), set one way (Mat, 2026-10-21): 0.42em tall, its ink from
    0.1em to 0.25em under the letters' foot, a little off them, crossing only what
    descends. The marks (`.mark::after`), the figures (on `.figureMark`, inline, so they
    sit as the marks do) and the wordmark keep that; measure a new one against them.
  - Headers are solid, never frosted or translucent: the navbar (`docs/styles/layout.css`
    overrides Nextra's blur) and the playground's bar. From 48rem wide, on a screen at
    least 36rem tall (not a phone, where with the navbar it would take too much height),
    it holds under the navbar as its lower half: while the stage passes under, the
    navbar's edge moves to the bar's foot, the field runs the playground's width, and the
    bar's foot rides on the stage's as the two leave (they share a box, so the template
    row under the stage is never under it). `useStuck` writes `data-stuck` to the bar
    directly, not to state, so this never re-renders the stage. While the bar can hold,
    `useStuck` sets the page's `scroll-padding-top` to the navbar and the bar, measured,
    so a control that takes focus in the stage comes into view below the bar (WCAG
    2.4.11).
  - The navbar holds the docs' code switch, React or Web Components (Mat, 2026-10-21;
    React by default; `docs/components/CodeSwitch.tsx`), after the search and before the
    repository's link: a pair of native radios, one tab stop, named "Code examples", drawn
    as the Transcript's EN | TXT is (pills, no frame, small semibold text, muted until
    chosen), the chosen one in the Viewer's controls' dark fill (light on a dark page),
    never the accent at rest (it drew the eye from the page), the accent under the pointer
    or focused. The choice is the reader's (`docs/lib/code-flavor.ts`): stored, in step
    across tabs, and set on the root as `data-code` before the page paints
    (`code-flavor-script.ts`, in the root layout's head), so CSS shows an example's code in
    the chosen flavor (`data-code-flavor`, `layout.css`) with no flash and no re-render;
    both flavors stay in the HTML, for agents and pages read without scripts. On a phone
    it reads "React | Web", the rest of the name still read (2.5.3); under 360px the
    repository's icon gives way (the footer links the source), so the header fits at
    320px (1.4.10).
  - Titles and share cards are `pageMetadata` (`docs/lib/site.ts`), the root layout's
    `metadata` and each page's `generateMetadata` (`app/[[...mdxPath]]/page.tsx`): the
    homepage's title is "Clover IIIF – A viewer as distinctive as your collections" and the site's
    description says what Clover is, plainly, in Get Started's words, in React or as a web
    component (Mat, 2026-10-21: so an agent or a search result can tell; the hero is the
    brand's; every description of Clover, the READMEs' and the packages' too, names both,
    and only what each does today); a page
    takes its `title` (front matter, else its first `h1`, Nextra's rule) and its
    `description`. Give every page a `description`: agents read it in `llms.txt`, the
    parts' list and the Markdown. Every page's card picture is a 1200 × 630 band of
    the White catalog's cover, cut by Northwestern's IIIF Image server and linked from
    there, never copied into `public/` (Mat, 2026-10-16: the record's attribution does
    not permit further distribution of its images).
  - Under the navbar on every page, a small acknowledgment in the corner, on the page's
    ground with no band of its own (Mat, 2026-10-20), muted (`--gray-11`, 2026-10-21),
    says Clover is a project of
    Northwestern University Libraries, linking the Libraries'
    site (`docs/components/Subheader.tsx`, styled in `docs/styles/layout.css`). It is
    aligned to the end of the navbar's content. It is not held (Mat, 2026-10-16):
    the root layout's `navbar` renders it after Nextra's `Navbar`, outside the navbar's
    sticky box, so it scrolls away with the page.
  - On the homepage the navbar's content, and that line, line up with the sections'
    1300px (and the shell's padding) at every width (`Home.module.css`); docs pages keep
    Nextra's 90rem, which lines up with their sidebar. Nextra 4 has no `raw` layout: the
    homepage and the `/test/` pages are `full` with the sidebar and the rest turned off
    (`_meta.ts`), and their CSS modules undo the full layout's 90rem and its article's
    padding around them alone (`:has()`), so they span the window as they did.
  - The homepage renders on the server, so a component it imports statically must not
    import `@iiif/helpers` (through `docs/lib/iiif-content`, say). It is an ESM external
    there, which makes the importing module async, and the homepage's import of it is
    then undefined ("Element type is invalid").
  - A page has one `main`, Nextra's: the homepage's shell and the test mocks' pages are
    `div`s inside it.
  - What agents and crawlers read (Mat, 2026-10-21) is built with the site, from what it
    already holds (`docs/lib/agents.ts`: the docs' menu, each page's front matter, and
    `figures.ts`), and, the site being a static export on GitHub Pages, each is a file:
    `llms.txt` (`app/llms.txt/route.ts`; what Clover is, at a glance with its figures,
    then the docs as their menu lists them, each linked to its Markdown, 3.x under
    "Optional"), `sitemap.xml` (`app/sitemap.ts`, every page but the unlisted and
    `/test/`, with its file's last commit's time, from Git, `docs/lib/last-changed.ts`, as
    the pages' `dateModified` is: Nextra's own `timestamp` was not always the file's, and
    the deploy fetches the whole history for it) and `robots.txt` (`app/robots.ts`; Pages reads
    one only at a host's root, so it counts on a domain of the site's own). After
    Pagefind, `scripts/build-agent-docs.mjs` writes each of the sitemap's pages as
    Markdown beside its HTML (`/docs/items.md`, converted from the built page, its
    examples' code and tables included, front matter giving its title, description,
    address and version) and `llms-full.txt` (Clover 4's pages, in `llms.txt`'s order),
    and fails the build if `llms.txt` links to a page it could not write. Each page's
    head links its Markdown (`alternate`, `text/markdown`; the homepage's is `llms.txt`).
    The homepage's structured data is Clover itself (`homeData`: the site, its publisher,
    and the software, its features its parts' descriptions), and its HTML lists the
    parts (`PartsIndex.tsx`, drawn on the server into the parts' placeholder, out of
    sight and out of search) until the live parts take its place, for a reader without
    the page's scripts. Agent-facing words say what Clover does as released
    (`npm install @nulib/clover`; Mat, 2026-10-21: "assume my product will be live").
  - `/test/…` (`content/test/`) holds unlisted mocks of host pages, for trying Clover 4
    where it is meant to live: raw layout, no docs navbar or footer, out of search.
    `/test/dc-item` is a Digital Collections item page (`docs/components/DcItemMock/`),
    filled from the DC API, with the Viewer and `Items` where the site has 3.x's Viewer and
    Slider; `?id=<work id>` opens another work, and a row's works open in the mock.
- The package builds to `packages/clover/dist/`; the site's static assets are in `public/`.
- Tests are colocated near code as `*.test.ts|tsx`: the package's, and the docs' own
  helpers in `docs/lib/` (the root `vitest.config.mjs`), run together through
  `vitest.workspace.mjs`.

## Nextra 4

- Pages are server components. An MDX page cannot hand a function to a component (an
  `onClick`, a callback, an `adapt`): move it into a `"use client"` module, as
  `docs/components/ContentState/`, `Examples/HomepageButton.tsx` and
  `Canvas/adapters.ts` do. A docs component that uses hooks, `next/dynamic` or the DOM
  starts with `"use client"`. `next/router` is gone: `useRouter` from `docs/lib/router.ts`
  gives the old `query` (read once the page hydrates, `isReady`), `pathname`, `basePath`
  and `push` / `replace` (`shallow` moves through the history API).
- Front matter is compiled to `export const metadata`: an MDX page never exports another
  `metadata`.
- A folder's own page is its `index.mdx` with `asIndexPage: true` in its front matter, so
  the folder in the sidebar is that page's link. Sidebar titles come from `_meta.ts`
  first, then front matter. The Mocks page is never in the sidebar
  (`content/docs/_meta.ts`): it stays at `/docs/mocks`, linked from the pages whose
  examples use a mock.
- Tabs are `<Tabs.Tab>` (no `Tab` export). Nextra gives each tab a hidden heading named by
  its place among `<Tabs>`' children, so nothing else sits between tabs: a
  `{/* prettier-ignore */}` goes before `<Tabs>`, which Prettier then leaves whole.
  Every panel stays mounted; a tab holding a live demo is `<Tabs.Tab unmount>`, so the
  demo loads when its tab opens.
- Nextra's stylesheet is in cascade layers (Tailwind 4's `theme`, `base`, `components`,
  `utilities`), so the site's unlayered CSS outranks it without `!important`, and
  Clover's `@layer clover`, declared after, outranks it too. Its utilities are
  `x:`-prefixed classes; match them whole, `[class~="x:text-primary-600"]`. A layered
  `!important` beats any unlayered rule: meet it through the custom property it reads.
  Re-check `docs/styles/layout.css`'s fixes (focus ring, hidden sidebar and phone-menu
  links, link colors, the solid navbar) after a Nextra upgrade.
- The ground is the site's `--gray-1` (`Head`'s `backgroundColor`, `app/layout.tsx`), not
  Nextra's #fafafa. Code blocks use Shiki's `github-light-default` and
  `github-dark-default` (`next.config.mjs`), whose colors hold 4.5:1; Nextra's own do
  not.
- Markdown tables render through `ScrollTable` (`mdx-components.tsx`): a box that, while
  the table is wider than the page, is a focusable region named for its section (WCAG
  2.1.1). Nextra's code blocks are focusable themselves.
- Search is Pagefind: `postbuild:docs` indexes the built HTML (`.next/server/app`) into
  `out/_pagefind`, then writes the pages' Markdown (`scripts/build-agent-docs.mjs`). In
  `npm run dev` search answers only after a build, and the Markdown is not there; `llms.txt`,
  the sitemap and `robots.txt` are. Front matter `searchable: false` keeps a page out of
  search, the sitemap and the Markdown.
- Nextra 4.6.1 needs Zod 4.3 (4.4 and later reject its Layout's props, "expected
  nonoptional … at children"): `overrides` in `package.json` hold Nextra's own Zod at
  4.3.6. Drop them with a Nextra release past 4.6.1.
- Nextra's "Copy page" menu is off (`copyPageButton={false}`) until it has been checked
  against WCAG 2.2 AA.

## Build, Test, and Development Commands

- `npm run dev`: start the docs site locally at `http://localhost:3000`.
- `npm run build`: build `@nulib/clover` (Vite-based, writes to `packages/clover/dist/`).
- `npm run build:docs`: build the Next.js docs site. Not while `npm run dev` is running:
  both write to `.next/`, and the build leaves the dev server failing with "Cannot find
  module './NNNN.js'". Stop the dev server first, or after a build clear `.next/` and
  restart it.
- `npm run test`: run unit tests (Vitest/JSDOM).
- `npm run coverage`: run tests with coverage reports (text/json/html).
- `npm run lint`: Prettier check + ESLint 9 (`eslint.config.mjs`, a flat config; Next 16
  has no `next lint`). It lints the package's source, `app/`, `pages/` and `docs/lib/`,
  as `next lint` did. The React Compiler rules of eslint-plugin-react-hooks 7 are off
  (99 hits in code that passed before); turn them on deliberately.
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
- Update docs (`docs/` or `content/`) when changing public APIs or behavior.

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

- The docs' i18n page (`content/docs/i18n.mdx`, under Contribute; Mat, 2026-10-20) is
  for readers and contributors: the languages shipped, how one is chosen, and adding a
  language, with a demo that switches one Viewer between them (`LanguagesDemo.tsx`).
  Keep it in step with what follows.
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
    server and CORS open. In `next dev` its Manifest is given at the static path too
    (`/mocks/<name>/manifest.json`, a rewrite in `next.config.js`), so the homepage and
    the demos open the live copy, and files it names that are not deployed yet answer;
  - where the static site cannot answer (a search's `?q=`), a `mockFetch` the docs demos
    pass as `request.fetch`.
- Document every mock on `content/docs/mocks.mdx` (URLs, contents, example answers, how to
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
  the playground's Catalog; `transcripts`, Cookbook 0219's _Lunchroom Manners_ with its
  English captions and, as the Canvas's `rendering` (0017's way), the film's plain-text
  transcript that 0253 provides (static); `page-transcript`, `content-search`'s newspaper
  with each page's own OCR as a plain-text `rendering` in German, a line of the page a
  line of the file (static, and live in `npm run dev` under
  `pages/api/mocks/page-transcript/`, since its text files are its own);
  `standalone-canvas`, the one Canvas of Northwestern's record of Borghi's map of the
  British Isles, as 3.x's site publishes it on its own (`source.json`), its `partOf`
  kept, with a Contributor metadata line from the record and Ireland tagged (static);
  `rudolf-hess-nuremberg`, the National Archives' reel of the Nuremberg judgment on
  Commons, made to show Rudolf Hess's distress beside the other defendants (Mat,
  2026-10-19), labeled "Rudolf Hess at Nuremberg Sentencing, 30 September–1 October
  1946": a "Rudolf Hess" page of three tracked annotations (`xywh=…&t=…`, `tracks.json`)
  and an "Other Defendants" page, English captions from the trial's record
  (`captions.json`, the Russian and French interpretation in the record's English), the
  same words as a plain-text transcript (the Canvas's `rendering`), and chapters titled
  with the archive's description (static, and live in `npm run dev` under
  `pages/api/mocks/rudolf-hess-nuremberg/`, since its captions and transcript are its
  own). It is the playground's Footage. The package's tests use copies of
  `page-transcript`, `paged`, `rudolf-hess-nuremberg` and `transcripts`, in
  `packages/clover/src/fixtures/mocks/<name>/`.

## Environment & Tooling

- Node: 20.10 or later (`engines` in `package.json`).
- When working with IIIF resources, verify CORS in local examples.
