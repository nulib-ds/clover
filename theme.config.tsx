import { DocsThemeConfig, Navbar } from "nextra-theme-docs";
import Link from "next/link";
import Logo from "./docs/components/Logo";
import PageSettings from "./docs/components/PageSettings/PageSettings";
import Subheader from "./docs/components/Subheader";
import React from "react";
import { useConfig } from "nextra-theme-docs";
import { useFSRoute } from "nextra/hooks";
import { useMemo } from "react";
import { useRouter } from "next/router";

const siteTitle = "Clover IIIF";
/*
 * The homepage's title, and any page's without one of its own: the site's name and the
 * hero's headline (`docs/components/Home/Hero.tsx`).
 */
const homeTitle = `${siteTitle} – Imagine a viewer built by you`;
/*
 * The site's description, for the homepage and any page without one of its own: the
 * hero's sentence, less "designed", so it fits the 160 or so characters a search result
 * shows. Keeps "Manifests" and "Collections" for search.
 */
const siteDescription =
  "Share your distinctive collections through a lightweight, accessible, and modular viewer for IIIF Manifests, Collections, and the material they describe.";
/*
 * Every page's share card picture: the cover of the White Sewing Machine Company's 1896
 * bicycle catalog (the playground's Catalog, `public/mocks/paged/`), a 1.91:1 band of it
 * cut by Northwestern's IIIF Image server (the rider from her hat to the handlebars, "The
 * White" beside her, the scan's border trimmed), so no platform crops it further. Served
 * from there, never copied into the site: the record's attribution does not permit
 * further distribution of its images (Mat, 2026-10-16).
 */
const shareImage = {
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
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nulib-ds.github.io/clover"
).replace(/\/+$/, "");

/*
 * A sidebar entry's title. Nextra marks the current page by its look only, so the
 * current page's link also says so to screen readers. Its test is Nextra's own.
 */
function SidebarTitle({
  title,
  type,
  route,
}: {
  title: string;
  type: string;
  route: string;
}) {
  const [current] = useFSRoute().split("#");
  const isCurrent =
    type !== "separator" && [current, current + "/"].includes(route + "/");
  return (
    <>
      {title}
      {isCurrent && <span className="nx-sr-only"> (current page)</span>}
    </>
  );
}

const config: DocsThemeConfig = {
  darkMode: true,
  nextThemes: {
    defaultTheme: "light",
    enableSystem: false,
  },
  docsRepositoryBase: "https://github.com/nulib-ds/clover",

  /*
   * The docs lead with Clover 4, which is not released yet; the banner says so once, for
   * every page, rather than a callout on each. Retire it (or change its key, so readers
   * who dismissed it see the next) when 4.0 ships: a stale banner costs more attention
   * than it earns.
   */
  banner: {
    key: "clover-4-in-development",
    text: (
      <>
        Clover 4 is in development and not on npm yet. The released Clover is
        3.x:{" "}
        <Link href="/docs/3.x" style={{ textDecoration: "underline" }}>
          Clover 3.x docs
        </Link>
      </>
    ),
  },
  footer: {
    text: "A suite of accessible UI components for IIIF content. Created at Northwestern University Libraries.",
  },

  useNextSeoProps() {
    const config = useConfig();
    const title = config.frontMatter.title
      ? `${config.frontMatter.title} – ${siteTitle}`
      : homeTitle;
    const description = config.frontMatter.description
      ? config.frontMatter.description
      : siteDescription;

    /*
     * Joined as text: `new URL(route, siteUrl)` would drop the site's path (`/clover`), the
     * route being absolute.
     */
    const { route } = useRouter();
    const canonical = useMemo(() => `${siteUrl}${route}`, [route]);

    return {
      defaultTitle: homeTitle,
      title,
      description,
      canonical,
      openGraph: {
        type: "website",
        url: canonical,
        title,
        description,
        siteName: siteTitle,
        images: [shareImage],
      },
      // X reads the title, description and picture from Open Graph; its alt it does not.
      twitter: {
        cardType: "summary_large_image",
      },
      additionalMetaTags: [
        { name: "twitter:image:alt", content: shareImage.alt },
      ],
    };
  },
  /*
   * In place of Nextra's default head, which carries its own description, Open Graph
   * title and description ("Nextra: the next docs builder") and its author's X handle,
   * contradicting the cards `useNextSeoProps` writes. Kept: the language, and the name a
   * phone gives the site on its home screen.
   */
  head: (
    <>
      <meta httpEquiv="Content-Language" content="en" />
      <meta name="apple-mobile-web-app-title" content={siteTitle} />
    </>
  ),
  logo: <Logo />,
  navbar: {
    /* Font, appearance and colour, behind a gear at the end of the header row. */
    extraContent: <PageSettings />,
    /*
     * Nextra's navbar, held at the top as ever, and under it the line saying whose
     * project Clover is, which is not held: it follows the navbar's sticky box rather
     * than sitting in it, so it scrolls away with the page.
     */
    component: (props: React.ComponentProps<typeof Navbar>) => (
      <>
        <Navbar {...props} />
        <Subheader />
      </>
    ),
  },
  project: {
    link: "https://github.com/nulib-ds/clover",
  },
  /*
   * #0F62FE (the site's blue, Carbon's Blue 60) = hsl(219 99% 53%). Nextra bakes its own lightness per utility and reads
   * only these two, so the saturation has to be set alongside the hue — left at its
   * default of 100% the accent renders fluorescent.
   * Kept in step with `--accent-9` in docs/styles/tokens.css.
   */
  primaryHue: 219,
  primarySaturation: 99,
  sidebar: {
    /*
     * Off, so an opened folder stays open while focus moves through it. On, Nextra closed
     * it when focus passed from a page link to a nested folder's link, which then sat in
     * a closed folder, hidden from focus (docs/styles/layout.css).
     */
    autoCollapse: false,
    defaultMenuCollapseLevel: 1,
    titleComponent: SidebarTitle,
    toggleButton: true,
  },
};

export default config;
