# Accessibility

WCAG 2.2 at Level AA is this repository's prime directive: non-negotiable, for the
package and the docs site alike (`AGENTS.md`, `packages/clover/DESIGN.md` §0). This file
holds what is known to fail and the plan to clear it. Fixing any of it is always in
scope; when you do, delete its row below and its id from the plan.

## Audit of 15 October 2026

Fifteen auditors read the package and the site against the 55 A and AA criteria, two of
them in headless browsers (axe-core, a keyboard walk, 320px reflow and text spacing, in
light and dark). A critic sent auditors back to criteria they had passed over. Two
independent reviewers, with a third to break ties, checked each of the 214 distinct
findings against the code and the standard; 160 held. Of those, 77 were blatant and easy
and were fixed first. Ten workstreams then fixed 44 more in the package; the rest are
planned below. The package has 79 (73 fixed), the docs 81 (53 fixed).

## Package

There are 79 verified findings in the package. 73 are fixed (19 serious, 39 moderate, 15 minor) and 6 remain (3 serious, 3 moderate). Four of the six (P19, P7, P104, P56) are done in code and wait on a check no test can make: picture in picture on a phone, screen readers, native speakers. Two (P51, P68) rest on the colour guidance and the docs' dark mode. Since the audit, the work found two more, both now fixed.

### Fixed

- **Canvas names and focus:** the viewport, unlabelled hotspots and the lightbox now have names. Focusing an off-screen hotspot no longer detaches the overlay, the controls stay under a resting pointer, and the frame arrows keep focus (1.1.1, 4.1.2, 2.4.7, 1.4.13, 2.4.3; P1–P4, P29, P77).
- **Captions:** they carry `lang`, decode character references and expose the on/off state (3.1.2, 1.2.2, 4.1.2; P31, P32, P105).
- **Captions and transport:** tracks inside the stream are offered, the bar wraps and its menus stay on a short stage, toggles show their state by more than colour, focus survives auto-advance, chapter and track names carry `lang`, and the media toggle reads "Close player" (1.2.2, 1.4.10, 1.4.1, 2.4.3, 3.1.2, 2.4.6; P16, P18, P22, P23, P28, P30, P34).
- **Items:** unlabelled items read "Item N of M", and the figure no longer hides the option's name (4.1.2; P53, P97).
- **Language:** the error boundary, Contents, Transcript, annotation set titles and thumbnail alt carry `lang`, and full screen has one name in every locale (3.1.2, 3.2.4; P43, P52, P70, P107).
- **Interface language:** Clover's strings carry `lang` where it is not the page's, the Canvas reads its IIIF text in the Root's language, and Items' list name keeps its label's (3.1.2; P39, P10, P60).
- **Panes:** Escape, focus leaving and every way of closing now keep focus clear of panes and popups (2.4.11, 2.4.3; P62, P63, P69).
- **Keep focus:** Previous, Next and Items' arrows keep focus at the first and last view. Entering a nested Collection keeps focus in the list. An Escape outside a Canvas menu no longer pulls focus into it, and one inside closes nothing else. Enter and Space hand `onSelect` the real key event (2.4.3, 2.1.1; P49, P58, P14, P59).
- **Text:** accordion headings stop sticking on short screens, long values and Document's title wrap, and ReadMore measures again when spacing changes (1.4.10, 1.4.4, 1.4.12; P38, P67, P82, P109).
- **Accordion:** content headings nest under their sections, labels wrap, and focus in the open section stays clear of the stuck headings (1.3.1, 2.4.11, 1.4.12; P64, P37, P46).
- **Colour:** links are underlined, and the search placeholder reaches 5.3:1 (1.4.1, 1.4.3; P93, P66).
- **Colour and targets:** the focused Item has a two-tone inner ring, matched search words are bold, and link list items are 24px tall (1.4.1, 2.5.8; P98, P75, P74).
- **Map:** it shows focus, themes its popup, cases its lines and reports the credits state. A list of places under it is its text alternative and the keyboard's way to them, it is one region named in Clover's language, and its popups carry `lang` (2.4.7, 1.4.3, 1.4.11, 4.1.2, 2.1.1, 1.1.1, 3.1.2; P88, P89, P91, P113, P85, P86, P90, P92).
- **Hotspots:** two-tone outlines, names in a `Tip` that can be hovered and dismissed and stays in the stage, the annotations' order, `aria-current`, a pan clear of the chrome on Tab, and alt text for image annotations (1.4.11, 1.4.13, 2.4.11, 2.4.3, 4.1.2, 1.1.1; P5, P6, P8, P9, P17, P65).
- **Viewport and controls:** one pointer can always zoom out, and the controls take their presses without the stylesheet (2.5.1, 2.5.8; P12, P99).
- **Split handle:** a 3:1 grip, a click that steps the pane, and a handle that shows in forced colours and without the stylesheet (1.4.11, 2.5.7, 2.4.7; P78, P80, P81, P101).
- **Headings:** templates and parts take `headingLevel`, and Markdown keeps its lists and headings (1.3.1; P102, P61, P44).
- **Status messages:** Status's region stays mounted and Search's stays in the accessibility tree, so Loading and fast errors are announced (4.1.3; P41, P95).
- **Collections:** CollectionSelect loads only on Enter or a choice from its own list (3.2.2; P54).
- **Tips:** they wrap and move inside what clips them (1.4.12; P110).
- **Long hotspot notes:** a note taller than the stage is capped inside it and scrolls, by wheel, touch and the keys from its hotspot, still hoverable across the gap, never taking focus (1.4.10, 1.4.13; P13).
- **Long titles under thumbnails:** a carousel's or grid's title cut at three lines shows in full over its picture while its item is hovered or focused, and Escape hides it. Default's rail titles wrap (1.4.12, 1.4.13; P57).
- **Sliders in forced colours,** found since the audit: the transport's seek and volume sliders draw in system colours, with an outline on focus, and its buttons keep their edge (1.4.11, 2.4.7).
- **Focus rings over pictures,** found since the audit: the viewport's and the map's rings are a dark edge, the accent and a light band at full strength, `primary` and `secondary` 9:1 apart, so one keeps 3:1 over any picture (1.4.11, C40; N1).

### Plan

What remains. Items 1 to 4 are done in code and need a check the tests cannot make.

1. **Captions in picture in picture** (1.2.2). Checked on 16 October 2026 in the iOS 26 Simulator (iPhone 17 Pro, Safari, the harness with Cookbook 0074's English and Italian captions): the system player shows the chosen track; its own Subtitles menu lists both by their labels, and Italian chosen there stays chosen, in the player again and inline; back on the page, Clover draws the one copy, and nothing is doubled. Not yet seen: picture in picture, which the Simulator did not start on Home from the system player, and Clover offers no control for. Check it on an iPhone (and Chrome's on Android, which `enterpictureinpicture` also reaches): its window shows the chosen track, and the page shows one copy afterwards. Size S. (P19)

2. **The viewport in screen readers** (4.1.2). The viewport has a role description, `aria-keyshortcuts` and its keys in words, all dropped when it cannot move. Test it in NVDA, JAWS and VoiceOver, where browse mode still takes the arrow keys, and then settle its role (`img` or `group`, or `application` on the viewport alone). Decide whether sighted keyboard users get a visible key hint. File: `CanvasView.tsx`. Size M. (P7)

3. **Touch with a screen reader** (2.2.1). Under a finger or a pen that does not hover, the chrome has no timer, and focus no press brought holds it. Test VoiceOver in iOS Safari and TalkBack in Chrome on Android: a screen reader that moves only its own cursor sends the page no event, so a faded control could still sit unseen under it. File: `useChromeVisibility.ts`. Size S. (P104)

4. **Locale review** (3.1.2). Every locale has every string, and `locales.test.ts` keeps them complete, but no native speaker has read the new ones: es, fi, fr, nb (and no, its copy), nn, and pt, which is European Portuguese and what Brazilian readers get too. Mat owns this, and will make the English strings more concise and consistent, then ask translators to review. It does not block the rest of this plan, and agents leave the translations alone until then. (P56)

5. **Accent text** (1.4.3). The selected item's label and View All fail contrast on dark pages, where the page sets the accent and the background. Mat's call: no new token. Clover's defaults meet 4.5:1, and "Colours and contrast" in `pages/docs/composing.mdx` tells a page that sets its own tokens which pairs to keep at which ratio. What remains is the docs' own dark mode (docs plan, item 5). (P51, P68)

### Decisions

All settled on 16 October 2026: the two-tone hotspot outlines and the Split grip stay, the grip now 1px wider than the bar on each side (P9, P80); and Clover speaks the page's `<html lang>` first and the browser's languages after, for its own strings and for IIIF text (P39). A focused viewport shows no key hint: its keys work (2.1.1), assistive technology hears them in its description and `aria-keyshortcuts`, and each control's tip names its key; a visible hint is help beyond AA (P7). A title cut short under a thumbnail shows in full on hover and focus, over the picture, and Default's rail titles wrap (P57). Leaving CollectionSelect takes back a step not yet chosen, and it gets no Open button: nothing loads on a change (3.2.2), a load after focus moved on could remove the control focus went to (2.4.3), and Enter, Alt+↓ and the menu's own list each choose (P54).

## Docs

Of 81 verified docs findings, 53 are fixed (15 serious, 26 moderate, 12 minor) and 28 remain (8 serious, 11 moderate, 9 minor).

Mat, 16 October 2026: the docs plan below waits until 4.x is being readied for release, and is done then, before it ships. The Example Viewer's editor was fixed at once, before it first shipped.

### Fixed

- Focus rings drawn in `--accent-11` and no longer clipped or covered. Hidden sidebar and menu links are out of the tab order (2.4.7, 1.4.11; D2, D6, D21, D42).
- Text reaches 4.5:1: Nextra links, syntax colours, editor text, search, placeholders, demo labels, the dark hover accent, the DC mock. The "Not yet" icon reaches 3:1 (1.4.3, 1.4.11; D7, D12, D15, D26, D27, D38, D49, D59, D61, D76, D86).
- Names added: the logo link, image demos, rights badge, homepage Items, textareas, demo field, the "Your own" state, Cookbook and Mocks links (1.1.1, 2.4.4, 2.5.3, 4.1.2; D8, D13, D17, D18, D19, D20, D24, D46, D52, D58, D62, D68, D82).
- Every page has `<html lang="en">` (3.1.1; D3).
- The Example Viewer's editor: a part picked by a press (or its grip focused) moves with Move up and Move down, Content's height is a number to type, its head's buttons are 24px, Escape puts away a part's name tag, and focus on a part of the held viewer above the window lets it go (2.5.7, 2.5.8, 1.4.13, 2.4.11; D4, D32, D70, D72).
- The playground's resource field, which replaced "Your own" and its popover, has a 3:1 edge, as does the Template button (`--pg-edge`: 3.4:1 light, 5.5:1 dark), and its list closes when focus leaves it, so it never covers focus (1.4.11, 2.4.11; D33).
- Focus stays in order and in view: parts chips, CanvasRecipe buttons, settings panel, phone banner (2.4.3, 2.4.11; D30, D34, D35, D66).
- Errors are announced, and 3.x Content State validates its input (4.1.3, 3.3.1; D31, D45, D79).
- Links and the current page are marked by more than colour (1.4.1; D28, D41).
- Pages reflow at 320px and survive text spacing (1.4.10, 1.4.12; D48, D63, D78, D88, D94, D95).
- The coverage-table tooltip is now visible text (1.4.13; D50, D51).
- A bare "/" no longer opens search (2.1.4; D40). Search's Clear target is 24px (2.5.8; D73).

### Plan

1. **Animation** (2.3.1). The playground's Animation (Muybridge plate 700, 16 frames looping at 16 fps) may pass the general flash threshold. Measured on 16 October 2026 by frame analysis, not PEAT: in the worst 10° field, 3 flashes a second where it is shown 900px wide and 4 at 600px; under the limit in the Example Viewer. Its frames are crops of one plate, each slightly misaligned and differently exposed, so the background and the light jump every frame. Autoplay off is not enough, since 2.3.1 covers playback a reader starts, and neither is a content warning or a reduced-motion gate. What conforms: half speed on the homepage (about 2 a second) without autoplay, or the resource off the homepage until PEAT clears it. The docs' demo also lists Muybridge plate 626 and Cookbook 0688, unmeasured. Mat, 16 October 2026: a docs example, not the package; it waits with this plan. `playground-config.ts`, `PartsLive.tsx`. S. (D25)

2. **Code blocks and tables** (2.1.1, 1.4.13). Keyboard users cannot scroll code or tables that overflow, and on phones the wrap button covers code on hover. Wrap `pre` and `table` through theme.config `components` in a focusable, labelled region, and show the button at all times below 768px. `theme.config.tsx`, `layout.css`. S. (D16, D96)

3. **Modal Viewer panel** (2.4.3). Tab leaves the full-window demo panel for page links hidden behind it. Open the panel as a `<dialog>` with `showModal()`. If nothing opened it, focus the IIIF field on close. `CookbookViewerPanel.tsx`. M. (D10)

4. **Reflow** (1.4.10, 1.4.12). On phones the banner cuts off its 3.x link, recipe tables and Content State's columns crush, and tile names clip. Let the banner wrap and stop pinning it below 768px, then remove D34's scroll padding. Stack the table actions, and let the columns and `.tileName` wrap. `layout.css`, `CookbookCoverageTable.module.css`, `content-state.mdx`, `Parts.module.css`. S. (D9, D11, D71, D84)

5. **Accent text and edges** (1.4.3, 1.4.11). Accent text is 3.77:1 in dark mode, and the Content State textareas have edges of 1.2:1. Add a text-accent token to the package, with a CHANGELOG entry, and map it to `--accent-11` in the docs' dark bridge. Add a 3:1 boundary step. `tokens.css`, package CSS. M. (D1, D83)

6. **3.x pages** (2.1.1, 2.4.2, 2.4.5). The Map demo takes coordinates from a pointer only, six pages share the homepage's title, and nothing links to two pages. Add coordinate inputs and `title:` front matter ending in "(3.x)", with `config.title` as the fallback, and link both pages from viewer.mdx. `CoordinatePickingDemo.tsx`, `pages/docs/3.x/`. S. (D14, D43, D67)

7. **Media alternatives** (1.2.1, 1.2.2). Film has no text alternative, and the 0003 and 0013 demos play speech without captions. Point 0003 at 0219, which has captions, and caption 0013 through `adapt`. `canvas.mdx`, `Demos.tsx`. M. (D55, D64)

8. **Nextra chrome** (4.1.2, 4.1.3, 1.3.1, 2.4.11). Toggles don't expose their state, search announces nothing and doesn't name each result's page, the phone menu leaves the page behind it focusable, and the nav's structure is flat. Patch nextra-theme-docs for `aria-expanded`, a search status region, page names in results and an inert page under the menu. Make separators headings in `SidebarTitle` and nest the TOC through `toc.component`. `theme.config.tsx`, `patches/`. L. (D36, D37, D39, D65, D90, D91)

9. **Field labels** (3.3.2, 3.3.1). The IIIF field's only label is a placeholder that disappears, and the hex field has no label and ignores bad input silently. Show a visible label on both fields. On the hex field, add a format hint and an `aria-invalid` message. `CustomManifest.tsx`, `PageSettings.tsx`. S. (D47, D74)

### Decisions needed

- **Playground bar** (D29): in Chromium and WebKit, scroll padding scrolls the page and releases the held bar. Should `useStuck` measure the bar, or should the stage's controls get scroll-margin (which also reaches the package's scroll containers)?
- **Film** (D64): describe a shortened Reel 1 published as a mock, or swap in a film that already has a description?
- **Edge token** (D83, D74): a 3:1 edge is darker than the design's hairlines. The playground's field and Template button now use `--gray-11` at 75% over the page (`--pg-edge`, `Playground.module.css`). Make that the token, and only on controls?
- **Nextra**: patch 2.13.4, or upgrade?
- **Nav headings** (D90): should four sidebar headings come before every page's h1?

Also: D60, D77, D89, mark German, Arabic and tile-fact text with `lang` (3.1.2, S). D23, failures in @samvera/clover-iiif itself, to report to samvera-labs/clover-iiif.

## Open findings

The audit's ids, cited by the plans, and N for those found since. Most severe first.

### Package

| Id   | Criterion               | Severity | Finding                                                                                                              | Where                                                                                                                                          |
| ---- | ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| P19  | 1.2.2 Captions          | serious  | Checked in the system player on the iOS Simulator; captions in picture in picture are unchecked                      | `packages/clover/src/components/Canvas/media/useCaptionTracks.ts:33-60`, `packages/clover/src/components/Canvas/media/useCaptionTracks.ts:170` |
| P51  | 1.4.3 Contrast          | serious  | Accent-coloured text fails contrast on a dark page (selected item label, View All)                                   | `packages/clover/src/components/Items/Items.css:435`, `packages/clover/src/components/Items/Items.css:47` …                                    |
| P56  | 3.1.2 Language of Parts | serious  | Every locale is complete, but no native speaker has reviewed the new strings                                         | `packages/clover/src/i18n/locales/es.json`, `packages/clover/src/i18n/locales/pt.json` …                                                       |
| P7   | 4.1.2 Name              | moderate | The viewport's role and key description are untested in NVDA, JAWS and VoiceOver, and nothing visible names its keys | `packages/clover/src/components/Canvas/CanvasView.tsx:753-757`, `packages/clover/src/components/Canvas/CanvasView.tsx:79-95`                   |
| P68  | 1.4.3 Contrast          | moderate | The panel sets its text colour but leaves the background to the page                                                 | `packages/clover/src/components/InformationPanel/InformationPanel.css:20`, `packages/clover/src/templates/default/Default.css:62-65` …         |
| P104 | 2.2.1 Timing Adjustable | moderate | Fixed in code for touch and pen, untested with VoiceOver and TalkBack, whose cursor may rest on a faded control      | `packages/clover/src/components/Canvas/useChromeVisibility.ts:19-30`                                                                           |

### Docs

| Id  | Criterion                              | Severity | Finding                                                                                                        | Where                                                                                                                                         |
| --- | -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 1.4.3 Contrast                         | serious  | Clover's accent-coloured text is 3.77:1 in docs dark mode, and 4.40:1 on hover in light                        | `docs/styles/tokens.css:37`, `docs/styles/tokens.css:150-170` …                                                                               |
| D9  | 1.4.10 Reflow                          | serious  | The site banner cuts off its text and its 'Clover 3.x docs' link                                               | `theme.config.tsx:39`, `node_modules/nextra-theme-docs/dist/index.js:385` …                                                                   |
| D10 | 2.4.3 Focus Order                      | serious  | The demo's full-window Viewer panel is not modal, so focus moves to page chrome hidden under it                | `docs/components/CookbookRecipes/CookbookViewerPanel.tsx:68`, `docs/components/CookbookRecipes/CookbookViewerPanel.tsx:94` …                  |
| D11 | 1.4.10 Reflow                          | serious  | The Cookbook recipe tables crush and overlap their titles at phone widths and under text spacing               | `docs/components/CookbookRecipes/CookbookCoverageTable.module.css:1`, `docs/components/CookbookRecipes/CookbookCoverageTable.module.css:18` … |
| D14 | 2.1.1 Keyboard                         | serious  | Picking coordinates in the 3.x Map demo works only with a pointer                                              | `docs/components/Map/CoordinatePickingDemo.tsx:26`, `docs/components/Map/CoordinatePickingDemo.tsx:40` …                                      |
| D16 | 2.1.1 Keyboard                         | serious  | Scrolling code blocks and tables cannot be reached by keyboard                                                 | `theme.config.tsx:25`, `pages/docs/canvas.mdx:501` …                                                                                          |
| D23 | 4.1.2 Name                             | serious  | Out of scope: @samvera/clover-iiif's own components fail several A criteria on these pages                     | `node_modules/@samvera/clover-iiif/dist/primitives/index.mjs:691`, `node_modules/@samvera/clover-iiif/dist/primitives/index.mjs:651` …        |
| D25 | 2.3.1 Three Flashes or Below Threshold | serious  | The Animation resource may pass the general flash threshold, and it starts and loops by itself                 | `docs/components/Playground/playground-config.ts:129`, `docs/components/Home/PartsLive.tsx:269` …                                             |
| D29 | 2.4.11 Focus Not Obscured              | moderate | The playground's sticky bar can hide focused controls in the stage                                             | `docs/components/Playground/Playground.module.css:13`, `docs/components/Playground/Playground.module.css:77` …                                |
| D36 | 2.4.11 Focus Not Obscured              | moderate | The open phone menu leaves the page behind it focusable                                                        | `node_modules/nextra-theme-docs/dist/index.js:1896`, `node_modules/nextra-theme-docs/dist/index.js:3001`                                      |
| D37 | 4.1.2 Name                             | moderate | The menu and folder toggles don't expose their state                                                           | `node_modules/nextra-theme-docs/dist/index.js:1536`, `node_modules/nextra-theme-docs/dist/index.js:1700` …                                    |
| D39 | 4.1.3 Status Messages                  | moderate | Search results, and their absence, are not announced                                                           | `node_modules/nextra-theme-docs/dist/index.js:780`, `node_modules/nextra-theme-docs/dist/index.js:813` …                                      |
| D43 | 2.4.2 Page Titled                      | moderate | Six 3.x pages share the homepage's title                                                                       | `theme.config.tsx:57`, `pages/docs/3.x/scroll/demo.mdx:1` …                                                                                   |
| D47 | 3.3.2 Labels or Instructions           | moderate | The IIIF address field's only visible label is a placeholder that disappears                                   | `docs/components/CustomManifest/CustomManifest.module.css:14`, `docs/components/CustomManifest/CustomManifest.tsx:75` …                       |
| D55 | 1.2.2 Captions                         | moderate | Video demos play speech without captions                                                                       | `pages/docs/canvas.mdx:349`, `pages/docs/canvas.mdx:395` …                                                                                    |
| D60 | 3.1.2 Language of Parts                | moderate | i18n (3.x): the German strings are not tagged de, and they leak into other pages                               | `docs/components/I18nExamples/GermanViewer.tsx:17`, `docs/components/I18nExamples/GermanViewer.tsx:34` …                                      |
| D64 | 1.2.1 Audio-only and Video-only        | moderate | Film is 73.6 minutes of silent video with no text alternative                                                  | `docs/components/Playground/playground-config.ts:112`, `docs/components/Playground/Playground.tsx:561` …                                      |
| D65 | 1.3.1 Info and Relationships           | moderate | Search results name their page only in a visual group header, outside every result link                        | `node_modules/nextra-theme-docs/dist/index.js:986`, `node_modules/nextra-theme-docs/dist/index.js:997` …                                      |
| D67 | 2.4.5 Multiple Ways                    | moderate | Two 3.x Viewer pages are hidden from the sidebar and linked from nowhere; search is the only way to reach them | `pages/docs/3.x/viewer/_meta.json:9`, `pages/docs/3.x/viewer/_meta.json:24` …                                                                 |
| D71 | 1.4.12 Text Spacing                    | minor    | With text spacing applied, the long tile names are cut off by the page's overflow clip                         | `docs/components/Home/Home.module.css:8`, `docs/components/Home/Parts.module.css:645` …                                                       |
| D74 | 3.3.1 Error Identification             | minor    | The hex field has no visible label or format, and drops invalid input silently                                 | `docs/components/PageSettings/PageSettings.tsx:75`, `docs/components/PageSettings/PageSettings.tsx:201` …                                     |
| D77 | 3.1.2 Language of Parts                | minor    | The Arabic featured title isn't marked `lang="ar"`                                                             | `docs/components/CookbookRecipes/featuredItems.ts:36`, `docs/components/CookbookRecipes/FeaturedGrid.tsx:36` …                                |
| D83 | 1.4.11 Non-text Contrast               | minor    | Content State page: the textarea edges are 1.2:1 and barely show                                               | `pages/docs/3.x/viewer/content-state.mdx:122`, `pages/docs/3.x/viewer/content-state.mdx:138` …                                                |
| D84 | 1.4.10 Reflow                          | minor    | Content State page: three fixed columns crush the fields at 320 px                                             | `pages/docs/3.x/viewer/content-state.mdx:108`                                                                                                 |
| D89 | 3.1.2 Language of Parts                | minor    | Tile facts take a language map's first value and drop its language tag                                         | `docs/components/Home/PartsLive.tsx:58`, `docs/components/Home/PartsLive.tsx:258` …                                                           |
| D90 | 1.3.1 Info and Relationships           | minor    | The sidebar's section titles are styled as headings but exposed as plain list items                            | `node_modules/nextra-theme-docs/dist/index.js:1764`, `node_modules/nextra-theme-docs/dist/index.js:1771` …                                    |
| D91 | 1.3.1 Info and Relationships           | minor    | The table of contents shows heading nesting only by indentation, in one flat list                              | `node_modules/nextra-theme-docs/dist/index.js:2212`, `node_modules/nextra-theme-docs/dist/index.js:2221` …                                    |
| D96 | 1.4.13 Content on Hover or Focus       | minor    | Below 768 CSS px, the code-block word-wrap button fades in over the code on hover and cannot be dismissed      | `node_modules/nextra/dist/components/pre.js:41`, `node_modules/nextra/dist/components/pre.js:52` …                                            |
