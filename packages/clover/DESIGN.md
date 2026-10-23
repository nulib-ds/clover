# Design: space, type, selectors and words

How `@nulib/clover` sizes everything it draws, how its stylesheet is written, and how its
words are cased. This is a rule, not a guideline. `src/styles/scale.test.ts` enforces the parts a test can check;
the rest is review.

The aim is natural whitespace. Space between things should say how closely they belong
together, so a reader can see the structure before reading a word. Every value comes
from one scale, and the scale comes from the page Clover sits in.

## 0. Prime directive: WCAG 2.2 AA

Every part, template and style conforms to WCAG 2.2 at Level AA. This outranks every
other rule in this file, every request and every deadline. No look, size budget or
schedule excuses a failure.

- A change that fails a criterion does not ship. Fix it or take it back.
- When a design or a request conflicts with a criterion, conformance wins. Say so, and
  offer the way that conforms.
- Check each change against the criteria it touches: keyboard and focus (2.1.1, 2.1.2,
  2.4.3, 2.4.7, 2.4.11), names, roles and states (4.1.2, 2.5.3), contrast (1.4.3,
  1.4.11), target size (2.5.8), gestures and dragging (2.5.1, 2.5.7), motion (2.2.2,
  2.3.1, `prefers-reduced-motion`), reflow and text spacing (1.4.10, 1.4.12), content on
  hover or focus (1.4.13), status messages (4.1.3), language of parts (3.1.2), media
  (1.2, 1.4.2).
- Every drag has a single-pointer alternative. A keyboard path alone does not meet 2.5.7.
- A control that moves when clicked (a split's bar stepping a pane) moves out from under
  the pointer, so the second click of a double click would land on what it uncovered.
  Let that press go: for a double click's time (500ms), near where the control was,
  until the pointer moves away. Two clicks never do two different things by accident.
- One Escape closes one thing: the innermost popup where focus is. A popup that handles
  an Escape from inside itself or from its control calls `preventDefault()`, so a modal
  `<dialog>` or floating panel around it stays open. A popup that listens on the
  document listens in the capture phase, so it sees the key before the page's React
  handlers do. Every Escape handler first checks `event.defaultPrevented`. An Escape
  from elsewhere may close a popup, but never moves focus (2.4.3).
- A control with nothing left to do at the end of a sequence (Previous, Next, a
  carousel's arrows, a frame step) is `aria-disabled`, never `disabled`, which would
  drop focus to the page. Its press does nothing, so the press that reaches the end
  keeps focus (2.4.3). One the stylesheet hides at an end also leaves the tab order
  (`tabindex="-1"`), and stays in sight while focused.
- Headings follow the page's outline (1.3.1). A part or template that renders a heading
  takes `headingLevel` (2 and up), and the headings inside it are exactly one level
  below. A part with no title gives its own level to whatever takes the title's place.
  Markdown headings get their level from the part around them and never skip one. No
  heading is ever past `h6`, and none is capped there either: a title that would be an
  `h7` is no heading, and names the group it heads instead (`ui/heading.ts`; Mat,
  2026-10-21), since an `aria-level` past 6 reads as 2 in JAWS, and in TalkBack with
  Chrome.
- Mark each of Clover's strings, never a container (3.1.2). An element that shows a
  Clover string, or is named by one, carries `lang={langOf(key)}`. A container's name in
  another language is a hidden element's, reached through `aria-labelledby`
  (`useContainerName`). No Clover root sets `lang`, because hosts put their own content
  inside it.
- Color never carries meaning alone, and every default token pair meets its contrast
  ratio: a page's own tokens are the page's responsibility, Clover's defaults are ours.
  The pairs a page must check are in the docs' "Colors and contrast"
  (`pages/docs/composing.mdx`); a part that draws a token on a new ground adds its row.
- `e2e/specs/axe.spec.ts` catches some failures. Most need a keyboard, a screen reader
  and a look. Known failures and the plan to clear them are in the repository's
  `ACCESSIBILITY.md`.

## 1. Clover takes its size and type from the page

- **No font family, ever.** Not on a part, not on a button, not anywhere. Type is the
  page's.
- **No base size.** No part sets a `font-size` on itself to restyle its text, and no part
  sets a `line-height`. The panel, the caption box and the menus read at the page's own
  size and leading.
- **`1rem` is the page's.** Clover's unit is the page's root size, so a reader who
  enlarges text enlarges Clover with it.
- **Controls inherit too.** Browsers give buttons, inputs, selects and textareas their own
  font. One rule in `src/styles/scale.css` hands them the page's
  (`:where(...) :where(button, input, select, textarea) { font: inherit }`). It has no
  specificity, so any part's own size wins.

## 2. The scale

Every space is a step of the golden ratio (φ ≈ 1.618) from `1rem`. Every step is a
custom property on `:root` in `src/styles/scale.css`. They have no literal fallbacks:
the stylesheet that uses them defines them, and a page may override any of them.

| Token                | Value    | At 16px | Step |
| -------------------- | -------- | ------- | ---- |
| `--clover-space-3xs` | 0.146rem | 2.3px   | φ⁻⁴  |
| `--clover-space-2xs` | 0.236rem | 3.8px   | φ⁻³  |
| `--clover-space-xs`  | 0.382rem | 6.1px   | φ⁻²  |
| `--clover-space-s`   | 0.618rem | 9.9px   | φ⁻¹  |
| `--clover-space-m`   | 1rem     | 16px    | 1    |
| `--clover-space-l`   | 1.618rem | 25.9px  | φ    |
| `--clover-space-xl`  | 2.618rem | 41.9px  | φ²   |
| `--clover-space-2xl` | 4.236rem | 67.8px  | φ³   |

**Type** is the page's `1rem` plus or minus a space step. The steps are the golden cuts
around the page's size: `3xs` and `2xs` either side, so each cuts the gap left by the one
before at the golden ratio (1.236 cuts [1, 1.382], 1.146 cuts [1, 1.236], and 0.854 and
0.764 cut [0.618, 1] the same way). These five sizes are the only ones Clover's text
takes: no part uses another, not even a fluid size between two steps (video captions
step through them with container queries instead). Larger display sizes, a page's own
headings, belong to the page and are not packaged.

| Token              | Value    | At 16px | Step    | Use                                                                                  |
| ------------------ | -------- | ------- | ------- | ------------------------------------------------------------------------------------ |
| `--clover-text-xs` | 0.764rem | 12.2px  | 1 − 2xs | Badges: a duration on a thumbnail                                                    |
| `--clover-text-s`  | 0.854rem | 13.7px  | 1 − 3xs | Secondary text: times, formats, captions under thumbnails, menu legends              |
| (inherited)        | 1rem     | 16px    | 1       | Everything else: text, metadata (its labels medium), the strip's titles and position |
| `--clover-text-m`  | 1.146rem | 18.3px  | 1 + 3xs | A section's heading: the information panel's accordion                               |
| `--clover-text-l`  | 1.236rem | 19.8px  | 1 + 2xs | Titles: a layout's title, Items' title, the lightbox's, an error headline            |

**One derived size.** `--clover-control` is a 1rem icon with `s` on every side,
`calc(1rem + 2 * var(--clover-space-s))`, 2.236rem. Every round control is this size.

**One named step.** `--clover-inset` is a region's inset, `l`. It is a name for a step,
not a new size, so a region's inset is set in one place and everything in a region steps
down from it (§3).

**Derived places** are sums of steps, written out with `calc()` so the reasoning shows:

- "Below the cluster": `calc(var(--clover-space-m) + var(--clover-control) + var(--clover-space-s))`.
  That is the cluster's inset, one control and the gap after it. The caption box, a
  placeholder's toggle and the navigator in full screen all sit there.
- `--clover-transport-room` (`Transport.css`, on `.clover-canvas`) is what the media bar
  takes up: the bar (one control, or its measured height once it wraps,
  `--clover-transport-bar-height`), the seek row (`l`), `xs` between them and `m` above
  and below. Captions and the caption box clear it.
- `--clover-transport-menu-room` (on `.clover-canvas-transport`) caps a transport menu:
  the Body's height (`100cqb`; `.clover-canvas-media` is a size container) less the
  bar's inset `m`, a control, the `s` gap and `xs` clear of the top. A menu also
  measures the room above its own button, whichever row the bar wrapped it onto, so its
  first option never sits above the Body.

## 3. Adjacency: the step comes from how closely things belong together

The closer two things are related, the smaller the step between them. A container's
inset is one step larger than the gap between the things it holds. Work from the top
down: decide the outer level first, then step down for each level inside it.

| Relationship                                               | Step  | Examples                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A region's inset (`--clover-inset`)                        | `l`   | A layout's header and thumbnail strip, each padded all round; the information panel; the picture in the Body at home; the lightbox                                                                          |
| Separate groups in one list                                | `l`   | Annotation sets                                                                                                                                                                                             |
| A region's parts; a part's inset in a region               | `m`   | The header's title and actions; the strip's header over its thumbnails; About's parts; a tab row over its content; the cluster's and the transport's inset from the Body                                    |
| Items that are each a group                                | `m`   | Thumbnails in any layout of Items (each a picture with its caption)                                                                                                                                         |
| Siblings within one part                                   | `s`   | Cluster buttons; transport buttons; a strip's titles and Position; metadata's label-value pairs; a row's inline padding; the map over its list of places                                                    |
| Parts of one control or one item; a heading over its value | `xs`  | A thumbnail and its caption; a label and its select; a search field and its button; the seek row over the bar; an icon beside a text button's label; a row's block padding; a metadata label over its value |
| Rows of one list                                           | `2xs` | Rows of annotations, Ranges, cues and hits; the tabs in their row; an accordion heading over its line                                                                                                       |
| Lines of one caption                                       | `3xs` | A thumbnail's label and summary; a map overlay's name over "Georeferenced image"                                                                                                                            |

A region's content sits `--clover-inset` (`l`, 1.618rem) in from its edges, whatever the
region: a layout's header, its thumbnail strip, the information panel, the picture in
the Body at home (`--clover-canvas-inset`, kept by the renderer and the placeholder
alike), the lightbox. So the title, the strip's header, the panel's first heading and the
page all start on the same line. Everything inside a region steps down from its inset, a
step a level: its parts `m` apart, what is within a part `s`, a label over its value
`xs`. Something that scrolls past may run on to the region's edge, as the strip's
thumbnails do and a zoomed picture does, but what starts the region keeps the inset. A
box that is its own target (an accordion heading, with its hover) reaches out over the
inset by its own padding, so its text lands on the line rather than a step in. The
controls over the Body (the cluster, the media bar) are a part of the Body, not its
content, so they sit a part's `m` in from the Body's edge, nearer it than the picture.

Worked examples, from the top of the Viewer down:

- **A layout** (the Viewer's `Default`): the header and the thumbnail strip are regions, each
  `l` inside all round. Each holds its own space, so nothing around them needs a margin.
  The header's title and actions, its parts, are `m` apart. The strip's header, the view's
  page titles at the start and the Position at the end, is `m` over its thumbnails, the
  titles and the Position within it `s` apart. The thumbnails run on past the strip's end padding to the pane's edge; its
  arrows stay inside it.
- **The Body**: the picture at home, and its placeholder, `l` in all round
  (`--clover-canvas-inset`, the region's inset).
- **The Canvas's controls**: the cluster sits `m` in from the Body's top and end, with
  its buttons `s` apart. Each is one `--clover-control`. A placeholder's toggle takes a
  control's place beside it, `s` away.
- **The media bar**: `m` in from the Body's sides and bottom, with `xl` of scrim above.
  The seek row is `xs` over the bar, since they are one control. The bar's controls are
  `s` apart, as the cluster's are. In a narrow Body (under 28rem, or 37.5rem with
  chapters, whose title wants room of its own) it is two rows, `xs` apart: the time and
  chapter under the seek row, then the controls, those at the end kept together at the
  end of the last row.
- **The information panel**: `l` inside. A tab is `xs` by `s`, the tabs `2xs` apart, and
  the open tab's content `m` below the row. An accordion box's heading is `s` over its label and
  `2xs` under it, then its 3px line, the boxes `2xs` apart; the content is `m` under
  the line and over what follows, as a tab's is under its row, and `s` in; the boxes reach `s` out
  over the panel's `l`, so their text is `l` in, on the title's line. About's parts are
  `m` apart, metadata's pairs `s`, a label `xs` over its value.
  - The close control sits `xs` in from the corner. It reaches `xs + control = 2.618rem`
    (`xl`) in, which is `m` past the panel's `l`. So the tab row keeps `m` clear for it
    (`--clover-panel-clear`), and the sums land back on the scale.
- **Menus over the Canvas**: `xs` inside, options `xs` by `s`, groups `s` apart.
- **Items**: each item is a group, so items are `m` apart, one step over their insides:
  a picture `xs` over its label, a caption's lines `3xs` apart, in `text-s`. An item
  holds a card per Canvas, and the Manifest's `behavior` decides what an item holds: the
  cards of a spread (`paged`) or of a `continuous` Manifest are one item, stitched with
  no gap (`0`), each with its own label under its own picture. Hover, selection and
  focus ring the pictures, 1px clear of them (a hairline, 3px: the accent for the
  selection, at half strength for hover, the text's color for focus), in room the item
  keeps round itself and gives back, so the ring never moves the items or is cut by a
  strip's edge. Focus adds a second ring inside the pictures' edge, in two tones
  (`secondary` at the edge, `primary` inside it, 2px each), so it shows on any picture
  and by more than color.
- **The Map**: the map's box (`--clover-map-height`), and its places `s` under it as
  rows of the panel. An overlay's row is its Canvas's name, with "Georeferenced image"
  `3xs` under it in `text-s`.

When a new part does not fit a row of the table, place it by asking what it belongs to,
not by eye.

## 4. Selectors: few, structural, written once

The stylesheet's size is part of the design.

- **One class names a component.** Its insides are selected by structure under it: the
  semantic elements it renders (`.clover-about dl`, `.clover-canvas-menu legend`,
  `.clover-canvas-caption dt`). Do not add a class for each element. Keep the classes
  that state a role the HTML cannot, such as `-label`, `-summary` or `-current` states,
  and the classes tests or hosts rely on.
- **Families are written once**, as one `:is()` list over their members, and each member
  keeps only what is its own:

  | Family               | Where              | Members                                                                                                           |
  | -------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
  | Round controls       | `ui/Button.css`    | the Canvas's cluster, the media transport, Items' arrows, `Previous` and `Next` (Items' pager), the Panel's close |
  | Text buttons         | `ui/Button.css`    | Search's button                                                                                                   |
  | Rows and their lists | `Panel.css`        | annotations, Ranges, cues, search hits, places on the map                                                         |
  | Fields               | `styles/scale.css` | a search's query, a Collection's menu, a transcript's track menu                                                  |
  | Popovers             | `ui/Tip.css`       | every control that shows an icon alone (§7), the Canvas's hotspots, a split's handle                              |
  | Controls             | `Canvas.css`       | the Canvas's cluster, navigator, a placeholder's toggle, the media transport, its captions                        |

  A family meant to be refined by its members is `:where()`, with no specificity. A
  family that sets a look its members keep is `:is()`.

  In forced colors a row's tint is dropped, and every edge would be drawn in the text
  color, so the other rows' edges are set to `Canvas` and the current row's to
  `Highlight`. The current row stays distinct with no color of Clover's own.

- **A state many parts share is decided once**, as custom properties on the part that
  owns it, and each reads them. The Canvas's controls are shown by one selector, which
  sets `--clover-controls-shown` (0 or 1), `--clover-controls-events` and
  `--clover-controls-timing` on `.clover-canvas`; one rule fades, tucks and spares each
  of the controls from them, and captions lift by the same number. Never repeat the
  state's selector per piece.
- **The controls never hide on a timer from a reader who cannot hover** (WCAG 2.2.1). A
  mouse, or a pen that hovers, shows them by moving, and they fade after `hideDelay`.
  Resting on one of them holds them (`:hover`, WCAG 1.4.13). A finger, or a pen that
  does not hover, has no timer: a tap on the picture shows the controls, and the next
  tap hides them. A press where faded controls sit only shows them, and goes no further:
  no zoom, no play, no hotspot. Focus that no press brought, and keyboard focus
  (`:has(:focus-visible)`), hold them. One pointer can always zoom back out: at the
  largest zoom, a click, a double click or a double tap goes home (WCAG 2.5.1).
- **The viewport lies beneath everything else in the figure**: `z-index: -1` in an
  isolated figure, inline as well as in the stylesheet. The controls, in the flow or
  positioned, then take their own presses with or without the stylesheet (WCAG 2.5.8).
- **A hotspot is as large as its region**, however small: a line of OCR can be a few
  pixels tall at the zoom shown. It meets WCAG 2.5.8 by the Equivalent exception: the
  Canvas's annotations menu lists the view's annotations, each a row at least 24px tall,
  and picking one does what pressing its hotspot does. A layout that turns the menu off
  (`controls={{ annotations: false }}`) keeps the exception only with an `Annotations`
  list on the page. axe-core's `target-size` rule reports such hotspots, as expected.
- **A toggle that is on** (Captions showing, Repeat pressed) shows a mark that hover and
  focus never draw: a 2px bar under the glyph, inset `s` from the sides and `2xs` from
  the bottom. It is a border, not a fill, because forced colors keep a border in the
  text's color but would paint a fill as the page. The accent fill alone is not
  enough, since hover and focus use it too (WCAG 1.4.1). Any new toggle takes the same
  mark.
- **`button.x`, not `.x`.** One class ties with a reset's `[type="button"]`. The element
  type breaks the tie whichever stylesheet loads last.
- **Everything is in `@layer clover`**, so a page's own unlayered rules win, a reset's
  included. Where a reset removes a look that carries meaning, as with the markers on a
  Markdown body's lists (and with them VoiceOver's list semantics in Safari), the docs
  give the override, in the Styles section of `composing.mdx`.

## 5. What is not on the scale

Some values are not space between things, and stay as they are:

- **Dimensions**: the Body's height (`--clover-body-height`), panel widths and their
  bounds, thumbnail heights, menu widths, and a target's minimum size (24px, in CSS px
  as WCAG 2.5.8 measures it, such as the link lists' `min-block-size`). Use the scale
  where a dimension is really a space; the navigator, for example, is a golden
  rectangle, `2xl + xl` by `2xl`.
- **Hairlines**: borders, outlines, focus rings, slider rails and thumbs, at most 4px.
- **Motion**: the controls leave on `--clover-controls-leave` (180ms, accelerating
  away), tucked `--clover-controls-tuck` (`s`) toward their edges, and come back on
  `--clover-controls-enter` (340ms, springing out a touch past and back). One pair for all
  of them, so they move as one. Reduced motion sets all three to zero: the controls still
  come and go, without moving.
- **Breakpoints**, percentages and viewport units. Breakpoints for a part over the Body
  are container queries on the Body (`.clover-canvas-media`), not the window.

## 6. Adding or changing a style

1. Name the component's root class; select its insides by structure.
2. Is it a member of a family? Add it to the family's list and keep only what differs.
3. For each space, ask what the two things belong to and take that step (§3). For a
   place, add up steps with `calc()`.
4. Leave its text at the page's size, or use one of the four text steps (`xs`, `s`, `m`,
   `l`). Never set a font family or a line height, or a size between the steps.
5. A control that shows an icon alone gets a popover (§7).
6. Run `npx vitest run src/styles`. It fails on a literal rem or em in a spacing, inset
   or font-size declaration, on pixel spacing above a 4px hairline, on a font size that
   is not a text step or `inherit`, and on any font family. Then check the stylesheet's size in `npm run test:build`.

## 7. Every control names itself: an accessibility boon

Every control that shows an icon alone shows its name in a popover on hover and on
keyboard focus, with its keyboard shortcut when it has one: "Zoom in (+)", "Mute (M)",
"Play (K)". It is `Tip` (`ui/Tip.tsx`, styled in `ui/Tip.css`), and it is public, so a
control of your own can carry the same.

This is a boon for more readers than any one feature: a sighted reader learns what an
icon does without trying it, a keyboard reader sees where focus is and what it will do,
a speech-input reader sees the words to say to press it, and anyone sees the key that
does it faster.

- **The same words as the accessible name.** The popover says exactly what the
  control's `aria-label` (or its visually hidden name) says, from the same i18n string, so
  what is seen is what a screen reader reads and what voice control answers to (WCAG 2.1,
  2.5.3 Label in Name). The format of a name and its key is itself a string,
  `controlShortcut` (`"{{label}} ({{shortcut}})"`), so a language orders and punctuates it
  its own way.
- **Keys are announced too.** The control carries `aria-keyshortcuts` (WAI-ARIA key
  names: `Plus`, `Shift+R`, `K Space`). A popover names a key only once the Canvas
  handles it (`SHORTCUTS` in `ui/Tip.tsx`), and the Canvas takes its keys while any of
  its own controls has focus (`forwardShortcut`), so the key shown works where the reader
  is.
- **Content on Hover or Focus (WCAG 2.1, 1.4.13).** It shows on keyboard focus, not on
  hover alone. Escape hides it without moving the pointer or focus. Hidden, it takes no
  pointer, so whatever it covered can be reached, and it shows again when the pointer
  next enters the control. It is hoverable: the gap to the control is bridged, so the
  pointer can move onto it. It stays until the pointer or focus leaves. Under the
  pointer it waits a moment, so passing over a row does not flash every popover in it;
  on focus it shows at once.
- **Not `title`.** A native tooltip shows on hover only, never on focus or touch, cannot
  be dismissed, and is read inconsistently. Clover's controls set no `title`, and their
  icons no SVG `<title>`, which browsers also show as a tooltip.
- **Read once.** The popover is `aria-hidden`; the name and key are the control's.
- **Placed by family**, `xs` from the control: above by default; below a control along
  the top of what it sits on (the cluster, the panel's close, a toolbar); beside the
  cluster when it is a column on a phone; at either end of a row, lined up with the
  control's outer edge, so it stays inside the Body; and beside a split's handle, at
  its grip, over the pane after it (a handle is as tall as its layout, so a popover
  above or below would put the name at its far ends). Then, each time it shows, it is
  measured and kept inside what clips it (the Body, a scrolling panel, the window),
  `xs` clear: it wraps to the room there is and moves in from the edge, so text spacing,
  zoom or a longer language never cut a name off (WCAG 1.4.10, 1.4.12).
- **A hotspot's popover** wraps, no wider than the Body, and sits on the side of the
  hotspot with more room. It is kept inside the Body across and down, `xs` from its
  edges. Where neither side has room, it moves over the hotspot.
- **Part of its control, not something to press.** A control that acts on press or drag
  ignores presses that start on its `.clover-tip`, and the Tip keeps `cursor: default`.
- **Plain without the stylesheet.** It reads as text beside the icon: a visible label.
  `Previous` and `Next` shown as arrows alone take `iconOnly`, which hides their name for
  sight inline and adds the popover, so the name never shows twice.
- **For a control of your own:** give it the `aria-label` (and `aria-keyshortcuts`), and
  put `<Clover.Tip label={label} shortcut={shortcut} />` inside it, last.

## 8. Words in sentence case

Every name, button, menu item, tab, heading, title and link Clover shows is in sentence
case: a capital opens it, and inside it marks a proper name, nothing else. "More
information", "View all", "No results", "Show items", "Hide annotations", "Zoom in". The
docs site keeps the same rule for its menus, calls to action and headings (Mat,
2026-10-22; root `AGENTS.md`). `src/i18n/locales/locales.test.ts` enforces it for
Clover's English; the rest is review.

Sentence case reads as one person speaking to another, and it leaves a capital to mean
something: "Open the full Manifest" names a IIIF resource, where "Show items" asks no
reader to know a part's name.

- **Proper names keep their capitals**, as their owners write them: Clover; IIIF, its
  resource types (`Collection`, `Manifest`, `Canvas`, `Range`) and its specifications
  (the Image API, Content Search, Content State); the IIIF Cookbook; keys (Escape, Shift,
  Space, a letter); acronyms; people, places, institutions, products and languages.
- **A part's name only where the words name the part.** The docs' headings "In the
  Viewer" and "Outside a Root" name components. Clover's own interface speaks to a reader, who
  knows no part's name: "Show items", "Hide annotations".
- **Text from a resource is shown as written.** A label, a summary, a metadata line: never
  recased, in either direction. No Clover style sets words in capitals
  (`text-transform`), so a screen reader, a copy and a page without the stylesheet read
  what is shown.
- **Each language keeps its own conventions.** A translation follows its language's case,
  never English's: the shipped languages use sentence case too, and German would
  capitalize its nouns.
- **A string with a new proper name** adds it to `PROPER_NAMES` in the locales test, which
  lists IIIF's resource types, keys and acronyms.
