/*
 * @nulib/clover as a consumer meets it: through the package name, from the built `dist/`.
 * Run `npm run build -w @nulib/clover` first.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

import { bundleAsConsumer } from "./consumer-bundle.mjs";
import { ENTRIES, PART_ENTRIES } from "./entries.mjs";
import { exportedNames } from "./entry-types.mjs";

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
      (id) =>
        chunks.get(fileName).modules[resolve(root, id)].renderedLength > 0,
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
  assert.deepEqual(JSON.parse(stdout.trim()), {
    viewer: "function",
    same: true,
  });
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

/** A module hook that refuses React: whatever imports it, at once or later, fails. */
const NO_REACT = `data:text/javascript,${encodeURIComponent(
  `export async function resolve(specifier, context, next) {
     if (/^react(-dom)?(\\/|$)/.test(specifier))
       throw new Error("imported " + specifier);
     return next(specifier, context);
   }`,
)}`;

test("the helpers entry imports in plain node, React nowhere", () => {
  const { values } = exportedNames(resolve(root, ENTRIES["helpers/index"]));
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { register } from "node:module";
       register(${JSON.stringify(NO_REACT)});
       const helpers = await import("@nulib/clover/helpers");
       console.log(JSON.stringify(Object.keys(helpers).sort()));`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout.trim()), [...values].sort());
});

/*
 * One module graph: what an entry of its own exports is `@nulib/clover`'s, by the same
 * name, so a page that imports from both has one copy of each, and one React context.
 */
test("every part's entry, and the helpers', exports what @nulib/clover does", () => {
  const entries = [...PART_ENTRIES, "helpers/index"].map((entry) => ({
    subpath: `@nulib/clover/${entry.replace(/\/index$/, "")}`,
    names: exportedNames(resolve(root, ENTRIES[entry])).values,
  }));
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const index = await import("@nulib/clover");
       const entries = ${JSON.stringify(entries)};
       const apart = [];
       for (const { subpath, names } of entries) {
         const entry = await import(subpath);
         for (const name of names)
           if (entry[name] === undefined || entry[name] !== index[name])
             apart.push(subpath + " " + name);
       }
       console.log(JSON.stringify(apart));`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout.trim()), []);
});

/*
 * esbuild's code splitting counts a module as reached by its re-export alone, so through
 * `@nulib/clover` it loads up front every part a lazy chunk shares, the Default template's
 * whole set among them (`AGENTS.md`, "Build and test"). A part's own entry reaches that
 * part alone: a page importing one loads no template and none of the Panel.
 */
test("an esbuild app with code splitting loads a part's own entry without the others", async () => {
  const dir = mkdtempSync(join(tmpdir(), "clover-esbuild-"));
  try {
    const cases = {
      items: `import { Items } from "@nulib/clover/items"; console.log(Items);`,
      canvas: `import { Canvas } from "@nulib/clover/canvas"; console.log(Canvas);`,
      primitives: `import { Label, Metadata } from "@nulib/clover/primitives"; console.log(Label, Metadata);`,
      viewer: `import Viewer from "@nulib/clover/viewer"; console.log(Viewer);`,
      helpers: `import { toPresentation4 } from "@nulib/clover/helpers"; console.log(toPresentation4);`,
    };
    for (const [name, contents] of Object.entries(cases)) {
      const entry = join(dir, `${name}.mjs`);
      writeFileSync(entry, contents);
      const { metafile } = await esbuild({
        entryPoints: [entry],
        absWorkingDir: root,
        nodePaths: [resolve(root, "../../node_modules")],
        bundle: true,
        splitting: true,
        format: "esm",
        outdir: join(dir, `out-${name}`),
        metafile: true,
        write: false,
        external: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
        ],
        logLevel: "silent",
      });
      const outputs = metafile.outputs;
      const start = Object.keys(outputs).find((file) =>
        outputs[file].entryPoint?.endsWith(`${name}.mjs`),
      );
      const upFront = new Set();
      const visit = (file) => {
        if (upFront.has(file) || !outputs[file]) return;
        upFront.add(file);
        for (const { path, kind, external } of outputs[file].imports)
          if (!external && kind !== "dynamic-import") visit(path);
      };
      visit(start);
      const modules = [...upFront].flatMap((file) =>
        Object.entries(outputs[file].inputs)
          .filter(([, { bytesInOutput }]) => bytesInOutput > 0)
          .map(([id]) => id),
      );
      const strays = modules.filter((id) =>
        /dist\/(templates|components\/(Panel|Search|Annotations))\//.test(id),
      );
      assert.deepEqual(strays, [], `${name} loads others up front`);
      if (name === "helpers")
        assert.deepEqual(
          modules.filter((id) => /dist\/(components|ui|react)\//.test(id)),
          [],
          "the helpers load no part",
        );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
