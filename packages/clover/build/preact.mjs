/**
 * React's imports, answered by Preact: how `<clover-viewer>` is built
 * (`web-components.config.mjs`), and how its tests run (`vitest.preact.config.mjs`), so
 * they test what ships.
 */
export const preactAliases = [
  { find: /^react-dom\/client$/, replacement: "preact/compat/client" },
  { find: /^react-dom$/, replacement: "preact/compat" },
  { find: /^react\/jsx-runtime$/, replacement: "preact/jsx-runtime" },
  { find: /^react\/jsx-dev-runtime$/, replacement: "preact/jsx-dev-runtime" },
  { find: /^react$/, replacement: "preact/compat" },
];
