"use client";

import Link from "next/link";
import { useRouter } from "docs/lib/router";
import React, { useEffect, useState } from "react";

/**
 * Where a page went when Clover 4 became the docs' focus: 3.x moved under /docs/3.x, and
 * 4.x up from /docs/4.x. A 3.x page whose name 4.x now uses (/docs/viewer, /docs/map,
 * /docs/composing) shows the 4.x page instead, which links back to its 3.x version.
 */
const MOVES: [RegExp, string][] = [
  [/^\/docs\/4\.x(\/.*)?$/, "/docs$1"],
  [
    /^\/docs\/(image|scroll|slider|homepage|label|metadata|partOf|rendering|requiredStatement|seeAlso|summary|thumbnail|i18n)(\/.*)?$/,
    "/docs/3.x/$1$2",
  ],
  /*
   * Clover 4's demo is the homepage now: its playground opens what `?iiif-content=` names,
   * as the demo page did, and iiif.io's recipe pages link to
   * `/docs/viewer/demo?iiif-content=<manifest>`. The query and the hash go along.
   */
  [/^\/docs\/viewer\/demo$/, "/"],
  // The templates' page, folded into the Viewer's (Mat, 2026-10-21).
  [/^\/docs\/viewer\/templates$/, "/docs/viewer#templates"],
  // The 3.x Viewer's own pages: content state, search and prefetched content.
  [/^\/docs\/viewer\/(.+)$/, "/docs/3.x/viewer/$1"],
  // The component's page, from when the Panel was the InformationPanel.
  [/^\/docs\/information-panel$/, "/docs/panel"],
  // Pages folded into others: the templates under the Viewer, the element into Get Started.
  [/^\/docs\/templates$/, "/docs/viewer#templates"],
  [/^\/docs\/web-component$/, "/docs#web-component"],
];

/** The page moved to from `path`, or nothing. */
export function movedTo(path: string): string | null {
  const clean = path.replace(/\/+$/, "") || "/";
  for (const [pattern, target] of MOVES) {
    if (pattern.test(clean)) return clean.replace(pattern, target);
  }
  return null;
}

/**
 * The 404 page. The docs are a static export, so there are no server redirects; GitHub
 * Pages serves this page for any missing path instead, and it sends a moved one on.
 */
export function Moved() {
  const router = useRouter();
  const [target, setTarget] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const path = window.location.pathname.slice(router.basePath.length);
    const next = movedTo(path);
    setTarget(next);
    if (next) {
      // A target's own section, unless the address names one (its headings came along).
      const [path, section] = next.split("#");
      const hash = window.location.hash || (section ? `#${section}` : "");
      router.replace(path + window.location.search + hash);
    }
  }, [router]);

  if (target === undefined) return null;
  return (
    <div style={{ padding: "4rem 0", textAlign: "center" }}>
      {target ? (
        <p>
          This page has moved to <Link href={target}>{target}</Link>.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Page not found
          </h1>
          <p style={{ marginTop: "1rem" }}>
            Start from the <Link href="/docs">docs</Link>, or the{" "}
            <Link href="/docs/3.x">Clover 3.x docs</Link>.
          </p>
        </>
      )}
    </div>
  );
}
