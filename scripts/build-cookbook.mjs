/**
 * Reads the IIIF Cookbook's recipes for the curated Collection the homepage lists them
 * from (`docs/mocks/cookbook/`), writing what it read to `docs/mocks/cookbook/recipes.json`.
 * Run with `npm run build:cookbook` (vite-node, with the docs' path aliases) when the
 * Cookbook changes, then `npm run build:mocks`, which writes the Collection from it, and
 * commit both.
 *
 * Each recipe is listed as `cookbookSections.ts` names and orders it, opening the resource
 * `resourceFor` gives it. Each resource is read here, so one that no longer answers is
 * left out and said, its type kept (a Manifest, or a Collection of them), and its
 * thumbnail found: its own, else its first Canvas's (or a Collection's first member's),
 * else the first image painted on it, by its image service at a size its `info.json`
 * allows. Nothing else is taken from a resource.
 *
 * The Cookbook's index is read too, and the recipes it lists that `cookbookSections.ts`
 * does not (or the other way about) are said, to be added there by hand, and to
 * `progress4.ts` once checked.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

import { cookbookSections } from "docs/components/CookbookRecipes/cookbookSections";
import { resourceFor } from "docs/components/CookbookRecipes/cookbookCatalog";
import { thumbnailFrom } from "docs/lib/iiif-image-sizes";

const INDEX = "https://iiif.io/api/cookbook/";
const OUT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../docs/mocks/cookbook/recipes.json",
);

/** Twice the size the field draws a thumbnail at (2.618rem), so it is sharp on a dense screen. */
const WANTED = 96;

const asArray = (value) =>
  Array.isArray(value) ? value : value == null ? [] : [value];
const idOf = (value) =>
  typeof value === "string" ? value : (value?.id ?? value?.["@id"]);

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

/** An image service's address, as Image API 3 or 2 names it. */
const serviceOf = (resource) => {
  const service = asArray(resource?.service).find((s) =>
    /ImageService|image-api|iiif\.io\/api\/image/.test(
      `${s?.type ?? s?.["@type"] ?? ""} ${s?.profile ?? ""} ${s?.["@context"] ?? ""}`,
    ),
  );
  return idOf(service);
};

/** The whole image at a size its server keeps, where it has a service. */
async function fromService(service) {
  const info = await fetchJson(`${service.replace(/\/$/, "")}/info.json`);
  return thumbnailFrom(service, info, WANTED)?.id;
}

/** A `thumbnail` as given, sized by its service where it has one. */
async function fromThumbnail(thumbnail) {
  const first = asArray(thumbnail)[0];
  if (!first) return undefined;
  const service = serviceOf(first);
  if (service) {
    const sized = await fromService(service).catch(() => undefined);
    if (sized) return sized;
  }
  return idOf(first);
}

/** The first Canvas, as Presentation 3 or 2 holds it. */
const firstCanvas = (manifest) =>
  asArray(manifest.items)[0] ??
  asArray(asArray(manifest.sequences)[0]?.canvases)[0];

/** The first image painted on a Canvas: its body, the first of a Choice, a region's source. */
const paintedImage = (canvas) => {
  const page = asArray(canvas?.items)[0];
  const annotation = asArray(page?.items)[0];
  let body =
    asArray(annotation?.body)[0] ?? asArray(canvas?.images)[0]?.resource;
  if (body?.type === "Choice" || body?.["@type"] === "oa:Choice")
    body = asArray(body.items)[0] ?? body.default;
  if (body?.type === "SpecificResource") body = body.source;
  const type = body?.type ?? body?.["@type"] ?? "";
  return /Image/i.test(type) ? body : undefined;
};

/**
 * A Canvas's thumbnail: its own, else its image's by its service, else its placeholder's
 * or accompanying Canvas's, for a recording or film. An image without a service is not
 * taken: it may be the full image, far larger than a thumbnail needs.
 */
async function canvasThumbnail(canvas) {
  if (!canvas) return undefined;
  if (canvas.thumbnail) return fromThumbnail(canvas.thumbnail);
  const service = serviceOf(paintedImage(canvas));
  if (service) return fromService(service).catch(() => undefined);
  for (const other of [canvas.placeholderCanvas, canvas.accompanyingCanvas]) {
    const found = other && (await canvasThumbnail(other));
    if (found) return found;
  }
  return undefined;
}

async function thumbnailOf(resource, depth = 0) {
  if (resource.thumbnail) return fromThumbnail(resource.thumbnail);
  const type = resource.type ?? resource["@type"] ?? "";
  if (/Collection/.test(type)) {
    if (depth > 1) return undefined;
    const member =
      asArray(resource.items)[0] ??
      asArray(resource.manifests)[0] ??
      asArray(resource.collections)[0];
    if (!member) return undefined;
    if (member.thumbnail) return fromThumbnail(member.thumbnail);
    const read = await fetchJson(idOf(member)).catch(() => undefined);
    return read ? thumbnailOf(read, depth + 1) : undefined;
  }
  return canvasThumbnail(firstCanvas(resource));
}

/** The recipes the Cookbook's index lists, in its order. */
async function indexed() {
  const response = await fetch(INDEX);
  const html = await response.text();
  return [
    ...new Set(
      // Linked with a slash after the name, or without (0010).
      [...html.matchAll(/recipe\/(\d{4}-[^/"#?\s]+)/g)].map(
        (match) => match[1],
      ),
    ),
  ];
}

/** Runs `task` over `items`, a few at a time, keeping their order. */
async function pool(items, size, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
}

const listed = cookbookSections.flatMap((section) =>
  section.recipes.map((recipe) => ({ ...recipe, section: section.title })),
);

const problems = [];

const onIndex = await indexed().catch((error) => {
  problems.push(`The Cookbook's index could not be read: ${error.message}`);
  return [];
});
if (onIndex.length) {
  const known = new Set(listed.map((recipe) => recipe.slug));
  for (const slug of onIndex.filter((slug) => !known.has(slug)))
    problems.push(`On iiif.io, not in cookbookSections.ts: ${slug}`);
  const published = new Set(onIndex);
  for (const { slug } of listed.filter((r) => !published.has(r.slug)))
    problems.push(`In cookbookSections.ts, not on iiif.io's index: ${slug}`);
}

const recipes = (
  await pool(listed, 6, async ({ slug, title, section }) => {
    const resource = resourceFor(slug);
    if (!resource) return undefined;
    const read = await fetchJson(resource).catch((error) => {
      problems.push(`Left out ${slug}: ${error.message}`);
      return undefined;
    });
    if (!read) return undefined;
    const type = /Collection/.test(read.type ?? read["@type"] ?? "")
      ? "Collection"
      : "Manifest";
    const thumbnail = await thumbnailOf(read).catch(() => undefined);
    return {
      slug,
      title,
      section,
      resource,
      type,
      ...(thumbnail && { thumbnail }),
    };
  })
).filter(Boolean);

const checked = new Date().toISOString().slice(0, 10);
const json = await prettier.format(JSON.stringify({ checked, recipes }), {
  parser: "json",
});
writeFileSync(OUT, json);

const pictured = recipes.filter((recipe) => recipe.thumbnail).length;
console.log(
  `Wrote ${recipes.length} recipes (${pictured} with a thumbnail) to ${OUT}`,
);
for (const problem of problems) console.warn(`- ${problem}`);
