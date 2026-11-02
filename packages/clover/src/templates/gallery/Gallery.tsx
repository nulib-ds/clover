import React, { useCallback, useState } from "react";

import * as Clover from "../../parts";
import type {
  ItemsLayout,
  ItemsProps,
  PanelLayout,
  RootProps,
} from "../../parts";
import { useGivenAnnotations } from "../shared/givenAnnotations";
import { Lightbox, preloadLightbox } from "../shared/Lightbox";

export type GalleryProps = Omit<RootProps, "children"> & {
  /** The size of a grid cell. Default `10rem`, through `--clover-items-size`. */
  size?: string;
  /**
   * The Gallery's height: `"auto"` (the default) grows with its grid; a number (pixels)
   * or any CSS length fixes it, its padding inside, and the grid scrolls under the header.
   */
  height?: number | string;
  /**
   * The space between the grid's cells: a number (pixels) or any CSS length. Default the
   * Gallery's inset, `--clover-inset`.
   */
  gap?: number | string;
  /**
   * The grid, as its Items' layout: `grid`, square cells, or `masonry`, each picture at
   * its own proportions. Default `grid`.
   */
  items?: Extract<ItemsLayout, "grid" | "masonry">;
  /**
   * The line under each cell's label, where it has one (a Collection's members do): its
   * `summary`, its `navDate`, or `none`. Default `summary`.
   */
  secondary?: ItemsProps["secondary"];
  /**
   * The resource's summary under the title, cut to two lines with Read more under it where
   * it runs longer. Default `true`; `false` leaves it out, the title alone over the grid.
   */
  summary?: boolean;
  /**
   * How the lightbox moves on from the view it shows: a short strip of thumbnails
   * (`slider`, Items' carousel), or `pager`, Previous, the position and Next. Default
   * `slider`.
   */
  lightboxItems?: "slider" | "pager";
  /**
   * The information panel beside the lightbox's view, as Default's and Document's is
   * beside theirs, and its toggle. Default `true`.
   */
  panel?: boolean;
  /**
   * Whether the panel starts open beside the lightbox's view. Default `true`. Where it has
   * no room there and would slide over the view, it starts closed.
   */
  defaultPanelOpen?: boolean;
  /** How the panel lays out its sections: `"accordion"` (the default) or `"tabs"`. */
  panelLayout?: PanelLayout;
  /** The downloads in the panel's About, where there is a `rendering`. Default `true`. */
  download?: boolean;
  /**
   * The languages to read the resource in, beside the panel's About heading, where what
   * it says of itself comes in several (the Panel's `languages`). Default `true`.
   */
  languages?: boolean;
  /**
   * Where the panel's width is remembered once the reader drags its bar
   * (`localStorage`). Default `"clover-template-gallery"`; `false` forgets it.
   */
  storageKey?: string | false;
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The lightbox's title is a level below it. Default 2.
   */
  headingLevel?: number;
  /**
   * When the Body's view controls (zoom, the turns, reset, full screen) wait behind
   * More: `"auto"` (the default), only where its row cannot hold them all; `"always"`.
   * Its lightbox's Body's `collapseControls`.
   */
  collapseControls?: "auto" | "always";
};

/** The heading level under another. Past 6, the parts' titles name what they head. */
const below = (level: number) => level + 1;

const length = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;

/**
 * A grid framed by what it opens, that opens a cell in a lightbox with the Body and the
 * pager. A Manifest: its title and summary, and a cell for each view (a spread is one
 * cell). A Collection: its own title and summary, and a cell for each member, which
 * shows that Manifest in the lightbox. Escape, the close button, or a press outside
 * closes it, and focus returns to the cell.
 */
export function Gallery({
  className,
  size,
  height = "auto",
  gap,
  items = "grid",
  secondary,
  summary = true,
  lightboxItems = "slider",
  panel = true,
  defaultPanelOpen = true,
  panelLayout = "accordion",
  download = true,
  languages = true,
  storageKey = "clover-template-gallery",
  headingLevel = 2,
  collapseControls,
  style,
  ...root
}: GalleryProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // Past h6 the title is no heading, and names the Viewer instead (`Clover.titled`).
  const title = Clover.titled(
    headingLevel,
    `${Clover.useUniqueId().replace(/:/g, "")}-title`,
  );
  const fixed = height !== "auto";
  const vars = {
    ...(size && { "--clover-items-size": size }),
    ...(fixed && { "--clover-template-gallery-height": length(height) }),
    ...(gap != null && { "--clover-template-gallery-gap": length(gap) }),
  } as React.CSSProperties;
  return (
    <Clover.Root
      className={["clover-template-gallery", className]
        .filter(Boolean)
        .join(" ")}
      style={{ ...style, ...vars }}
      data-height={fixed ? "fixed" : "auto"}
      // The lightbox's Body loads as the reader reaches for the gallery, not with the page.
      onPointerOver={preloadLightbox}
      onFocus={preloadLightbox}
      {...title.group}
      {...root}
    >
      <GalleryGrid
        title={title}
        // Its grid is a grid or masonry; anything else (an element's attribute) a grid.
        layout={items === "masonry" ? "masonry" : "grid"}
        secondary={secondary}
        summary={summary}
        onOpen={() => setOpen(true)}
      />
      <Lightbox
        open={open}
        onClose={close}
        headingLevel={below(headingLevel)}
        items={lightboxItems}
        panel={panel}
        defaultPanelOpen={defaultPanelOpen}
        panelLayout={panelLayout}
        download={download}
        languages={languages}
        storageKey={storageKey}
        collapseControls={collapseControls}
      />
    </Clover.Root>
  );
}

function GalleryGrid({
  title,
  layout,
  secondary,
  summary,
  onOpen,
}: {
  title: ReturnType<typeof Clover.titled>;
  layout: NonNullable<GalleryProps["items"]>;
  secondary: GalleryProps["secondary"];
  summary: boolean;
  onOpen: () => void;
}) {
  // Opened as a Collection, the Root shows a member at a time: the grid is the
  // Collection's, its title and summary too.
  const collection = Clover.useCloverSelector((state) =>
    state.throughCollection ? state.collection : null,
  );
  /*
   * Opened on annotations (an AnnotationPage of tags across Manifests, as James Turner's;
   * Mat, 2026-11-01), the Root shows the Manifest of the one picked: the grid is the
   * annotations, a cell for each, titled by their page. Not an AnnotationCollection a
   * Manifest's pages are part of (Cookbook 0309): that Manifest's views are its grid.
   */
  const set = useGivenAnnotations();
  return (
    <>
      <header className="clover-template-gallery-header">
        <Clover.Label
          as={title.as}
          className="clover-template-gallery-title clover-template-title clover-title"
          label={
            (set ? set.label : collection?.label) as Clover.LabelProps["label"]
          }
          {...title.title}
        />
        {/* Annotations have no summary of their own: the Manifest's is not theirs. */}
        {summary && !set && (
          <Clover.Summary
            className="clover-template-gallery-summary"
            value={collection?.summary}
          />
        )}
      </header>
      {/*
       * Choosing a member loads it, which the lightbox's Body shows. A "Loading…" here
       * would push the grid down and back up as it came and went: once the Collection
       * is in, the Status only announces.
       */}
      <Clover.Status loading={collection || set ? false : undefined} />
      {/* A grid even of one view: the gallery is its items, and one still opens. */}
      <Clover.Items
        layout={layout}
        secondary={secondary}
        of={set ? "annotations" : collection ? "members" : "views"}
        singleItem
        onSelect={onOpen}
      />
    </>
  );
}
