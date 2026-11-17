# Document

Reads like a PDF viewer's continuous view: a toolbar across the top, page thumbnails down
the left, and the pages down one column on a gray ground, a space around them and one
size smaller between two, and the top of the next always in sight.

The toolbar holds the title, a hairline under it fading out toward its ends. At its end
are the provider's logo, linked to its homepage, and Clover's round controls, together on
one capsule in the controls' dark fill, the open one in the accent, ringed white: first a
globe for the languages to read in, the resource's and Clover's interface languages
(`Clover.Language`; About in the aside offers none), then a button for each section the
resource has (About, the views, the Collection, the contents, the transcript, the
annotations; the map only where `panelSections` names it) and Download, where there is a `rendering`; and at its end, inside one edge
with it, Clover's search field, open where the toolbar is 56rem wide or more, else a
magnifier that opens into it. A section that holds something of the page in view has a dot
of the accent, ringed white, on its button, described as "This page", gone while the
section is open: About where the page describes itself (About then shows its label,
summary and metadata after the resource's) or has a place, Contents where it has
chapters, and Annotations where one is listed on it or a georeferenced image is. A section's button
opens it alone in Document's own aside, beside the page with a bar to share the width
where there is room, over the page where there is not, its close on its inner edge.
Pressed again, the button puts it away. A search made in the toolbar lists its hits in the
aside; the field's X clears it and puts both away.

The pages scroll freely, with the wheel, a trackpad, a finger or the scrollbar; past the
first or last, the web page scrolls on. The page most in view is the active one, its
thumbnail chosen, and its Canvas is live, the others stills of their pictures. A press on
a page, the pointer a magnifier over it, or a zoom opens it as the full viewer: a
keyboard's way in is the page's Canvas, which takes focus, and its Plus. Among the
pages, Tab reaches the page in view (its Canvas, or its Play), and from there Up and Down
go to the previous page and the next, Home and End to the first and last, focus going
with them and each page's place said, as the thumbnails' list steps; Enter opens it, or
plays it on a page that plays. The full viewer
lies over the whole column: the Canvas's own controls at its top end, as in Default (zoom in
and out, the two turns, reset, full screen, then Map, where the page, else the resource,
has a place, which shows the map in a box hanging just under them, in the Canvas, so their
Tips lie over it, and puts it away), and centered at its foot a button back to
the pages, its two arrows pointing at each other, Previous and
Next after it (over its top left for a recording, whose player's controls are at its
foot); the button, or Escape, closes it and puts the view home. A press on a thumbnail, and PageUp and PageDown, bring their page to the
top. An annotation chosen in the aside (a search's hit, a region in Contents, a hotspot
too), or a Transcript's cue, opens the full viewer on its page, framed
or playing from its time, its thumbnail chosen; on a phone the aside goes as it opens. A single page takes the column's whole height, its picture fitted whole in the
middle of it.

A video's, a sound's or a moving image's (pictures on a Canvas with a `duration`) page is its still (its `placeholderCanvas`'s picture, else its
`thumbnail`) on black, a sound's small in the middle as its player shows its artwork,
with a play button over it, a real one on the page in view, which a keyboard reaches
too: it, or a press on the still, plays it, the full viewer open, a video filling the column on its black ground, its
player's own controls at its foot, full screen among them at the lower right, and none of
a picture's. Closing the full viewer pauses it.

A place named in About, or a georeferenced image listed in Annotations, shows the Root's
map over the whole column as it is pressed, framed on it and marked, its zoom row at its
top end, where the full viewer has the Canvas's controls, and the page's picture in a box
just under it, in the map's box (`children`), so its Tips lie over it, the aside staying
beside it with what was pressed; on a phone the aside goes, and focus goes on to the map.
The page's box, Collapse map, trades the two: the map in a box over the pages at their
top end, as the Canvas's map box is over the Body in Default, with Expand map, which
trades them back, and Close; focus goes with each swap, and the map stays the one map.
Another page chosen meanwhile moves it to that page's place, its image else. Close or
Escape puts it away, focus back to what was pressed, else to its section's button. An
annotation then chosen in the aside puts it away too, opening the full viewer on its
page. Where `panelSections` names the Map, it is a section of its own whose Expand map
lays it over the column too; the toolbar's Map button puts it back in the aside.

The page thumbnails' toggle sits on the bar between them and the pages while they show,
and over the page's top left while they are put away. The bar widens or narrows them
(8rem to 24rem; drag it, click or tap it to step from 8rem to 13rem to 24rem and around
again, or use the arrow keys on it), and the width is remembered.

```jsx
import Viewer from "@nulib/clover";
import { Document } from "@nulib/clover/templates";
import "@nulib/clover/styles.css";
import "@nulib/clover/templates.css";

<Viewer iiifContent="https://example.org/manifest.json" template={Document} />;
```

| Prop                 | Default                      | What it does                                                                           |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| `defaultSidebarOpen` | Several pages                | Whether the page thumbnails start shown; a single page's put away; over the page, not. |
| `singleItem`         | `true`                       | The page thumbnails and their toggle for a single page too; `false` leaves them.       |
| `defaultPanelOpen`   | `false`                      | Whether the aside starts open on About beside the page; over it, closed.               |
| `panelSections`      | All                          | Which sections the toolbar offers; of those, the ones the resource has.                |
| `panelLabels`        |                              | Each section's name, in place of Clover's: `{ annotations: "Chapters" }`.              |
| `download`           | `true`                       | The Download button, where there is a `rendering`.                                     |
| `languages`          | `true`                       | The globe, where the resource comes in several languages.                              |
| `interfaceLanguages` | `true`                       | Whether the globe also offers Clover's interface languages.                            |
| `headingLevel`       | `2`                          | The title's level; the aside's name a level below, its section's under that.           |
| `storageKey`         | `"clover-template-document"` | Where the bars' widths are remembered; `false` forgets them.                           |
| …                    |                              | Every `Clover.Root` prop: `request`, `canvasId`, `annotations`…                        |

`panelLayout` is not read: each section opens alone.

Size it with `--clover-template-document-height` (default `min(85svh, 56rem)`, the
window's smallest height where a browser knows it, else `min(85vh, 56rem)`). In a box too
short for its toolbar and 16rem of pages, it grows past that height, for the page around
it to scroll, rather than crush the pages. Below 40rem the thumbnails cover the page while
open, their toggle on their inner edge, and choosing one puts them away; they can be
dragged back off to the start, toggle and all.

The title in the toolbar is an `h2`, the aside's name an `h3`, and its section's headings
and the downloads' groups `h4`s. Under a heading of the page's own, pass the level below
it as `headingLevel`.

A page is a view: a paged Manifest's spreads are a sheet each. Pinch and Ctrl-wheel zoom
into the active page; the plain wheel always scrolls the column. On a touch screen a
finger scrolls it too, until the page is zoomed in: then it moves about the page. A 3D
Scene takes a finger's drag always, to turn it, as in Default.

The aside's sections, the toolbar's search field and the downloads' links each load their
code as they are first wanted, so the page loads without them.

To change it, follow the same four steps as every template:

1. On GitHub, open the [tag](https://github.com/nulib-ds/clover/tags) for the version you
   have installed, and copy this folder into your app.
2. In the files you copied, change `../../parts` to `@nulib/clover`, and each
   `../shared/…` to `@nulib/clover/templates`.
3. Rename `Document`, then make it yours.
4. Import `Document.css` after Clover's CSS (`styles.css`, then `templates.css`), and hand
   it to the Viewer:
   `<Viewer iiifContent={url} template={MyViewer} />`.

The helpers it imports from `@nulib/clover/templates` are on
[Helpers](https://clover.iiif.library.northwestern.edu/docs/composing/helpers#templates).
