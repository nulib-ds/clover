import React, { useRef } from "react";
import dynamic from "next/dynamic";
import styles from "docs/components/Home/Parts.module.css";

/*
 * The parts run in the browser only: the renderer needs one, and the homepage is drawn on
 * the server, where Clover's modules are not to be imported (see AGENTS.md).
 */
const PartsLive = dynamic(() => import("docs/components/Home/PartsLive"), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

/**
 * The homepage's second half: the resource in the playground above, taken apart into the
 * parts every template is made of (`PartsLive.tsx`). It follows the playground: pick
 * another resource there and other parts light up here.
 */
const Parts: React.FC<{
  /** The playground's resource: an address or a content state. */
  resource: string | null;
  /** Put one of the playground's resources on its stage, by key. */
  onTry: (key: string) => void;
}> = ({ resource, onTry }) => {
  // A chip's resource remounts the parts, chip and all, so focus moves here first.
  const heading = useRef<HTMLHeadingElement>(null);
  const tryResource = (key: string) => {
    onTry(key);
    heading.current?.focus({ preventScroll: true });
  };
  return (
    <section className={styles.section}>
      {/*
       * `#parts` for links to the section. Its call to action, "Build a layout", is over
       * it, under the playground's stage, beside the template picker.
       */}
      <h2
        ref={heading}
        tabIndex={-1}
        className={styles.visuallyHidden}
        id="parts"
      >
        Parts
      </h2>
      {resource ? (
        <PartsLive resource={resource} onTry={tryResource} />
      ) : (
        <div className={styles.placeholder} aria-hidden="true" />
      )}
    </section>
  );
};

export default Parts;
