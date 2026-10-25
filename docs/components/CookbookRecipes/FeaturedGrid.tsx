import React from "react";

import { featuredItems } from "docs/components/CookbookRecipes/featuredItems";
import styles from "docs/components/CookbookRecipes/FeaturedGrid.module.css";
import { example } from "docs/lib/example";

interface FeaturedGridProps {
  /** Opens a resource in the viewer. Keep it stable: the grid renders once. */
  onView: (resource: string) => void;
  /** Called when a card is approached, so the viewer can load ahead of the click. */
  onPreload?: () => void;
}

/** A grid of items to open in the Viewer with one click. Memoized for the same reason as the table. */
const FeaturedGrid: React.FC<FeaturedGridProps> = ({ onView, onPreload }) => {
  return (
    <section
      className={styles.container}
      aria-label="Example items"
      {...example()}
    >
      <ul className={styles.grid}>
        {featuredItems.map((featured) => (
          <li key={featured.resource}>
            <button
              type="button"
              className={styles.card}
              onClick={() => onView(featured.resource)}
              onPointerEnter={onPreload}
              onFocus={onPreload}
            >
              {/* Static export with unoptimized images: next/image has nothing to add for a remote thumbnail. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.thumbnail}
                src={featured.thumbnail}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span className={styles.title} dir="auto">
                {featured.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default React.memo(FeaturedGrid);
