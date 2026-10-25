# Clover

**A [Northwestern University Libraries](https://www.library.northwestern.edu/) project.**

A viewer as distinctive as your collections. Design a user experience rooted in IIIF.

Clover builds accessible viewers for IIIF Manifests and Collections, in React or as web
components: a ready-made `Viewer`, and the parts it is made of, to compose your own. This repository holds the package,
`@nulib/clover` (in [`packages/clover`](./packages/clover)), and its documentation site.

Clover 3.x, `@samvera/clover-iiif`, is maintained at
[samvera-labs/clover-iiif](https://github.com/samvera-labs/clover-iiif). Its documentation
is kept on this site, under "Earlier versions".

## Development

The documentation site is Next.js and [Nextra](https://nextra.site/), at
`http://localhost:3000`:

```shell
npm install
npm run dev
```

| Command              | What it does                                                           |
| -------------------- | ---------------------------------------------------------------------- |
| `npm run build`      | Build `@nulib/clover` into `packages/clover/dist/`                     |
| `npm run build:docs` | Build the site as a static export (not while `npm run dev` is running) |
| `npm test`           | Run the unit tests (Vitest): the package's and the docs'               |
| `npm run e2e`        | Run the package's end-to-end tests (Playwright)                        |
| `npm run lint`       | Check formatting (Prettier) and lint (ESLint)                          |
| `npm run typecheck`  | Check types (TypeScript)                                               |

## Contributing

Please follow the [contributing guidelines](./.github/CONTRIBUTING.md), and branch from
`main`.

## License

[MIT](./LICENSE).
