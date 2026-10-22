import type { MetadataRoute } from "next";
import { publishedPages } from "docs/lib/agents";
import { siteUrl } from "docs/lib/site";

/*
 * Every page the site publishes, with when it last changed (`docs/lib/agents.ts`), for
 * search engines and agents: a file in the static export, `sitemap.xml`.
 */
export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await publishedPages()).map(({ route, modified }) => ({
    url: `${siteUrl}${route === "/" ? "" : route}`,
    ...(modified && { lastModified: modified }),
  }));
}
