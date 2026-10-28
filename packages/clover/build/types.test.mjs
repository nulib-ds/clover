/*
 * The published declarations, as a project with `skipLibCheck: false` reads them: every
 * entry's bundled `.d.mts` must compile. dts-bundle-generator neither renames clashing
 * names (an import and a part both called `Canvas`) nor keeps a re-exported external
 * type's import, and nothing else would notice: a project that skips library checks
 * silently reads such a type as `any`. Run `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "package.json"));
const ENTRIES = ["index", "templates/index", "map/index", "three/index"].map(
  (entry) => resolve(root, `dist/${entry}.d.mts`),
);

test("every entry's declarations compile with skipLibCheck off", () => {
  for (const file of ENTRIES) assert.ok(existsSync(file), `${file} is missing`);
  const dir = mkdtempSync(join(tmpdir(), "clover-types-"));
  try {
    const config = join(dir, "tsconfig.json");
    writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          types: [],
        },
        files: ENTRIES,
      }),
    );
    const tsc = require.resolve("typescript/bin/tsc");
    const run = spawnSync(process.execPath, [tsc, "-p", config], {
      cwd: root,
      encoding: "utf8",
    });
    // Only Clover's own: a dependency's declarations (Node's, which `@iiif/presentation-3`
    // references) may disagree with this TypeScript, and are not ours to fix here.
    const ours = run.stdout
      .split("\n")
      .filter((line) => line.includes("/dist/") || line.startsWith("dist/"));
    assert.deepEqual(ours, [], ours.join("\n"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
