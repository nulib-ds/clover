/*
 * After the docs' build (`postbuild:docs`), for agents: every published page as Markdown
 * beside its HTML (`/docs/items` → `/docs/items.md`, linked from the page's head), and
 * `llms-full.txt`, all of Clover 4's pages in one file, in `llms.txt`'s order. Converted
 * from the pages as built, so each says what its page says, its examples' code and its
 * tables included. The pages are the sitemap's (`docs/lib/agents.ts`: unlisted pages and
 * the test mocks are out of it); the homepage's Markdown is `llms.txt` itself. A page
 * `llms.txt` links to that has no Markdown fails the build.
 *
 *     npm run build:docs   # next build, then Pagefind, then this
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fromHtml } from "hast-util-from-html";
import { toMdast } from "hast-util-to-mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

const out = path.resolve("out");
const read = (file) => readFileSync(path.join(out, file), "utf8");

/* The site's address (the sitemap's first entry is the homepage's), and its path on the host. */
const sitemap = read("sitemap.xml");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const siteUrl = urls[0].replace(/\/+$/, "");
const basePath = new URL(siteUrl).pathname.replace(/\/+$/, "");
const routeOf = (url) => url.slice(siteUrl.length) || "/";

/** Every element under `node`, depth first, with its parent. */
function* elements(node, parent = null) {
  if (node.type === "element") yield [node, parent];
  for (const child of node.children ?? []) yield* elements(child, node);
}

const classes = (node) => node.properties?.className ?? [];
const find = (tree, test) => {
  for (const [node] of elements(tree)) if (test(node)) return node;
};

/*
 * What a page shows for a reader, not its chrome: the controls (buttons, the tabs' list,
 * whose panels each keep a heading of their tab's name, every panel kept though only one
 * shows), heading anchors, icons, scripts and what is hidden.
 */
const isChrome = (node) =>
  ["script", "style", "svg", "button", "noscript", "template"].includes(
    node.tagName,
  ) ||
  node.properties?.role === "tablist" ||
  (node.properties?.hidden !== undefined &&
    node.properties?.role !== "tabpanel") ||
  node.properties?.ariaHidden === "true" ||
  classes(node).includes("subheading-anchor");

/* Each of an example's flavors, named over its code: "React", "Web components". */
const FLAVORS = { react: "React", "web-components": "Web components" };
const labelOf = (flavor) => ({
  type: "element",
  tagName: "p",
  properties: {},
  children: [
    {
      type: "element",
      tagName: "strong",
      properties: {},
      children: [{ type: "text", value: FLAVORS[flavor] }],
    },
  ],
});

function clean(node) {
  if (!node.children) return;
  const flavor = node.properties?.dataCodeFlavor;
  // A name in prose (`code-flavors.mjs`): React's as written, then web components' after it.
  if (node.tagName === "span" && FLAVORS[flavor]) {
    if (flavor === "web-components")
      node.children = [
        { type: "text", value: " (web components: " },
        ...node.children,
        { type: "text", value: ")" },
      ];
  } else if (FLAVORS[flavor]) node.children.unshift(labelOf(flavor));
  // React's markers (`<!--$-->`) and other comments are not the page's words.
  node.children = node.children.filter(
    (child) =>
      child.type !== "comment" &&
      (child.type !== "element" || !isChrome(child)),
  );
  // A callout is a quotation, without its icon.
  if (classes(node).includes("nextra-callout")) {
    node.tagName = "blockquote";
    node.children = node.children.filter(
      (child) =>
        child.type !== "element" || !child.properties?.dataPagefindIgnore,
    );
  }
  node.children.forEach(clean);
}

/* Addresses as an agent can follow them: absolute, on the site, under its path. */
const underBase = (value) =>
  Boolean(basePath) &&
  value.startsWith(basePath) &&
  (value.length === basePath.length || "/?#".includes(value[basePath.length]));
function absolute(main, pageUrl) {
  const { origin } = new URL(siteUrl);
  for (const [node] of elements(main)) {
    for (const key of ["href", "src"]) {
      const value = node.properties?.[key];
      if (typeof value !== "string") continue;
      if (value.startsWith("#")) node.properties[key] = `${pageUrl}${value}`;
      else if (value.startsWith("/") && !value.startsWith("//"))
        node.properties[key] =
          `${origin}${underBase(value) ? "" : basePath}${value}`;
    }
  }
}

const meta = (html, pattern) => html.match(pattern)?.[1];
const unescape = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** A page as Markdown: its front matter (title, description, address, version), then its content. */
function markdownOf(html, url) {
  const tree = fromHtml(html);
  const main = find(
    tree,
    (node) => node.tagName === "main" && node.properties?.dataPagefindBody,
  );
  if (!main) return null;
  clean(main);
  absolute(main, url);
  const body = toMarkdown(toMdast(main), {
    bullet: "-",
    extensions: [gfmToMarkdown()],
    fences: true,
    rule: "-",
  }).trim();
  const route = routeOf(url);
  const earlier = route === "/docs/3.x" || route.startsWith("/docs/3.x/");
  const title = unescape(
    meta(html, /<meta property="og:title" content="([^"]*)"/) ?? "",
  ).replace(/ – Clover IIIF$/, "");
  const description = unescape(
    meta(html, /<meta name="description" content="([^"]*)"/) ?? "",
  );
  const front = [
    "---",
    `title: ${JSON.stringify(title)}`,
    description && `description: ${JSON.stringify(description)}`,
    `url: ${url}`,
    `version: ${earlier ? '"3.x, the earlier version, superseded by Clover 4"' : '"4"'}`,
    "---",
  ].filter(Boolean);
  return { front: front.join("\n"), body, title };
}

/* Every published page but the homepage, as Markdown beside its HTML. */
const written = new Map();
for (const url of urls) {
  const route = routeOf(url);
  if (route === "/") continue;
  const file = [`${route.slice(1)}.html`, `${route.slice(1)}/index.html`].find(
    (name) => existsSync(path.join(out, name)),
  );
  if (!file) throw new Error(`build-agent-docs: no HTML for ${url}`);
  const page = markdownOf(read(file), url);
  if (!page) throw new Error(`build-agent-docs: no content in ${file}`);
  writeFileSync(
    path.join(out, `${route.slice(1)}.md`),
    `${page.front}\n\n${page.body}\n`,
  );
  written.set(`${url}.md`, { url, ...page });
}

/*
 * `llms-full.txt`: `llms.txt`'s head (what Clover is), then each of Clover 4's pages it
 * lists, before its "Optional" section, in its order, each with its address under its title.
 */
const llms = read("llms.txt");
const [main] = llms.split(/^## Optional$/m);
const linked = [...llms.matchAll(/\]\((https?:\/\/[^)\s]+\.md)\)/g)].map(
  (m) => m[1],
);
const missing = linked.filter((link) => !written.has(link));
if (missing.length)
  throw new Error(
    `build-agent-docs: llms.txt links to pages with no Markdown: ${missing.join(", ")}`,
  );
const head = llms.split(/^## /m)[0].trim();
const pages = [...main.matchAll(/\]\((https?:\/\/[^)\s]+\.md)\)/g)].map((m) =>
  written.get(m[1]),
);
const full = [
  head,
  ...pages.map(({ url, body, title }) => {
    const withTitle = body.startsWith("# ") ? body : `# ${title}\n\n${body}`;
    const [first, ...rest] = withTitle.split("\n");
    return [first, "", `Source: ${url}`, ...rest].join("\n");
  }),
].join("\n\n---\n\n");
writeFileSync(path.join(out, "llms-full.txt"), `${full}\n`);

console.log(
  `build-agent-docs: ${written.size} pages as Markdown, ${pages.length} in llms-full.txt`,
);
