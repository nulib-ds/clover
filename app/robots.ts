import type { MetadataRoute } from "next";
import { siteUrl } from "docs/lib/site";

/*
 * Everything open to crawlers, and where the sitemap is. A crawler reads `robots.txt` only
 * at a host's root: on nulib-ds.github.io the site is under `/clover`, so this one is not
 * read there, but it is on a domain of the site's own.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
