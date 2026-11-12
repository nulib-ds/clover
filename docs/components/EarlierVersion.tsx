import Link from "next/link";
import React from "react";

import { earlierPackage } from "docs/lib/site";
import styles from "./EarlierVersion.module.css";

/**
 * The notice every 3.x page opens with, before its title, drawn on the server
 * (`app/[[...mdxPath]]/page.tsx`), so a person, a search engine, the Markdown agents read
 * and a page without scripts all meet it first. It says at once that the page is for a
 * deprecated version, used only to support an older installation, and leads to Clover 4's
 * docs (Mat, 2026-11-12: "IT SHOULD be immediately clear that this is a deprecated
 * version and advice is to not use unless you are supporting an older installation. use
 * 4.x docs at /docs instead."). `earlierAdvice` (`docs/lib/site.ts`) says the same to
 * search engines and agents.
 *
 * A note named by its first line, so assistive technology names it as it reaches it; the
 * page's title in the browser's tab says "deprecated" before it.
 */
export function EarlierVersion() {
  const id = "deprecated-version";
  return (
    <div className={styles.notice} role="note" aria-labelledby={id}>
      <p className={styles.head} id={id}>
        <svg
          className={styles.mark}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        Clover 3.x is deprecated
      </p>
      <p className={styles.text}>
        This page documents Clover 3.x, <code>{earlierPackage}</code>, which is
        no longer maintained. Don&apos;t use it unless you&apos;re supporting an
        older installation. For anything new, use Clover 4,{" "}
        <code>@nulib/clover</code>, and its docs at{" "}
        <Link href="/docs">/docs</Link>.
      </p>
      <p className={styles.ways}>
        <Link href="/docs" className="cta-solid">
          Go to Clover 4 docs
        </Link>
        <Link href="/docs/upgrading" className={styles.upgrade}>
          Upgrading from 3.x
        </Link>
      </p>
    </div>
  );
}
