/*
 * What search engines need to know of the copies agents read (2026-11-22). The docs
 * publish each page as Markdown beside its HTML (`/docs/items.md`,
 * `scripts/build-agent-docs.mjs`), and the docs whole as text (`/llms.txt`,
 * `/llms-full.txt`), so an agent can read them without the page's markup. A search
 * engine could index them too, as duplicates of the pages. So, as CloudFront answers:
 *
 * - a page's Markdown names its HTML page as canonical (a `Link` header, which is how a
 *   search engine is told the canonical of a file that is not HTML), so what links to
 *   it counts for the page, and search results show the page;
 * - `llms.txt` and `llms-full.txt`, which no HTML page mirrors, are `noindex`.
 *
 * Agents read both as before: neither header keeps a reader out. Only a page served
 * whole (200) gets one. `SITE`, the site's address, is put before this code by
 * Terraform (`main.tf`), from the same host the distribution serves.
 */
function handler(event) {
  var response = event.response;
  if (response.statusCode !== 200) return response;
  var uri = event.request.uri;

  if (uri === "/llms.txt" || uri === "/llms-full.txt") {
    response.headers["x-robots-tag"] = { value: "noindex" };
  } else if (uri.endsWith(".md")) {
    response.headers["link"] = {
      value: "<" + SITE + uri.slice(0, -3) + '>; rel="canonical"',
    };
  }
  return response;
}
