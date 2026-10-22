/**
 * Three test projects: the docs site's helpers (the root config), the package
 * (`@nulib/clover`, its own config, relative imports only), and the package's web
 * component under Preact, as it ships.
 */
export default [
  { extends: "./vitest.config.mjs", test: { name: "docs" } },
  "./packages/clover/vitest.config.mjs",
  "./packages/clover/vitest.preact.config.mjs",
];
