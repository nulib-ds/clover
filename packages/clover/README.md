<picture>
  <source media="(prefers-color-scheme: dark) and (prefers-reduced-motion: reduce)" srcset="https://raw.githubusercontent.com/nulib-ds/clover/main/.github/assets/hero-dark-still.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nulib-ds/clover/main/.github/assets/hero-dark.svg">
  <source media="(prefers-reduced-motion: reduce)" srcset="https://raw.githubusercontent.com/nulib-ds/clover/main/.github/assets/hero-light-still.svg">
  <img alt="The Clover IIIF wordmark over a Clover Viewer blown apart into its blocks on a Root, each block named in its edge, seen from a little below, showing the White bicycle catalog as a paged book: its Label, “Portfolio of illustrations showing the White bicycles : then and now”; its Body zoomed in on Page 24 of the spread of Page 24 and Page 25, its Then and Now annotations framed as Clover frames them, Now picked, the picture around it dimmed, and its Tip standing out of the Body saying “Now – Three generations of a family cycle along a lakeside path.”; Items, its views Page 20 and Page 21, Page 22 and Page 23, Page 24 and Page 25, Page 26 and Page 27, Page 28 and Page 29, Page 24 and Page 25 chosen, between its previous and next buttons; and a Panel of Annotations, under Page 24, “Then – Family rides in a two-horse surrey along a country road.” and “Now – Three generations of a family cycle along a lakeside path.”, Now chosen, a line from Now to its Tip on the Body, and About, its Metadata (Contributor, White Sewing Machine Company (Author); Date, 1896; Location, Ohio--Cleveland; Publisher, The White Sewing Machine Co.). Sliding out from under its right side, other media as options: a Canvas of the Nuremberg footage, Rudolf Hess annotated, a pointer pressing its play button, and a Scene, the Esu shrine standing out of it." src="https://raw.githubusercontent.com/nulib-ds/clover/main/.github/assets/hero-light.svg">
</picture>

**A viewer as distinctive as your collections.** Design a user experience rooted in IIIF.

Clover builds accessible viewers for IIIF Manifests and Collections, in React or as web
components: a ready-made `Viewer`, and the parts it is made of, to compose your own. It is
a project of [Northwestern University Libraries](https://www.library.northwestern.edu/).

[Documentation](https://clover.iiif.library.northwestern.edu/docs) ·
[Repository](https://github.com/nulib-ds/clover) ·
[Issues](https://github.com/nulib-ds/clover/issues)

## Install

```bash
npm install @nulib/clover
```

React 18 and 19 are supported. The package is ES modules only.

## In React

The Viewer, with its `Default` template:

```jsx
import Viewer from "@nulib/clover";
import "@nulib/clover/styles.css";

export default function Item() {
  return (
    <Viewer iiifContent="https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif" />
  );
}
```

Another template, with its styles:

```jsx
import Viewer from "@nulib/clover";
import { Document } from "@nulib/clover/templates";
import "@nulib/clover/styles.css";
import "@nulib/clover/templates.css";

<Viewer iiifContent={url} template={Document} />;
```

Or a layout of your own, from the parts the templates are made of:

```jsx
import * as Clover from "@nulib/clover";
import "@nulib/clover/styles.css";

<Clover.Root iiifContent={url}>
  <Clover.Label />
  <Clover.Body />
  <Clover.Items />
</Clover.Root>;
```

## As web components

For a page without React. The elements bring their own styles, so there is no stylesheet
to add. With a bundler, import them once:

```js
import "@nulib/clover/web-components";
```

Or load them from a CDN, in the page's `<head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@nulib/clover/dist/web-components/index.umd.js"></script>
```

Then place the Viewer, or the parts:

```html
<clover-viewer
  iiif-content="https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif"
></clover-viewer>

<clover-root iiif-content="https://example.org/manifest.json">
  <clover-label></clover-label>
  <clover-body></clover-body>
  <clover-items></clover-items>
</clover-root>
```

If you serve Clover's files yourself, copy the whole `dist/web-components` folder.

## Entry points

| Import                                | What it is                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `@nulib/clover`                       | The Viewer (the default export), and every part, hook and helper (named).             |
| `@nulib/clover/templates`             | The templates: `Default`, `Document` and `Gallery`.                                   |
| `@nulib/clover/map`                   | `Map` and its helpers, as `@nulib/clover` exports them (`Clover.Map`).                |
| `@nulib/clover/three`                 | `registerThreeEngine`, to draw a Scene with three.js, which you install.              |
| `@nulib/clover/web-components`        | `<clover-viewer>`, and every part as an element.                                      |
| `@nulib/clover/web-components/viewer` | `<clover-viewer>` alone, for a page that shows a Viewer and nothing else of Clover's. |
| `@nulib/clover/web-components/three`  | three.js for the elements' Scene, bundled.                                            |
| `@nulib/clover/styles.css`            | Every part's styles, and the `Default` template's.                                    |
| `@nulib/clover/templates.css`         | The other templates' styles.                                                          |
| `@nulib/clover/base.css`              | For a look of your own, in place of both: the structure of every part and template.   |
| `@nulib/clover/spacing.css`           | Clover's margins, paddings and gaps, after `base.css`.                                |

## Learn more

- [Get started](https://clover.iiif.library.northwestern.edu/docs): a quick start, either way.
- [Viewer](https://clover.iiif.library.northwestern.edu/docs/viewer): its templates, and every prop.
- [Composing layouts](https://clover.iiif.library.northwestern.edu/docs/composing): layouts of your
  own, from the parts and hooks.
- [Styling](https://clover.iiif.library.northwestern.edu/docs/styling): colors, sizes and classes.
- [Glossary](https://clover.iiif.library.northwestern.edu/docs/composing/glossary): every
  component and helper, and the package's structure.

Clover 3.x, `@samvera/clover-iiif`, is deprecated and no longer maintained. Its docs are
kept on the same site, under
[Clover 3.x](https://clover.iiif.library.northwestern.edu/docs/deprecated-versions).

## License

MIT, © 2026 Northwestern University Libraries. See
[LICENSE](https://github.com/nulib-ds/clover/blob/main/LICENSE).

## Credits

The White Sewing Machine Company's bicycle catalog (1896), courtesy of Northwestern University Libraries; an Esu shrine, © 2025 Northwestern University; the Nuremberg judgment (1946), National Archives, via Wikimedia Commons.
