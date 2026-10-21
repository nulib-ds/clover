import type { Metadata } from "next";

/*
 * The site's name, titles, description and share card, for every page's metadata
 * (`app/layout.tsx`, and each page's in `app/[[...mdxPath]]/page.tsx`).
 */

export const siteTitle = "Clover IIIF";

/*
 * The homepage's title, and any page's without one of its own: the site's name and the
 * hero's headline (`docs/components/Home/Hero.tsx`).
 */
export const homeTitle = `${siteTitle} – A viewer as distinctive as your collections`;

/*
 * The site's description, for the homepage and any page without one of its own: the
 * hero's sentence, then what the field under it does, which keeps "Manifest" and
 * "Collection" for search.
 */
export const siteDescription =
  "Design the user experience that you imagine for your IIIF resources. View any IIIF Manifest or Collection.";

/*
 * Every page's share card picture: the cover of the White Sewing Machine Company's 1896
 * bicycle catalog (the playground's Catalog, `public/mocks/paged/`), a 1.91:1 band of it
 * cut by Northwestern's IIIF Image server (the rider from her hat to the handlebars, "The
 * White" beside her, the scan's border trimmed), so no platform crops it further. Served
 * from there, never copied into the site: the record's attribution does not permit
 * further distribution of its images (Mat, 2026-10-16).
 */
export const shareImage = {
  url: "https://iiif.dc.library.northwestern.edu/iiif/3/7ff31828-e562-4cbe-b517-74baace7745c/60,650,4636,2434/1200,/0/default.jpg",
  type: "image/jpeg",
  width: 1200,
  height: 630,
  alt: "The cover of the White Sewing Machine Company's 1896 bicycle catalog: a woman in a white dress and straw hat rides a bicycle down a country road, “The White” lettered beside her.",
};

/*
 * The site's address, for canonical links. The deploy workflow passes it as Pages reports
 * it (`NEXT_PUBLIC_SITE_URL`); a build without it is for nulib-ds.github.io.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nulib-ds.github.io/clover"
).replace(/\/+$/, "");

/**
 * A page's title, description, canonical link and share cards. A page with a `title` in
 * its front matter is "Title – Clover IIIF"; one without takes the homepage's title, and
 * one without a `description` the site's. Joined as text: `new URL(route, siteUrl)` would
 * drop the site's path (`/clover`), the route being absolute.
 */
export function pageMetadata({
  title,
  description,
  route,
}: {
  title?: string;
  description?: string;
  route: string;
}): Metadata {
  const fullTitle = title ? `${title} – ${siteTitle}` : homeTitle;
  const text = description || siteDescription;
  const canonical = `${siteUrl}${route === "/" ? "" : route}`;
  return {
    title: { absolute: fullTitle },
    description: text,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: fullTitle,
      description: text,
      siteName: siteTitle,
      images: [shareImage],
    },
    // X reads the title, description and picture from Open Graph; its alt it does not.
    twitter: { card: "summary_large_image" },
    other: { "twitter:image:alt": shareImage.alt },
  };
}

/*
 * Clover 3.x, `@samvera/clover-iiif`, is the earlier version: its docs are kept under
 * `/docs/3.x/` for reference (and it is the one on npm until Clover 4 is released). Every
 * page there says so to a reader, to search engines (its description and structured
 * data) and to the site's own search (its results are titled "(3.x)" and rank below
 * Clover 4's): see `app/[[...mdxPath]]/page.tsx`.
 */
export const isEarlierVersion = (route: string) =>
  route === "/docs/3.x" || route.startsWith("/docs/3.x/");

const EARLIER = "(3.x)";

/** A 3.x page's title, always ending "(3.x)", so a result says which version it is. */
export const earlierTitle = (title: string) =>
  title.endsWith(EARLIER) ? title : `${title} ${EARLIER}`;

/** A 3.x page's description: its own, after what it documents. */
export const earlierDescription = (description?: string) =>
  [
    "Clover 3.x (@samvera/clover-iiif), the earlier version, documented for reference.",
    description,
  ]
    .filter(Boolean)
    .join(" ");

/**
 * A page's structured data (schema.org, as JSON-LD): what it documents, which version,
 * and, for a 3.x page, that it is superseded, so a search engine or an agent reading the
 * page knows Clover 4's docs are the current ones.
 */
export function structuredData({
  title,
  description,
  route,
}: {
  title: string;
  description: string;
  route: string;
}) {
  const earlier = isEarlierVersion(route);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    url: `${siteUrl}${route === "/" ? "" : route}`,
    inLanguage: "en",
    version: earlier ? "3.x" : "4",
    ...(earlier && { creativeWorkStatus: "Superseded" }),
    isPartOf: { "@type": "WebSite", name: siteTitle, url: siteUrl },
    about: earlier
      ? {
          "@type": "SoftwareSourceCode",
          name: "@samvera/clover-iiif",
          version: "3.x",
          codeRepository: "https://github.com/samvera-labs/clover-iiif",
        }
      : {
          "@type": "SoftwareSourceCode",
          name: "@nulib/clover",
          version: "4 (in development)",
          codeRepository: "https://github.com/nulib-ds/clover",
        },
  };
}
