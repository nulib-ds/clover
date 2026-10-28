# @nulib/clover

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
| `@nulib/clover/map`                   | `Map`, for navPlace and georeferenced images. The Viewer adds its Map tab itself.     |
| `@nulib/clover/three`                 | `registerThreeEngine`, to draw a Scene with three.js, which you install.              |
| `@nulib/clover/web-components`        | `<clover-viewer>`, and every part as an element.                                      |
| `@nulib/clover/web-components/viewer` | `<clover-viewer>` alone, for a page that shows a Viewer and nothing else of Clover's. |
| `@nulib/clover/web-components/three`  | three.js for the elements' Scene, bundled.                                            |
| `@nulib/clover/styles.css`            | Every part's styles, and the `Default` template's.                                    |
| `@nulib/clover/templates.css`         | The other templates' styles.                                                          |

## Learn more

- [Get started](https://clover.iiif.library.northwestern.edu/docs): a quick start, either way.
- [Viewer](https://clover.iiif.library.northwestern.edu/docs/viewer): its templates, and every prop.
- [Composing layouts](https://clover.iiif.library.northwestern.edu/docs/composing): layouts of your
  own, from the parts and hooks.
- [Styling](https://clover.iiif.library.northwestern.edu/docs/styling): colors, sizes and classes.
- [Technical overview](https://clover.iiif.library.northwestern.edu/docs/technical): events,
  languages, types, what each part loads, and coming from Clover 3.x.

Clover 3.x, `@samvera/clover-iiif`, is documented on the same site, under
[Clover 3.x](https://clover.iiif.library.northwestern.edu/docs/3.x).

## License

MIT, © 2026 Northwestern University Libraries. See
[LICENSE](https://github.com/nulib-ds/clover/blob/main/LICENSE).
