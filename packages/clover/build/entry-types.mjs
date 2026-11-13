/*
 * The declarations of the entries that only re-export `index`'s parts (`PART_ENTRIES`):
 * each name the entry's source exports, re-exported from `index`'s declarations, which
 * `dts-bundle-generator` has written. So `ItemsProps` from `@nulib/clover/items` is the
 * same type as from `@nulib/clover`, and the build bundles no declarations twice.
 * `build/types.test.mjs` compiles them; `build/consumer.test.mjs` holds their values to
 * `index`'s.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ENTRIES, PART_ENTRIES } from "./entries.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(import.meta.url)("typescript");

/**
 * The names a module exports, values and types apart, as its export declarations give them.
 * An entry names each (`export { … } from`): any other export (`export *`, `export const`,
 * `export default`) fails here, rather than go missing from its declarations and tests.
 */
export function exportedNames(file) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
  );
  const values = [];
  const types = [];
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      for (const element of statement.exportClause.elements) {
        (statement.isTypeOnly || element.isTypeOnly ? types : values).push(
          element.name.text,
        );
      }
    } else if (
      ts.isExportDeclaration(statement) ||
      ts.isExportAssignment(statement) ||
      (ts.canHaveModifiers(statement) &&
        ts
          .getModifiers(statement)
          ?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword))
    ) {
      throw new Error(
        `${file}: name each export, \`export { … } from\` (build/entry-types.mjs)`,
      );
    }
  }
  return { values, types };
}

for (const entry of PART_ENTRIES) {
  const { values, types } = exportedNames(resolve(root, ENTRIES[entry]));
  const out = resolve(root, `dist/${entry}.d.mts`);
  const index = relative(dirname(out), resolve(root, "dist/index.mjs"));
  const from = JSON.stringify(index.startsWith(".") ? index : `./${index}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    [
      `export { ${values.join(", ")} } from ${from};`,
      ...(types.length
        ? [`export type { ${types.join(", ")} } from ${from};`]
        : []),
      "",
    ].join("\n"),
  );
}
