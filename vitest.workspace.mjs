import { existsSync } from "node:fs";

/**
 * Four test projects: the docs site's helpers (the root config), the package
 * (`@nulib/clover`, its own config, relative imports only), the package again on React 18
 * (the root's React is 19), and the package's web components under Preact, as they ship.
 *
 * React 18 is an install of its own (`packages/clover/e2e/react18`, shared with the
 * end-to-end harness): CI installs it, and a checkout without it runs the rest.
 */
const react18 = existsSync(
  new URL(
    "./packages/clover/e2e/react18/node_modules/react/package.json",
    import.meta.url,
  ),
);
if (!react18) {
  const missing =
    "The package's tests on React 18 need it installed: run `npm ci` in packages/clover/e2e/react18.";
  if (process.env.CI) throw new Error(missing);
  console.warn(`${missing} Running the rest.`);
}

export default [
  { extends: "./vitest.config.mjs", test: { name: "docs" } },
  "./packages/clover/vitest.config.mjs",
  ...(react18 ? ["./packages/clover/vitest.react18.config.mjs"] : []),
  "./packages/clover/vitest.preact.config.mjs",
];
