/*
 * `@nulib/clover/web-components/viewer` without the files the main element build already
 * has (Mat, 2026-10-27, `DRY.md`: "The viewer entry repeats … the main folder's files").
 *
 * The two element builds are apart, so the lazy code both use (MapLibre and its worker,
 * hls.js, DOMPurify, the upgrader, the languages, a few small modules) was written into
 * each. Every name carries a hash of what it holds, so a file of `viewer/` with the same
 * name and bytes as one beside it is the same file: it goes, and what refers to it in
 * `viewer/` (its imports, a `new URL(…, import.meta.url)`) and in the build's chunk map
 * points at `../` instead. The package is a quarter lighter; a page loads what it did,
 * from the folder above for those files, so `viewer/` works as part of `web-components/`,
 * not copied alone. Run after the Viewer's build, before its loader is copied in.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const main = join(root, "dist/web-components");
const viewer = join(main, "viewer");

/** The Viewer's own entry files, which a page names: never taken from the folder above. */
const OWN = new Set(["index.mjs", "index.umd.js", "index.d.mts"]);

/** Every file under `dir`, by its path from it, but the build's own map. */
function files(dir, from = dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === ".vite") return [];
    return statSync(path).isDirectory()
      ? files(path, from)
      : [relative(from, path)];
  });
}

const same = files(viewer).filter((file) => {
  if (OWN.has(file)) return false;
  const there = join(main, file);
  return (
    existsSync(there) &&
    readFileSync(there).equals(readFileSync(join(viewer, file)))
  );
});
for (const file of same) rmSync(join(viewer, file));
// A folder emptied so (`assets/`, MapLibre's worker gone) goes too.
for (const folder of new Set(same.map(dirname)))
  if (folder !== "." && readdirSync(join(viewer, folder)).length === 0)
    rmSync(join(viewer, folder), { recursive: true });

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A quoted reference to `file` from the folder's root: `"./x.mjs"` or `"assets/x.js"`. */
const quoted = (file) => new RegExp(`(["'\`])(?:\\./)?${escape(file)}\\1`, "g");

const kept = files(viewer).filter((file) => /\.(m?js)$/.test(file));
for (const file of kept) {
  const path = join(viewer, file);
  let text = readFileSync(path, "utf8");
  for (const gone of same)
    text = text.replace(quoted(gone), (_, q) => `${q}../${gone}${q}`);
  writeFileSync(path, text);
}

// The chunk map the size measures read (`element-size.mjs`): the files above, where they are.
const mapPath = join(viewer, ".vite/manifest.json");
const map = JSON.parse(readFileSync(mapPath, "utf8"));
for (const chunk of Object.values(map))
  if (same.includes(chunk.file)) chunk.file = `../${chunk.file}`;
writeFileSync(mapPath, JSON.stringify(map, null, 2) + "\n");

// Nothing may still name a file that went, as if it were beside it.
for (const file of kept) {
  const text = readFileSync(join(viewer, file), "utf8");
  for (const gone of same)
    if (quoted(gone).test(text))
      throw new Error(`viewer/${file} still refers to ${gone} beside it`);
}

const saved = same.length;
console.log(
  `web-components/viewer: ${saved} file${saved === 1 ? "" : "s"} taken from the folder above`,
);
