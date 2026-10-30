/*
 * Resources from the world, for the upgrader's parity test (`src/core/presentation.test.ts`):
 * Presentation 2 and 3 as institutions publish them, which this repository does not keep.
 * Fetches Mirador's test fixtures and every member of the Universal Viewer's examples
 * Collection into a folder (Mat, 2026-10-30: "we should be testing against real world
 * presentation 2 resources too"), then says how to run the test over them. Network, by
 * hand:
 *
 *     node build/upgrade-resources.mjs /tmp/iiif
 *     CLOVER_UPGRADE_RESOURCES=/tmp/iiif npx vitest run src/core/presentation.test.ts
 *
 * On 2026-10-30 it kept 151 of 204 addresses (some refuse a script, a few are gone),
 * about 100 of them Presentation 2, and every one upgraded as `upgradeToPresentation4`
 * upgrades it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "upgrade-resources");
const MIRADOR = "https://raw.githubusercontent.com/ProjectMirador/mirador/main";
const MIRADOR_TREE =
  "https://api.github.com/repos/ProjectMirador/mirador/git/trees/main?recursive=1";
const UV_EXAMPLES =
  "https://raw.githubusercontent.com/UniversalViewer/universalviewer/dev/src/iiif-collection.json";

/** JSON at `url`, or null where it does not answer with some. */
async function json(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** The Manifests and Collections a Collection lists, at any depth, by their ids. */
function members(collection) {
  const found = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const id = value["@id"] ?? value.id;
    const type = String(value["@type"] ?? value.type ?? "");
    if (value !== collection && id && /Manifest|Collection/.test(type))
      found.add(id);
    for (const key of ["manifests", "collections", "members", "items"])
      walk(value[key]);
  };
  walk(collection);
  return [...found];
}

const tree = await json(MIRADOR_TREE);
const fixtures = (tree?.tree ?? [])
  .map((entry) => entry.path)
  .filter((path) => /^__tests__\/fixtures\/version-[23]\/.*\.json$/.test(path));
const examples = members(await json(UV_EXAMPLES));
const wanted = [
  ...fixtures.map((path) => [
    `mirador-${path.split("/").slice(-2).join("-")}`,
    `${MIRADOR}/${path}`,
  ]),
  ...examples.map((url, index) => [`uv-${index + 1}.json`, url]),
];

mkdirSync(out, { recursive: true });
let kept = 0;
for (const [name, url] of wanted) {
  const resource = await json(url);
  if (!resource) continue;
  writeFileSync(join(out, name), JSON.stringify(resource));
  kept++;
}
console.log(`Kept ${kept} of ${wanted.length} in ${out}. Then:`);
console.log(
  `CLOVER_UPGRADE_RESOURCES=${out} npx vitest run src/core/presentation.test.ts`,
);
