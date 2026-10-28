"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import React, { useEffect, useRef, useState } from "react";
import { pageReferrer } from "docs/lib/tag-manager";

type TagManagerWindow = Window & { dataLayer?: Record<string, unknown>[] };

/**
 * One event per public page, including Next's client navigation. The container uses
 * `clover_page_view` to send GA4 page views (docs/README.md); changes inside an example
 * are not visits to another page. Queries and fragments are not in these events.
 */
export default function GoogleTagManager({
  containerId,
  siteUrl,
}: {
  containerId: string;
  siteUrl: string;
}) {
  const pathname = usePathname();
  const started = useRef(false);
  const previous = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // A local preview of a production build must not count as a visit to the site.
    if (!pathname || window.location.origin !== new URL(siteUrl).origin) return;
    const pageLocation = `${siteUrl}${pathname === "/" ? "" : pathname.replace(/\/+$/, "")}`;
    if (previous.current === pageLocation) return;

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
        return true;
      }
      const page = {
        page_location: pageLocation,
        page_title: document.title,
        page_referrer: previous.current ?? pageReferrer(document.referrer),
      };
      const dataLayer = ((window as TagManagerWindow).dataLayer ??= []);
      if (!started.current) {
        // The Google tag can read the first page's values when its container initializes.
        dataLayer.push(page, { "gtm.start": Date.now(), event: "gtm.js" });
        started.current = true;
        setReady(true);
      }
      dataLayer.push({ event: "clover_page_view", ...page });
      previous.current = pageLocation;
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
  }, [pathname, siteUrl]);

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
      {ready && (
        <Script
          id="google-tag-manager"
          src={`https://www.googletagmanager.com/gtm.js?id=${containerId}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
