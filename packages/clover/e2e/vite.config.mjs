import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The end-to-end harness (`e2e/app`) over the package's source, on the React installed in
 * `e2e/<react>`, on its own port. Each React is an install of its own, aliased here: the
 * root's is the docs' (19, for Next 16), so without one the harness ran whatever the docs
 * needed, and the projects meant for React 18 ran 19. This config serves the harness on
 * React 18; `vite.react19.config.mjs` serves it on React 19.
 */
export function harness(react, port) {
  const modules = resolve(here, react, "node_modules");
  if (!existsSync(resolve(modules, "react/package.json")))
    throw new Error(
      `The e2e harness's React is not installed: run \`npm ci\` in packages/clover/e2e/${react}.`,
    );
  return defineConfig({
    root: resolve(here, "app"),
    esbuild: { jsx: "automatic" },
    json: { stringify: true },
    resolve: {
      alias: [
        {
          find: /^react-dom\/client$/,
          replacement: `${modules}/react-dom/client.js`,
        },
        { find: /^react-dom$/, replacement: `${modules}/react-dom/index.js` },
        {
          find: /^react\/jsx-runtime$/,
          replacement: `${modules}/react/jsx-runtime.js`,
        },
        {
          find: /^react\/jsx-dev-runtime$/,
          replacement: `${modules}/react/jsx-dev-runtime.js`,
        },
        { find: /^react$/, replacement: `${modules}/react/index.js` },
      ],
    },
    // Each React's dependencies bundled apart, and afresh at each start: the cache's key
    // reads the repository's lockfile, never this install's.
    optimizeDeps: { force: true },
    cacheDir: resolve(here, react, ".vite"),
    server: { port, strictPort: true },
    logLevel: "warn",
  });
}

export default harness("react18", 4321);
