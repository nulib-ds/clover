import React, { useState } from "react";

import * as Clover from "../../parts";
import type { RootProps } from "../../parts";
import { Lightbox, preloadLightbox } from "../shared/Lightbox";

export type GalleryProps = Omit<RootProps, "children"> & {
  /** The size of a grid cell. Default `10rem`, through `--clover-items-size`. */
  size?: string;
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The lightbox's title is a level below it. Default 2.
   */
  headingLevel?: number;
};

/** The heading level under another. Past 6, the parts' titles name what they head. */
const below = (level: number) => level + 1;

/**
 * A grid of the Manifest's views — a spread is one cell — that opens one in a lightbox
 * with the Body and the pager. Escape, the close button, or a press outside closes it,
 * and focus returns to the cell.
 */
export function Gallery({
  className,
  size,
  headingLevel = 2,
  style,
  ...root
}: GalleryProps) {
  const [open, setOpen] = useState(false);
  // Past h6 the title is no heading, and names the Viewer instead (`Clover.titled`).
  const title = Clover.titled(
    headingLevel,
    `${Clover.useUniqueId().replace(/:/g, "")}-title`,
  );
  return (
    <Clover.Root
      className={["clover-template-gallery", className]
        .filter(Boolean)
        .join(" ")}
      style={
        size
          ? ({ ...style, "--clover-items-size": size } as React.CSSProperties)
          : style
      }
      // The lightbox's Body loads as the reader reaches for the gallery, not with the page.
      onPointerOver={preloadLightbox}
      onFocus={preloadLightbox}
      {...title.group}
      {...root}
    >
      <header className="clover-template-gallery-header">
        <Clover.Label
          as={title.as}
          className="clover-template-gallery-title clover-template-title"
          {...title.title}
        />
        <Clover.Summary className="clover-template-gallery-summary" />
      </header>
      <Clover.Status />
      <Clover.Items layout="grid" onSelect={() => setOpen(true)} />
      <Lightbox
        open={open}
        onClose={() => setOpen(false)}
        headingLevel={below(headingLevel)}
      />
    </Clover.Root>
  );
}
