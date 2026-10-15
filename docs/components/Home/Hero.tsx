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
        Imagine a viewer <span className={styles.mark}>built by you</span>.
      </h1>
      <p className={styles.subtitle}>
        Share your distinctive collections through a lightweight, accessible,
        and modular viewer designed for IIIF Manifests, Collections, and the
        material they describe.
      </p>
    </div>
  </header>
);

export default Hero;
