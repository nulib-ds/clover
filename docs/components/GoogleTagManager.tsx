"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import React, { useEffect, useRef, useState } from "react";
import { ctaClick, pageReferrer, resourceOpen } from "docs/lib/tag-manager";
import { useRouter } from "docs/lib/router";

type TagManagerWindow = Window & { dataLayer?: Record<string, unknown>[] };

/** Check current metadata again at interaction time, including during client navigation. */
function isIndexablePage(url: string) {
  return (
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.href.replace(/\/+$/, "") === url &&
    ![
      ...document.querySelectorAll<HTMLMetaElement>('meta[name="robots"]'),
    ].some((meta) => /\bnoindex\b/i.test(meta.content))
  );
}

/**
 * One event per public page, including Next's client navigation. The container uses
 * `clover_page_view` to send GA4 page views (docs/README.md); changes inside an example
 * are not visits to another page. Queries and fragments are not in page views. The
 * homepage's resource choices and template changes have separate events.
 */
export default function GoogleTagManager({
  containerId,
  siteUrl,
}: {
  containerId: string;
  siteUrl: string;
}) {
  const pathname = usePathname();
  const { query, isReady } = useRouter();
  const content =
    typeof query["iiif-content"] === "string"
      ? query["iiif-content"].trim()
      : undefined;
  const template =
    query.t === undefined
      ? "default"
      : typeof query.t === "string" &&
          ["default", "document", "gallery"].includes(query.t)
        ? query.t
        : undefined;
  const started = useRef(false);
  const previous = useRef<string | undefined>(undefined);
  const previousResource = useRef<string | undefined>(undefined);
  const previousTemplate = useRef<string | undefined>(undefined);
  const installSeen = useRef(false);
  const [publicPage, setPublicPage] = useState<string | undefined>(undefined);

  useEffect(() => {
    // A local preview of a production build must not count as a visit to the site.
    if (!pathname || window.location.origin !== new URL(siteUrl).origin) return;
    const pageLocation = `${siteUrl}${pathname === "/" ? "" : pathname.replace(/\/+$/, "")}`;

    const record = () => {
      // Next can commit the route before its head. Wait for this page's metadata,
      // including its indexing policy, rather than sending an empty or previous title.
      const canonical = document.querySelector<HTMLLinkElement>(
        'link[rel="canonical"]',
      );
      if (
        canonical?.href.replace(/\/+$/, "") !== pageLocation ||
        !document.title.trim()
      )
        return false;
      if (
        [
          ...document.querySelectorAll<HTMLMetaElement>('meta[name="robots"]'),
        ].some((meta) => /\bnoindex\b/i.test(meta.content))
      ) {
        previous.current = undefined;
        previousResource.current = undefined;
        previousTemplate.current = undefined;
        return true;
      }
      const dataLayer = ((window as TagManagerWindow).dataLayer ??= []);
      if (previous.current !== pageLocation) {
        const page = {
          page_location: pageLocation,
          page_title: document.title,
          page_referrer: previous.current ?? pageReferrer(document.referrer),
        };
        if (!started.current) {
          // The Google tag can read the first page's values when its container initializes.
          dataLayer.push(page, { "gtm.start": Date.now(), event: "gtm.js" });
          started.current = true;
        }
        dataLayer.push({ event: "clover_page_view", ...page });
        previous.current = pageLocation;
        setPublicPage(pageLocation);
      }
      const resource =
        pathname === "/" && content
          ? resourceOpen(content, siteUrl)
          : undefined;
      if (resource && content !== previousResource.current)
        dataLayer.push({ event: "clover_resource_open", ...resource });
      previousResource.current = resource ? content : undefined;
      if (pathname !== "/") previousTemplate.current = undefined;
      else if (isReady) {
        // Establish the initial choice after hydration, including a shared `?t=`.
        // Only changes after that are toggles; returning to Default removes `t`.
        if (
          template &&
          previousTemplate.current &&
          template !== previousTemplate.current
        )
          dataLayer.push({
            event: "clover_template_change",
            template,
            previous_template: previousTemplate.current,
          });
        previousTemplate.current =
          template ?? previousTemplate.current ?? "default";
      }
      return true;
    };
    if (record()) return;
    const observer = new MutationObserver(() => {
      if (record()) observer.disconnect();
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [pathname, siteUrl, content, template, isReady]);

  useEffect(() => {
    if (pathname !== "/") {
      installSeen.current = false;
      return;
    }
    if (
      publicPage !== siteUrl ||
      window.location.origin !== new URL(siteUrl).origin ||
      installSeen.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;

    let active = true;
    let visibility: IntersectionObserver | undefined;
    let pending: MutationObserver | undefined;
    const observe = () => {
      const install = document.getElementById("install");
      if (!install) return false;
      visibility = new IntersectionObserver(
        (entries) => {
          if (
            !active ||
            installSeen.current ||
            previous.current !== siteUrl ||
            !isIndexablePage(siteUrl)
          )
            return;
          if (
            entries.some(
              (entry) =>
                entry.target === install &&
                entry.isIntersecting &&
                entry.intersectionRatio >= 0.5,
            )
          ) {
            installSeen.current = true;
            (window as TagManagerWindow).dataLayer?.push({
              event: "clover_install_view",
            });
            visibility?.disconnect();
            pending?.disconnect();
          }
        },
        { threshold: 0.5 },
      );
      visibility.observe(install);
      return true;
    };
    // Client navigation can commit page metadata before the homepage's target mounts.
    if (!observe()) {
      pending = new MutationObserver(() => {
        if (observe()) pending?.disconnect();
      });
      pending.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      active = false;
      visibility?.disconnect();
      pending?.disconnect();
    };
  }, [pathname, publicPage, siteUrl]);

  useEffect(() => {
    if (
      pathname !== "/" ||
      publicPage !== siteUrl ||
      window.location.origin !== new URL(siteUrl).origin
    )
      return;
    const record = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        (event.type === "click" ? event.button !== 0 : event.button !== 1) ||
        previous.current !== siteUrl ||
        !isIndexablePage(siteUrl)
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[data-cta-section]")
          : null;
      const cta = link ? ctaClick(link) : undefined;
      if (cta)
        (window as TagManagerWindow).dataLayer?.push({
          event: "clover_cta_click",
          ...cta,
        });
    };
    // Capture before Next handles navigation. Enter synthesizes one click; middle-click
    // has its own auxclick. Tracking never prevents or delays normal link behavior.
    document.addEventListener("click", record, true);
    document.addEventListener("auxclick", record, true);
    return () => {
      document.removeEventListener("click", record, true);
      document.removeEventListener("auxclick", record, true);
    };
  }, [pathname, publicPage, siteUrl]);

  return (
    <>
      <noscript>
        <iframe
          title="Google Tag Manager"
          src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
      {publicPage && (
        <Script
          id="google-tag-manager"
          src={`https://www.googletagmanager.com/gtm.js?id=${containerId}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
