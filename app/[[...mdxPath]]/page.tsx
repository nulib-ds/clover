import { notFound } from "next/navigation";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import React from "react";

import { EarlierVersion } from "docs/components/EarlierVersion";
import { homeData, trailOf } from "docs/lib/agents";
import { lastChanged } from "docs/lib/last-changed";
import {
  earlierDescription,
  earlierTitle,
  isEarlierVersion,
  pageMetadata,
  siteDescription,
  structuredData,
} from "docs/lib/site";
import { useMDXComponents as getMDXComponents } from "../../mdx-components";

/*
 * Every page in `content/`, built ahead of time for the static export: Nextra lists them,
 * and `importPage` reads one with its front matter, headings and source.
 */
export const generateStaticParams = generateStaticParamsFor("mdxPath");

type Props = { params: Promise<{ mdxPath?: string[] }> };

const routeOf = (mdxPath?: string[]) => `/${(mdxPath ?? []).join("/")}`;

/*
 * When the page last changed, its file's last commit's time (`last-changed.ts`): for
 * crawlers and agents, in the page's structured data and Open Graph, as no line on the
 * page says it.
 */
const modifiedOf = (metadata: { filePath?: string }) =>
  lastChanged(metadata.filePath);

/*
 * A page from `content/`, or the not-found page for a path that is none (in `next dev`,
 * where any path reaches this route: a browser's `/favicon.ico`, say).
 */
const load = (mdxPath?: string[]) =>
  importPage(mdxPath).catch(() => notFound());

export async function generateMetadata(props: Props) {
  const { mdxPath } = await props.params;
  const { metadata } = await load(mdxPath);
  const route = routeOf(mdxPath);
  const earlier = isEarlierVersion(route);
  return pageMetadata({
    /*
     * The front matter's title, else the page's first heading (Nextra's rule). The
     * homepage has neither (its heading is the hero's), so it keeps the site's title.
     */
    title:
      route === "/"
        ? undefined
        : earlier
          ? earlierTitle(metadata.title)
          : metadata.title,
    description: earlier
      ? earlierDescription(metadata.description ?? undefined)
      : (metadata.description ?? undefined),
    route,
    modified: route === "/" ? undefined : modifiedOf(metadata),
    // Linked as Markdown, as `scripts/build-agent-docs.mjs` writes it: all but the unlisted.
    markdown: (metadata as { searchable?: unknown }).searchable !== false,
    // Indexed by search engines: all but the unlisted and the test mocks (`/test/`).
    indexed:
      (metadata as { searchable?: unknown }).searchable !== false &&
      route !== "/test" &&
      !route.startsWith("/test/"),
  });
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props: Props) {
  const params = await props.params;
  const {
    default: MDXContent,
    toc,
    metadata,
    sourceCode,
  } = await load(params.mdxPath);
  const route = routeOf(params.mdxPath);
  const earlier = isEarlierVersion(route);
  const title = earlier ? earlierTitle(metadata.title) : metadata.title;
  // The homepage's is Clover itself, the site and its publisher; any other page's, an article.
  const data =
    route === "/"
      ? await homeData()
      : structuredData({
          title,
          description: earlier
            ? earlierDescription(metadata.description ?? undefined)
            : (metadata.description ?? siteDescription),
          route,
          modified: modifiedOf(metadata),
          trail: await trailOf(route),
        });
  return (
    <Wrapper
      toc={toc}
      /*
       * A 3.x page is out of the site's search (Pagefind): Nextra marks a page's `main`
       * as its body (`data-pagefind-body`) unless it is `searchable: false`, and Pagefind
       * then leaves out every page without one. It stays in the sitemap, the Markdown and
       * `llms.txt`, which read the front matter, not this.
       */
      metadata={
        earlier
          ? ({ ...metadata, searchable: false } as typeof metadata)
          : metadata
      }
      sourceCode={sourceCode}
    >
      <script
        type="application/ld+json"
        // JSON, with `<` escaped so no value can close the script.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
      {earlier ? (
        <>
          <EarlierVersion />
          <MDXContent {...props} params={params} />
        </>
      ) : (
        <MDXContent {...props} params={params} />
      )}
    </Wrapper>
  );
}
