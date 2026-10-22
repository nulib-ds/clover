import { defineProject } from "vitest/config";

/**
 * The @nulib/clover test project: jsdom, relative imports only (no `src/*` alias). The
 * element's tests run under Preact instead (`vitest.preact.config.mjs`).
 */
export default defineProject({
  esbuild: { jsx: "automatic" },
  test: {
    name: "clover",
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/web-components/**", "**/node_modules/**"],
    setupFiles: ["./src/setupTests.ts"],
    pool: "forks",
    // The React this project runs, the root's (the docs', 19): `src/react.test.tsx`.
    provide: { react: "19" },
  },
});
