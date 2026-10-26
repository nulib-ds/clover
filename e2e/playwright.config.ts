import { defineConfig, devices } from "@playwright/test";

/**
 * The docs site end to end (`npm run e2e:docs`, and with the package's in `npm run e2e`):
 * what only the site does, in Chromium, over `npm run dev`, a running one reused; or,
 * with `DOCS_URL`, over a site already served there, a built one (its pages at the
 * address's root, its base path taken off by the server: WEBMCP.md). First, the tools
 * the site offers agents through WebMCP (WEBMCP.md), with a stand-in for the browser's
 * `document.modelContext` (`specs/stand-in.ts`), since no browser offers it to the site
 * until its origin trial does. The package's own suite is `packages/clover/e2e/`.
 */
const served = process.env.DOCS_URL;

export default defineConfig({
  testDir: "specs",
  // `next dev` compiles each page the first time it is asked for.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: served ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
  webServer: served
    ? undefined
    : {
        command: "npm run dev",
        cwd: "..",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
