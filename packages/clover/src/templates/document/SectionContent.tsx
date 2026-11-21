import React from "react";

import * as Clover from "../../parts";
import type { PanelSection } from "../../parts";

type Json = Record<string, any>;

/**
 * A section's content, alone in Document's aside (`Document.tsx`), from the parts Clover
 * draws each with: About, the views of a content state, the Collection, the contents,
 * the search's hits, the map of the view, its transcript and its annotations. A module of
 * its own, loaded as the aside first opens, so a page that opens none never loads them
 * (Mat, 2026-11-09: "sections should not stack as accordions or act as tabs for the
 * Panel component. they should be their own custom aside with content").
 */
export default function SectionContent({
  section,
  headingLevel,
  pages = [],
  expandMapId,
  onExpandMap,
  places = false,
}: {
  section: PanelSection;
  /**
   * The pages in view that describe themselves, for About (`marks.ts`): handed down, so
   * this module, loaded apart, takes nothing from Document's own.
   */
  pages?: readonly Json[];
  /** The level of the section's own headings: a level under the aside's. */
  headingLevel: number;
  /** The map's Expand map button's id. */
  expandMapId?: string;
  /** Expands the map over the pages (`ExpandedMap`). */
  onExpandMap?: () => void;
  /**
   * Whether Annotations lists the georeferenced images: only where the Map section is not
   * offered.
   */
  places?: boolean;
}) {
  switch (section) {
    case "about":
      /*
       * The toolbar has the downloads, and its globe the languages, the resource's and
       * Clover's interface languages both (Mat, 2026-11-10: "remove lang from the about
       * on document").
       */
      return (
        <>
          <Clover.About
            headingLevel={headingLevel}
            download={false}
            languages={false}
            interfaceLanguages={false}
          />
          <PageAbout pages={pages} headingLevel={headingLevel} />
        </>
      );
    case "targets":
      return <Clover.Items of="targets" layout="list" />;
    case "collection":
      return <Clover.Collection headingLevel={headingLevel} />;
    case "contents":
      return <Clover.Contents />;
    case "search":
      // Its field is the toolbar's (`Document.css`): here, its hits.
      return <Clover.Search headingLevel={headingLevel} size="small" />;
    case "map":
      // Its Expand map at its top end, beside its zoom row (`Document.css`).
      return (
        <div className="clover-template-document-map-box">
          <Clover.Map />
          {onExpandMap && (
            <div className="clover-template-document-map-actions">
              <MapButton
                id={expandMapId}
                label="mapExpand"
                onClick={onExpandMap}
              >
                {/*
                 * The aside is at the page's end, so the map grows toward the lower
                 * left, as Expand points (mirrored right to left, `Document.css`).
                 */}
                <Clover.ExpandGlyph />
              </MapButton>
            </div>
          )}
        </div>
      );
    case "transcript":
      return <Clover.Transcript sticky size="small" />;
    case "annotations":
      // Its georeferenced images are the Map section's, where Document offers one.
      return <Clover.Annotations headingLevel={headingLevel} places={places} />;
    default:
      return null;
  }
}

/**
 * The map over the pages' column (`Document.tsx`), shown for a place asked for (`asked`:
 * About's places, Annotations' georeferenced images), which it frames, as it follows the
 * Root's `place`, or expanded from the aside's Map section, where `panelSections` names
 * one. It and the page trade places (Mat, 2026-11-13: "in the top right corner, show the
 * image inset into a box. like we do on default viewer for the map control overlaying the
 * image. one should be able to swap between the two"): filling the column, its zoom row
 * centered at its foot, it has the page's picture in a box at its top end, Collapse map,
 * which puts it in a box of its own over the pages there instead (`inset`), as the
 * Canvas's map box sits over the Body in Default, with Expand map, to trade them back, and
 * Close. Its map is one map throughout, so it keeps its place. Escape in it puts it away.
 */
export function ExpandedMap({
  id,
  swapId,
  container,
  inset,
  onSwap,
  onClose,
  asked = false,
}: {
  /** Its id, for the Map control that shows it (`aria-controls`). */
  id: string;
  /** Its swap's id, Collapse map's or Expand map's, which focus follows. */
  swapId: string;
  /** Where it lies: its Body in the full viewer (`"body"`), else over the pages. */
  container: HTMLElement | "body";
  /** In a box over the pages, as the Canvas's map box is over the Body. */
  inset: boolean;
  /** Trades the map and the page. */
  onSwap: () => void;
  onClose: () => void;
  /** Shown for a place asked for: a phone's aside hands focus to it (`useAwayForPlaces`). */
  asked?: boolean;
}) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  // Its Close, on the map's box: the page's picture over the map has its own.
  const closer = (
    <MapButton label="commonClose" onClick={onClose}>
      {CLOSE}
    </MapButton>
  );
  return (
    // Escape in it, from wherever focus is in it.

    <Clover.Inset
      id={id}
      container={container}
      // Not in its box, the map over the pages: what its class lays out.
      expanded={!inset}
      className="clover-template-document-map"
      label={t("mapExpand")}
      lang={langOf("mapExpand")}
      expandId={swapId}
      onExpand={onSwap}
      actions={closer}
      // It waits out of sight until its map has drawn, then comes in (`Map.css`).
      data-map-host
      data-asked={asked ? "" : undefined}
      data-inset={inset || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      {/*
       * The map, its one child, so it stays the one map as the two trade places; over it,
       * in its box (`children`), the page's picture in the same box, which trades them,
       * hanging under its zoom row, whose Tips lie over it (Mat, 2026-11-14: "This is a
       * little too far off the controls above it."), with Close after its Collapse map, as
       * the map's box has after Expand map (Mat, 2026-11-16: "include close button here as
       * well"), which puts it away, as the map's Image control does, which brings it back
       * (`Clover.useMapPutAway`), never the map under it.
       */}
      <Clover.Map navigable={!inset}>
        {!inset && (
          <Clover.Inset
            className="clover-template-document-map-page"
            label={t("mapCollapse")}
            lang={langOf("mapCollapse")}
            expandId={swapId}
            onExpand={onSwap}
            actions={<PageClose />}
          >
            <Clover.Thumbnail of="canvas" alt="" size={720} />
          </Clover.Inset>
        )}
      </Clover.Map>
    </Clover.Inset>
  );
}

// Clover's Close, as the Canvas's controls draw it.
const CLOSE = <Clover.CloseGlyph />;

/** Close on the page's picture over the map: puts the picture away, as Image does. */
function PageClose() {
  const putAway = Clover.useMapPutAway();
  return (
    <MapButton label="commonClose" onClick={() => putAway?.()}>
      {CLOSE}
    </MapButton>
  );
}

/** One of Clover's round controls, named by its words in Clover's interface language. */
function MapButton({
  id,
  label,
  onClick,
  children,
}: {
  id?: string;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  return (
    <button
      id={id}
      type="button"
      className="clover-canvas-button"
      lang={langOf(label)}
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 512 512"
        fill="currentColor"
        stroke="currentColor"
      >
        {children}
      </svg>
      <span style={Clover.visuallyHidden}>{t(label)}</span>
      <Clover.Tip label={t(label)} />
    </button>
  );
}

/**
 * Each page in sight that describes itself, after the resource's About: its label, at
 * the level of the resource's own, then its summary and metadata, as the Canvas's
 * information shows them in the other layouts, which Document's pages do not offer (Mat,
 * 2026-11-10: "remove the metadata i at the canvas level"). The toolbar's About is marked
 * while there is one (`marks.ts`).
 */
function PageAbout({
  pages,
  headingLevel,
}: {
  pages: readonly Json[];
  headingLevel: number;
}) {
  if (!pages.length) return null;
  const title = (
    headingLevel <= 6 ? `h${headingLevel}` : "p"
  ) as React.ElementType;
  return (
    <>
      {pages.map((canvas) => (
        <div
          key={canvas.id}
          className="clover-about clover-template-document-page-about"
        >
          {canvas.label && (
            <Clover.Label
              label={canvas.label}
              as={title}
              className="clover-about-label clover-title"
            />
          )}
          {canvas.summary && (
            <Clover.Summary
              value={canvas.summary}
              className="clover-about-summary"
            />
          )}
          {canvas.metadata?.length > 0 && (
            <Clover.Metadata
              value={canvas.metadata}
              className="clover-about-metadata"
            />
          )}
        </div>
      ))}
    </>
  );
}
