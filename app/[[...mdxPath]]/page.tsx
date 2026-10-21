import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "nextra/components";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import React from "react";

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
 * When the page last changed, its last commit's time (Nextra's `timestamp`): for crawlers
 * and agents, in the page's structured data and Open Graph, as no line on the page says it.
 */
const modifiedOf = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toISOString() : undefined;

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
    modified: route === "/" ? undefined : modifiedOf(metadata.timestamp),
  });
}

/*
 * Every 3.x page opens with this, drawn on the server, so a reader, a search engine and
 * the site's own index all meet it first.
 */
const EarlierVersion = () => (
  <Callout type="warning">
    This page documents <strong>Clover 3.x</strong>,{" "}
    <code>@samvera/clover-iiif</code>, the earlier version of Clover, kept here
    for reference; it is the one on npm until Clover 4 is released. These docs
    lead with Clover 4: <Link href="/docs">Get Started</Link>.
  </Callout>
);

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
  const data = structuredData({
    title,
    description: earlier
      ? earlierDescription(metadata.description ?? undefined)
      : (metadata.description ?? siteDescription),
    route,
    modified: modifiedOf(metadata.timestamp),
  });
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      {route !== "/" && (
        <script
          type="application/ld+json"
          // JSON, with `<` escaped so no value can close the script.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(data).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {earlier ? (
        /*
         * For the site's search (Pagefind): a result's title says "(3.x)", the version is
         * a filter, and the page's words weigh half of Clover 4's, so a search for a
         * part finds its Clover 4 page first.
         */
        <div
          data-pagefind-meta={`title:${title}`}
          data-pagefind-filter="version:3.x"
          data-pagefind-weight="0.5"
        >
          <EarlierVersion />
          <MDXContent {...props} params={params} />
        </div>
      ) : (
        <MDXContent {...props} params={params} />
      )}
    </Wrapper>
  );
}
