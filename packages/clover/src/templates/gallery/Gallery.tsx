import React, { useState } from "react";

import * as Clover from "../../parts";
import type { RootProps } from "../../parts";
import { Lightbox } from "../shared/Lightbox";

export type GalleryProps = Omit<RootProps, "children"> & {
  /** The size of a grid cell. Default `10rem`, through `--clover-items-size`. */
  size?: string;
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The lightbox's title is a level below it. Default 2.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

/** The heading level under another, no deeper than 6. */
const below = (level: number) => Math.min(level + 1, 6) as 2 | 3 | 4 | 5 | 6;

/**
 * A grid of the Manifest's views — a spread is one cell — that opens one in a lightbox
 * with the stage and the pager. Escape, the close button, or a press outside closes it,
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
      {...root}
    >
      <header className="clover-template-gallery-header">
        <Clover.Label
          as={`h${headingLevel}`}
          className="clover-template-gallery-title"
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
