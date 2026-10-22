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
 *
 * What follows the parts ("Why Clover", `children`) shares their grid, in the parts'
 * column, so the example viewer stays held beside it, and a story there with a
 * `data-point` (a part's key, or `viewer`) outlines that part, or every part, in the
 * viewer, with a line drawn to it, while it is in the middle of the window. Drawn here, on the server, so
 * it is the page's own text before the parts load.
 */
const Parts: React.FC<{
  /** The playground's resource: an address or a content state. */
  resource: string | null;
  /** Put one of the playground's resources on its stage, by key. */
  onTry: (key: string) => void;
  /**
   * The parts, listed (`PartsIndex.tsx`, drawn on the server): out of sight until the live
   * parts take its place, for a reader without the page's scripts.
   */
  index?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ resource, onTry, index, children }) => {
  // A chip's resource remounts the parts, chip and all, so focus moves here first.
  const heading = useRef<HTMLHeadingElement>(null);
  const tryResource = (key: string) => {
    onTry(key);
    heading.current?.focus({ preventScroll: true });
  };
  return (
    <section className={styles.section}>
      {/*
       * `#parts` for links to the section. The calls to action over it, under the
       * playground's stage, lead to the docs.
       */}
      <h2
        ref={heading}
        tabIndex={-1}
        className={styles.visuallyHidden}
        id="parts"
      >
        Parts
      </h2>
      <div className={styles.grid}>
        {resource ? (
          <PartsLive resource={resource} onTry={tryResource} />
        ) : (
          <div className={styles.placeholder}>
            {/* Out of the site's search, which finds each part on its own page. */}
            {index && (
              <div className={styles.visuallyHidden} data-pagefind-ignore="">
                {index}
              </div>
            )}
          </div>
        )}
        {children && <div className={styles.after}>{children}</div>}
      </div>
    </section>
  );
};

export default Parts;
