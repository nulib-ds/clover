import { defineConfig, devices } from "@playwright/test";

/**
 * @nulib/clover end to end, on Chromium, WebKit and Firefox (React 18, `e2e/react18`, its
 * own install), on WebKit at iPhone size and Chromium at an Android phone's (Pixel 7),
 * both with touch, and on Chromium with React 19 (`e2e/react19`, its own install too):
 * `npm run e2e -w @nulib/clover`.
 * The harness is served by Vite over the package's source; every IIIF resource and image
 * is served from disk by routing (`specs/fixtures.ts`), so nothing reaches the network.
 */
/** Specs that measure time, run alone (the `timing` project). */
const TIMED = /scale\.spec\.ts$/;

export default defineConfig({
  testDir: "specs",
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4321", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: TIMED,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: TIMED,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: TIMED,
    },
    // Phones, with touch: WebKit at iPhone size, and Chromium as Chrome on Android.
    // Phone-only specs skip elsewhere.
    { name: "iphone", use: { ...devices["iPhone 15"] }, testIgnore: TIMED },
    { name: "android", use: { ...devices["Pixel 7"] }, testIgnore: TIMED },
    {
      name: "react19",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4322" },
      testIgnore: TIMED,
    },
    /*
     * Timed specs, in Chromium, once everything else has finished: sharing the machine
     * with four other browsers, their timings measured the machine, not Clover.
     */
    {
      name: "timing",
      use: { ...devices["Desktop Chrome"] },
      testMatch: TIMED,
      dependencies: [
        "chromium",
        "webkit",
        "firefox",
        "iphone",
        "android",
        "react19",
      ],
    },
  ],
  webServer: [
    {
      command: "npx vite --config e2e/vite.config.mjs",
      cwd: "..",
      url: "http://localhost:4321",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npx vite --config e2e/vite.react19.config.mjs",
      cwd: "..",
      url: "http://localhost:4322",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
