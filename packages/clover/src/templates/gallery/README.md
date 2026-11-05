# Gallery

A grid framed by what it opens, each cell opening in a lightbox: the Manifest's label as
its title, the Body to pan and zoom with the view's label under it, a short strip of
thumbnails to move on (or the pager), and the information panel beside it. Opened on a Manifest, the grid is its
views (a spread is one cell, and one view still a grid); opened on a Collection, the Collection's title and summary
head it and its members are the cells, each showing that Manifest in the lightbox; opened
on an AnnotationPage of tags across Manifests (`useGivenAnnotations`), its label
heads it and its tags are the cells, each showing its Manifest framed on it, the
lightbox's strip stepping through the tags.

The lightbox is a modal layer inside the Gallery, filling its bounds, not a window-wide
`<dialog>`: the rest of the Gallery is out of reach while it is open. Before its title,
Back, a step out to the grid, named for where it goes ("Back to" the Collection, or the
Manifest); after it, Close. Focus is on the view shown in its strip of thumbnails (on
Close with the pager). Escape, Close, Back or a press outside its panel closes it, and
focus returns to the cell.

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

| Prop               | Default                     | What it does                                                                      |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------- |
| `items`            | `"grid"`                    | The grid, as its Items' layout: `grid` (square cells) or `masonry`.               |
| `secondary`        | `"summary"`                 | The line under each cell's label: `summary`, `navDate` or `none`.                 |
| `summary`          | `true`                      | The summary under the title, two lines with Read more; `false` leaves it out.     |
| `size`             | `10rem`                     | A grid cell's width (sets `--clover-items-size`).                                 |
| `gap`              | The inset                   | The space between cells: pixels, or a CSS length.                                 |
| `height`           | `"auto"`                    | `auto` grows with the grid; a height holds it, the grid scrolling under it.       |
| `lightboxItems`    | `"slider"`                  | Under the lightbox's view: a short strip of thumbnails, or `"pager"`.             |
| `panel`            | `true`                      | The information panel beside the lightbox's view, as Default's and Document's.    |
| `defaultPanelOpen` | `true`                      | Whether the panel starts open beside the view; over it, closed.                   |
| `panelLayout`      | `"accordion"`               | The panel's sections as stacked boxes, or `"tabs"`.                               |
| `panelSections`    | All                         | Which of the panel's sections it may have; none with data, and there is no panel. |
| `download`         | `true`                      | The downloads in the panel's About.                                               |
| `languages`        | `true`                      | The languages to read the resource in, beside the panel's About heading.          |
| `storageKey`       | `"clover-template-gallery"` | Where the panel's width is remembered; `false` forgets it.                        |
| `headingLevel`     | `2`                         | The title's level; the lightbox's title is one below.                             |
| …                  |                             | Every `Clover.Root` prop.                                                         |

The lightbox fills the Gallery by default. `--clover-template-lightbox-inset`,
`--clover-template-lightbox-backdrop` and `--clover-template-lightbox-radius` give it room
around its panel, a backdrop there and corners. Under a page's own sticky header,
`--clover-template-lightbox-top`, that header's height, holds the lightbox below it, so
the header never covers its title, Back or Close.

The lightbox's Body loads its code when the lightbox first opens, or as a
pointer or focus first comes to the gallery, so the page loads only the thumbnails.

To change it, follow the same four steps as every template:

1. On GitHub, open the [tag](https://github.com/nulib-ds/clover/tags) for the version you
   have installed, and copy this folder into your app.
2. In the files you copied, change `../../parts` to `@nulib/clover`, and each
   `../shared/…` to `@nulib/clover/templates`.
3. Rename `Gallery`, then make it yours.
4. Import `Gallery.css` after Clover's CSS (`styles.css`, then `templates.css`), and hand
   it to the Viewer:
   `<Viewer iiifContent={url} template={MyViewer} />`.

The helpers it imports from `@nulib/clover/templates` are on
[Helpers](https://clover.iiif.library.northwestern.edu/docs/composing/helpers#templates).
The lightbox is `Lightbox` from there, styled in `templates.css`.
