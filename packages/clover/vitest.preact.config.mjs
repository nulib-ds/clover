import { defineProject } from "vitest/config";
import { preactAliases } from "./build/preact.mjs";

/**
 * `<clover-viewer>`'s tests, under Preact, as the element is built and ships
 * (`build/preact.mjs`). The package's own project leaves them out.
 */
export default defineProject({
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  resolve: { alias: preactAliases },
  test: {
    name: "clover-preact",
    environment: "jsdom",
    globals: true,
    include: ["src/web-components/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/setupBrowser.ts"],
    pool: "forks",
  },
});
