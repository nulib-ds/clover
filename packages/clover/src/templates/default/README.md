# Default

The Viewer's own layout, drawn when it is given no `template`: Clover 3.x's Viewer, built
from 4.x parts. The thumbnail (`xl` high, at its own shape up to 5rem wide, cropped past that) and the title over the Body; the thumbnail strip under the Body, whose
arrows are Previous and Next, headed by the titles of the view on the left (a dot
between a spread's two) and the position on the right; and the information panel to the right of all three, the layout's
full height, scrolling within when its sections run longer. Downloads (the page's and the
Manifest's `rendering`) are listed in the panel's About.

The panel never stacks. As in 3.x it has its own space beside the Body, 24rem to start,
and the bar between them shares the width: drag it by its grip; click or tap it to step
the panel from its narrowest to 24rem to its widest and around again; or focus it and use
the arrow keys (Home and End for the limits). The Body keeps at least
16rem and the panel 14rem, and the width the reader chooses is remembered. With no room
for both (about 31rem, a phone), the panel slides over the Body instead, leaving a strip
of the page uncovered: a click on the strip, Escape or its close button puts it away.
The template measures its own width, so a narrow column of a wide page behaves the same.
The panel's toggle never fades with the other controls. While the panel is open beside the
Body it sits on the bar between them, level with the Body's controls; closed, or over
the Body, it is in the Body's top corner. It moves as it is pressed, and focus goes
with it.

```jsx
import Viewer from "@nulib/clover";
import "@nulib/clover/styles.css";

<Viewer iiifContent="https://example.org/manifest.json" />;
```

Given no template, the Viewer loads `Default` the first time it draws: one request before
the Manifest starts to load, and nothing drawn on the server. Its styles are in
`styles.css`, so it needs no `templates.css`. To have it up front and drawn on the server,
pass it: `template={Default}`, from `@nulib/clover/templates`.

| Prop               | Default                     | What it does                                                      |
| ------------------ | --------------------------- | ----------------------------------------------------------------- |
| `header`           | `true`                      | The thumbnail and title over the Body.                            |
| `headingLevel`     | `2`                         | The title's level; the panel's sections are a level below.        |
| `panel`            | `true`                      | The information panel and its toggle.                             |
| `download`         | `true`                      | The downloads in the panel's About, where there is a `rendering`. |
| `defaultPanelOpen` | —                           | Whether the panel starts open. Unset: open when it fits beside.   |
| `panelLayout`      | `"accordion"`               | The panel's sections as stacked boxes, or `"tabs"`.               |
| `items`            | `"carousel"`                | The thumbnails: `"carousel"`, `"list"`, `"grid"`, or `false`.     |
| `storageKey`       | `"clover-template-default"` | Where the panel's width is remembered; `false` forgets it.        |
| …                  |                             | Every `Clover.Root` prop: `request`, `canvasId`, `annotations`…   |

Size the Body with `--clover-body-height` (default `min(65vh, 40rem)`).

The title is an `h2`, the panel's section headings `h3`s, and the headings inside them
`h4`s. On a page where the Viewer sits under an `h2` of its own, pass `headingLevel={3}`
and every heading moves down a level, so the page's outline stays true. With
`header={false}` there is no title, and the panel's sections take its place, at
`headingLevel` itself: under a page's `h1`, they are `h2`s.

To change the layout, copy `Default.tsx` and `Default.css` into your app, and import the
parts from `@nulib/clover` where they import `../../parts`. They use only what
`@nulib/clover` exports, and the hooks in `templates/shared/` (`useSlide.ts`,
`useDragToClose.ts`, `useSpine.ts`, `useFollowFocus.ts`); copy those too. The
split is `Clover.Split`, `Clover.SplitPane` and `Clover.SplitHandle`, which you can use
for any layout of your own.
