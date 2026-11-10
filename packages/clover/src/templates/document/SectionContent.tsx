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
                <path {...LINE} d={FRAME} />
                <rect stroke="none" {...BOX} />
                <path {...LINE} d="M429.77 82.2L312 200M424 200H312V88" />
              </MapButton>
            </div>
          )}
        </div>
      );
    case "transcript":
      return <Clover.Transcript sticky size="small" />;
    case "annotations":
      return <Clover.Annotations headingLevel={headingLevel} />;
    default:
      return null;
  }
}

/**
 * The aside's map, expanded over the pages' column (`Document.tsx`): the whole column,
 * its zoom row then Collapse map and Close at its top end, as the Canvas's map box is
 * when it fills its Body (`Caption.css`). Collapse map puts it back in the aside; Close,
 * or Escape in it, puts it away.
 */
export function ExpandedMap({
  collapseId,
  onCollapse,
  onClose,
}: {
  collapseId: string;
  onCollapse: () => void;
  onClose: () => void;
}) {
  return (
    // Escape in it, from wherever focus is in it.

    <div
      className="clover-template-document-map"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <Clover.Map />
      <div className="clover-template-document-map-actions">
        <MapButton id={collapseId} label="mapCollapse" onClick={onCollapse}>
          <path {...LINE} d={FRAME} />
          <rect stroke="none" {...BOX} />
          <path {...LINE} d="M328 72h112v112M429.77 82.2L312 200" />
        </MapButton>
        <MapButton label="commonClose" onClick={onClose}>
          <path
            fill="none"
            strokeLinecap="round"
            strokeWidth="45"
            d="M154 154L358 358M358 154L154 358"
          />
        </MapButton>
      </div>
    </div>
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

/*
 * Clover's Expand map and Collapse map (`Body/glyphs.tsx`): a frame open at its upper
 * right, a box inside it at the lower left, and an arrow in the opening, in toward the
 * box to expand, out of it to collapse. The aside is at the page's end, so the map grows
 * toward the lower left and goes back to the top right, as the glyphs point (mirrored
 * right to left, `Document.css`).
 */
const LINE = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 40,
} as const;
const FRAME = "M232 72H72V440H440V280";
const BOX = { x: 144, y: 244, width: 124, height: 124, rx: 16 } as const;

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
