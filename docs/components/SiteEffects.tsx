"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { restorePageTheme, watchReaderContrast } from "docs/lib/page-theme";
import { basePath } from "docs/lib/router";

const SIDEBARS = ".nextra-sidebar, .nextra-mobile-nav";

/*
 * Marks the current page's links in the sidebars `aria-current="page"`: Nextra marks it by
 * its look alone (bold, tinted), which a screen reader does not hear (WCAG 1.3.1, 4.1.2).
 */
function markCurrent(pathname: string) {
  const here = (basePath + pathname).replace(/\/+$/, "") || "/";
  document
    .querySelectorAll<HTMLAnchorElement>(`:is(${SIDEBARS}) a[href]`)
    .forEach((link) => {
      const path =
        new URL(link.href, location.href).pathname.replace(/\/+$/, "") || "/";
      if (path === here) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
}

/**
 * What every page does once it is in the browser, from the root layout.
 */
export default function SiteEffects() {
  const pathname = usePathname() ?? "/";

  /*
   * Again whenever a sidebar draws new links (a folder opening, the phone menu), which
   * Nextra renders without the attribute.
   */
  useEffect(() => {
    markCurrent(pathname);
    const observer = new MutationObserver(() => markCurrent(pathname));
    document
      .querySelectorAll(SIDEBARS)
      .forEach((sidebar) =>
        observer.observe(sidebar, { childList: true, subtree: true }),
      );
    return () => observer.disconnect();
  }, [pathname]);

  /*
   * Reapply the reader's accent and font on every cold load.
   *
   * The playground writes both to the document root, but it only mounts on the homepage —
   * so without this, choosing an accent and then navigating into the docs dropped it, and
   * the stored value was never honored again. Runs in an effect because `localStorage` is
   * unreachable during SSR, which means a frame of the default theme before it applies.
   */
  useEffect(() => {
    restorePageTheme();
  }, []);

  // The site's higher-contrast mode, as the reader's system asks for more contrast.
  useEffect(watchReaderContrast, []);

  /*
   * Nextra's search takes a bare "/" page-wide, a single-key shortcut that cannot be
   * turned off (WCAG 2.1.4). Its listener is on `window`, so stop the key at `document`,
   * one hop before it. Cmd/Ctrl+K still opens search, and "/" still types and finds.
   */
  useEffect(() => {
    const keepSlash = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      )
        event.stopPropagation();
    };
    document.addEventListener("keydown", keepSlash);
    return () => document.removeEventListener("keydown", keepSlash);
  }, []);

  return null;
}
