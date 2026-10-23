# Gallery

A grid of a Manifest's views (a spread is one cell) that opens one in a lightbox: its
label and position, the Body to pan and zoom, and the pager to move on. The lightbox is
a native `<dialog>`: focus stays inside it, Escape or a press outside closes it, and
focus returns to the cell.

```jsx
import Viewer from "@nulib/clover";
import { Gallery } from "@nulib/clover/templates";
import "@nulib/clover/styles.css";
import "@nulib/clover/templates.css";

<Viewer
  iiifContent="https://example.org/manifest.json"
  template={Gallery}
  size="12rem"
/>;
```

| Prop           | Default | What it does                                          |
| -------------- | ------- | ----------------------------------------------------- |
| `size`         | `10rem` | A grid cell's width (sets `--clover-items-size`).     |
| `headingLevel` | `2`     | The title's level; the lightbox's title is one below. |
| …              |         | Every `Clover.Root` prop.                             |

To change the layout, copy `Gallery.tsx`, `Gallery.css` and `../shared/Lightbox.tsx` into
your app. They use only what `@nulib/clover` exports.
