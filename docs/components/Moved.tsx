"use client";

import Link from "next/link";
import { movedTo } from "docs/lib/moved.mjs";
import { useRouter } from "docs/lib/router";
import React, { useEffect, useState } from "react";

/**
 * The 404 page. The docs are a static export, so there are no server redirects;
 * CloudFront serves this page for any missing path instead, and it sends a moved one on
 * (`docs/lib/moved.mjs`). The moved paths a built page answers for have pages of their
 * own, which redirect first (`scripts/build-moved-pages.mjs`).
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
            <Link href="/docs/deprecated-versions">Clover 3.x docs</Link>.
          </p>
        </>
      )}
    </div>
  );
}
