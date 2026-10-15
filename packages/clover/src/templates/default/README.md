# Default

The Viewer's own layout, drawn when it is given no `template`: Clover 3.x's Viewer, built
from 4.x parts. The thumbnail (`xl` high, at its own shape up to 5rem wide, cropped past that) and the title over the stage; the thumbnail strip under the stage, whose
arrows are Previous and Next, headed by the titles of the view on the left (a dot
between a spread's two) and the position on the right; and the information panel to the right of all three, the layout's
full height, scrolling within when its sections run longer. Downloads (the page's and the
Manifest's `rendering`) are listed in the panel's About.

The panel never stacks. As in 3.x it has its own space beside the stage, 24rem to start,
and the bar between them shares the width: drag it, or focus it and use the arrow keys
(Home and End for the limits; a double click puts it back). The stage keeps at least
16rem and the panel 14rem, and the width the reader chooses is remembered. With no room
for both (about 31rem, a phone), the panel slides over the stage instead, leaving a strip
of the page uncovered: a click on the strip, Escape or its close button puts it away.
The template measures its own width, so a narrow column of a wide page behaves the same.
The panel's toggle is always in the stage's top corner and never fades with the other
controls.

```jsx
import Viewer from "@nulib/clover";
import "@nulib/clover/styles.css";

<Viewer iiifContent="https://example.org/manifest.json" />;
```

Given no template, the Viewer loads `Default` the first time it draws: one request before
the Manifest starts to load, and nothing drawn on the server. Its styles are in
`styles.css`, so it needs no `templates.css`. To have it up front and drawn on the server,
pass it: `template={Default}`, from `@nulib/clover/templates`.

| Prop               | Default                     | What it does                                                    |
| ------------------ | --------------------------- | --------------------------------------------------------------- |
| `header`           | `true`                      | The thumbnail and title over the stage.                         |
| `panel`            | `true`                      | The information panel and its toggle.                           |
| `defaultPanelOpen` | —                           | Whether the panel starts open. Unset: open when it fits beside. |
| `panelLayout`      | `"accordion"`               | The panel's sections as stacked boxes, or `"tabs"`.             |
| `items`            | `"carousel"`                | The thumbnails: `"carousel"`, `"list"`, `"grid"`, or `false`.   |
| `storageKey`       | `"clover-template-default"` | Where the panel's width is remembered; `false` forgets it.      |
| …                  |                             | Every `Clover.Root` prop: `request`, `canvasId`, `annotations`… |

Size the stage with `--clover-content-height` (default `min(65vh, 40rem)`).

To change the layout, copy `Default.tsx` and `Default.css` into your app, and import the
parts from `@nulib/clover` where they import `../../parts`. They use only what
`@nulib/clover` exports, and the slide hooks in `templates/shared/useSlide.ts`. The
split is `Clover.Split`, `Clover.SplitPane` and `Clover.SplitHandle`, which you can use
for any layout of your own.
