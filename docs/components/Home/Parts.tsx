import React from "react";
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
  /** Open one of the playground's resources in its Viewer, by key. */
  onTry: (key: string) => void;
  /** Open a resource the parts moved to (a Collection's member) in the playground. */
  onOpen?: (content: string) => void;
  /**
   * The parts, listed (`PartsIndex.tsx`, drawn on the server): out of sight until the live
   * parts take its place, for a reader without the page's scripts.
   */
  index?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ resource, onTry, onOpen, index, children }) => {
  /*
   * A chip's resource remounts the parts, chip and all, so focus moves first to their
   * heading, "…or build your own." over the tiles (`#parts`, `Playground.tsx`).
   */
  const tryResource = (key: string) => {
    onTry(key);
    document.getElementById("parts")?.focus({ preventScroll: true });
  };
  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        {resource ? (
          <PartsLive resource={resource} onTry={tryResource} onOpen={onOpen} />
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
    </div>
  );
};

export default Parts;
