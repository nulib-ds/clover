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
- Presentation 4's `provides` (Mat, 2026-10-29) is how a resource names the
  accessibility features its `supplementing` annotations offer (captions, subtitles, a
  transcript, an audio description…). Clover reads it wherever it offers such a feature,
  and a Presentation 4 mock or example that offers one gives it (`packages/clover/AGENTS.md`,
  "What a resource `provides`"; `ACCESSIBILITY.md`, "What a resource provides").

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
    `@samvera/clover-iiif`, is kept at `content/docs/deprecated-versions/` (URLs
    `/docs/deprecated-versions/…`, `/docs/3.x/…` until 2026-10-30: Mat, a name that holds
    the next earlier version too), one sidebar group titled "Clover 3.x", collapsed, under
    "Earlier versions" at the bottom.
    Its page titles end in "(3.x)" so search results tell the two apart (its overview's,
    "Clover 3.x", says it already).
  - The 3.x pages are for reference, never the standard (Mat, 2026-10-20). They document
    an earlier version: never take their API, behavior, wording or patterns as how
    Clover 4 works or should work. The package's source, its tests, its own AGENTS.md
    and DESIGN.md, and the 4.x pages are the authority. Every 3.x page says so to
    readers, search engines and agents: a notice opening the page and a "(3.x)" title,
    a description in its own words, then what it documents (Mat, 2026-10-30: its own
    words first, so its search result opens with them), schema.org data (`version: "3.x"`,
    `creativeWorkStatus: "Superseded"`), and in the site's search a "(3.x)" title, a
    `version` filter and half the weight of Clover 4's pages (`app/[[...mdxPath]]/page.tsx`,
    `docs/lib/site.ts`). `llms.txt` (`docs/lib/agents.ts`) tells agents the same. A new 3.x page gets all
    of it from its place under `content/docs/deprecated-versions/`.
  - 3.x's source is not on `main`: it is on this repository's `v3` branch. The 3.x
    pages' live examples import the published `@samvera/clover-iiif` (a devDependency,
    pinned to `4.0.0-rc.2`, the release the pages were written against), through
    `docs/components/DynamicImports/` and the entry points (`/viewer`, `/primitives`,
    `/i18n`…). Its components inject their own styles. Data those pages need lives in
    `docs/fixtures/`.
  - Keep 3.x as a nested group, not flattened with `"display": "children"`: Nextra 2
    keys sidebar items by file name, so a flattened `deprecated-versions/viewer` collides with 4.x's
    `viewer` and drops out of the sidebar.
  - Links inside 3.x pages point within `/docs/deprecated-versions/`. Keep 4.x features out of the 3.x
    pages, and 3.x's API out of the 4.x ones. `Canvas` is documented in 4.x only.
  - The site deploys to S3, behind CloudFront, through GitHub Actions
    (`.github/workflows/deploy-s3.yml`), after the Tests workflow passes on `main`, or
    by hand. The job assumes a role by OIDC (`aws-actions/configure-aws-credentials`,
    `vars.AWS_ROLE_ARN`) and syncs `out/` to `vars.DOCS_BUCKET`, hashed assets first and
    kept a year, the rest revalidated, then invalidates
    `vars.CLOUDFRONT_DISTRIBUTION_ID` where one is set. The build reads
    `DOCS_BASE_PATH` (`next.config.mjs`, empty: CloudFront serves the site at its host's
    root) and `NEXT_PUBLIC_SITE_URL` (canonical links, `docs/lib/site.ts`, from
    `vars.DOCS_SITE_URL`). Without them, a build is for
    `clover.iiif.library.northwestern.edu` at its root. The infrastructure itself is
    `terraform/`.
  - The site is a static export, so there are no server redirects. URLs that moved
    (3.x pages from `/docs/…` and `/docs/3.x/…`, 4.x pages from `/docs/4.x/…`, the demo, the Panel's page)
    are sent on by the 404 page (`app/not-found.tsx`, exported as `404.html`, which CloudFront
    serves for any missing path), from the table in `docs/components/Moved.tsx`, query
    and hash kept. Move a page
    again, and add its old URL there. A 3.x page whose name 4.x now uses (`viewer`,
    `map`) shows the 4.x page, which links to its 3.x version.
  - How to compose a layout (`Root`, the parts, the property parts, the information
    panel's `Tab`s, `Split`, hooks, renderers) lives on one page,
    `content/docs/composing.mdx` ("Composing layouts", "Composing" in the menu). The
    Viewer page covers what the Viewer handles and links there; add composition material
    there, not to the Viewer page. Its first example is live, on the examples' card
    (`ComposeExample.tsx`; Mat, 2026-10-23): a `Root` with `Body` and an aside of parts,
    its code under it in both flavors, each part's lines moved by its grip (dragged, its
    arrow keys, or pressed and then Move up or Move down, Escape letting go; WCAG 2.5.7),
    the title's element and the other Label's `of` picked in the code, the demo
    following. How to style one is the page after it,
    `content/docs/styling.mdx` ("Styling"; Mat, 2026-10-23): the stylesheets and their
    layer, how every size steps from the page's `1rem` (the scale, text, the control, the
    inset), colors, classes and states, lists in Markdown text, then colors and contrast
    told simply for a person (a checklist of native checkboxes, `Checklist.tsx`, its
    items strings with their code in backticks, as MDX would make children a paragraph a
    label cannot hold; then "Do" and "Don't") before every pair in full, kept for audits
    and agents, and last "Variables", a glossary of every custom property a page sets,
    with its default and where to set it (never those Clover sets as it runs). A new
    property a page may set gets its row there. Composing keeps a short Styles section linking there.
  - Every docs page reads as the Components pages do (Mat, 2026-10-23: "remove breadcrumbs
    EVERYWHERE", "remove sidebars everywhere. style like the Components pages"): no
    breadcrumb and no table of contents (the `docs` folder's `theme` in
    `content/_meta.ts`, which carries to every page in it), the components' title, a lede
    (`docs-lede`) where a page opens by saying what it is (Get started, Composing,
    Styling, i18n, Mocks), and their spacing (`layout.css`, keyed on
    `.nextra-sidebar ~ article`, any page beside the sidebar). Prose, lists, tables, code
    and examples all reach one right edge, the page's width (Mat, 2026-10-23: no reading
    measure; a table spans it too); the lede's lines are a little looser than Nextra's
    fixed 1.75rem gives its size (`max(1.4em, 1.75rem)`; Mat, 2026-10-23: "just a tad");
    running text is the reader's `1rem`, inherited (Nextra sets the root to `1rem`), and
    no font size in the docs' CSS is in pixels, as Clover's are not; it is black, white on
    a dark page (`--nav-text`; Mat, 2026-10-23), the lede and the tables' heads muted.
    Inline code keeps Nextra's own look (Mat, 2026-10-23), its text the running text's. A
    table's groups' names (`scope="rowgroup"`) are a step up from its head, in the text's
    color. The sidebar's list has more room as the window widens (`--docs-room-start`,
    `--docs-room-top`, on `:root`), and the page beside it the same room over it, so their
    tops always match (Mat, 2026-10-23); the open sidebar widens by what its list gains,
    which keeps the width Nextra pins on it. Its Collapse button is drawn as Clover's
    `PanelToggle` (round, the controls' fill and glyph, the accent under the pointer or
    focused, its glyph mirrored for a panel on the left, a mask that forced colors paint;
    Mat, 2026-10-23).
  - Every part the homepage shows has a page under "Root components" (Mat, 2026-10-20;
    the group so named on 2026-10-26):
    Body, Canvas, Items, Panel, the Panel's sections (Annotations, Collection with
    CollectionSelect, Contents, Search, Transcript), Download and Map, then Primitives
    (`content/docs/primitives/`, an overview and a page per property part: Label,
    Thumbnail, Summary, Metadata, RequiredStatement, Rights, Homepage, SeeAlso,
    Rendering, PartOf, Id, Provider, Logo, Value). Each reads as Radix Themes' component pages do (Mat,
    2026-10-21): a lede (`docs-lede`), one example at the top, "API reference" (what it
    reads and renders, then one table per component, Prop, Type, Default and Description,
    from the source), "Examples" (an `###` each: one sentence and an `<Example>`, the demo
    with its code attached, `ViewerDocs.tsx`), and "Previous versions" where 3.x had it:
    a link and a few words of direction, never a mapping of the differences. No other
    tables, and no table of contents (none on any docs page), so the examples have the
    width. Live examples are
    `<PartDemo part="…" />` (`docs/components/Clover4/PartDemo.tsx`): the part named, its
    props plain values, in a `Root` over a mock (`resource`), with a `Body` above it
    (`content`) where it follows the view; several parts in the one `Root` (`parts`, on
    a line with `row`); a tall part in a box that scrolls (`box`), as the templates
    scroll the Panel, the box in the example's code too. The example at the top is live,
    as the homepage's editor is (Mat, 2026-10-22): `<LivePart part="…" knobs={…} />`
    (`docs/components/Clover4/LiveExample.tsx`) names one to three knobs, props whose
    change the demo shows at once (a layout, a size, a switch), as plain data, and the
    reader changes them in its code, both flavors, the demo following (`LiveCode.tsx`,
    its controls `docs/components/CodeValues.tsx`, shared with the homepage's editor; the
    code written by `docs/lib/live-code.ts`). Each prop is written under the attribute
    its element's spec reads it from (one it has none for fails the build), and the
    page's Markdown takes the code as it opens (`data-live-code`,
    `scripts/build-agent-docs.mjs`). A page whose part has no such prop keeps its static
    example: Annotations (its `scope` shows nothing on the catalog's cover), Collection,
    Contents, Download and the property parts but Label, Thumbnail, Summary, Metadata, Id
    and Value. Body opens on the newspaper (`page-transcript`), as the catalog's cover is
    a placeholder, which shows no controls; Canvas offers `placeholder` for the same
    reason. The homepage's tiles link to these pages
    (`DOCS` in `docs/components/Home/PartsLive.tsx`); a new part gets a page and a link.
    `content/docs/panel.mdx` holds the Panel's layouts and keys, its default sections
    and when each shows, `Tab`s, headings, showing and closing it, the open section, its
    props (and `Tab`'s, `PanelToggle`'s, `About`'s), and 3.x's
    `options.informationPanel`; Composing keeps a short section with the `Tab` example
    and links there. Its demos are each in a 24rem box (`box`), so the page stays
    scannable (the catalog's About is long), each `headingLevel` one
    below the heading it sits under. `canvas.mdx` says when to place `Body` rather
    than `Canvas`.
  - Timeline and Scene (2026-10-23) have pages under Components after Canvas
    (`timeline.mdx`, `scene.mdx`), built as the others are, and after their examples what
    a reader of those parts needs besides: Formats (what plays or draws, and the
    Cookbook's recipes that do), Accessibility (written for the person reading the page,
    in plain sentences, never notes or criteria lists; Mat, 2026-10-23), Size, and a short
    "What's next", hints of what is planned. They are official: nothing on them calls them
    a prototype or experimental (Mat, 2026-10-23). They are on no homepage tile (Body's
    covers them), so `DOCS` has no entry for them. A part Body draws with (`BODY_PARTS` in
    `LiveExample.tsx` and `LiveCode.tsx`: Canvas, Timeline, Scene) shows alone in a
    `LivePart`, loading its `iiifContent`; their resources are the `hindenburg` mock and the
    Cookbook's recipe 0608 (`audio`, `model` in `part-demo-resources.ts`, 0608 an
    address): `hindenburg` is the homepage's Recording, Northwestern's Hindenburg
    broadcast with its reel's box as its accompanying Canvas, which Timeline's page uses
    throughout (Mat, 2026-10-24), shown as Timeline's player, its artwork the box. A size in a page's prose is `<Measured size="…" />`
    (`docs/components/Clover4/Measured.tsx`), the build's own figure. Scene's "Customizing
    engine" says Clover's own engine is the default for its size, giving both engines'
    (Mat, 2026-10-23), and shows the two side by side (its three.js side registered as a
    page would, `registerThreeEngine()` in `docs/components/DynamicImports/Scene.tsx`,
    `three` being opt-in; Mat, 2026-10-27): demos side by side are figures in a
    `.docs-compare` row, each captioned over it ("Scene with `clover` as engine."), a name
    in a caption drawn as a part head's is, in the accent, its view's accessible name the
    caption's words (WCAG 2.5.3). "Scene or Body" says Body handles every container the
    Presentation API defines, switching between Canvas, Timeline and Scene as the reader
    moves (Mat, 2026-10-23).
  - A component page's head (Mat, 2026-10-22): no breadcrumb (none on any docs page), its
    title set as the homepage's section titles are, with no stroke under it (`layout.css`,
    as every docs page's is), and opposite it, on one line
    (`<div className="docs-title-row">` around the `#` title and `<PartHead part="…" />`,
    `docs/components/Clover4/PartHead.tsx`), the part's name as the reader's flavor writes
    it, as the homepage's tiles name theirs (`.tileName`: the code's face at 0.875rem,
    medium, the text accent; Mat, 2026-10-23), and beside it, on a badge white on
    the accent, as a solid call to action is (`.cta-solid`), its corners the containers'
    (`--radius-4`), what the part adds to a page with a `Root` (or, for `Canvas`, `Map`
    and `Value`, which their pages show alone, what a page with it alone loads), each
    flavor's own (`parts`, `partsAlone`, `elementParts`, `elementPartsAlone` in
    `sizes.json`, through `docs/lib/sizes.ts`), what was measured in words for assistive
    technology. Where the line is too narrow, the two go under the title, and the badge
    under the name. A new part gets its size measured (`PARTS` in `build/sizes.mjs`) and
    its head. Its examples are on a card lifted as the homepage's example viewer is
    (`--card-shadow`): the demo, then its code.
  - Every code block on the site is drawn as the homepage's editor is (`CodeBlock`,
    `docs/components/CodeBlock.tsx`, through `mdx-components.tsx`'s `pre`, styled in
    `docs/styles/code.css`; Mat, 2026-10-22): its language over it (the fence's, kept as
    `data-lang`), Copy, its lines numbered and wrapped, in the editor's colors: a third
    theme Nextra's highlighter colors every token with (`--shiki-editor`,
    `docs/lib/code-theme.mjs`, `next.config.mjs`), each color a token (`--editor-*`,
    `tokens.css`). It is light on a light page and dark on a dark one, or as an example
    sets it (`editor="dark"`, `CodeArea` in `ViewerDocs.tsx`); the homepage's editor stays
    dark. Light, its colors are Material's light theme's, darkened only as far as 4.5:1
    needs (`--code-light-*`, 5.1:1 on white); in both its tags are the text accent. A
    command (a fence in `bash`, `sh`, `shell`, `zsh` or `console`) is drawn as the homepage's
    install is instead (`docs-terminal`): one block on the editor's black, Copy at its end.
    A fence's marked lines (`{3}` after its language) are what it is about, lit as the
    homepage's editor lights a part pointed at, one rounded block tinted with the accent
    (`--editor-mark`: its 24% dark, 8% light, where 24% would take the text under 4.5:1);
    every line keeps its colors (dimming the rest would take them under 4.5:1), and the
    twin marks the same element's lines (`twinLines`, `code-flavors.mjs`). Mark a part's
    own lines where an example's code holds a `Root` or other parts around it.
  - Use Clover: Get started (`/docs`, a quick start and nothing more; Mat, 2026-10-26:
    "everything should be about a quick start"), Viewer (`/docs/viewer`,
    the templates on it: their old page, `/docs/viewer/templates`, forwards to
    `#templates`), Composing, Styling (the menu's names, short; "Composing" for the page
    titled "Composing layouts"; Mat, 2026-10-23), Technical overview (`/docs/technical`;
    Mat, 2026-10-26: the package's entry points, the Viewer, events, languages, parts,
    layouts, parts of your own, helpers (every public function, each documented there;
    Mat, 2026-10-27), types, what it loads, styles, and coming from 3.x, in React and as
    web components, the two at parity: each section says it in the reader's flavor,
    `<div data-code-flavor>`, or once for both, as the events' table does; the web
    components' detail Get started held, and `/docs/web-component`'s forward, are here).
    Build with an agent (`/docs/agents`; Mat, 2026-10-26) is hidden for now (Mat,
    2026-10-26: "let's hide this page for now"): out of the menu (`display: "hidden"` in
    `content/docs/_meta.ts`, its place after Styling kept) and of search, the sitemap,
    `llms.txt` and the Markdown (`searchable: false`), at its address still. It is for a
    reader with an AI agent in the browser, in plain sentences to that reader, what to
    ask, what happens on the page, what it reads and never sends, and what they need, with
    an example of its own (under the lede, so a preview there sits under the page's title)
    for an agent's preview to take the place of. It never names the tools or says how they
    work ("Agent tools (WebMCP)", below, does).
  - Get started (Mat, 2026-10-26) is a quick start: its title, a lede of two lines (what
    Clover is: no renderer named), then Install, in steps (`<div className="docs-steps">`,
    numbered by `layout.css`; not Nextra's `Steps`, which numbers every heading in it, an
    example's Viewer's title too). Its first step, "Choose your setup", offers three
    ways as radio cards (`InstallGuide.tsx`, `RadioCards.tsx`): React, Web components
    (npm) and Web components (CDN), each in a plain sentence (Mat, 2026-10-26: "say this
    less technically"), in step with the header's code switch (React chooses React's
    code across the docs, either other the web components'); the chosen way's steps
    count on from it. Each way's "Add it to a page" step holds the example
    (`StartExample.tsx`): its two ways in as radio cards, stacked, "Start with the Viewer"
    and "Compose with its parts", each linking the page that goes on with it, then, in the
    page's column, the chosen one live, the Viewer or a `Root` of Label, Body and Items,
    its code under it (its HTML the markup alone, `CodeTree.loaded`, as the steps load the
    elements; React's a whole module, as a component file is), the
    parts' lines moved and their values picked in the docs' editor (`PartsEditor.tsx`,
    Composing's first example's too, working as the homepage's example viewer's editor
    does, in the page's editor colors). Every example on it reads Northwestern's record
    of a street in Corozal (`…/works/3510cac2-…?as=iiif`). Then Next, where to go on, as
    small link cards (`<Related>` and `<RelatedLink href title note />`,
    `docs/components/Related.tsx`; Mat, 2026-10-26: "we will use this type of thing for
    related content/next steps"), the site's one way to list related pages. Nothing another page says (Mat: "don't repeat this from other parts of the
    docs. focus on what we are doing"). JSX code blocks across the site run on past the
    block's edge, scrolling, rather than wrap (`code.css`).
  - The Viewer page reads as Radix Themes' component pages do (Mat, 2026-10-21): the title
    and a lede (`docs-lede`), one example at the top (the Viewer, its code under it, live:
    each template's own knobs, `LiveViewerExample`, kept as the reader switches; Mat,
    2026-10-22; and under the code the template's switch, drawn as the navbar's code
    switch, radios with the chosen one `data-checked`, the code naming the template, even
    `template={Default}`, as a choice too, each moving the other, focus kept on the code's
    choice as its template's code replaces it; Mat, 2026-10-23; and `wide`: an example may
    reach past the page's column into the room a wide window adds at its sides,
    `--docs-bleed`, never by default, Mat, 2026-10-23), then "API reference" (the Viewer's
    props, then each template's: Prop, Type, Default, Description), then "Examples", an
    `h3` each with one sentence, a live example and its code. Its examples are
    `ViewerExample` and `OptionsExample` (`docs/components/Clover4/ ViewerDocs.tsx`): a
    Viewer over one of the homepage's resources (`resources` in `playground-config.ts`,
    never a Cookbook recipe; Content Search is the catalog's, its words read by machine
    and searchable since 2026-10-26), mounted only near the window (a browser keeps
    only so many WebGL contexts), in a hairline frame with little room at its sides, its
    code attached under it. The page has no table of contents, so its prose, tables and
    examples have the width, to one right edge (Mat, 2026-10-23), and its sections more
    room (`layout.css`).
  - The Default template's walk-through (`/docs/viewer/default`, region by region, its code
    quoted from the package by `SourceFile`) was taken down on 2026-10-22 (Mat: kept in
    Git's history, to become the example in a guide to making templates); its address
    forwards to the Viewer's templates.
  - A Viewer or standalone `Items` on a docs page takes the `headingLevel` one below the
    heading it sits under (`docs/components/Clover4/Demos.tsx`: 3 under an `h2`, 4 under
    an `h3`), so the page's outline stays true. Move a demo, and check its level. The DC
    item mock's Explore Further rows take 3.
  - The homepage is Clover 4's demo (Mat, 2026-10-20): its playground opens what
    `?iiif-content=` names. iiif.io's recipe pages link to
    `…/docs/viewer/demo?iiif-content=<manifest>`, the demo's old address, which the 404
    table forwards to the homepage with its query: never drop that forward. The
    Cookbook's recipes are listed on the homepage, in its Viewing field, tucked away at
    its end, and in its Natural story's select (below); the page that listed them,
    `/docs/cookbook` ("IIIF Cookbook" under Use Clover), was taken down on 2026-10-25
    (Mat: "we can now remove this page and any components that are unique to it"), and
    its address forwards to the homepage. `/docs/viewer/progress` is
    unlisted (hidden in the sidebar, out of search): each recipe's status in 4.x beside
    3.x, and what is missing. Its data is `docs/components/CookbookRecipes/progress4.ts`;
    when a recipe starts working, or stops, record it there with the date.
  - The site writes of Clover 4 as released (Mat, 2026-10-22: "assume we are live
    already"): it has no banner, and nothing a reader or an agent meets says Clover 4 is
    unreleased or still to come ("in development", "not on npm yet", "until Clover 4 is
    released").
  - The homepage (`docs/components/Home/`) opens, `l` under the navbar and `2xl` over the
    resource field (Mat, 2026-10-25: swapped, so the field has room), with its headline, "A viewer as distinctive /
    as your collections." (two lines, its stroke under "distinctive") (`Hero.tsx`, the page's `h1`), standing out (Mat, 2026-10-25): 8vw, so each line keeps to one from 320px up, to 5.236rem, under `.hero .headline` so the docs pages' title rule (`.nextra-sidebar ~ article > main h1`, which matches the homepage too, its sidebar only hidden) never holds it small, and one sentence, on one line where it fits
    (Mat, 2026-10-20; his rewording, 2026-10-22: one verb, no commas, IIIF given a role and never a tack-on): "Design a user experience rooted in IIIF." ("with Clover" taken off, Mat, 2026-10-25; the homepage's description then names Clover, `homeDescription`). Its size is set by the headline's (`clamp(var(--text-lg), 3vw, 2rem)`; Mat, 2026-10-25: "make relative to hero size. try to keep one line"), never under the stories' words at their smallest (`--text-lg`, 1.125rem, `--text-lede`'s floor; Mat, 2026-10-25), balanced over two lines on the narrowest phones; nothing after it (its "Docs →" link was removed, 2026-10-25). It has two halves: the templates live under it
    (`docs/components/Playground/`), and below them the same resource shown one IIIF
    property at a time by the components the templates are made of (`Parts.tsx` and
    `PartsLive.tsx`), with no heading of its own in sight. The playground's `h2`, "Try the templates", is
    hidden, over its Viewer's title (`headingLevel` 3) (Mat, 2026-10-21); the parts' is
    "…or build your own.", below. Between the two, under the playground's Viewer, is the
    choice (Mat, 2026-10-23: "it needs to be two. but they need to communicate"): two
    halves on one card on the code editor's black, as "Why Clover"'s black stories are
    (Mat, 2026-10-25: "would it help if we went black here and didn't float text over
    bg?"; the `--code-*` tokens, its words white and its notes the faint text, 6.1:1; a
    hairline inside it on a dark page), a hairline between the halves (across them when
    stacked), its corners `--radius-4`, no shadow. Before it, the two floated on the
    page's ground with hand-drawn gray arrows from each title, to the Viewer and to the
    tiles (`ChoiceArrows.tsx`, 2026-10-23 to 2026-10-25, removed with the card: "the
    weakest part of the whole page"), and a black card under the template alone was
    tried on 2026-10-23, "too much is going on". Their titles are one sentence across
    them, set as the section intros' are, "Use a template…" and "…or build your own.",
    its last words under the hero's stroke (Mat, 2026-10-23: two titles side by side,
    "Ready when you are." and "IIIF building blocks.", competed, as did labels over
    them). First: its title (an `h3`), its note, "Demo each in the Viewer above." (Mat,
    2026-10-27), then, side by side and as tall, the template's menu, drawn as a dropdown is (Mat,
    2026-10-23: "an obvious dropdown"; on the card, its edge the card's 3:1 one
    (`--pg-edge`, 5.6:1 on black), its words white, no lift, the name and a chevron in
    it, the accent's edge under the pointer, as wide as the longest name, so it holds
    still; named "Default template", its visible name first, WCAG 2.5.3), and Get
    started (`/docs`, the solid one). Then: the parts' `h2` (`#parts`, where a chip's
    resource sends focus), its note "IIIF building blocks that snap together.", and "See all (the count)
    components" (`/docs/body`, the parts counted, `counts.ts`; Mat, 2026-10-25), outlined in the card's
    edge, its words white, its edge the accent under the pointer (the accent's text step
    falls under 4.5:1 on black). Each half's title and note sit in the section intros'
    own grid (`intro.text`), so their sizes and gaps are those of "Thoughtful and
    flexible." (Mat, 2026-10-23: "match gaps/fontsize"). Side by side while their words
    fit (Mat, 2026-10-25: "these stack too early"): the template's half never narrower
    than its words and its two calls to action on one line: from 64rem, where the example
    viewer is held, the parts' own columns, the card's hairline in the middle of their
    gap and each half's words in from it by more as the window widens, 1.618rem at
    1025px to the card's own padding (Mat, 2026-10-25: "increase padding left/right at
    wide viewports"); under it, half and half
    (Mat, 2026-10-25: "it should just go 50/50 once the floating viewer goes away"); the
    building blocks' note wrapping before its title would; one above the other under
    48rem, each half centered. The
    room over the card is `l` to `xl`, and under it `2xl` (`Parts.module.css`'s
    `.section`). Viewer
    documentation is not offered there (Mat, 2026-10-23); the navbar has no link to the
    docs. No figure and no code. The parts follow the playground: `Homepage` holds the resource the playground reports
    (`onResourceChange`) and hands it down, and the section's chips put another of the
    playground's resources in its Viewer (`pickResource`). A member the reader opens
    from the Collection's tile goes up to the playground too (Root's `onManifestChange`,
    `openContent`: ours by its key, else the reader's own), so the Viewing field and the
    Viewer show it (Mat, 2026-10-25); the parts' Root, already showing it, is kept rather
    than drawn again, so focus stays on the member chosen (WCAG 2.4.3).
  - After the parts, "Why Clover" tells six stories, one at a time: Adaptable, Accessible,
    Seamless, Composable, Lightweight, Natural, on the page's ground and the code editor's
    black in turn, Adaptable on the ground so Accessible keeps its black (Mat, 2026-10-20
    and 2026-10-25). Adaptable (Versatile until 2026-10-25; its title "Multimodal first.", short enough for one line at every width) is about formats: in its figures' column, a thumbnail of
    each (Image, Audio & video, 3D model, Text: the playground's Catalog, Footage, Model and Manuscript; Mat, 2026-10-25), native radios, one tab stop, drawn as Clover's Items draws its items (the accent's 3px ring 1px clear when chosen, half of it under the pointer, its name in the text accent; focus in the text's color with a two-tone ring inside)
    (`FormatPicker.tsx`), each opening its resource in the playground and so in the held
    viewer; two by two beside the words, a row of four under them where the story stacks (Mat, 2026-10-25: "the examples get VERY large"); its line goes to Body (`data-point="body"`). Some resources start the held viewer their own way (`STARTS` in `PartsLive.tsx`; Mat, 2026-10-25): the Footage with its annotations under its Body (the other examples' 240) in place of Items, Summary and Metadata, in a box of one height for every resource, so the viewers match, the Other Defendants page put away, "Hess is led out of the dock" picked, and its film playing, muted, once in view (never where the reader asks for reduced motion); the Manuscript (Maktaba's, the Text) with its annotations under its Body likewise, in the reader's language to start, English here, Arabic a press away (Mat, 2026-10-25; the Annotations page's example starts in Arabic, its Root's `language`); a story whose part such a viewer lacks draws its line to the viewer as a whole (`StoryLines.tsx`). A pick holds the story where it is
    in the window, frame by frame, while the parts above it load again, with the browser's
    scroll anchoring off and the page's height kept meanwhile (Safari has no anchoring, and
    Firefox's loses its anchor as the tiles empty). Set apart from the parts by size, not colors of
    its own; its accent is `--accent-9` itself, never a shade or a fill: the hero's marker stroke under every figure, the figures themselves in the text's color (black on the page's ground; on black, white, `--code-bright`, never the editor's tinted text; Mat, 2026-10-20 and 2026-10-21). Its
    words are Apple-style marketing, by way of Strunk and White: plain and conversational,
    as one person speaking to another, never terse bursts (Mat, 2026-10-21); titles short, each ending in a period,
    US English, every claim one Clover keeps. A size is what a reader's browser loads,
    never what a page "ships" (jargon; Mat, 2026-10-21), and only for what draws something:
    no figure for the Viewer before its template. It is what loads to the first view
    (Mat, 2026-10-27: "to first view", never "from", which sells a used car), on the
    plainest resource of its kind (an image for the Viewer): React and the engines others
    make that load on demand (MapLibre and its worker, hls.js, three.js) never counted;
    the upgrader and, in React, the stylesheets counted for a template only, a part's
    React figure its script alone (`build/sizes.mjs`, held to a browser by
    `npm run check:first-view -w @nulib/clover`). Its unit is shown as written, "kB",
    never lowercased, and its figure rounded, never in tenths: "89 kB", a whole number, or
    under 1 kB its tenth, "0.5 kB", with no "~" (`kB` in `docs/lib/sizes.ts`; Mat,
    2026-10-27). OpenSeadragon goes unmentioned in Clover
    4's copy (Mat, 2026-10-21). Every figure is the code's own: sizes from
    `sizes.json` (measured by the package's build), the parts counted from the
    Components menu (`counts.ts`), the Cookbook's counts and date from `progress4.ts`,
    all through `docs/lib/figures.ts`, which what agents read shares (`llms.txt`, the
    structured data), so the two never disagree. Never write a figure into the copy.
  - It sits in the parts' grid, beside the held example viewer (`Homepage` passes it to
    `Parts` as children; the Root draws no box). `StoryLines.tsx` drives it from the
    scroll, only where the viewer is held: one 3px line from the story at the middle to
    the part it names (`data-point`, or `viewer` for the frame); `data-lit` on that part
    and on the tiles crossing the middle (not the Thumbnail's, beside the Label: `quiet`,
    `data-quiet`; Mat, 2026-10-27); Lightweight (`data-weigh`) draws its line to
    the viewer's middle and lights every part it shows, each tag giving, after the
    part's name, what it adds to a page with a `Root` (`sizes.json`'s `parts`, measured by
    `build/sizes.mjs`, through `docs/lib/sizes.ts`; `data-weighed` on the viewer; in words
    for assistive technology in the story), its one figure the Viewer's in its Default template, to first view,
    captioned "All the Viewer needs" (Mat, 2026-10-22 and 2026-10-27); Accessible (`data-turn`) shows the viewer's
    inspector (`AccessibilityTree.tsx`: WCAG checks measured on the viewer (names and
    ARIA, the keyboard, targets, contrast and text size, captions, language, motion),
    each with its mark, in the standard's order (1.1.1, 1.2.2…), then an ARIA snapshot with tab stops,
    the card as tall as both need where the window has room under the held viewer,
    focus anywhere in the viewer's column giving it up; Mat, 2026-10-22) and Natural (`data-recipe`; Coverage until 2026-10-25, renamed so its label is an adjective as the others' are, "Native" set aside as it can read as about people, its words of Clover itself, never "we", saying "IIIF" once: "Clover gains IIIF fluency from building blocks designed natively to open specifications." (active, never "comes from"), then "Code and components are crafted toward recipes, with **62** handled in the cookbook." (never "it's" or "its", and no range of recipes; the figure in the sentence, `cookbook.handled`, bold with the figures' stroke under it, `.inlineFigure`, rather than in a column of its own, the card one column, `data-single`; Mat, 2026-10-25: "instead of going columns for this card. put the 62 in line in the sentence … bold the number and underline it"), with no date and the link the one word "cookbook", to the IIIF Cookbook itself, `https://iiif.io/api/cookbook/` (Mat, 2026-10-25); its title "Reads the IIIF cookbook.", "cookbook" lowercase there and in its words (Mat, 2026-10-25, an exception to the IIIF Cookbook's capitals elsewhere), IIIF's logo for the word, in its own colors and proportions (never squeezed), sized a little past where its stems match the title's weight (0.786em, as its colors on black read smaller), on the title's baseline, `aria-hidden`, the word read in its place (beside or over the figure was tried and undone), `docs/components/Home/IIIFLogo.tsx`, a copy of the 3.x badge's, which goes with the 3.x pages; Mat, 2026-10-25) a Cookbook recipe (0032, a
    Collection, read by Label, Body, Metadata and Collection, all outlined but Metadata;
    Mat, 2026-10-21; for this example alone, the Collection held in from its outline, its
    address on one line, and its members given thumbnails from their own images at a size
    each `info.json` prescribes, its `sizes` else a level of its tiles,
    `recipeThumbnails.ts`; Mat, 2026-10-22), each crossfading with the viewer (no flip), inert, and given
    up when focus comes to the viewer (2.4.7). Under Natural's words, across its foot as
    Composable's code is (Mat, 2026-10-25: "put it underneath the marketing language like
    we do for the jsx editor on composable"), the playground's own select, the same
    `ResourceField` (Mat, 2026-10-25: "just use the same select as above. it will need
    dark capability. the arrow should point up. try to keep it dry between the two";
    `RecipeSelect.tsx`): `of="recipes"`, the Cookbook's recipes alone, from the curated
    `cookbook` Collection (Mat: "use a IIIF Collection that we can curate"), read while
    the page is idle, named "Viewing" ("Viewing IIIF Cookbook recipe" to hear), showing
    the recipe up top, else the one the example viewer reads (0032), staged (`staged`;
    Mat, 2026-10-25: "stage the 0032 manifest in the select. do not have it be
    submitted"): in the field and marked in its list, never in `?iiif-content=` until the
    reader chooses it or presses Open, which opens what the field shows; `toward="up"`, Open's caret pointing up; in the site's
    dark palette (`dark` around it), the select carrying its own edge and lift
    (`--pg-edge`, `--pg-lift` on `.resourcePicker`), so it is the same select anywhere.
    Choosing one opens it in the playground's Viewer up top (Mat: "load in the viewer up
    top, not JUST swap out the side bar") and takes the reader up to it (Mat: "make this
    change/submit navigate the user top"): the page to its top, smoothly where motion is
    allowed, and focus to the playground's field, which shows it now (2.4.3, 2.4.11). Its field shows the recipe up top, chosen there or in the
    playground's field, so the two are one choice. While focus is in it the story is
    lifted (`z-index`), so its list lies over what follows. The held viewer's recipe face
    reads 0032, always, whatever the playground shows (Mat, 2026-10-25: "it should remain
    as the 0032 collection always"), and keeps it past the story to the page's foot, only
    its line ending there (`StoryLines`, which follows the Collection part as the face
    draws). The select shows at every width: what it opens is up top, the Viewer, which is there
    when the columns stack too. Seamless (`data-brand`) previews Northwestern
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
    Mat set (Body first at 400, then Label, Summary, Items larger), the code
    crossfading with its new lines lit at a fixed 15 lines, the viewer fading out and in
    around it, and puts it back after. Each change starts with its story's line (Mat,
    2026-10-21: in sync) and waits `BAND` past its edge before undoing; the line draws in
    from the moment its end can be shown (a part on a face the viewer is turning to is
    looked for each frame), and the page's foot ends the last story too, its line fading
    (`data-gone`), still drawn to it, and its change undone, but for Natural's recipe,
    which the viewer keeps past it (Mat, 2026-10-25: "do not reset the side floating
    viewer … after the Natural story"). Where the viewer is held, a
    story's figure strokes draw as its line reaches it too (`data-drawn`), and elsewhere
    once they come into view past a point; every stroke draws once and stays drawn until
    the page loads again, never by the scroll's own position (`Swoosh.tsx`; Mat, 2026-10-22). Seamless has the site's Font family and Color (`BrandPicker.tsx`),
    which set the whole site and are remembered (`page-theme.ts`), Princeton's orange ahead
    of Texas A&M's maroon (Mat, 2026-10-29), and under the colors High contrast, a native
    checkbox (Mat, 2026-10-29), the site's higher-contrast mode, remembered too: on the
    document root as `data-high-contrast`, which the site's solid fills read (`--solid-*`,
    `tokens.css`) and every Clover on the page follows, as its styles key on the attribute
    around it. It is held on, checked and disabled with the reason under it, while the accent
    cannot carry white text at 4.5:1 (`carriesWhite`, `docs/lib/accent-contrast.ts`:
    Princeton's orange) or the reader's system asks for more contrast. In the column the
    other stories give their figures, and under its words its figures, smaller and side by
    side, then the CSS a page would write (Mat, 2026-10-21): `1rem` ("Inherited sizing") and `CSS` ("Variables for
    styling"), a word, never a count (Mat, 2026-10-21). The navbar's one
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
    (`.scroll`) (as tall as a third of the window, 8rem to 15rem; a Collection's 14rem to 24rem; Mat, 2026-10-25: never dominating a small window where a drag would be captured) lets the wheel pass to the page until the reader points into it or
    focuses in it (`data-armed`), so a trackpad's gesture is never spent on a box the
    page brought under the pointer; `Tile`, the viewer's parts, `ViewerCode`,
    `RecipeFace` and `AccessibilityTree` are memoized on what they show; animations are opacity or transform only (no `background-color` or
    `clip-path`, which the main thread redraws every frame); the recipe and the
    inspector's snapshot load while the page is idle, never mid-scroll; a change of the
    viewer renders as a React transition; no `:has()` on the page's root or its
    ancestors (attributes instead: `data-bar-stuck` and
    `docs/lib/full-width.ts`'s rules); no view transitions (their snapshot costs frames).
    Nothing a story begins or ends restyles more than a few hundred elements in one frame
    (Mat, 2026-10-24: "sluggish" as the Accessible and Composable stories met Seamless,
    whose preview went on and off over 1,500 elements at once): Seamless's preview reaches
    only what is on screen (the viewer's face shown, the stories and their line, the
    tiles the fold shows), and goes on and off about 400 elements a frame, a frame after
    the story's own change (`previewPageTheme`, `page-theme.ts`); and no inherited
    property (`pointer-events`, `visibility`, a custom property) is set on a large
    subtree as a story changes (the turned viewer's front is kept from the pointer by an
    empty layer over it, `.flip::after`, not `pointer-events` on it).
    Measure with a scroll in a current Chrome (`npx playwright` with
    `channel: "chrome"`), since Playwright's bundled Chromium is slower to restyle, and
    on a production build (`next dev`'s React adds some 16ms to each story's change),
    built in a copy of the tree with `node_modules` cloned (`cp -c`), so a running
    `npm run dev` is untouched, by wheel (as a trackpad scrolls) at Mat's size too, about
    1876 × 1960, with a Chrome trace: `UpdateLayoutTree`'s element count says how much
    restyled, and invalidation tracking
    (`disabled-by-default-devtools.timeline.invalidationTracking`) says why. There, on
    October 21, 2026, main-thread tasks were 1.7ms at the median, the Seamless story's
    restyle 6ms, and the only long frames the headless browser's own software raster; on
    October 24, no task at a story's edge was over 9.2ms (15.7 before), the preview's
    frames 5 to 7ms, the longest the Composable story's own change (9ms, React's part
    3 to 4ms), and no frame of 802 over 16.8ms.
  - That section is one `Root` for that resource. On the left its parts make a small
    viewer, held in view (by its foot, once taller than the window), and held so that
    at the page's end its foot meets the npm block's (Install's, where the grid ends;
    lower on a window too tall for the page to scroll so far, `--assembled-end`); where
    the columns stack (64rem and under) it is not shown at all, nor its code (Mat,
    2026-10-25: "should just go away when the columns stack"), with
    no caption (it
    is a region named "Example Viewer" for assistive technology; never `<Clover.Root />`),
    its parts in the order its code gives them, from the Label, with no Thumbnail (Mat,
    2026-10-27: moved to the title's right, then taken out; its tile stays), for every
    resource (`VIEW_DEFAULTS` and `STARTS`). The code control under it opens that code
    below, as an editor (Prism's Material colors on black, `--code-*` in
    `docs/styles/tokens.css`): its `Root` and parts as written. Its values are live
    (Body's `height` a number to type, step or drag, its `controls` a switch, Items'
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
    (a property, `items` alone for Items; for `Body`, "Canvas, Scene, or Timeline", what it
    is for, kept on purpose before a `Scene` draws; Mat, 2026-10-23), and nothing more: no fact from the resource
    beside them (Mat, 2026-10-23). Pointing at a tile outlines the part in the viewer.
    A tile's head is the link to the part's page, its name's, an arrow in its top right
    corner, muted, saying so: the same place from the corner on every tile, 1rem in from
    its edge and on its name's line, however the words wrap; pointed at or focused
    (`data-on`), its name underlines and its arrow takes the accent and steps forward (a
    transform), as its edge takes the accent (Mat, 2026-10-23: obvious and light; an accent
    band across the head was tried and found too heavy). Focused, its ring is the page's
    controls' (the accent, 2px). Where the tiles are under 47.5rem wide (a container
    query), the third and the two thirds beside it share their row in halves, as a third
    is then too narrow for a name, which never breaks, and its arrow. A part the resource gives
    nothing to is a chip at the end, under the last tile, inside what "More components" shows
    (Mat, 2026-10-24), naming what it would read and the playground resource
    that has it (`SHOWN_IN`). Every value shown is the resource's own: no illustrations,
    made-up figures or copy. Golden-ratio spaces, hairline edges, no gray fills.
    The tiles run (Mat, 2026-10-23): Label and Thumbnail, Body, Items, Summary, Metadata,
    RequiredStatement, Annotations beside Contents (either alone across the row), Search across its row after them (Mat, 2026-10-26; its Root answers the mocks' searches, `MOCK_SEARCH`), the
    Collection, then the rest. Provider (its logo and name, linked) is among the rest, after Rights (Mat, 2026-10-24). From halfway through the Collection's tile (its middle,
    measured, `--fold-at`, the fade centered there) to the end, the chips too, they fade
    out, a preview only, inert, under "More components", at the tiles' end (Mat, 2026-10-25; "Show all" before): pressed, it
    shows them all and goes, focus moving to the first of them (2.4.3), and they stay shown
    for another resource; a chip for a folded part shows them all too. Without a Collection the fold
    starts halfway through the first tile after it, and fewer than three such tiles do not
    fold (`FOLD_FROM`).
  - The playground shows how far one Viewer stretches: any layout with any kind of
    resource. Two pickers, each changing the Viewer without the other. Over it, centered,
    the resource (`ResourceField.tsx`): one field, its label, "Viewing" (named "Viewing IIIF resource", the rest visually hidden, WCAG 2.5.3; Mat, 2026-10-25; "Select…" before), in one pill, as Airbnb's search is (Mat, 2026-10-25: "more compact and friendly"):
    the resource's thumbnail, round, then the label (its `<label>`, semibold) over the field
    (its name, muted), the list's chevron, and Open at its end, a round accent button with
    Items' caret (the site's round buttons agree; Mat, 2026-10-25), named "Open", for the address or content state of the reader's own, with ours listed under it,
    the list as wide as the whole select (its label, the field and Open; Mat, 2026-10-22) (`resources`
    in `playground-config.ts`, in this order (Mat, 2026-10-26): a catalog, the footage, a
    Collection (the masks), a model in 3D, a manuscript in Arabic (Maktaba's), a
    recording, a postcard, a photo, a film, a map…), each by its thumbnail, its own label, and a few words on one thing it has
    that the others do not (`description`: concise, only what the resource has). The
    list's first item, always, is "View your own" (a dashed slot with a plus, as the old
    "Your own" tile was), which empties the field for an address. Each of the reader's
    own joins the list as they open it, after that, by its root `label` and
    `thumbnail` (never a Canvas's or member's) over its address, so they can switch
    between theirs and ours; held in memory only, never stored, gone with the page. Last,
    tucked away (Mat, 2026-10-25: "list all but place them inside of a category that is
    tucked away at the bottom of the list"), "IIIF Cookbook recipes", IIIF's logo in its
    slot, a hairline over it: chosen, it reads the recipes (the curated `cookbook`
    Collection's members, never fetched until asked for) and shows every one under it
    in one group (WAI-ARIA's grouped listbox, named for them), the list kept open, the
    first recipe marked and the count said in a status (4.1.3); chosen again, it hides
    them. Each is listed by its title as the Cookbook writes it, its folder's name on
    iiif.io under it ("0047-homepage"; Mat, 2026-10-25), and its thumbnail, else its
    number in the empty slot. Shown, typing narrows
    them with ours; they stay shown while a recipe is in the Viewer, and fold away again
    as anything else opens there, so ours stand apart (Mat, 2026-10-25: "toggling to a non
    recipe causes the two groups to come back together"). A recipe opens as the reader's own
    does (`?iiif-content=` its address), but the field shows it as the recipe, never
    adding it to the reader's own: so a link from a recipe's page on iiif.io arrives
    titled, its category open. A recipe in the Viewer is said plainly in the field (Mat,
    2026-10-25: "strongly hint they are viewing a recipe"): IIIF's logo set into the pill's top edge, in its middle, clear of the thumbnail, as a fieldset's legend is: the edge breaks around it on the page's ground, with no disc, edge or shadow of its own (Mat, 2026-10-25: "meshes better with the select"; held under the navbar, a little lower, so all of it shows), and after the title its folder's name on iiif.io, in the code's face, a
    size smaller and the title's muted gray (lighter would fail 1.4.3), the field as wide
    as the title where a browser sizes it so (`field-sizing`; else the name at the line's
    end), the name giving way first and never below its number, and on a narrow field
    (a container query) its number alone; the field described by it ("IIIF Cookbook recipe
    0029-metadata-anywhere"); gone while the reader types. The playground's field only. The recipes are read through `readRecipes`
    (`recipeCatalog.ts`), here and by the Natural story, from the `cookbook` mock, a IIIF
    Collection curated in `docs/mocks/cookbook/index.mjs` (Mat, 2026-10-25), so what it
    lists is what both list. What it lists is `docs/mocks/cookbook/recipes.json`, written
    by `npm run build:cookbook` (`scripts/build-cookbook.mjs`) from `cookbookSections.ts`
    and `resourceFor`: it reads each resource, leaves out (and says) one that does not
    answer, keeps its type (a Manifest or a Collection), finds its
    thumbnail (its own, its first Canvas's or member's, else its first image's service at
    a size its `info.json` allows, `docs/lib/iiif-image-sizes.ts`; an image without a
    service is never taken, being perhaps the full image), and says which recipes
    iiif.io's index lists that `cookbookSections.ts` does not, or the other way about.
    Run it when the Cookbook changes, then `npm run build:mocks`. The
    field shows the label of the one in the Viewer, never our word for its kind (`name`,
    which only the parts' chips use). It is a WAI-ARIA editable combobox: typing narrows the
    list, Down and Up open and move through it, Enter opens the one marked or what is
    typed, Escape closes the list and then puts the field back; focus stays in the field.
    On a touch screen a press lists ours and brings no keyboard (`inputMode="none"` while
    it shows one of ours; Mat, 2026-10-21), nor selects the label as a mouse's press does;
    "View your own" brings the keyboard, for an address, by focusing the field again
    within the press.
    Its edge, and the Template button's, is 3:1 (`--pg-edge`): controls only, while the
    Viewer and the parts' tiles keep their hairlines (Mat, 2026-10-16; the tiles at 3:1
    was tried and put back). Under the Viewer, in the template card, the template's
    dropdown listing the templates by name. No drawings of the layouts, no
    fills of light gray, spaces on Clover's golden-ratio scale. Each template shows with its own defaults: no props, no generated code (a
    Customize drawer with both was removed on purpose). The section is wider than the
    reading sections but held off the screen's edges; the Viewer keeps one height for
    every pairing, with a hairline edge and a small, soft gray shadow (never the accent).
    Keep the playground itself about layout and UX: names and those few words, no
    marketing lines; the marketing is in the choice under it and in Why Clover.
  - The homepage's titles and the words under them are two sizes, wherever they are (Mat,
    2026-10-25: "make sure we continue the same weight/size throughout … simplify our
    styling so that we are not building so many variants"): every title, a section
    intro's, the choice's halves and the stories' cards, is `--text-title`, bold, set by
    the window and never by the box it is in; every note and story's words are
    `--text-lede` (`tokens.css`). A new card or section takes
    these, never a size of its own. The hero's headline and its sentence (sized by the
    headline since 2026-10-25), the mono labels and the figures are their own.
  - The homepage's two sections after the parts open alike, with `SectionIntro`
    (`docs/components/Home/SectionIntro.tsx`): no rule over it and room around it (Mat,
    2026-10-21), a title ending in a period under the hero's stroke, one short note (`--text-lede`, as the hero's sentence and the choice's), and one call to action (`cta-solid` or `cta-outline`,
    `tokens.css`), under the note, always (Mat, 2026-10-25: "place it under the description paragraph"),
    all of it centered under 64rem, where the example viewer is no longer held (Install's
    command then its own width, 24rem at most, beside its button, the pair centered). The parts' is the choice's right half, above. Why Clover (titled "Thoughtful and flexible.", Mat, 2026-10-22; "Read the
    docs", solid in the accent since 2026-10-25; its note one conversational sentence of why, the full spectrum of user experience,
    every visitor, layout and IIIF resource, never "intention", a colon, or the title's words, never the stories in brief, which would say them twice; Mat, 2026-10-22) and Install ("Install is easy.", "Get started"), the last in the gap after Natural, beside the
    held viewer, the grid ending with its npm block (its Copy drawn as the example viewer's
    editor's is, `.installCopy`; the block beside its button, `SectionIntro`'s `beside`, as
    tall as it, and under it where the column is narrow; Mat, 2026-10-22), and a few rem under it, no more
    (`4.236rem`, the page's own; Nextra's empty room under the article hidden on full
    pages, `full-width.ts`), before the footer (Mat, 2026-10-21).
  - The footer (`docs/components/SiteFooter.tsx`, inside Nextra's `Footer`, styled in
    `layout.css`; Mat, 2026-10-20 and 2026-10-21) is one column on the page's white
    (`--color-background`), set off by white space alone, no line over it, its text at
    the sidebar's size (1rem) and black (`--nav-text`), but who made it and the legal line
    muted (`--gray-11`: 5.9:1 on white, 9:1 on the dark ground; Mat, 2026-10-21): the wordmark,
    then what Clover is in the homepage hero's words, a sentence a line (the headline's
    in bold, a step up, `1.618rem`, balanced where it takes two lines, Mat, 2026-10-22; the sentence at `--text-lede`, muted as the hero's is), then one paragraph in
    Mat's words, whose project Clover is (Academic Innovation at Northwestern University
    Libraries; Mat, 2026-10-22), since when (2021) and at which version ("version 4.x"), and how widely it is used and built on, a
    variety of implementations and the institutions that contributed, never a person
    (Mat, 2026-10-21: people are credited elsewhere; its maturity shown, never claimed),
    its "more" linking to the repository's contributors; the two across 61.8% of the
    footer's width (all of it on a phone). No history, and no titles. Under it, `3xl`
    away, that it is MIT licensed and fully open source, the holder as `LICENSE` names
    it: Northwestern University Libraries, from 2026, and the site's links (Code, the repository,
    Slack, named so alone and opening `#clover-iiif` on IIIF's Slack, `https://iiif.slack.com/archives/C090ZBQCL77`, Mat,
    2026-10-22 and 2026-10-25, and License;
    never the earlier version, Mat, 2026-10-21), with the
    appearance after them (Light, Dark or System, `ThemeSwitch.tsx`, Nextra's `Select`) on
    every page (Mat, 2026-10-21). Nextra's own switch is off (`darkMode={false}`), so
    none is in the sidebar's foot (its Collapse button at its start, the sidebar open or
    collapsed, with no rule over it; Mat, 2026-10-23), the phone's menu
    or a band over the footer. Keep each fact the record's.
  - The wordmark (`docs/components/Logo.tsx`, the navbar's and the footer's) is the text's
    color, the hero's stroke always under it (Mat, 2026-10-21: no longer drawn on hover),
    sized and set in `em` of the wordmark's height as the marks are (`--wordmark-height`),
    never a fade or a fill. Every stroke on the site is one shape,
    `--swoosh` (`tokens.css`), set one way (Mat, 2026-10-21): 0.42em tall, its ink from
    0.1em to 0.25em under the letters' foot, a little off them, crossing only what
    descends. The hero's mark (`.mark::after`), the marks and figures drawn as they come into view
    (on `.figureMark`, inline, so they sit as the marks do: `Swoosh.tsx`'s spans) and the
    wordmark keep that; measure a new one against them. A stroke draws from one end to
    the other, as a pen draws it, never stretched (Mat, 2026-10-22): a window slides
    open over ink that slides back as far, both transforms, so it holds still. A stroke never draws again for a color: its ink eases to a new accent (a registered `--stroke-ink`, 480ms, none where the reader asks for reduced motion; Mat, 2026-10-25).
  - The site's icon (Mat, 2026-10-30) is Clover's Next control, as Items' Next and the
    playground's Open draw it: the accent's round fill and its white caret, the caret
    larger and heavier so it holds in a 16px tab. `app/icon.svg` is its source, and
    `npm run build:icons` (`scripts/build-icons.mjs`) draws `app/favicon.ico` (16, 32 and
    48px) and `app/apple-icon.png` (180px, square, the accent to its edges) from it; run
    it after changing the SVG, and commit all three. Tried and set aside that day: the
    wordmark's C on the accent (it read as a crescent moon) and the stroke across a black
    tile (at 16px, the "thin blue line" symbol).
  - Every card, container, call to action and code block on the site has one radius,
    `--radius-4` (12px), Nextra's code blocks, callouts and search field too
    (`layout.css`); what sits inside one takes a smaller step (`--radius-2`,
    `--radius-3`), so the corners nest, and pills stay pills (Mat, 2026-10-22: "keep
    consistency"). Every card lifted off the page has one shadow, `--card-shadow` (a
    hairline edge and a soft gray shadow, `--card-lift` on its own), the same on the
    homepage and in the docs (Mat, 2026-10-22).
  - Headers are solid, never frosted or translucent: the navbar (`docs/styles/layout.css`
    overrides Nextra's blur) and the playground's bar. From 48rem wide, on a screen at
    least 36rem tall (not a phone, where with the navbar it would take too much height),
    it holds under the navbar as its lower half, a little up under it (0.382rem): while
    the playground's Viewer and then the parts pass under, the navbar's edge moves to the
    bar's foot, the field runs as wide as the navbar's content, the wordmark to the
    repository's icon, never past it (Mat, 2026-10-25: "only the viewer container can do
    this"; at rest it keeps 1rem from the Viewer's edges), and the bar's foot rides on the first story's top (Adaptable,
    `data-bar-until`) as it leaves (Mat, 2026-10-25: "keep this sticky … all the way
    through the component examples"). Its box reaches there: a spacer after the Viewer
    (`.reach`) as tall as from the Viewer's foot to the story, and the same room taken
    back as the box's negative margin, both written by `useStuck` only when they change,
    never as a custom property (the Viewer would inherit it). While it is held, the
    example viewer beside the tiles is held under it (`html[data-bar-stuck] .assembled`,
    `--bar-height`), and goes up to its place as the bar leaves. `useStuck` writes
    `data-stuck` to the bar directly, not to state, so this never re-renders the Viewer.
    While the bar can hold, `useStuck` sets the page's `scroll-padding-top` to the navbar
    and the bar, measured, so a control that takes focus in the Viewer comes into view
    below the bar (WCAG 2.4.11).
  - The navbar holds the docs' code switch, React or Web components (Mat, 2026-10-21;
    React by default; `docs/components/CodeSwitch.tsx`), after the search and before the
    repository's link: a pair of native radios, one tab stop, named "Code examples", drawn
    as the Transcript's EN | TXT is (pills, no frame, small semibold text, muted until
    chosen), the chosen one in the Viewer's controls' dark fill (light on a dark page),
    never the accent at rest (it drew the eye from the page), the accent under the pointer
    or focused. The choice is the reader's (`docs/lib/code-flavor.ts`): stored, in step
    across tabs, and set on the root as `data-code` before the page paints
    (`code-flavor-script.ts`, in the root layout's head), so CSS shows an example's code in
    the chosen flavor (`data-code-flavor`, `layout.css`) with no flash and no re-render;
    both flavors stay in the HTML, for agents and pages read without scripts. Get started's
    install choice sets it too (`InstallGuide.tsx`). On a phone the header's reads
    "React | Web", the rest of the name still read (2.5.3); under 360px the
    repository's icon gives way (the footer links the source), so the header fits at
    320px (1.4.10).
  - Menus, calls to action, headings, titles, tabs and labels are in sentence case, on
    the site as in Clover (`packages/clover/DESIGN.md` §8; Mat, 2026-10-22): "Get
    started", "Composing layouts", "API reference", "Viewer documentation", "On this page"
    (Nextra's table of contents, `toc` in `app/layout.tsx`). Proper names keep their
    capitals: Clover's components and templates where the words name them ("In the
    Viewer"), IIIF, its resource types and specifications (Content Search), the IIIF
    Cookbook, React, people, places and institutions. Words from elsewhere stay as
    written: a resource's label, a Cookbook recipe's title, the Digital Collections
    mock's copy of that site. No style sets a heading, menu item or call to action in
    capitals; the stories' one-word mono labels (`.storyLabel`) are type, not headings.
    The 3.x pages keep the earlier version's own headings; their menu follows the rule.
  - Every Clover 4 page holds its examples in both flavors (2026-10-22). Each `jsx or `tsx
    fence gets its "Web components" twin as the page compiles
    (`docs/lib/code-flavors.mjs`, run by `docs/lib/mdx-code-flavors-loader.cjs`, a loader
    before Nextra's in `next.config.mjs`, as Turbopack takes no plugin functions):
    `jsx-to-html.mjs` turns the JSX into the elements' HTML through their specs, `{url}`
    the frame's resource (`example-urls.mjs`) or else the Cookbook's book, and the two are
    boxed `data-code-flavor`, which `layout.css` shows by the reader's choice. A fence HTML
    cannot say (hooks, state, functions) gets its twin written by hand, `html twin right
after it, or stays React's, shown in both; `jsx react shows to React's readers alone
    (a stylesheet's import). Write a new example so it turns, or give it its twin. Words
    in prose that only look like a prop (an attribute's values, `timeline`, `scene`) go in
    `<span data-code-flavor="both">`, which the turning skips and both flavors show (Mat,
    2026-10-23: values bare, never quoted). After
    changing those helpers, restart `npm run dev`: Node keeps the modules the loader
    first loaded. A page compiled between the change and the restart keeps what the old ones
    made (Turbopack caches it against the new files): clear `.next/dev` as you restart. A component's "API reference" wraps its React tables in
    `<ApiReference elements="clover-…">` (`docs/components/Clover4/ApiReference.tsx`),
    which draws its elements' tables from their specs, with the page's own Markdown
    components, in the other flavor. `OptionsExample` shows its chosen value's code by
    CSS (`data-shown`), so the Markdown keeps every value's. `?code=web-components` (or
    `react`) on an address chooses the flavor before the page paints, never stored; the
    homepage's editor writes HTML in that flavor (its lines as many, its values as live);
    the Markdown labels each flavor ("React", "Web components") and keeps each fence's
    language (`mdx-components.tsx`'s `code`), as `llms.txt` says; and the elements'
    manifest is published at `/custom-elements.json` (`app/custom-elements.json/route.ts`,
    from the package's build).
  - Titles and share cards are `pageMetadata` (`docs/lib/site.ts`), the root layout's
    `metadata` and each page's `generateMetadata` (`app/[[...mdxPath]]/page.tsx`): the
    homepage's title is "Clover IIIF – A viewer as distinctive as your collections" and the site's
    description says what Clover is, plainly, in Get started's words, in React or as web
    components (Mat, 2026-10-21: so an agent or a search result can tell; plural since
    2026-10-22, when every part became one, never "a web component"; every description of
    Clover, the READMEs' and the packages' too, names both, and only what each does
    today). The hero's headline and line are written once (`homeHeadline`, `homeTagline`
    in `site.ts`), for the hero and the footer, and carried wherever the brand speaks
    (Mat, 2026-10-22): the homepage's description and share text open with the line, then
    say what Clover is, as plainly (`homeDescription`); its structured data gives them as
    `headline` and `alternativeHeadline`; `llms.txt` (and so `llms-full.txt`) and the
    README carry both. A page takes its `title` (front matter, else its first `h1`,
    Nextra's rule) and its `description`. Give every page a `description`: agents read it
    in `llms.txt`, the parts' list and the Markdown, and a search result shows it under the
    title, so it is the page's own and at most 155 characters, a 3.x page's with what it
    documents added (Mat, 2026-10-30: `DESCRIPTION_MOST`, held by `docs/lib/site.test.ts`;
    the site's and the homepage's too, so "Accessible, composable and light." is said by
    `aboutClover` alone). Each page's structured data names its publisher and gives its
    breadcrumbs, the site, the menu's folders around it (`trailOf`, `docs/lib/agents.ts`)
    and the page, which a desktop search result shows in place of its address; no page
    draws them. Every page's card picture is a 1200 ×
    630 band of the White catalog's cover, cut by Northwestern's IIIF Image server and
    linked from there, never copied into `public/` (Mat, 2026-10-16: the record's
    attribution does not permit further distribution of its images).
  - Under the navbar on the homepage alone (Mat, 2026-10-22: not on interior pages, whose
    footer says it), a small acknowledgment in the corner, on the page's
    ground with no band or edge of its own (Mat, 2026-10-20; a gray band and hairline
    were tried and taken off, 2026-10-25), at Clover's smallest step (`--clover-text-xs`,
    2026-10-25), muted (`--gray-11`, 2026-10-21; its link too, underlined, 2026-10-25),
    says Clover is a project of
    Northwestern University Libraries, linking the Libraries'
    site (`docs/components/Subheader.tsx`, by `usePathname`, so the static export holds
    it in the homepage's HTML only; styled in `docs/styles/layout.css`). It is
    aligned to the end of the navbar's content, and centered under 48rem (Mat, 2026-10-25),
    over the centered hero. It is not held (Mat, 2026-10-16):
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
  - The live examples' sample material is not what the site is about (Mat, 2026-10-25:
    "the important content retrieved from the page is the documentation for the Clover
    app and its marketing material -- NOT THE the rich material being using for
    examples"), but it stays there for everyone, said to be an example ("make sure that
    the examples are accessible, but that they are accurately described as examples. we
    want these examples to remain helpful for agents aiding users"). Every live example's
    demo, never its code, spreads `example()` (`docs/lib/example.ts`): `data-example`,
    `data-nosnippet` (out of search engines' snippets; Google reads it on a `div`, `span`
    or `section`), `data-pagefind-ignore="all"` (out of the docs' search), and, given a
    name, a group so named ("Example"), which a screen reader and an agent reading the
    accessibility tree meet; unnamed where the demo has a name of its own (the held
    "Example Viewer", the 3.x "Example items"), is a control (the select), or sits in a
    named example already (a demo inside `<Example>`, whose frame marks it; never two).
    Where: the docs' example frames (`ViewerDocs.tsx`'s `preview`, `LiveCode.tsx`,
    `ComposeExample.tsx`, `StartExample.tsx`) and an agent's preview in one
    (`AgentPreview.tsx`), `LanguagesDemo`, the 3.x wrappers (`DynamicImports/*`,
    `GermanViewer`, the Cookbook panel, `FeaturedGrid`), the test mocks ("Example page"),
    and on the homepage the playground's Viewer, its select, the held viewer's faces and
    each tile's live part (its head, the part's name and docs link, unmarked). A new live
    example takes it. The agents' Markdown quotes a marked demo under **Example**, saying
    it shows sample IIIF data (`scripts/build-agent-docs.mjs`), and `llms.txt` says the
    same and that the examples are worth using to show a reader how Clover behaves. The
    select renders its options only while open, so no page's HTML holds the samples'
    names. Every page is `noimageindex` (its pictures are the samples'; the site's marks
    are inline), the unlisted and the test mocks `noindex` too (`pageMetadata`'s
    `indexed`), and the share card's alt says it is a sample image from the examples.
    `robots.txt` cannot help on `clover.iiif.library.northwestern.edu` (read only at a host's root);
    on a domain of its own, disallow `/mocks/` and `/test/`. The Mocks page stays as it
    is: its tables are the mocks' addresses and queries, documentation a developer needs.
  - What agents and crawlers read (Mat, 2026-10-21) is built with the site, from what it
    already holds (`docs/lib/agents.ts`: the docs' menu, each page's front matter, and
    `figures.ts`), and, the site being a static export, each is a file:
    `llms.txt` (`app/llms.txt/route.ts`; what Clover is, at a glance with its figures,
    then the docs as their menu lists them, each linked to its Markdown, 3.x under
    "Optional"), `sitemap.xml` (`app/sitemap.ts`, every page but the unlisted and
    `/test/`, with its file's last commit's time, from Git, `docs/lib/last-changed.ts`, as
    the pages' `dateModified` is: Nextra's own `timestamp` was not always the file's, and
    the deploy fetches the whole history for it) and `robots.txt` (`app/robots.ts`; a crawler reads
    one only at a host's root, which the site now has, so it counts). After
    Pagefind, `scripts/build-agent-docs.mjs` writes each of the sitemap's pages as
    Markdown beside its HTML (`/docs/items.md`, converted from the built page, its
    examples' code and tables included, each fence with its language, from its block's
    `data-lang`, and each link's words without the space Nextra's arrow left, front
    matter giving its title, description, address and version) and `llms-full.txt` (Clover 4's pages, in `llms.txt`'s order),
    and fails the build if `llms.txt` links to a page it could not write. Each page's
    head links its Markdown (`alternate`, `text/markdown`; the homepage's is `llms.txt`).
    The homepage's structured data is Clover itself (`homeData`: the site, its publisher,
    and the software, its features its parts' descriptions), and its HTML lists the
    parts (`PartsIndex.tsx`, drawn on the server into the parts' placeholder, out of
    sight and out of search) until the live parts take its place, for a reader without
    the page's scripts. Agent-facing words say what Clover does as released
    (`npm install @nulib/clover`; Mat, 2026-10-21: "assume my product will be live").
  - Agents' helpers (WebMCP; Mat, 2026-10-25 and 2026-10-26): three tools every docs page
    offers an agent in the reader's browser, about Clover and never the examples' sample
    material, one of them drawing a preview in the page's first example frame. Readers meet
    them on Build with an agent (`content/docs/agents.mdx`, hidden for now), written for a
    reader with an AI agent in the browser, never as notes on the tools (Mat, 2026-10-26:
    "it reads like notes to a developer"). What they may do and read, their engine and how
    they grow are under "Agent tools (WebMCP)" below.
  - `/test/…` (`content/test/`) holds unlisted mocks of host pages, for trying Clover 4
    where it is meant to live: raw layout, no docs navbar or footer, out of search.
    `/test/dc-item` is a Digital Collections item page (`docs/components/DcItemMock/`),
    filled from the DC API, with the Viewer and `Items` where the site has 3.x's Viewer and
    Slider; `?id=<work id>` opens another work, and a row's works open in the mock.
- The package builds to `packages/clover/dist/`; the site's static assets are in `public/`.
- Tests are colocated near code as `*.test.ts|tsx`: the package's, and the docs' own
  helpers in `docs/lib/` (the root `vitest.config.mjs`), run together through
  `vitest.workspace.mjs`, with the package's again on React 18
  (`packages/clover/vitest.react18.config.mjs`, its React installed in
  `packages/clover/e2e/react18`; the root's React is 19, the docs') and the web
  components' under Preact, as they ship (`packages/clover/vitest.preact.config.mjs`).
  CI also builds the package and runs `npm run test:build`, the build's own checks and
  budgets. The end-to-end suites run locally only (`npm run e2e`): the package's
  (`packages/clover/e2e/`), then the docs site's (`e2e/` at the root, `npm run e2e:docs`,
  Chromium over `npm run dev`, a running one reused), which checks the agent tools with a
  stand-in `document.modelContext`. Against a build instead: `npm run build:docs` (in a
  copy of the tree while `npm run dev` runs), `node e2e/serve.mjs` (`out/` as Pages
  serves it, its base path taken off), then `DOCS_URL=http://localhost:4400 npm run
e2e:docs`.

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

- Language: TypeScript + React (Next for docs; Preact for the web components' build,
  `packages/clover/build/web-components.config.mjs`: ES modules with a classic-script
  loader).
- Formatting: Prettier (semicolons enabled). Use `npm run prettier:fix` to format.
- Linting: ESLint with `next/core-web-vitals` and `@typescript-eslint` rules.
- Naming: React components in PascalCase, files `*.tsx`; utilities in camelCase `*.ts`.
- Vocabulary (Mat, 2026-10-23: "normalize our language around our defined components"):
  name a thing by the component that draws it, in docs, comments, code and class names
  alike. The box a view is drawn in is the Body, never "stage"; what comes and goes over
  it (the control cluster, the transport, the scrim) are the controls, plural, never
  "chrome", which is the browser's word alone; the playground's box is the Viewer, and
  Document's scrolling pages are its column. A template's `-body` class sits on its
  `Clover.Body` alone (`-panes` on its `Split`). Where `body` would meet a IIIF
  annotation's body, take a fuller name (`bodyBox`, `figure`).
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
- A dated decision (Mat, …) stands until Mat changes it. A change that would reverse one
  is put to him, with the reason it was made, never made quietly.

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
- The package brings the same worker to its consumers: its build fills
  `src/components/Map/maplibre-worker.ts`, empty in source, with the bundled worker
  (`packages/clover/build/maplibre-worker.mjs`, a plugin in its `vite.config.mjs`), which
  `MapView` starts from a `blob:` URL when the page sets none. It must match the MapLibre
  running, so `maplibre-gl` is pinned exactly in the package's `dependencies`: bump the
  two together.
- `scripts/build-maplibre-worker.mjs` bundles `maplibre-gl-worker.mjs` (it imports
  `maplibre-gl-shared.mjs` by relative path, which a blob URL cannot resolve, so it must
  be bundled rather than copied) into `docs/lib/maplibre-worker.generated.ts`, which is
  gitignored and regenerated by `prebuild:docs`, `predev` and `pretypecheck`. Run
  `npm run build:maplibre-worker` by hand after bumping maplibre-gl.

## Packages

- `packages/clover` is `@nulib/clover`, the composable 4.x Clover, as an npm workspace.
  Its own rules are in `packages/clover/AGENTS.md`.
- Publishing (Mat, 2026-10-27: a beta first, 4.0.0 later that week): the package is
  public and ready to publish, but for its `version`, which is Mat's, as publishing is.
  `publishConfig` gives `access: public`; its `tag: beta`, which held the betas off
  `latest`, came out for 4.0.0 (2026-10-30), so a release goes to `latest`. A later
  prerelease takes `npm publish --tag beta` (or `next`), or it becomes `latest`. npm 11's
  "Publishing … with tag latest" notice reads the command line only: the publish itself
  takes `publishConfig`'s tag where one is set. A release is tagged in Git by its package
  and version, `@nulib/clover@4.0.0` (Mat, 2026-10-30), apart from the `v…` tags 3.x and
  `@samvera/clover-iiif`'s release candidates (`v4.0.0-rc.0`, `v4.0.0-rc.2`) left; the
  betas have none. `prepublishOnly`
  builds from clean and runs `test:build`, so no stale `dist/` ships, and `files` leaves
  out the build's chunk maps (`.vite/`). Its README (`packages/clover/README.md`) is the
  npm page, its links absolute; its `LICENSE` is a copy of the root's, kept the same.
- The package never imports the docs or 3.x (`@samvera/clover-iiif`): ESLint forbids it,
  and the package's build rejects undeclared imports. Only the 3.x docs pages import 3.x.
- 3.x is kept on this repository's `v3` branch (3.17.0, `d0f457f`; it was
  `samvera-labs/clover-iiif`'s `main` until the move of 2026-10-28), apart from `main`.
  Code the package copied from it (fullscreen, hls, i18n, the control cluster) may drift.

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
  a Root `language` follows the same order (`readerLanguages`, which Clover's strings read
  too; `closestLanguage` picks the tag, IIIF's rule, held to `@iiif/helpers`' by
  `languages.test.ts`; both `src/i18n/languages.ts`). Each regional tag also tries its base
  language (`pt-BR` → `pt`).
- Every rule for how Clover chooses a language and marks text with it lives in
  `packages/clover/src/i18n/` (Mat, 2026-10-29: "DRY all internationalization rules"),
  each module loading where its callers do; `packages/clover/AGENTS.md`, "Languages", has
  the map. A new rule goes there, never beside the part that first needs it.
- The chain is made once and read by every string, Items' hundreds of tiles each asking
  (`lookupChain`, `i18n/config.ts`; Mat, 2026-10-27, kept at its cost); it is made again
  only as the strings or settings (`version`), the page's `<html lang>` or the browser's
  languages change. Anything new it reads joins that key.
- Components call `useCloverTranslation()` and use `t` and `langOf`. It re-renders through
  `useSyncExternalStore` when `initCloverI18n` changes the language or the strings.
- Any element that shows one of Clover's strings, or is named by one (an `aria-label`, an
  icon button with a `Tip`), carries `lang={langOf(key)}`: the string's language where it
  differs from the page's, and nothing otherwise (WCAG 3.1.2). An element showing text,
  Clover's or a IIIF value's, spreads `{...languageProps(lang)}` (`src/i18n/direction.ts`)
  in place of `lang`, which adds `dir="rtl"` where the language is written right to left
  (Mat, 2026-10-29: "carry this through on labels/text"); a component's own `lang` prop
  (`Tip`, `Button`) stays a prop, and a field (`input`, `textarea`) keeps `lang` alone, its
  direction the reader's typing. A container named by a
  string or a IIIF label (a `nav`, a list, a group) takes its name from
  `useContainerName(text, lang)` (`src/i18n/useContainerName.tsx`), which, where the name's
  language differs from the page's, uses `aria-labelledby` and a hidden element carrying
  `lang`.
- Each Clover root reads the page's language with `useRootLanguage`
  (`src/i18n/useRootLanguage.ts`). The roots are a `Root`, and a `Canvas`, `Items` or `Map`
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
- Clover's English is in sentence case (`packages/clover/DESIGN.md` §8), which
  `locales.test.ts` checks; a string with a proper name the test does not know adds it
  to `PROPER_NAMES` there.
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
- Shipped: en, es, fi, fr, nb, nn, no (the same strings as nb for now, but its own file:
  Norwegian's three tags, `no`, Bokmål `nb` and Nynorsk `nn`, each keep one, to be
  translated apart; never merge them; Mat, 2026-10-27) and pt (European Portuguese, which
  Brazilian readers get too). The non-English strings await native review
  (`ACCESSIBILITY.md`, P56).

## Mocks

- Complex, reusable IIIF mocks are published, not kept private to a test. Each has one
  generator in `docs/mocks/<name>/` and three outputs that must agree:
  - static files in `public/mocks/<name>/`, written by `npm run build:mocks`
    (`scripts/build-mocks.mjs`, run with vite-node) and committed, published with the
    docs at `https://clover.iiif.library.northwestern.edu/mocks/<name>/`;
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
  (static), the playground's Print until 2026-10-26, when a postcard of Deering Library
  took its place (Mat);
  `navplace`, Northwestern's record of a Sullivan slide of a Chicago bus, kept as fetched,
  with a navPlace point at the corner its summary names (static), the playground's
  Photo; `paged`, Northwestern's record of the White Sewing Machine Company's 1896 bicycle
  catalog, a `paged` Manifest kept as fetched, with a `summary` written from its own
  fields and pages (it had none), its double-page plate (Page 15)
  `facing-pages`, so it stands alone and Page 16 and Page 17 share a spread, and Ranges
  for its sections (`structures`, titled only by its printed headings or the covers'
  Canvas labels; some name a region), each plate's "Then" and "Now" tagged and, after
  the word, described as a cataloger would, concisely (Mat, 2026-10-26; "Now – Postman on
  bicycle greets woman in period style white dress on bicycle."), and its
  words read by machine (Mat, 2026-10-26: "transcribe this item and build a iiif search
  endpoint for it"; Apple's Vision framework, `npm run build:paged-ocr`,
  `scripts/ocr-vision.swift`, macOS, each page read at a size its `info.json` lists and
  no image kept, into `ocr.json`, not corrected by hand) as OCR by line and by word and
  a Content Search 2.0 service by word or phrase (static, and live in `npm run dev` under
  `pages/api/mocks/paged/`; the docs answer its searches in the browser,
  `docs/lib/mock-search.ts`), the playground's Catalog. Its OCR and search, and the
  newspaper's, are one engine, `docs/mocks/ocr-search.mjs`; `annotation-collection`, a scaled AnnotationCollection
  example (Mat, 2026-10-29: "document it as a scaled annotation collection example"): the
  `paged` catalog's Canvases with each line its OCR read a `tagging` annotation on its box,
  569 on 28 pages, a page of lines referenced from each Canvas, every page `partOf` one
  AnnotationCollection ("Lines of text, read by machine", its `total`, `first` and `last`
  in the Manifest's references too, as Cookbook 0309 advises), and none of `paged`'s own
  annotations or search, for trying pages that load as the reader reaches them (static,
  and live in `npm run dev` under `pages/api/mocks/annotation-collection/`, its pages'
  ids under the dev server); `hindenburg`, Northwestern's record of WLS-AM's
  Hindenburg broadcast, kept as fetched, its Canvas of sound given an
  `accompanyingCanvas` painting the reel's box (the record's "enclosure back", its label; Mat,
  2026-10-24), English captions transcribed by speech recognition and corrected by hand
  (`captions.json`, `[unclear]` where a word could not be told; not yet checked by a
  listener), nine chapters titled with the broadcast's own words, and a page of
  `describing` notes on its time (Mat, 2026-10-24), the playground's Recording and
  Timeline's resource (static, and live in `npm run dev` under
  `pages/api/mocks/hindenburg/`, since its captions are its own); `transcripts`, Cookbook 0219's _Lunchroom Manners_ with its
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
  2026-10-19), labeled "Rudolf Hess at Nuremberg Sentencing" (no dates; Mat, 2026-10-26): a "Rudolf Hess" page of three tracked annotations (`xywh=…&t=…`, `tracks.json`)
  and an "Other Defendants" page, English captions from the trial's record
  (`captions.json`, the Russian and French interpretation in the record's English), the
  same words as a plain-text transcript (the Canvas's `rendering`), and chapters titled
  with the archive's description, each with a still of its own in a `thumbnail-nav` Range,
  the leaders `no-nav` (Cookbook 0229; Mat, 2026-10-30) (static, and live in `npm run dev` under
  `pages/api/mocks/rudolf-hess-nuremberg/`, since its captions and transcript are its
  own). It is the playground's Footage; `esu-shrine`, Northwestern's Material History
  Lab's scan of an Esu shrine (IBD12-AD-2-1), which the Lab publishes in Smithsonian
  Voyager and not as IIIF, as a Presentation 4 Manifest of one Scene (Mat, 2026-10-23):
  its label, metadata and homepage from the Lab's object page word for word, its
  thumbnail the page's first photograph (the Voyager scene's renderings show its editor's
  box around the model), and its GLB painted at the origin, turned about its upright axis
  to the Voyager scene's opening view, written from that scene as fetched
  (`source.json`). The Lab's server sends no CORS headers, so the model (34.5 MB,
  © 2025 Northwestern University) is kept beside the Manifest, `model.glb`, as it came
  (Mat, 2026-10-23: "download the model so we don't have to worry about cors"):
  `npm run build:mocks` fetches it from the Lab only when it is missing, and the live
  copy (`pages/api/mocks/esu-shrine/`) serves that file. The photograph is linked, never
  copied. It is the playground's Model; `cookbook`, the IIIF Cookbook's recipes as one
  Collection, only those on its viewer matrix (`https://iiif.io/api/cookbook/recipe/matrix/`,
  which `npm run build:cookbook` reads; Mat, 2026-10-28), each a member by the resource the Cookbook publishes for it, its title,
  its folder's name on iiif.io as its summary ("0047-homepage", `none`; Mat,
  2026-10-25), its thumbnail and its page on iiif.io (its homepage),
  curated in its generator (its words, and `LEFT_OUT`: a resource another recipe owns is
  listed once, so 0466 and 0599 are out), from `recipes.json`, which
  `npm run build:cookbook` writes (static; the homepage's field and Natural story read
  it). The package's tests use copies of
  `page-transcript`, `paged`, `rudolf-hess-nuremberg` and `transcripts`, in
  `packages/clover/src/fixtures/mocks/<name>/`.

## Agent tools (WebMCP)

- Every docs page offers an agent in the reader's browser three tools through WebMCP
  (`docs/lib/webmcp/`, registered by `docs/components/AgentTools.tsx` in the root layout;
  Mat, 2026-10-25 and 2026-10-26): about Clover itself, what it is, what it handles across
  the IIIF specifications and how to build with it, helpers that guide implementation
  first, above all those that compose a Clover example as they go, and never the examples'
  sample material. They are lean (Mat, 2026-10-26: "let's also try to be lean and not
  overload tools") and written to grow with Clover ("Built to grow", below).
  `nulib-labs/clover-mcp`, 3.x's MCP server, is context only; updating it is separate work.
- `clover_suggest_layout` finds the parts for needs, in a reader's words or by name ("3d",
  "captions", "Items"), for a resource's address, or both: each part with its props and
  docs, and a layout to start from; it answers "does Clover handle…?" too.
  `clover_compose_layout` checks a layout (the Viewer in a template, or parts in a Root, in
  the page's own `div`, `section`, `aside`, `header`, `footer` and `nav`) and writes it as
  a whole module, with its install and each part's docs and size, one flavor a call, React
  unless the call asks for `html`; a layout that does not hold gets what is wrong at each
  place and how to put it right, and no code. Both are read-only, the first marked
  `untrustedContentHint`. `clover_preview_layout` draws a layout, or a capability over a
  sample that has it, in the page's first example frame, and knows its page: given
  nothing, a part's page shows its part, and the Viewer's page the Viewer (Mat,
  2026-10-26). It changes that page and nothing else (`readOnlyHint: false`), and a page
  with no frame (Styling) is refused, naming pages that have one.
- Cut, and kept out (Mat, 2026-10-26): searching or fetching the docs (`llms.txt`,
  `llms-full.txt` and each page's Markdown give them), listing parts, checking support and
  describing a resource (`clover_suggest_layout` answers all three, and
  `clover_compose_layout`'s errors list a part's props), checking code (an agent composes
  again; a JSX parser in the browser would weigh more than it helps), setting a template
  or opening a resource in the Viewer (a Viewer layout is one compose writes and preview
  draws), reading the Viewer's state (it would hand agents the samples' content), and
  `show_capability` (folded into the preview). Fold a new helper into one of the three, as
  a new input or a new answer; a new tool needs Mat's agreement.
- Every agent on the page reads every tool's schema, so each stays small: part, template
  and capability names, never every prop (props come back from `clover_suggest_layout`, or
  in `clover_compose_layout`'s errors). Answers are bounded: lists name things, detail
  comes when asked for. A tool answers in plain data, which WebMCP serializes as JSON, a
  failure too (`ok: false`, and what is wrong), never a thrown error (`run.ts`).
- What a tool says comes from what Clover already states: the element specs, the docs'
  menus, `sizes.json` and the docs' own code writer (`live-code.ts`), so its code, in
  either flavor, is what a reader copies from the docs, and its sizes are the build's
  (`write.test.ts` holds the module `clover_compose_layout` writes). Kept by hand, each
  small and held by a test that fails saying what to add: `capabilities.ts` (what Clover
  handles, in a reader's words, the parts for each, and a sample from
  `part-demo-resources.ts`) and, in `catalog.ts`, `ENTRY`, `INSIDE` and `DOCUMENTED_ON`.
- The engine, `docs/lib/compose/`, is plain modules, no React and no DOM. A page carries
  only the tools' definitions, written on the server from the catalog (`agentTools()`,
  which `app/layout.tsx` hands to `AgentTools.tsx`, and `llms.txt` lists under "Tools for
  agents"), and the code that registers them. What they do (`run.ts`) and the engine load
  on the first call, the preview's renderer (`AgentPreview.tsx`) on the first preview; the
  docs' e2e suite (`e2e/specs/agent-tools.spec.ts`, with a stand-in
  `document.modelContext`) checks that neither loads sooner, so keep it so.
- A resource is read for its structure alone, and what is read is untrusted
  (`docs/lib/compose/read-resource.ts`, `structure.ts`): an `http:` or `https:` address,
  or a content state as the package decodes one (`core/content-state-reader.ts`), fetched
  without the reader's cookies (`credentials: "omit"`) or the page's address
  (`referrerPolicy: "no-referrer"`; its origin still goes with a request to another site,
  as CORS needs), waited for and read only so far (`WAIT`, `MOST_BYTES`), and stopped by
  the caller's cancel. `structure.ts` is a reader of its own, by `type` and `motivation` in
  Presentation 2, 3 and 4, not `@iiif/parser`: only counts, and tokens checked against
  what IIIF defines, come through, never a string the resource wrote, and past its
  `LIMITS` it says so (`truncated`). The answer marks the resource `untrusted: true` and
  says what it did not read.
- A preview is an example, held to WCAG 2.2 AA as every example is. It takes the place of
  the first example frame the page shows, in document order, never one it hides, as Get
  started hides the setups not chosen (`preview-store.ts`), until the reader presses "Show
  this page's example", which brings the page's own back with focus on the frame (2.4.3),
  or leaves the page. It is marked as an example (`example()`), its code under it in both
  flavors (`LiveCode`). A tool never moves focus, and scrolls the page only when asked
  (`reveal`, at once where the reader asks for less motion). The status region
  `AgentTools.tsx` keeps out of sight says as a preview comes and goes (4.1.3), and a
  layout that throws as it is drawn says so rather than taking the page with it. Its
  titles, the Viewer's too, take the level one below the heading its frame sits under
  (`levelUnder`), as the docs' demos take theirs (1.3.1), and the answer says which.
- WebMCP is as the W3C Web Machine Learning Community Group's draft of 2026-10-20 has it,
  checked again on 2026-10-26 (`register.ts`, and the e2e suite's stand-in,
  `e2e/specs/stand-in.ts`; check both against a later draft): `document.modelContext`, on
  `navigator` in earlier drafts, so both are looked for, whose
  `registerTool(tool, { signal })` keeps a tool until the signal aborts and refuses a name
  already taken (the page then leaves that tool out, quietly). A name is 1 to 128 of ASCII
  letters, digits, `_`, `-` and `.`, unique in a document (`tools.test.ts`). It needs a
  secure context, and its `tools` Permissions Policy is `'self'` by default. Chrome offers
  it in an origin trial (149 to 156; Edge 147 behind a flag): its token,
  `WEBMCP_ORIGIN_TRIAL` (`docs/lib/webmcp/origin-trial.ts`), is empty until Mat registers
  one (https://developer.chrome.com/origintrials) for the origin the site is served from
  (`https://clover.iiif.library.northwestern.edu`), and every page then gives it as
  `<meta http-equiv="origin-trial">` (`app/layout.tsx`). A token works only on its origin, so a
  move to another host needs one of its own.
- Built to grow (Mat, 2026-10-26). When Clover grows, the tests named fail until each step
  is done:
  - A new part: its element spec, as every part has, puts it in the catalog. Then a page in
    the docs' menu, or a line in `DOCUMENTED_ON`, and a line in `capabilities.ts`; in
    `INSIDE` if it sits only inside another part; in `ENTRY`, with its entry point's source
    in `catalog.test.ts`, if it comes from a new entry point. A property part (in the
    Primitives menu, its `of` reading the Manifest) is named for the IIIF property it reads
    (`RequiredStatement` reads `requiredStatement`). `catalog.test.ts` says which is
    missing.
  - A new template: its word in the Viewer spec's `template`, its name and what it is in
    the spec's description ("Gallery (a grid, …)"), each of its props' descriptions opening
    with its name ("Default and Document: …"), and its sizes measured (`build/sizes.mjs`:
    `<word>TemplateGzip`, and `<word>TemplateFirstViewGzip`, which the catalog reads).
  - A new prop: its spec's attribute is enough; its description opens "Alone:" or "Inside a
    root:" where it is read in one place only. A prop only code can give (a function) goes
    in the spec's `properties`, and a layout leaves it out with a note.
  - A new format or feature: an entry in `capabilities.ts`, with a sample that has it. A
    new word for a need: its capability's `words`.
  - Something new to find in a resource (a format, a service, a motivation): a count in
    `structure.ts`, or a token checked against what IIIF defines, never a string as the
    resource wrote it, and in `hasOf` (`suggest.ts`) the capability it shows, with its
    evidence in Clover's words. `structure.test.ts`'s resource of marked words must still
    come through clean.
  - A new tool, with Mat's agreement: a name in `TOOL_NAMES`, a definition in
    `agentTools()` (`tools.ts`), its description and schema from the catalog, never lists
    written into it, and a case in `run.ts` that works through the engine
    (`tools.test.ts` fails while a name has no runner). It registers itself, and
    `llms.txt` lists it. The e2e stand-in's `open` waits for the tools by count (three),
    and the suite's first test lists their names, titles and hints.
  - A new tool or answer: check it in `e2e/specs/agent-tools.spec.ts`, and say what a
    reader can now ask, in a reader's words, on Build with an agent, which never names the
    tools or says how they work.
  - A new example frame: the component that draws a docs example's `figure` takes
    `usePreviewHost()` (`docs/components/Clover4/PreviewHost.tsx`), its `ref` on the
    figure, and draws `<AgentPreview shown={preview} />` in place of its own content while
    `preview` is set.

## Environment & Tooling

- Node: 20.10 or later (`engines` in `package.json`).
- When working with IIIF resources, verify CORS in local examples.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
