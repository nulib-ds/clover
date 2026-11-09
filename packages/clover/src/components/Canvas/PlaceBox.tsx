import React, { useMemo } from "react";

import { Close, CollapseMap, ExpandMap } from "../Body/glyphs";
import { GivenMap } from "../Map/MapView";
import { canvasGeoreferences } from "../../core/geo";
import Button from "../../ui/Button";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { type LanguageMapLike, localize } from "../../core/value";
import { useOneOpen } from "../../ui/useOneOpen";
import { languageProps } from "../../i18n/direction";
import { useContainerName } from "../../i18n/useContainerName";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * Where something is on the Earth, on a map, in a box the Canvas opens as it opens its
 * information (`Body/Caption.css`, `ControlMenu.css`), one popup at a time (`useOneOpen`):
 * a picked annotation's place (Cookbook 0139: a map in a pamphlet, tagged with the place
 * it shows; Mat, 2026-10-29: "a large metadata style popover of the canvas to show the
 * actual Map component"), or the Canvas's `navPlace`, else its Manifest's, from the map
 * control (Cookbook 0154), with the georeferenced images of the Canvases in view warped
 * onto it by their control points (Georeference Extension). A map of the place, the whole
 * box (Mat, 2026-10-29: "don't show the label … extend map to the top"), its Expand map
 * button and Close ending the map's zoom row in its top corner (Mat, 2026-11-08); its name,
 * out of sight, names the box. Closed by its Close, by Escape, or as another popup opens.
 * Its Expand map button puts the map in the Canvas's place, filling the Body, and the Canvas
 * away, kept as it was; pressed again, the Canvas comes back (Mat, 2026-11-08).
 * Loaded with MapLibre only as it first opens.
 */
export default function PlaceBox({
  id,
  open,
  onClose,
  swapped = false,
  onSwap,
  feature,
  name,
  canvases,
  owner,
  language,
}: {
  id: string;
  open: boolean;
  /** Close, giving focus back to what opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
  /** Whether its map and the Canvas have traded places: the map fills the Body. */
  swapped?: boolean;
  /** Trade them, or trade them back; without it, no swap control. */
  onSwap?: () => void;
  /** Its place: a GeoJSON `Feature`, `FeatureCollection` or geometry. */
  feature: unknown;
  /** What it is called: a place's `label`, else what holds it. */
  name?: LanguageMapLike;
  /** The Canvases in view, whose georeferenced images it overlays. */
  canvases?: readonly unknown[];
  /** What its place belongs to (the Canvas shown), whose picture it shows over its name. */
  owner?: unknown;
  language?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  const overlays = useMemo(
    () =>
      (canvases ?? []).flatMap((canvas) =>
        canvasGeoreferences(canvas as never),
      ),
    [canvases],
  );
  useOneOpen(open, () => onClose(false));
  const heading = localize(name, language);
  // A place with no label: the box is named for what it holds, in Clover's language.
  const fallback = useContainerName(
    t("mapLabel"),
    langOf("mapLabel"),
    Boolean(heading.text),
  );
  return (
    <div
      className="clover-canvas-caption clover-canvas-place"
      data-open={open}
      data-swapped={swapped || undefined}
      data-testid="clover-canvas-place"
      id={id}
      role="group"
      aria-labelledby={heading.text ? `${id}-name` : undefined}
      {...fallback.props}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }}
    >
      <div className="clover-canvas-place-actions">
        {onSwap && (
          <Button
            id={`swap-${id}`}
            // Named for what it does now, its glyph with it (Mat, 2026-11-08).
            label={t(swapped ? "mapCollapse" : "mapExpand")}
            lang={langOf(swapped ? "mapCollapse" : "mapExpand")}
            onClick={onSwap}
          >
            {swapped ? <CollapseMap /> : <ExpandMap />}
          </Button>
        )}
        <Button
          className="clover-canvas-caption-close"
          id={`close-${id}`}
          label={t("commonClose")}
          lang={langOf("commonClose")}
          onClick={() => onClose(true)}
        >
          <Close />
        </Button>
      </div>
      {fallback.node}
      {heading.text && (
        <p
          id={`${id}-name`}
          style={visuallyHidden}
          {...languageProps(heading.lang)}
        >
          {heading.text}
        </p>
      )}
      {open && (
        <GivenMap
          navPlace={feature}
          overlays={overlays}
          owner={owner}
          reframe={swapped}
          forwardedRef={null}
          landmark={false}
          list={false}
          language={language}
        />
      )}
    </div>
  );
}
