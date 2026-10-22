import Link from "next/link";
import React from "react";
import styles from "docs/components/Home/Home.module.css";
import { homeTagline } from "docs/lib/site";

/**
 * The hero: the page's headline, and the sentence that says what Clover does, with the
 * documentation after it, in the sentence's own type (Mat, 2026-10-22).
 *
 * No call-to-action buttons. The playground sits directly below and is itself the
 * invitation, and the choice under it and the install panel further down each offer Get
 * started.
 */
const Hero: React.FC = () => (
  <header className={styles.hero}>
    <div className={styles.shell}>
      <h1 className={styles.headline}>
        <span className={styles.line}>
          A viewer as <span className={styles.mark}>distinctive</span>
        </span>{" "}
        <span className={styles.line}>as your collections.</span>
      </h1>
      <p className={styles.subtitle}>
        {homeTagline}{" "}
        <Link className={styles.subtitleLink} href="/docs">
          Documentation
          <span
            className={`cta-arrow ${styles.subtitleArrow}`}
            aria-hidden="true"
          >
            →
          </span>
        </Link>
      </p>
    </div>
  </header>
);

export default Hero;
