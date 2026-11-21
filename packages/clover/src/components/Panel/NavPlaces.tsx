import React, { useSyncExternalStore } from "react";

import { PlaceGlyph as Place } from "../../ui/glyphs/Place";
import {
  type MapFeature,
  countPlaces,
  middleOf,
  navPlaceOf,
} from "../../core/geo";
import { selectVisibleCanvases } from "../../core/selectors";
import { languageProps } from "../../i18n/direction";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useClover, useCloverSelector } from "../../react/context";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * Where the resource is, in About, as its date is (Mat, 2026-11-13: "move navplace to the
 * About tab. like how we have navDate"), after its summary ("put this after the summary.
 * before metadata"): the places its `navPlace` names, the Manifest's,
 * then those of the Canvases in view, each by its name, pressed to show it on the map over
 * the Body, which the Body opens filling it, framed on it and marked (`clover.place`), as
 * a georeferenced image in Annotations is. `navPlace` is a property of a resource, never
 * an annotation, so it is said here, with what the resource says of itself. Neither the
 * Collection's place nor another member's, which are the Collection's, nor an
 * annotation's, which its annotation lists. Under each name, its coordinates (Mat,
 * 2026-11-13: "add in muted text the coordinates after this link"). Its own module, with
 * the reader of places (`core/geo.ts`), loaded only where there is one (`About`).
 */
export default function NavPlaces() {
  const { clover, language } = useClover("About");
  const { t, langOf } = useCloverTranslation();
  const features = useCloverSelector((state) =>
    navPlaceOf(state.manifest, state.collection, language),
  );
  const manifestId = useCloverSelector((state) => state.manifest?.id);
  // The Collection's own come first among the Root's places, and are not this resource's.
  const theirs = useCloverSelector((state) =>
    countPlaces((state.collection as { navPlace?: unknown } | null)?.navPlace),
  );
  const shown = useCloverSelector((state) =>
    selectVisibleCanvases(state.manifest, state.canvasId),
  );
  const asked = useSyncExternalStore(
    clover.place.subscribe,
    clover.place.get,
    clover.place.get,
  );
  const show = {
    text: t("annotationsShowPlace"),
    lang: langOf("annotationsShowPlace"),
  };
  // Keyed as the Root's map keys its places, `place-<index>`, so the map frames the one.
  const rows = features.features.flatMap((feature, index) => {
    const { annotationId, canvasId, manifestId: member } = feature.properties;
    if (index < theirs || annotationId) return [];
    const ours = canvasId
      ? shown.some((canvas) => canvas.id === canvasId)
      : !member || member === manifestId;
    if (!ours) return [];
    const { title, titleLang } = feature.properties;
    const name = title
      ? { text: title, lang: titleLang }
      : {
          text: t("mapPlaceUntitled", { number: index + 1 }),
          lang: langOf("mapPlaceUntitled"),
        };
    return [{ key: `place-${index}`, name, at: coordinates(feature) }];
  });
  if (!rows.length) return null;
  return (
    <ul className="clover-about-places">
      {rows.map(({ key, name, at }) => (
        <li key={key}>
          <button
            type="button"
            className="clover-about-open clover-about-place"
            aria-pressed={asked === key}
            onClick={() => clover.place.emit(key)}
          >
            {/* What it does, for assistive technology; the name for all. */}
            <span style={visuallyHidden} {...languageProps(show.lang)}>
              {show.text}:
            </span>{" "}
            <span {...languageProps(name.lang)}>{name.text}</span>
          </button>
          {/*
           * Its coordinates under it, after the map control's pin (Mat, 2026-11-13: "put the
           * link on top. svg and coordinates below"), their figures read left to right
           * whatever the page's direction.
           */}
          {at && (
            <span className="clover-about-place-at">
              <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false">
                <Place />
              </svg>
              <bdi dir="ltr">{at}</bdi>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Rounded to four places, some eleven meters, with no trailing zeros. */
const round = (degrees: number) => String(Math.round(degrees * 1e4) / 1e4);

/**
 * Where a place is, latitude then longitude, as a map's search takes them: a point's own,
 * else the middle of its shape (`middleOf`). None for a place with no position.
 */
function coordinates(feature: MapFeature): string | null {
  const middle = middleOf(feature.geometry);
  return middle && `${round(middle[1])}, ${round(middle[0])}`;
}
