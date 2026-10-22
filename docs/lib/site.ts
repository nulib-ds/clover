import type { Metadata } from "next";

/*
 * The site's name, titles, description and share card, for every page's metadata
 * (`app/layout.tsx`, and each page's in `app/[[...mdxPath]]/page.tsx`).
 */

export const siteTitle = "Clover IIIF";

/*
 * The hero's headline and the line under it (`docs/components/Home/Hero.tsx`), the brand's
 * words, written once: the hero and the footer show them, and the homepage's title,
 * description and structured data and `llms.txt` carry them (Mat, 2026-10-22).
 */
export const homeHeadline = "A viewer as distinctive as your collections.";
export const homeTagline =
  "Design a user experience rooted in IIIF with Clover.";

/* The homepage's title, and any page's without one of its own: the name and the headline. */
export const homeTitle = `${siteTitle} – ${homeHeadline.replace(/\.$/, "")}`;

/** What Clover does and its two ways, plainly, in the Get Started page's words. */
const whatItDoes =
  "builds interfaces for IIIF content in React or as a web component: a ready-made Viewer with templates, or parts to compose your own. Accessible, composable and light.";

/*
 * The site's description, for any page without one of its own: what Clover is, plainly
 * (Mat, 2026-10-21: so an agent or a search result can tell what it is).
 */
export const siteDescription = `Clover ${whatItDoes}`;

/* The homepage's: the hero's line, then what Clover is, as plainly. */
export const homeDescription = `${homeTagline} It ${whatItDoes}`;

/*
 * What Clover is, at more length, in the Get Started page's words
 * (`content/docs/index.mdx`): for agents and search engines, `llms.txt` and the
 * homepage's structured data (`docs/lib/agents.ts`).
 */
export const aboutClover =
  "Clover builds interfaces for IIIF content in React or as a web component: a Manifest, a Collection, a Canvas or a content state, read through the IIIF Presentation API, versions 2, 3 and 4. Use the ready-made Viewer with one of its templates, or compose a layout of your own from the parts it is built from; on a page without React, the Viewer is a web component. It is accessible, composable and light, and it draws images, video and sound with a renderer of its own.";

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

/*
 * A page as Markdown, for agents: its address with `.md` added, which
 * `scripts/build-agent-docs.mjs` writes after the build; the homepage's is `llms.txt`,
 * what the site is for an agent.
 */
export const markdownUrl = (route: string) =>
  route === "/" ? `${siteUrl}/llms.txt` : `${siteUrl}${route}.md`;

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
  modified,
  markdown = false,
}: {
  title?: string;
  description?: string;
  route: string;
  /** When the page last changed (ISO 8601), its last commit's time. */
  modified?: string;
  /** Whether the page has a Markdown copy (`markdownUrl`), linked for agents. */
  markdown?: boolean;
}): Metadata {
  const fullTitle = title ? `${title} – ${siteTitle}` : homeTitle;
  const text =
    description || (route === "/" ? homeDescription : siteDescription);
  const canonical = `${siteUrl}${route === "/" ? "" : route}`;
  return {
    title: { absolute: fullTitle },
    description: text,
    alternates: {
      canonical,
      ...(markdown && { types: { "text/markdown": markdownUrl(route) } }),
    },
    openGraph: {
      // A page with a date of its own is an article to Open Graph (`article:modified_time`).
      ...(modified
        ? { type: "article" as const, modifiedTime: modified }
        : { type: "website" as const }),
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
 * `/docs/3.x/` for reference. Every
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
  modified,
}: {
  title: string;
  description: string;
  route: string;
  /** When the page last changed (ISO 8601), its last commit's time. */
  modified?: string;
}) {
  const earlier = isEarlierVersion(route);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    url: `${siteUrl}${route === "/" ? "" : route}`,
    inLanguage: "en",
    ...(modified && { dateModified: modified }),
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
          version: "4",
          codeRepository: "https://github.com/nulib-ds/clover",
        },
  };
}

/**
 * The homepage's structured data (schema.org, as JSON-LD): the site, who publishes it,
 * and Clover itself, what it is (`aboutClover`) and what it does (`features`: its parts,
 * each in its page's words), for search engines and the agents that read it.
 */
export function homeStructuredData({
  features,
  react,
}: {
  features: string[];
  /** The React it runs with, as its package asks for it (`peerDependencies`). */
  react: string;
}) {
  const publisher = {
    "@type": "Organization",
    "@id": `${siteUrl}#publisher`,
    name: "Northwestern University Libraries",
    url: "https://www.library.northwestern.edu/",
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      publisher,
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        name: siteTitle,
        url: siteUrl,
        headline: homeHeadline,
        alternativeHeadline: homeTagline,
        description: homeDescription,
        inLanguage: "en",
        publisher: { "@id": publisher["@id"] },
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${siteUrl}#software`,
        name: siteTitle,
        alternateName: "@nulib/clover",
        description: aboutClover,
        url: siteUrl,
        version: "4",
        codeRepository: "https://github.com/nulib-ds/clover",
        programmingLanguage: "TypeScript",
        runtimePlatform: ["React", "Web Components"],
        license: "https://github.com/nulib-ds/clover/blob/main/LICENSE",
        copyrightHolder: { "@id": publisher["@id"] },
        copyrightYear: 2026,
        publisher: { "@id": publisher["@id"] },
        keywords: [
          "IIIF",
          "IIIF Presentation API",
          "IIIF viewer",
          "React",
          "web component",
          "accessibility",
          "WCAG 2.2",
        ],
        targetProduct: {
          "@type": "SoftwareApplication",
          name: siteTitle,
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Any, in a web browser",
          softwareRequirements: `React ${react}, or none for the web component`,
          featureList: features,
        },
      },
    ],
  };
}
