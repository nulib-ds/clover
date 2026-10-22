import Link from "next/link";
import React from "react";
import home from "docs/components/Home/Home.module.css";
import styles from "docs/components/Home/SectionIntro.module.css";
import { Swoosh } from "docs/components/Home/Swoosh";

/**
 * A section's intro on the homepage: its title, under the hero's stroke, one sentence,
 * and where to go from it, a button (`cta-solid` for the page's one primary way on,
 * `cta-outline` otherwise). What goes `beside` the button (Install's npm command) shares
 * its row, under the words.
 */
export function SectionIntro({
  title,
  note,
  cta,
  beside,
  as: Heading = "h2",
  className,
  id,
}: {
  title: React.ReactNode;
  note: React.ReactNode;
  cta: { href: string; label: string; primary?: boolean };
  beside?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
  id?: string;
}) {
  const link = (
    <Link
      href={cta.href}
      className={`${cta.primary ? "cta-solid" : "cta-outline"} ${styles.cta}`}
    >
      {cta.label}
      <span className="cta-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
  return (
    <div
      className={className ? `${styles.intro} ${className}` : styles.intro}
      data-beside={beside ? "" : undefined}
    >
      <div className={styles.text}>
        <Heading className={styles.title} id={id}>
          {/* Under the hero's stroke, drawn once as it comes into view. */}
          <Swoosh className={`${home.mark} ${home.markOnScroll}`}>
            {title}
          </Swoosh>
        </Heading>
        <p className={styles.note}>{note}</p>
      </div>
      {beside ? (
        <div className={styles.actions}>
          {link}
          {beside}
        </div>
      ) : (
        link
      )}
    </div>
  );
}
