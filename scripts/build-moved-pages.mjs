/*
 * After the docs' build (`postbuild:docs`): a page at each address a built page moved
 * from (`docs/lib/moved.mjs`), which sends a visitor on at once, the query and the hash
 * with it, so an old link (iiif.io's recipe pages link to `/docs/viewer/demo?iiif-content=…`)
 * answers with a redirect, not a 404. The site is a static export behind CloudFront, so no
 * server can redirect: an instant meta refresh, which search engines take as a permanent
 * redirect, with the canonical address of where it went, carries the old address's links
 * over (2026-11-22). An instant redirect is also how WCAG would have one made (G110).
 *
 * A moved path whose last segment has a dot (`/docs/3.x`) is left to the 404 page, which
 * sends it on as before: CloudFront serves such a path as a file, never as `.html`.
 *
 *     npm run build:docs   # next build, then the checks, Pagefind, the Markdown, then this
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { movedPages } from "../docs/lib/moved.mjs";

const out = path.resolve("out");
const read = (file) => readFileSync(path.join(out, file), "utf8");

/* The site's address (the sitemap's first entry is the homepage's), and its path on the host. */
const [, home] = read("sitemap.xml").match(/<loc>([^<]+)<\/loc>/) ?? [];
if (!home) throw new Error("build-moved-pages: the sitemap has no pages");
const siteUrl = home.replace(/\/+$/, "");
const basePath = new URL(siteUrl).pathname.replace(/\/+$/, "");

/** Every page the export holds, by its path, with its file: `/docs/items`, `docs/items.html`. */
function* pagesIn(dir = "") {
  for (const entry of readdirSync(path.join(out, dir), {
    withFileTypes: true,
  })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith("_")) yield* pagesIn(file);
    } else if (!file.endsWith(".html") || file === "404.html") continue;
    else if (entry.name === "index.html") yield [dir ? `/${dir}` : "/", file];
    else yield [`/${file.slice(0, -".html".length)}`, file];
  }
}
const files = new Map(pagesIn());

const escape = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** A page's title, as its head gives it. */
const titleOf = (route) => {
  const title = read(files.get(route)).match(/<title>([^<]*)<\/title>/)?.[1];
  return title
    ? title
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
    : "Clover IIIF";
};

let written = 0;
for (const { from, to } of movedPages([...files.keys()])) {
  if (from.slice(from.lastIndexOf("/") + 1).includes(".")) continue;
  const [route, section = ""] = to.split("#");
  const hash = section ? `#${section}` : "";
  const address = `${basePath}${route === "/" ? "/" : route}`;
  const canonical = `${siteUrl}${route === "/" ? "" : route}`;
  const title = titleOf(route);
  const script = `location.replace(${JSON.stringify(address)}+location.search+(location.hash||${JSON.stringify(hash)}))`;
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escape(title)}</title>`,
    `<link rel="canonical" href="${escape(canonical)}">`,
    // Before the refresh, so a browser keeps the query and the hash.
    `<script>${script.replace(/</g, "\\u003c")}</script>`,
    `<meta http-equiv="refresh" content="0; url=${escape(address + hash)}">`,
    "</head>",
    "<body>",
    `<p>This page has moved to <a href="${escape(address + hash)}">${escape(title)}</a>.</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
  const file = path.join(out, `${from.slice(1)}.html`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
  written += 1;
}

console.log(`build-moved-pages: ${written} moved addresses redirect`);
