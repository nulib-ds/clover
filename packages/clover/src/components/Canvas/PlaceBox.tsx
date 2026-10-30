import React from "react";

import { Close } from "../Body/glyphs";
import { GivenMap } from "../Map/MapView";
import Button from "../../ui/Button";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { type LanguageMapLike, localize } from "../../core/value";
import { useOneOpen } from "../../ui/useOneOpen";
import { languageProps } from "../../i18n/direction";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * Where something is on the Earth, on a map, in a box the Canvas opens as it opens its
 * information (`Body/Caption.css`, `ControlMenu.css`), one popup at a time (`useOneOpen`):
 * a picked annotation's place (Cookbook 0139: a map in a pamphlet, tagged with the place
 * it shows; Mat, 2026-10-29: "a large metadata style popover of the canvas to show the
 * actual Map component"), or the Canvas's `navPlace`, else its Manifest's, from the map
 * control (Cookbook 0154). A map of the place, the whole box, with Close over its zoom
 * controls (Mat, 2026-10-29: "don't show the label … extend map to the top. slot the close
 * in above the + / - zoom controls"); its name, out of sight, names the box. Closed by its
 * Close, by Escape, or as another popup opens. Loaded with MapLibre only as it first opens.
 */
export default function PlaceBox({
  id,
  open,
  onClose,
  feature,
  name,
  language,
}: {
  id: string;
  open: boolean;
  /** Close, giving focus back to what opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
  /** Its place: a GeoJSON `Feature`, `FeatureCollection` or geometry. */
  feature: unknown;
  /** What it is called: a place's `label`, else what holds it. */
  name?: LanguageMapLike;
  language?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  useOneOpen(open, () => onClose(false));
  const heading = localize(name, language);
  return (
    <div
      className="clover-canvas-caption clover-canvas-place"
      data-open={open}
      data-testid="clover-canvas-place"
      id={id}
      role="group"
      aria-labelledby={heading.text ? `${id}-name` : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }}
    >
      <Button
        className="clover-canvas-caption-close"
        id={`close-${id}`}
        label={t("commonClose")}
        lang={langOf("commonClose")}
        onClick={() => onClose(true)}
      >
        <Close />
      </Button>
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
          forwardedRef={null}
          landmark={false}
          list={false}
          language={language}
        />
      )}
    </div>
  );
}
