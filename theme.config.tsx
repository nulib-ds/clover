import { DocsThemeConfig } from "nextra-theme-docs";
import Link from "next/link";
import Logo from "./docs/components/Logo";
import PageSettings from "./docs/components/PageSettings/PageSettings";
import React from "react";
import { useConfig } from "nextra-theme-docs";
import { useMemo } from "react";
import { useRouter } from "next/router";

const siteTitle = "Clover IIIF";
/*
 * Drives the browser title and the OpenGraph description. Keeps "Manifests" and
 * "Collections" for search, where the homepage headline says "IIIF content".
 */
const siteDescription =
  "A suite of accessible UI components for IIIF Manifests and Collections.";
/*
 * The site's address, for canonical links. The deploy workflow passes it as Pages reports
 * it (`NEXT_PUBLIC_SITE_URL`); a build without it is for nulib-ds.github.io.
 */
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nulib-ds.github.io/clover"
).replace(/\/+$/, "");

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
      : `${siteTitle} – ${siteDescription}`;
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
      defaultTitle: `${siteTitle} - ${siteDescription}`,
      title,
      description,
      canonical,
      openGraph: {
        url: canonical,
        title,
        siteName: `${siteTitle} - ${siteDescription}`,
        images: [
          {
            url: "",
            type: "image/png",
            width: 1200,
            height: 675,
          },
        ],
      },
      twitter: {
        cardType: "summary_large_image",
      },
    };
  },
  logo: <Logo />,
  /* Font, appearance and colour, behind a gear at the end of the header row. */
  navbar: {
    extraContent: <PageSettings />,
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
    autoCollapse: true,
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
};

export default config;
