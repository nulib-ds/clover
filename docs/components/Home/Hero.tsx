import React from "react";
import styles from "docs/components/Home/Home.module.css";

/**
 * The hero: the page's headline, and the sentence that says what Clover does.
 *
 * No call-to-action buttons. The playground sits directly below and is itself the
 * invitation, so a "Try the components" link pointed at something already on screen,
 * and "Get started" duplicated both the navbar's Documentation link and the button on
 * the install panel further down.
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
        Design the user experience you imagine for your IIIF resources.
      </p>
    </div>
  </header>
);

export default Hero;
