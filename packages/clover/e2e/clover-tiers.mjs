import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * `virtual:clover-tiers`: base.css's and spacing.css's rules (`build/tiers.mjs`), derived
 * from the source, for the harness's and the elements' page's `css=base` and
 * `css=spacing`: again as any sheet changes, and by the builder as it is then (imported
 * afresh, as Node keeps a module it has loaded).
 */
export const cloverTiers = () => ({
  name: "clover-tiers",
  resolveId: (id) =>
    id === "virtual:clover-tiers" ? "\0virtual:clover-tiers" : null,
  async load(id) {
    if (id !== "\0virtual:clover-tiers") return null;
    const builder = resolve(here, "../build/tiers.mjs");
    const { SHEETS } = await import("../build/clover-sheets.mjs");
    for (const { file } of SHEETS) this.addWatchFile(file);
    this.addWatchFile(builder);
    const { tierSheets } = await import(
      `${pathToFileURL(builder).href}?at=${statSync(builder).mtimeMs}`
    );
    return `export default ${JSON.stringify(await tierSheets())};`;
  },
});
