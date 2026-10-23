import { readdirSync } from "node:fs";
import path from "node:path";
import type { PageMapItem } from "nextra";
import { getPageMap } from "nextra/page-map";
import { lastChanged } from "docs/lib/last-changed";

import docsMenu from "content/docs/_meta";
import primitivesMenu from "content/docs/primitives/_meta";
import viewerMenu from "content/docs/viewer/_meta";
import {
  componentCount,
  cookbook,
  loads,
  partCount,
  primitiveCount,
} from "docs/lib/figures";
import {
  aboutClover,
  homeHeadline,
  homeTagline,
  homeStructuredData,
  isEarlierVersion,
  markdownUrl,
  siteTitle,
  siteUrl,
} from "docs/lib/site";
import cloverPackage from "../../packages/clover/package.json";

/*
 * What the site tells agents and crawlers, built with the site from what it already holds,
 * so it never drifts from the pages (Mat, 2026-10-21): the docs' own menu (`_meta.ts`),
 * each page's title and description (its front matter, as Nextra reads it), and the
 * figures the homepage states (`figures.ts`). Read on the server only (the file system,
 * Nextra's page map): `llms.txt` (`app/llms.txt/route.ts`), the sitemap
 * (`app/sitemap.ts`), the homepage's structured data and its list of the parts
 * (`PartsIndex.tsx`). The site is a static export (GitHub Pages), so each is a file, and
 * `scripts/build-agent-docs.mjs` adds every page's Markdown and `llms-full.txt` after the
 * build.
 */

export interface DocsPage {
  title: string;
  route: string;
  description?: string;
}

export interface DocsSection {
  /** Its key: the menu's separator without its dashes (`components`), or `primitives`. */
  key: string;
  title: string;
  pages: DocsPage[];
}

type Entry = string | { title?: string; display?: string };

const titleOf = (entry: Entry) =>
  typeof entry === "string" ? entry : (entry.title ?? "");
const isHidden = (entry: Entry) =>
  typeof entry === "object" && entry.display === "hidden";

/** Every page's front matter, by route, as Nextra read it. */
async function frontMatters() {
  const byRoute = new Map<string, Record<string, unknown>>();
  const walk = (items: PageMapItem[]) => {
    for (const item of items) {
      if ("data" in item) continue;
      // A folder with an index page has its front matter too (`asIndexPage`).
      if ("frontMatter" in item && item.frontMatter)
        byRoute.set(item.route, item.frontMatter);
      if ("children" in item) walk(item.children);
    }
  };
  walk(await getPageMap());
  return byRoute;
}

/* The folders whose pages the menu lists after their own. */
const FOLDERS: Record<string, Record<string, Entry>> = {
  viewer: viewerMenu as Record<string, Entry>,
  primitives: primitivesMenu as Record<string, Entry>,
};

/**
 * The docs as their menu lists them (`content/docs/_meta.ts`): a section for each of its
 * separators, each page by its menu title with its own description, hidden pages left
 * out. A folder's pages follow its own (the Viewer's Default template), the Primitives
 * a section of their own; Clover 3.x, the earlier version, apart (`earlier`).
 */
export async function docsIndex(): Promise<{
  sections: DocsSection[];
  earlier?: DocsPage;
}> {
  const front = await frontMatters();
  const page = (route: string, entry: Entry): DocsPage => {
    const description = front.get(route)?.description;
    return {
      title: titleOf(entry),
      route,
      ...(typeof description === "string" && { description }),
    };
  };
  const folder = (key: string, route: string) =>
    Object.entries(FOLDERS[key] ?? {})
      .filter(([, entry]) => !isHidden(entry))
      .map(([name, entry]) => page(`${route}/${name}`, entry));

  const sections: DocsSection[] = [];
  let section: DocsSection | undefined;
  let earlier: DocsPage | undefined;
  for (const [key, entry] of Object.entries(docsMenu) as [string, Entry][]) {
    if (key.startsWith("--")) {
      section = { key: key.slice(2), title: titleOf(entry), pages: [] };
      sections.push(section);
      continue;
    }
    if (!section || isHidden(entry)) continue;
    const route = key === "index" ? "/docs" : `/docs/${key}`;
    if (isEarlierVersion(route)) earlier = page(route, entry);
    else if (key === "primitives")
      sections.push({
        key,
        title: titleOf(entry),
        pages: [page(route, entry), ...folder(key, route)],
      });
    else section.pages.push(page(route, entry), ...folder(key, route));
  }
  return {
    sections: sections.filter((item) => item.pages.length > 0),
    earlier,
  };
}

/**
 * Every page the site publishes, with when it last changed (its file's last commit,
 * `last-changed.ts`), for the sitemap: Clover 4's and 3.x's alike. Unlisted pages
 * (`searchable: false`) and the test mocks (`/test/`) are left out, as they are out of
 * search.
 */
export async function publishedPages() {
  const pages = new Map<string, string | undefined>();
  for (const [route, matter] of await frontMatters()) {
    if (route === "/test" || route.startsWith("/test/")) continue;
    if (matter.searchable === false) continue;
    const { filePath } = matter;
    pages.set(
      route,
      lastChanged(typeof filePath === "string" ? filePath : undefined),
    );
  }
  return [...pages].map(([route, modified]) => ({ route, modified }));
}

/**
 * The homepage's structured data (`homeStructuredData`), Clover's features its Viewer,
 * its components and its primitives, each in its page's words.
 */
export async function homeData() {
  const { sections } = await docsIndex();
  const pages = (key: string) =>
    sections.find((section) => section.key === key)?.pages ?? [];
  const features = [
    ...pages("viewer").filter((page) => page.route === "/docs/viewer"),
    ...pages("components"),
    ...pages("primitives").slice(0, 1),
  ]
    .filter((page) => page.description)
    .map((page) => `${page.title}: ${page.description}`);
  return homeStructuredData({
    features,
    react: cloverPackage.peerDependencies.react,
  });
}

/** The languages Clover ships, by tag, from its locales (`src/i18n/locales/`). */
export const shippedLanguages = () =>
  readdirSync(path.join(process.cwd(), "packages/clover/src/i18n/locales"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();

/** A list of things, as a sentence says them: "a, b and c". */
const listed = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
    : items.join("");

/**
 * Clover at a glance, for agents: what each of the homepage's stories says, with its
 * figures, and how to start.
 */
export const glance = () => {
  const name = cloverPackage.name;
  return [
    `Two ways to use it: the Viewer, \`import Viewer from "${name}"\`, with its Default, Document or Gallery template (\`${name}/templates\`); or the parts it is built from, \`import * as Clover from "${name}"\`, placed inside a \`Clover.Root\` in markup of your own.`,
    `${partCount} parts to compose with: ${componentCount} components, and ${primitiveCount} primitives, one for each IIIF descriptive property.`,
    `Accessible: every part is held to WCAG 2.2 AA, built on WAI-ARIA's patterns.`,
    `Seamless: no font and no base size of its own, so it takes the page's; its colors are CSS custom properties (\`--clover-color-*\`).`,
    `Quick to load: a page loads its template and the parts it uses, nothing more. A Canvas (images, video and sound) is ${loads.canvas} kB gzipped, and the Viewer with its Default template ${loads.defaultTemplate} kB; maps, video streaming and the sanitizer load the first time they are needed.`,
    `Checked against every recipe in the IIIF Cookbook: ${cookbook.handled} of ${cookbook.recipes} handled, and ${cookbook.inPart} more in part (last checked ${cookbook.checked}).`,
    `Its interface speaks ${listed(shippedLanguages())}, choosing the page's language first.`,
    `For a page without React, the Viewer and the parts are web components too, from \`${name}/web-components\`: \`<clover-viewer>\`, or \`<clover-root>\` with its parts (\`<clover-label>\`, \`<clover-body>\`…) in markup of your own. A page with a Viewer alone can load it whole, from \`${name}/web-components/viewer\` (${loads.viewerEntry} kB, rather than ${loads.element} kB). Their attributes, properties and events are in the Custom Elements Manifest, ${siteUrl}/custom-elements.json.`,
    `MIT licensed, a project of Northwestern University Libraries. Source: https://github.com/nulib-ds/clover (the package is \`packages/clover\`).`,
  ];
};

/**
 * `llms.txt` (llmstxt.org): what Clover is, at a glance, then the docs as their menu
 * lists them, each linked to its Markdown, and 3.x and the whole docs in one file under
 * "Optional", which an agent short of room may skip.
 */
export async function llmsTxt() {
  const { sections, earlier } = await docsIndex();
  const name = cloverPackage.name;
  const item = (page: DocsPage) =>
    `- [${page.title}](${markdownUrl(page.route)})${page.description ? `: ${page.description}` : ""}`;
  return [
    `# ${siteTitle}`,
    "",
    `> ${aboutClover}`,
    "",
    `${homeHeadline} ${homeTagline}`,
    "",
    `These docs are for Clover 4, \`${name}\`: \`npm install ${name}\`. Clover 3.x, \`@samvera/clover-iiif\`, is the earlier version, and its docs under ${siteUrl}/docs/3.x are kept for reference only: do not take its API or behavior as Clover 4's. Every page below is Markdown at its address with \`.md\` added, its examples in both of the docs' flavors, React and web components, each labeled; all of Clover 4's pages are in one file, ${siteUrl}/llms-full.txt.`,
    "",
    "## At a glance",
    "",
    ...glance().map((fact) => `- ${fact}`),
    ...sections.flatMap((section) => [
      "",
      `## ${section.title}`,
      "",
      ...section.pages.map(item),
    ]),
    "",
    "## Optional",
    "",
    ...(earlier
      ? [
          `- [${earlier.title}](${markdownUrl(earlier.route)}): the docs of \`@samvera/clover-iiif\`, the earlier version, kept for reference only; its source is https://github.com/samvera-labs/clover-iiif`,
        ]
      : []),
    `- [All of Clover 4's docs](${siteUrl}/llms-full.txt): every page above, as Markdown, in one file`,
    "",
  ].join("\n");
}
