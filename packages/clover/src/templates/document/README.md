# Document

Reads like a PDF viewer: a toolbar across the top (the title, and Download), page
thumbnails down the left, and the pages down one column on a grey ground, as a PDF
reader's continuous view. The page thumbnails' toggle is drawn as Clover's round controls
are: the glyph of a list of thumbnails, its pictures filled while they show, and where the
reader is ("3 / 17"). While they show, it sits on the bar between them and the page, over
them but for its far rounded end, so the thumbnails have their pane's whole height; put
away, it waits over the page's top left, level with the Canvas's controls. The bar widens
or narrows them (8rem to 24rem; drag it, click or tap it to step from 8rem to 13rem to
24rem and round again, or use the arrow keys on it), and the width is remembered. A
document of one page has no page thumbnails, bar or toggle: the page takes the whole
width.

Each view (a spread is one) is a sheet, fitted whole, and never taller than the stage
less a strip, so the top of the next always shows under it. Scroll through them as
through any page, with the wheel, a trackpad, a finger or the scrollbar; past the first
or last, the web page scrolls on. The top of the stage is where a sheet is active: when
the scroll comes to rest, the next sheet is brought there once the active one has been
scrolled a quarter of its height on (the previous once a quarter of it shows), and
otherwise the active one settles back. A press on another sheet, a thumbnail, and PageUp
and PageDown bring theirs too. Sheets not active are muted. The active sheet is the live
Canvas, to zoom into and explore; it and its controls show once it is in place and
drawn, and while the column scrolls its controls slide out of the way. Zoomed in or out,
or moved, the active sheet fills the stage and the others dissolve, until it is home
again (Reset, or `0`) or another sheet comes in.

The information panel, from the panel toggle among the Canvas's controls, sits to the
right of the page in its own pane where there is room for both, with a bar between them
to share the width (remembered as the thumbnails' is), and its toggle on that bar while it
is open. Where there is not (a phone), it slides out over the page instead and takes
focus; its close button or Escape puts it away and hands focus back to the toggle. Each
toggle moves as it is pressed, and focus goes with it.

```jsx
import Viewer from "@nulib/clover";
import { Document } from "@nulib/clover/templates";
import "@nulib/clover/styles.css";
import "@nulib/clover/templates.css";

<Viewer iiifContent="https://example.org/manifest.json" template={Document} />;
```

| Prop                 | Default                      | What it does                                                    |
| -------------------- | ---------------------------- | --------------------------------------------------------------- |
| `defaultSidebarOpen` | open on wide screen          | Whether the page thumbnails start shown.                        |
| `defaultPanelOpen`   | `false`                      | Whether the information panel starts open.                      |
| `panelLayout`        | `"accordion"`                | The panel's sections as stacked boxes, or `"tabs"`.             |
| `download`           | `true`                       | A Download button, when the Manifest or page has a `rendering`. |
| `headingLevel`       | `2`                          | The title's level; the panel's sections are a level below.      |
| `storageKey`         | `"clover-template-document"` | Where the thumbnails' width is remembered; `false` forgets it.  |
| …                    |                              | Every `Clover.Root` prop: `request`, `canvasId`, `annotations`… |

Size it with `--clover-template-document-height` (default `min(85vh, 56rem)`). Below
40rem the thumbnails cover the page while open, their toggle on their inner edge, and
choosing one puts them away; they can be dragged back off to the start, toggle and all.

The title in the toolbar is an `h2`, and the panel's section headings and the Download
menu's groups `h3`s. Under a heading of the page's own, pass the level below it as
`headingLevel`.

A page is a view: a paged Manifest's spreads are a sheet each.
Pinch and Ctrl-wheel zoom into the current sheet; the plain wheel always scrolls the
column. On a touch screen a finger scrolls it too, until you zoom in: then it moves
about the page.

To change the layout, copy `Document.tsx`, `Sheets.tsx` and `Document.css` into your
app, with the hooks in `templates/shared/` they import (`useSlide.ts`,
`useDragToClose.ts`, `useSpine.ts`, `useFollowFocus.ts`). Otherwise they use only what
`@nulib/clover` exports.
