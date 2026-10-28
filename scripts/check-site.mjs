/** Check what crawlers receive from the static export before it can be deployed. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fromHtml } from "hast-util-from-html";

const out = path.resolve("out");
const read = (file) => readFileSync(path.join(out, file), "utf8");

/** Only the head: a live example can make a page's full HTML quite large. */
function headOf(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert(head, "A built page has no head");
  const tree = fromHtml(head, { fragment: true });
  return tree.children.filter((node) => node.type === "element");
}

const meta = (head, name) =>
  head.find((node) => node.tagName === "meta" && node.properties.name === name)
    ?.properties.content;
const canonical = (head) =>
  head.find(
    (node) =>
      node.tagName === "link" && node.properties.rel?.includes("canonical"),
  )?.properties.href;
const noindex = (head) => /\bnoindex\b/i.test(meta(head, "robots") ?? "");

const home = headOf(read("index.html"));
const siteUrl = canonical(home);
assert(siteUrl, "The homepage must have a canonical URL");
const base = new URL(siteUrl);
assert(
  !base.search && !base.hash,
  "The public URL must not have a query or hash",
);
const urls = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1],
);
const listed = new Set(urls);
assert(
  urls.length > 1,
  "The sitemap must contain the homepage and documentation",
);
assert.equal(listed.size, urls.length, "Sitemap URLs must be unique");
assert(listed.has(siteUrl), "The homepage is missing from the sitemap");

function* htmlFiles(dir = "") {
  for (const entry of readdirSync(path.join(out, dir), {
    withFileTypes: true,
  })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith("_"))
      yield* htmlFiles(file);
    else if (entry.isFile() && file.endsWith(".html")) yield file;
  }
}

const pages = new Map();
for (const file of htmlFiles()) {
  const html = read(file);
  // Standalone public fixtures are not documentation pages.
  if (!html.includes('rel="canonical"')) continue;
  const head = headOf(html);
  const route = file === "index.html" ? "" : `/${file.slice(0, -5)}`;
  const url = `${siteUrl}${route}`;
  if (noindex(head)) {
    assert(!listed.has(url), `${file}: a noindex page is in the sitemap`);
    continue;
  }
  assert.equal(
    canonical(head),
    url,
    `${file}: canonical URL differs from its path`,
  );
  assert(listed.has(url), `${file}: a public page is missing from the sitemap`);
  assert(meta(head, "description"), `${file}: missing description`);
  assert(
    head.some((node) => node.tagName === "title" && node.children.length > 0),
    `${file}: missing title`,
  );
  pages.set(url, file);
}

for (const url of listed) {
  assert(pages.has(url), `Sitemap URL has no indexable HTML page: ${url}`);
  const parsed = new URL(url);
  assert.equal(parsed.origin, base.origin, `Wrong sitemap host: ${url}`);
  assert(
    !parsed.search && !parsed.hash,
    `Query or fragment in sitemap: ${url}`,
  );
}

const robots = read("robots.txt");
assert(
  robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`),
  "Wrong sitemap in robots.txt",
);
assert(
  !/^Disallow:\s*\/\s*$/m.test(robots),
  "robots.txt blocks the entire site",
);
const verification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
if (verification)
  assert.equal(
    meta(home, "google-site-verification"),
    verification,
    "The Search Console verification token is missing from the homepage's head",
  );

console.log(
  `Verified sitemap and search metadata for ${pages.size} public pages.`,
);
