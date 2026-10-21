import Link from "next/link";
import React from "react";
import styles from "docs/components/Home/SectionIntro.module.css";

/**
 * A section's intro on the homepage: its title, one sentence, and where to go from it,
 * a button (`cta-solid` for the page's one primary way on, `cta-outline` otherwise).
 */
export function SectionIntro({
  title,
  note,
  cta,
  as: Heading = "h2",
  className,
  id,
}: {
  title: string;
  note: React.ReactNode;
  cta: { href: string; label: string; primary?: boolean };
  as?: "h2" | "h3";
  className?: string;
  id?: string;
}) {
  return (
    <div className={className ? `${styles.intro} ${className}` : styles.intro}>
      <div className={styles.text}>
        <Heading className={styles.title} id={id}>
          {title}
        </Heading>
        <p className={styles.note}>{note}</p>
      </div>
      <Link
        href={cta.href}
        className={`${cta.primary ? "cta-solid" : "cta-outline"} ${styles.cta}`}
      >
        {cta.label}
        <span className="cta-arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </div>
  );
}
