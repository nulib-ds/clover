/*
 * @nulib/clover as a consumer meets it: through the package name, from the built `dist/`.
 * Run `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

import { bundleAsConsumer } from "./consumer-bundle.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test.before(() => {
  assert.ok(
    existsSync(resolve(root, "dist/index.mjs")),
    "dist/ is missing: run `npm run build -w @nulib/clover` first",
  );
});

test("a namespace import that uses only groupViews pulls in no renderer", async () => {
  const result = await esbuild({
    stdin: {
      contents: `import * as Clover from "@nulib/clover";\nconsole.log(Clover.groupViews([], "individuals"));`,
      resolveDir: root,
      sourcefile: "entry.mjs",
    },
    bundle: true,
    format: "esm",
    write: false,
    metafile: true,
    external: ["react", "react-dom", "react/jsx-runtime"],
    logLevel: "silent",
  });
  // `metafile.inputs` lists every module parsed; what survives tree shaking is what
  // contributes bytes to the output.
  const [output] = Object.values(result.metafile.outputs);
  const inputs = Object.entries(output.inputs)
    .filter(([, { bytesInOutput }]) => bytesInOutput > 0)
    .map(([id]) => id);
  const leaked = inputs.filter((id) =>
    /dist\/(components|lib\/renderer|ui)\//.test(id),
  );
  assert.deepEqual(leaked, [], "only the sequence module should be bundled");
  assert.ok(inputs.some((id) => id.endsWith("dist/core/sequence.mjs")));
});

test("the Viewer is a shell: no template and no part load with it", async () => {
  const entry = JSON.stringify(resolve(root, "dist/index.mjs"));
  const { chunks, initial } = await bundleAsConsumer(
    `import Viewer from ${entry};\nconsole.log(Viewer);`,
  );
  const fromPackage = (chunk) =>
    Object.keys(chunk.modules)
      .filter((id) => id.startsWith(resolve(root, "dist") + "/"))
      .map((id) => id.slice(root.length + 1));
  const upFront = [...initial].flatMap((fileName) =>
    fromPackage(chunks.get(fileName)).filter(
      (id) => chunks.get(fileName).modules[resolve(root, id)].renderedLength > 0,
    ),
  );
  assert.deepEqual(
    upFront,
    ["dist/components/Viewer/Viewer.mjs"],
    "only the shell loads up front",
  );
  // Default is still there for `<Viewer />`, in a chunk of its own.
  assert.ok(
    [...chunks.values()].some((chunk) =>
      fromPackage(chunk).includes("dist/templates/default/Default.mjs"),
    ),
  );
});

test("the Viewer is the default export, and Clover.Viewer too", () => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const Clover = await import("@nulib/clover");
       console.log(JSON.stringify({
         viewer: typeof Clover.default,
         same: Clover.default === Clover.Viewer,
       }));`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout.trim()), { viewer: "function", same: true });
});

test("the templates entry imports in plain node", () => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const Templates = await import("@nulib/clover/templates");
       console.log(JSON.stringify({
         Default: typeof Templates.Default,
         Gallery: typeof Templates.Gallery,
       }));`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout.trim()), {
    Default: "function",
    Gallery: "function",
  });
});

// The bundle test proves MapLibre is never imported statically; this proves the entry runs.
test("the map entry imports in plain node", () => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const Map = await import("@nulib/clover/map");
       console.log(JSON.stringify({
         Map: typeof Map.Map,
         navPlaceOf: typeof Map.navPlaceOf,
       }));`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout.trim()), {
    Map: "object",
    navPlaceOf: "function",
  });
});

test("plain node can import the package", () => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const Clover = await import("@nulib/clover");
       console.log(JSON.stringify({
         Canvas: typeof Clover.Canvas,
         groupViews: typeof Clover.groupViews,
         initCloverI18n: typeof Clover.initCloverI18n,
       }));`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout.trim()), {
    Canvas: "function",
    groupViews: "function",
    initCloverI18n: "function",
  });
});
