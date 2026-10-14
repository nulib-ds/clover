const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

const withNextra = require("nextra")({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
});

module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return withNextra({
    /*
     * Where GitHub Pages serves the site. The deploy workflow passes the path Pages reports
     * (`/clover` on nulib-ds.github.io, nothing on a private Pages domain); a build without
     * it is for nulib-ds.github.io.
     */
    basePath: isDev ? "" : (process.env.DOCS_BASE_PATH ?? "/clover"),
    images: {
      unoptimized: true,
    },
    // Skip ESLint during the docs build; we run lint separately.
    eslint: {
      ignoreDuringBuilds: true,
      // `next lint` covers pages by default; the package is linted with them.
      dirs: ["pages", "packages/clover/src"],
    },
    /*
     * The docs build is a static export (GitHub Pages). Only the build: an export turns API
     * routes off in `next dev` too, and the dev-only mocks under `pages/api` (see
     * /docs/mocks) need them.
     */
    ...(isDev ? {} : { output: "export" }),
  });
};
