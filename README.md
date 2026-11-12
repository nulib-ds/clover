<picture>
  <source media="(prefers-color-scheme: dark) and (prefers-reduced-motion: reduce)" srcset=".github/assets/hero-dark-still.svg">
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/hero-dark.svg">
  <source media="(prefers-reduced-motion: reduce)" srcset=".github/assets/hero-light-still.svg">
  <img alt="A Clover Viewer blown apart into its blocks on a Root, each block named in its edge, seen from a little below, showing the White bicycle catalog as a paged book: its Label, “Portfolio of illustrations showing the White bicycles : then and now”; its Body zoomed in on Page 24 of the spread of Page 24 and Page 25, its Then and Now annotations framed as Clover frames them, Now picked, the picture around it dimmed, and its Tip standing out of the Body saying “Now – Three generations of a family cycle along a lakeside path.”; Items, its views Page 20 and Page 21, Page 22 and Page 23, Page 24 and Page 25, Page 26 and Page 27, Page 28 and Page 29, Page 24 and Page 25 chosen, between its previous and next buttons; and a Panel of Annotations, under Page 24, “Then – Family rides in a two-horse surrey along a country road.” and “Now – Three generations of a family cycle along a lakeside path.”, Now chosen, a line from Now to its Tip on the Body, and About, its Metadata (Contributor, White Sewing Machine Company (Author); Date, 1896; Location, Ohio--Cleveland; Publisher, The White Sewing Machine Co.). Sliding out from under its right side, other media as options: a Canvas of the Nuremberg footage, Rudolf Hess annotated, its play button, and a Scene, the Esu shrine standing out of it." src=".github/assets/hero-light.svg">
</picture>

# Clover

**A viewer as distinctive as your collections.** Design a user experience rooted in
IIIF. Clover, a IIIF viewer made to fit any collection or project, is better than ever.
Use the Viewer as it is, or compose whatever suits your vision and your materials.
Install from npm as [`@nulib/clover`](https://www.npmjs.com/package/@nulib/clover) and
use as React or web components.

Try Clover with your own collections:\
https://clover.iiif.library.northwestern.edu

- **Adaptable:** images, audio, video, 3D objects and text, all in one viewer
- **Accessible:** WCAG 2.2 AA, ready for screen readers, with captions, strong contrast
  and more
- **Seamless:** takes on your institution’s brand colors and fonts
- **Composable:** your own layout, from the same components as the templates
- **Lightweight:** about 100 kB for the Viewer, less for a layout of your own
- **IIIF-native:** built to the IIIF APIs, for a wide range of use cases
- **Flexible:** every part of Clover, in React or as web components

## Get started

For templates, composing your own layout and every prop, see the
[documentation](https://clover.iiif.library.northwestern.edu/docs). To begin, choose your
setup, then add the Viewer to a page.

### React

You build your site with React. Add Clover to your app like any other package.

```bash
npm install @nulib/clover
```

```jsx
import Viewer from "@nulib/clover";
import "@nulib/clover/styles.css";

export default function Item() {
  return (
    <Viewer iiifContent="https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif" />
  );
}
```

### Web components (npm)

Your site has a build step, but no React. Install Clover once, then use it on any page.

```bash
npm install @nulib/clover
```

```js
import "@nulib/clover/web-components";
```

```html
<clover-viewer
  iiif-content="https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif"
></clover-viewer>
```

### Web components (CDN)

Plain HTML or an embed, no build step. Paste one line into a CMS or a blog post.

```html
<script src="https://cdn.jsdelivr.net/npm/@nulib/clover/dist/web-components/index.umd.js"></script>

<clover-viewer
  iiif-content="https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif"
></clover-viewer>
```

The elements bring their own styles, so there is no stylesheet to add.

### Compose with its parts

The Viewer is made of parts. Place them in a `Root`, in any order, for a layout of your
own.

```jsx
import * as Clover from "@nulib/clover";
import "@nulib/clover/styles.css";

export default function Item() {
  return (
    <Clover.Root iiifContent="https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif">
      <Clover.Body />
      <Clover.Label as="h3" />
      <Clover.Summary />
      <Clover.Items />
    </Clover.Root>
  );
}
```

```html
<clover-root
  iiif-content="https://api.dc.library.northwestern.edu/api/v2/works/3510cac2-1439-49f0-b30a-09ae19a0643d?as=iiif"
>
  <clover-body></clover-body>
  <clover-label as="h3"></clover-label>
  <clover-summary></clover-summary>
  <clover-items></clover-items>
</clover-root>
```

## Contributing

Please follow the [contributing guidelines](./.github/CONTRIBUTING.md), and branch from
`main`.

## License

[MIT License](./LICENSE). Copyright (c) 2026 Northwestern University Libraries.

## Credits

_The White Sewing Machine Company's bicycle catalog (1896), courtesy of Northwestern University Libraries; an Esu shrine, © 2025 Northwestern University; the Nuremberg judgment (1946), National Archives, via Wikimedia Commons._
