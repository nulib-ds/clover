import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineProject, mergeConfig } from "vitest/config";

import base from "./vitest.config.mjs";

/** React 18: the end-to-end harness's own install (`e2e/react18`). */
const react18 = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "e2e/react18/node_modules",
);

/**
 * The package's tests again on React 18, the earlier React its peers name: the root's is
 * 19, the docs'. Every import of React goes to `e2e/react18`, Testing Library's too,
 * through its ES module build, which Vite handles, so the aliases reach it; its CommonJS
 * build would require the root's React, and two Reacts break every hook.
 */
export default mergeConfig(
  base,
  defineProject({
    resolve: {
      alias: [
        {
          find: /^react-dom\/client$/,
          replacement: `${react18}/react-dom/client.js`,
        },
        {
          find: /^react-dom\/server$/,
          replacement: `${react18}/react-dom/server.js`,
        },
        {
          find: /^react-dom\/test-utils$/,
          replacement: `${react18}/react-dom/test-utils.js`,
        },
        { find: /^react-dom$/, replacement: `${react18}/react-dom/index.js` },
        {
          find: /^react\/jsx-runtime$/,
          replacement: `${react18}/react/jsx-runtime.js`,
        },
        {
          find: /^react\/jsx-dev-runtime$/,
          replacement: `${react18}/react/jsx-dev-runtime.js`,
        },
        { find: /^react$/, replacement: `${react18}/react/index.js` },
        {
          find: /^@testing-library\/react$/,
          replacement:
            "@testing-library/react/dist/@testing-library/react.esm.js",
        },
      ],
    },
    test: {
      name: "clover-react18",
      server: { deps: { inline: [/@testing-library\/react/] } },
      provide: { react: "18" },
    },
  }),
);
