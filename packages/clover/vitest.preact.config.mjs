import { defineProject } from "vitest/config";
import { cloverSheets } from "./build/clover-sheets.mjs";
import { preactAliases } from "./build/preact.mjs";

/**
 * The elements' tests, under Preact, as they are built and ship (`build/preact.mjs`),
 * each stylesheet loading with the code that draws what it styles, as the build has it
 * (`build/clover-sheets.mjs`), its key and place without its rules. The package's own project leaves them out.
 */
export default defineProject({
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  resolve: { alias: preactAliases },
  plugins: [cloverSheets({ rules: false })],
  test: {
    name: "clover-preact",
    environment: "jsdom",
    globals: true,
    include: ["src/web-components/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/setupBrowser.ts"],
    pool: "forks",
  },
});
