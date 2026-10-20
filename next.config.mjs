import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import nextra from "nextra";

const root = path.dirname(fileURLToPath(import.meta.url));

/*
 * Nextra 4 reads the pages from `content/` (served from the site's root) through the
 * catch-all route `app/[[...mdxPath]]/page.tsx`. Search is Pagefind, which indexes the
 * built HTML: `postbuild:docs` writes its index into `out/_pagefind`. Code blocks stay
 * out of the index, as FlexSearch kept them out in Nextra 2.
 */
const withNextra = nextra({
  search: { codeblocks: false },
  mdxOptions: {
    /*
     * GitHub's own default themes, whose every code color holds 4.5:1 on Nextra's white
     * and black code grounds (WCAG 1.4.3). Nextra's `github-light` and `github-dark` do
     * not: an orange at 3.5:1, and dark comments at 4.4:1.
     */
    rehypePrettyCodeOptions: {
      theme: { light: "github-light-default", dark: "github-dark-default" },
    },
  },
});

/* The mocks with a live copy for `npm run dev` (see /docs/mocks). */
const liveMocks = () => fs.readdirSync(path.join(root, "pages/api/mocks"));

export default function config(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  /*
   * Where GitHub Pages serves the site. The deploy workflow passes the path Pages reports
   * (`/clover` on nulib-ds.github.io, nothing on a private Pages domain); a build without
   * it is for nulib-ds.github.io.
   */
  const basePath = isDev ? "" : (process.env.DOCS_BASE_PATH ?? "/clover");

  return withNextra({
    basePath,
    // For the components that build addresses under it (`docs/lib/router.ts`).
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
    images: {
      unoptimized: true,
    },
    /*
     * The docs build is a static export (GitHub Pages). Only the build: the dev-only
     * mocks under `pages/api` (see /docs/mocks) need a server, which an export turns off.
     */
    ...(isDev ? {} : { output: "export" }),
    /*
     * In `next dev`, a mock with a live copy opens live at its published address too, as
     * the homepage and the demos open it: the live Manifest's ids are under the dev server,
     * which answers them, so what the static one points to on the published site and that
     * is not deployed yet (a new mock's captions) is there. Only the Manifest, as the live
     * copy does not serve every static file (content-search's example answers).
     */
    ...(isDev && {
      rewrites: async () => ({
        beforeFiles: liveMocks().map((name) => ({
          source: `/mocks/${name}/manifest.json`,
          destination: `/api/mocks/${name}/manifest.json`,
        })),
      }),
    }),
  });
}
