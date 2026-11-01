# Gallery

A grid framed by what it opens, each cell opening in a lightbox: its label under the
levels it sits in, the Body to pan and zoom, a short strip of thumbnails to move on (or the
pager), and the information panel beside it. Opened on a Manifest, the grid is its
views (a spread is one cell, and one view still a grid); opened on a Collection, the Collection's title and summary
head it and its members are the cells, each showing that Manifest in the lightbox.

The lightbox is a modal layer inside the Gallery, filling its bounds, not a window-wide
`<dialog>`: the rest of the Gallery is out of reach while it is open. Over its title, the
levels it sits in (the Manifest's label, and a Collection's), the one it opened from a
step back out. Focus is on the view shown in its strip of thumbnails (on Close with the
pager). Escape, Close, a press outside its panel or the step out closes it, and focus
returns to the cell.

```jsx
import Viewer from "@nulib/clover";
import { Gallery } from "@nulib/clover/templates";
import "@nulib/clover/styles.css";
import "@nulib/clover/templates.css";

<Viewer
  iiifContent="https://example.org/manifest.json"
  template={Gallery}
  items="masonry"
  size="12rem"
/>;
```

| Prop               | Default                     | What it does                                                                   |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------ |
| `items`            | `"grid"`                    | The grid, as its Items' layout: `grid` (square cells) or `masonry`.            |
| `secondary`        | `"summary"`                 | The line under each cell's label: `summary`, `navDate` or `none`.              |
| `size`             | `10rem`                     | A grid cell's width (sets `--clover-items-size`).                              |
| `gap`              | The inset                   | The space between cells: pixels, or a CSS length.                              |
| `height`           | `"auto"`                    | `auto` grows with the grid; a height holds it, the grid scrolling under it.    |
| `lightboxItems`    | `"slider"`                  | Under the lightbox's view: a short strip of thumbnails, or `"pager"`.          |
| `panel`            | `true`                      | The information panel beside the lightbox's view, as Default's and Document's. |
| `defaultPanelOpen` | `true`                      | Whether the panel starts open beside the view; over it, closed.                |
| `panelLayout`      | `"accordion"`               | The panel's sections as stacked boxes, or `"tabs"`.                            |
| `download`         | `true`                      | The downloads in the panel's About.                                            |
| `languages`        | `true`                      | The languages to read the resource in, beside the panel's About heading.       |
| `storageKey`       | `"clover-template-gallery"` | Where the panel's width is remembered; `false` forgets it.                     |
| `headingLevel`     | `2`                         | The title's level; the lightbox's title is one below.                          |
| …                  |                             | Every `Clover.Root` prop.                                                      |

The lightbox fills the Gallery by default. `--clover-template-lightbox-inset`,
`--clover-template-lightbox-backdrop` and `--clover-template-lightbox-radius` give it room
around its panel, a backdrop there and corners.

The lightbox's Body loads its code when the lightbox first opens, or as a
pointer or focus first comes to the gallery, so the page loads only the thumbnails.

To change the layout, copy `Gallery.tsx` and `Gallery.css` into your app, with what in
`templates/shared/` they import: `Lightbox.tsx`, `Lightbox.css` and `LightboxView.tsx`, the
information panel every template shares (`PanelPane.tsx`, `PanelPart.tsx`,
`useLazyPanelPane.ts`), and through them `useDrawer.ts`, `useSlide.ts`, `useSpine.ts`,
`useDragToClose.ts` (with `dragToClose.ts`) and `useFollowFocus.ts`. Otherwise they use only
what `@nulib/clover` exports.
