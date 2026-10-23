/*
 * A Clover 4 docs page's MDX with each React example's "Web components" twin beside it
 * (`code-flavors.mjs`), before Nextra compiles it. A loader, named by its path in
 * `next.config.mjs`, so Turbopack runs it as webpack does: neither takes a plugin function
 * through Nextra's options. The earlier version's pages, under `content/docs/3.x/`, are
 * left as written.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS loader, as webpack and Turbopack load one */
const path = require("node:path");
const { pathToFileURL } = require("node:url");
/* eslint-enable @typescript-eslint/no-require-imports */

const helpers = pathToFileURL(path.join(__dirname, "code-flavors.mjs")).href;

/*
 * What the twins are made with: a page compiles again when one changes. Node keeps the
 * modules it first loaded, so a change to them shows once `npm run dev` restarts.
 */
const HELPERS = [
  "code-flavors.mjs",
  "jsx-to-html.mjs",
  "example-urls.mjs",
  "inline-names.mjs",
];

module.exports = function codeFlavorsLoader(source) {
  const callback = this.async();
  const file = (this.resourcePath ?? "").split(path.sep).join("/");
  if (!file.includes("/content/docs/") || file.includes("/content/docs/3.x/"))
    return callback(null, source);
  for (const helper of HELPERS)
    this.addDependency(path.join(__dirname, helper));
  import(helpers)
    .then(({ withCodeFlavors }) => withCodeFlavors(String(source)))
    .then((text) => callback(null, text), callback);
};
