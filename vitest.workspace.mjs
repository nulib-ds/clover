/**
 * Two test projects: the docs site's helpers (the root config) and the package
 * (`@nulib/clover`, its own config, relative imports only).
 */
export default [
  { extends: "./vitest.config.mjs", test: { name: "docs" } },
  "./packages/clover/vitest.config.mjs",
];
