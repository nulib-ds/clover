import Link from "next/link";
import React from "react";

import styles from "./Related.module.css";

/**
 * Where a page goes on: related content and next steps, as small cards, each a link to a
 * page by the menu's own name, a sentence of what it holds under it, and an arrow in its
 * corner, as the homepage's tiles lead to the parts' pages (Mat, 2026-10-26: "make this
 * little cards. we will use this type of thing for related content/next steps"). A list,
 * so assistive technology counts them. Its sentence is a prop, as MDX makes children a
 * paragraph, which a link's span cannot hold.
 *
 * ```mdx
 * <Related>
 *   <RelatedLink
 *     href="/docs/viewer"
 *     title="Viewer"
 *     note="Its templates, and every prop."
 *   />
 * </Related>
 * ```
 */
export function Related({ children }: { children: React.ReactNode }) {
  return <ul className={styles.related}>{children}</ul>;
}

export function RelatedLink({
  href,
  title,
  note,
}: {
  href: string;
  title: string;
  /** What the page holds, in a sentence. */
  note: string;
}) {
  return (
    <li className={styles.card}>
      <Link href={href} className={styles.link}>
        <span className={styles.title}>{title}</span>{" "}
        {/* A space keeps the two apart in the link's name, "Viewer Its templates…". */}
        <span className={styles.note}>{note}</span>
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
}
