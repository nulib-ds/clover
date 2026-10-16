# Document

Reads like a PDF viewer: a toolbar across the top, page thumbnails down the left, and one
whole page at a time on a grey ground. The bar between the thumbnails and the page widens
or narrows them (8rem to 24rem; drag it, click or tap it to step from 8rem to 13rem to
24rem and round again, or use the arrow keys on it), and the width is
remembered. A document of one page has no thumbnails, bar or toggle for them: the page
takes the whole width. You never see part of the next page. Scrolling
turns the page, one gesture to one page however long a trackpad's momentum runs, and
PageUp and PageDown do the same. A scroll short of a turn shows how near it is: the
page leans the way it is scrolled and a chevron rises in from the edge the next page
comes from, springing back when let go. At the first or last page the wheel scrolls the
document on past the viewer. The information panel, from the panel toggle, sits to the
right of the page in its own pane where there is room for both, with a bar between them
to share the width (remembered as the thumbnails' is). Where there is not (a phone), it
slides out over the page instead and takes focus; its close button or Escape puts it
away and hands focus back to the toggle.

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
40rem the thumbnails cover the page while open, and choosing one puts them away.

The title in the toolbar is an `h2`, and the panel's section headings and the Download
menu's groups `h3`s. Under a heading of the page's own, pass the level below it as
`headingLevel`.

A page is a view: a paged Manifest turns a spread at a time, as the pager does. Pinch
and Ctrl-wheel still zoom into a page; the plain wheel always turns it.

To change the layout, copy `Document.tsx`, `usePaging.ts` and `Document.css` into your
app. They use only what `@nulib/clover` exports.
