/*
 * Every page's frame: Nextra's docs theme around the pages in `content/`.
 *
 * The stylesheets: Nextra's first, then Clover's (@nulib/clover ships its own, and
 * consumers import it the same way), MapLibre's for the 4.x Map, and the site's own,
 * which outrank Nextra's where they meet. The 3.x pages' components
 * (`@samvera/clover-iiif`, from npm) inject their own styles.
 */
import "nextra-theme-docs/style.css";
import "@nulib/clover/styles.css";
import "@nulib/clover/templates.css";
import "maplibre-gl/dist/maplibre-gl.css";

import "docs/styles/fonts.css";
import "docs/styles/layout.css";
import "docs/styles/tokens.css";

import type { Metadata } from "next";
import Link from "next/link";
import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { SiteFooter } from "docs/components/SiteFooter";
import { NoLastUpdated } from "docs/components/NoLastUpdated";
import React from "react";

import Logo from "docs/components/Logo";
import SiteEffects from "docs/components/SiteEffects";
import Subheader from "docs/components/Subheader";
import { pageMetadata, siteTitle } from "docs/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({ route: "/" }),
  // The name a phone gives the site on its home screen.
  appleWebApp: { title: siteTitle },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * The page's language, for screen readers and translation tools (WCAG 3.1.1). The site
     * is all in English.
     */
    <html lang="en" dir="ltr" suppressHydrationWarning>
      {/*
       * #0F62FE (the site's blue, Carbon's Blue 60) = hsl(219 99% 53%). Nextra bakes its
       * own lightness per utility and reads the hue and saturation, so the saturation is
       * set alongside the hue — left at its default of 100% the accent renders
       * fluorescent. Kept in step with `--accent-9` in docs/styles/tokens.css, as the
       * ground is with `--gray-1`.
       */}
      <Head
        color={{ hue: 219, saturation: 99 }}
        /*
         * The page's ground is the site's (`--gray-1` in docs/styles/tokens.css): Nextra's
         * own is #fafafa, which put a gray margin round the homepage and grayed the ground
         * under every part.
         */
        backgroundColor={{ light: "#ffffff", dark: "#111113" }}
      />
      <body>
        <Layout
          /*
           * The docs lead with Clover 4, which is not released yet; the banner says so once,
           * for every page, rather than a callout on each. Retire it (or change its key, so
           * readers who dismissed it see the next) when 4.0 ships: a stale banner costs more
           * attention than it earns.
           */
          banner={
            <Banner storageKey="clover-4-in-development">
              Clover 4 is in development and not on npm yet. The released Clover
              is 3.x:{" "}
              <Link href="/docs/3.x" style={{ textDecoration: "underline" }}>
                Clover 3.x docs
              </Link>
            </Banner>
          }
          /*
           * Nextra's navbar, held at the top as ever, and under it the line saying whose
           * project Clover is, which is not held: it follows the navbar's sticky box rather
           * than sitting in it, so it scrolls away with the page. No settings of its own
           * (Mat, 2026-10-20): font and color are chosen on the homepage, in "Why
           * Clover", and appearance in the footer.
           */
          navbar={
            <>
              <Navbar
                logo={<Logo />}
                projectLink="https://github.com/nulib-ds/clover"
              />
              <Subheader />
            </>
          }
          footer={
            <Footer className="site-footer">
              <SiteFooter />
            </Footer>
          }
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/nulib-ds/clover/tree/main"
          darkMode
          nextThemes={{ defaultTheme: "light" }}
          /*
           * Off: Nextra 4's "Copy page" menu is new to the site and has not been checked
           * against WCAG 2.2 AA (AGENTS.md); bring it in through that check, not by default.
           */
          copyPageButton={false}
          // No previous and next page links at a page's foot (Mat, 2026-10-21).
          navigation={false}
          lastUpdated={<NoLastUpdated />}
          sidebar={{
            /*
             * Off, so an opened folder stays open while focus moves through it. On, Nextra
             * closed it when focus passed from a page link to a nested folder's link, which
             * then sat in a closed folder, hidden from focus (docs/styles/layout.css).
             */
            autoCollapse: false,
            defaultMenuCollapseLevel: 1,
            toggleButton: true,
          }}
        >
          {children}
        </Layout>
        <SiteEffects />
      </body>
    </html>
  );
}
