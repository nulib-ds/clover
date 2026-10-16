import Playground, {
  type PlaygroundHandle,
} from "docs/components/Playground/Playground";
import React, { useRef, useState } from "react";
import Hero from "docs/components/Home/Hero";
import Link from "next/link";
import Parts from "docs/components/Home/Parts";
import styles from "docs/components/Home/Home.module.css";

const features = [
  {
    label: "Accessible",
    title: "WAI-ARIA design patterns",
    body: "Keyboard navigation, focus and motion preferences in every part.",
  },
  {
    label: "Composable",
    title: "Templates, or parts",
    body: "Take the Viewer in a template, or build a layout of your own from the parts the templates are made of.",
  },
  {
    label: "Yours",
    title: "Inherits your page",
    body: "Clover sets no font and steps every space from your 1rem. Colours are CSS custom properties: set one on any ancestor.",
  },
  {
    label: "Light",
    title: "Ships what you draw",
    body: "The Viewer is a 1 kB shell, so a page carries only the template and parts it uses. Its renderer replaces OpenSeadragon.",
  },
];

/**
 * The homepage, for Clover 4.
 *
 * Rendered from a thin `pages/index.mdx` shell rather than being a `pages/*.tsx` route of
 * its own: a plain Next page bypasses Nextra's layout entirely, which takes the navbar,
 * search, theme toggle and banner with it. Going through MDX with `theme.layout: "raw"`
 * (set in `pages/_meta.json`) keeps that chrome while giving this component the full
 * content area.
 *
 * Two halves: the templates, live, as the hero (`<Playground/>`), and below them the same
 * resource taken apart into the parts they are made of (`<Parts/>`), following it.
 */
const Homepage: React.FC = () => {
  const playground = useRef<PlaygroundHandle>(null);
  const [resource, setResource] = useState<string | null>(null);
  return (
    <div className={styles.page}>
      <Hero />

      <main className={styles.shell}>
        <Playground
          ref={playground}
          onResourceChange={(next) => setResource(next)}
        />

        <Parts
          resource={resource}
          onTry={(key) => playground.current?.pickResource(key)}
        />

        <div className={styles.contained}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Why Clover</h2>
              <p className={styles.sectionNote}>
                Reads IIIF Presentation 2, 3 and 4, from the parts up.
              </p>
            </div>
            <Link href="/docs" className={styles.sectionLink}>
              Read the docs →
            </Link>
          </div>

          <div className={styles.features}>
            {features.map((feature) => (
              <div className={styles.feature} key={feature.label}>
                <p className={styles.featureLabel}>{feature.label}</p>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureBody}>{feature.body}</p>
              </div>
            ))}
          </div>

          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Install</h2>
              <p className={styles.sectionNote}>
                Clover 4 is in development and not on npm yet. The released
                Clover is <Link href="/docs/3.x">3.x</Link>,{" "}
                <code>@samvera/clover-iiif</code>.
              </p>
            </div>
          </div>

          <div className={styles.install}>
            <code className={styles.installCode}>
              npm install @nulib/clover
            </code>
            <Link href="/docs" className="cta-solid">
              Get started
              <span className="cta-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Homepage;
