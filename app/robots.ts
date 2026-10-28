import type { MetadataRoute } from "next";
import { siteUrl } from "docs/lib/site";

/*
 * Everything open to crawlers, and where the sitemap is. A crawler reads `robots.txt` only
 * at a host's root, which the site has on its own domain, so this one is read. Served
 * under a path instead (`/clover` on nulib-ds.github.io), it would not be.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
