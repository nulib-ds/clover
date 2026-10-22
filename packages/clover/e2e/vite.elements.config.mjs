import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import elements from "../build/web-components.config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A page of Clover's elements (`e2e/elements`), served over the package's source as the
 * element build makes them: Preact for React, and the stylesheet in its runs.
 */
export default defineConfig({
  root: resolve(root, "e2e/elements"),
  resolve: elements.resolve,
  plugins: elements.plugins,
  esbuild: elements.esbuild,
  json: elements.json,
  server: { port: 4323, strictPort: true, fs: { allow: [root] } },
  logLevel: "warn",
});
