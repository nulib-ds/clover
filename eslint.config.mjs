import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

/*
 * ESLint 9's flat config, run by `npm run lint` (Next 16 has no `next lint`). What it
 * lints is what `next lint` did, the package's source and the site's routes, and the
 * site's shell beside them; the docs' components and scripts are not linted yet.
 */
export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/node_modules/**",
      "out/**",
      "coverage/**",
      "html/**",
      "playwright/**",
      "public/**",
      "**/*.d.ts",
      "**/*.umd.js",
      "docs/lib/maplibre-worker.generated.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      /*
       * The React Compiler's rules, new in eslint-plugin-react-hooks 7 (Next 16's config),
       * flag 99 places in code that passed every rule `next lint` ran before. Off until
       * they are taken up on purpose; the Rules of Hooks and exhaustive deps stay on.
       */
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Where Next's config sets up the hooks plugin.
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // A layout effect in the browser, an effect on the server, checked as either is.
      "react-hooks/exhaustive-deps": [
        "warn",
        { additionalHooks: "^(useIsomorphicLayoutEffect|useLayout)$" },
      ],
    },
  },
  {
    files: ["packages/clover/src/**"],
    rules: {
      // The package renders outside Next.js, where `next/image` is not there to use.
      "@next/next/no-img-element": "off",
      "no-restricted-imports": [
        "error",
        {
          // Preact starts `useId` again in each `<clover-viewer>`; `useUniqueId` doesn't.
          paths: [
            {
              name: "react",
              importNames: ["useId"],
              message:
                "Use useUniqueId (src/ui/useUniqueId.ts): ids stay unique across <clover-viewer>s.",
            },
          ],
          patterns: [
            {
              group: [
                "docs/*",
                "@samvera/clover-iiif",
                "@samvera/clover-iiif/*",
              ],
              message:
                "@nulib/clover uses relative imports only, and never imports the docs or 3.x.",
            },
          ],
        },
      ],
    },
  },
);
