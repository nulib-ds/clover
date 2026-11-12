<picture>
  <source media="(prefers-color-scheme: dark) and (prefers-reduced-motion: reduce)" srcset=".github/assets/hero-dark-still.svg">
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/hero-dark.svg">
  <source media="(prefers-reduced-motion: reduce)" srcset=".github/assets/hero-light-still.svg">
  <img alt="The Clover IIIF wordmark over a Clover Viewer blown apart into its blocks on a Root, each block named in its edge, seen from a little below, showing the White bicycle catalog as a paged book: its Label, “Portfolio of illustrations showing the White bicycles : then and now”; its Body zoomed in on Page 24 of the spread of Page 24 and Page 25, its Then and Now annotations framed as Clover frames them, Now picked, the picture around it dimmed, and its Tip standing out of the Body saying “Now – Three generations of a family cycle along a lakeside path.”; Items, its views Page 20 and Page 21, Page 22 and Page 23, Page 24 and Page 25, Page 26 and Page 27, Page 28 and Page 29, Page 24 and Page 25 chosen, between its previous and next buttons; and a Panel of Annotations, under Page 24, “Then – Family rides in a two-horse surrey along a country road.” and “Now – Three generations of a family cycle along a lakeside path.”, Now chosen, a line from Now to its Tip on the Body, and About, its Metadata (Contributor, White Sewing Machine Company (Author); Date, 1896; Location, Ohio--Cleveland; Publisher, The White Sewing Machine Co.). Sliding out from under its right side, other media as options: a Canvas of the Nuremberg footage, Rudolf Hess annotated, a pointer pressing its play button, and a Scene, the Esu shrine standing out of it." src=".github/assets/hero-light.svg">
</picture>

<sub>The White Sewing Machine Company's bicycle catalog (1896), courtesy of Northwestern University Libraries; an Esu shrine, © 2025 Northwestern University; the Nuremberg judgment (1946), National Archives, via Wikimedia Commons.</sub>

**A [Northwestern University Libraries](https://www.library.northwestern.edu/) project.**

A viewer as distinctive as your collections. Design a user experience rooted in IIIF.

Clover builds accessible viewers for IIIF Manifests and Collections, in React or as web
components: a ready-made `Viewer`, and the parts it is made of, to compose your own. This repository holds the package,
`@nulib/clover` (in [`packages/clover`](./packages/clover)), and its documentation site.

Clover 3.x, `@samvera/clover-iiif`, is deprecated and no longer maintained. Its source
is kept on this repository's [`v3` branch](https://github.com/nulib-ds/clover/tree/v3),
and its documentation on this site, under "Deprecated versions".

## Development

The documentation site is Next.js and [Nextra](https://nextra.site/), at
`http://localhost:3000`:

```shell
npm install
npm run dev
```

| Command                     | What it does                                                                      |
| --------------------------- | --------------------------------------------------------------------------------- |
| `npm run build`             | Build `@nulib/clover` into `packages/clover/dist/`                                |
| `npm run build:docs`        | Build the site as a static export (not while `npm run dev` is running)            |
| `npm run build:readme-hero` | Redraw the READMEs' picture in `.github/assets/`, by hand: no other build runs it |
| `npm test`                  | Run the unit tests (Vitest): the package's and the docs'                          |
| `npm run e2e`               | Run the package's end-to-end tests (Playwright)                                   |
| `npm run lint`              | Check formatting (Prettier) and lint (ESLint)                                     |
| `npm run typecheck`         | Check types (TypeScript)                                                          |

## Contributing

Please follow the [contributing guidelines](./.github/CONTRIBUTING.md), and branch from
`main`.

## License

[MIT](./LICENSE).
