import React from "react";

import { Place as PlaceGlyph } from "../Body/glyphs";
import { overlayItems } from "../Map/overlayItems";
import { georeferencesOf } from "../../core/geo";
import type { Manifest } from "../../core/presentation";
import type { ThumbnailSource } from "../../core/thumbnail";
import { type LocalizedValue, localize } from "../../core/value";
import type { CloverRequest } from "../../core/request";
import { langWithin } from "../../i18n/config";
import { languageProps } from "../../i18n/direction";
import { EntryThumbnail } from "../../ui/EntryThumbnail";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * The georeferenced images of the Root's resource (Georeference Extension annotations), as
 * Annotations lists them: under their Canvas with its annotations, as every annotation is
 * listed, by sheet, never by the page it was published on or what it is for (Mat,
 * 2026-11-16: "make it so georeferencing annotations are handled by Page on other items.
 * don't categorize these annotations differently", then "don't organize by motivation.
 * always just organize by sheet"; listed first, apart, under no title, from 2026-11-13).
 * Each is named and pictured as the Map's own list names and pictures it
 * (`overlayItems`): by its label, its picture the map it is, with the map control's pin
 * over its corner ("do leave the map … map icon"). Places (`navPlace`, a property of a
 * resource, never an annotation) are About's (`Panel/NavPlaces`), and an annotation's own
 * place is listed with its annotation.
 *
 * A press on one asks the Body for the Root's map, filling it, framed on that one
 * (`clover.place`); one on another Canvas goes there first. Its own module, loaded only
 * where the Root has a georeference, with their reader (`core/geo.ts`).
 */

/** A georeferenced image, as Annotations lists it: keyed as the map's list keys it. */
export interface Place {
  /** `overlay-<id>`, as the map's list keys it, and as `clover.place` asks for it. */
  key: string;
  /** Its annotation's id: what the Root's highlight names, so its map outlines it. */
  overlay: string;
  /** The Canvas it is on. */
  canvasId: string;
  name: LocalizedValue;
  picture: ThumbnailSource | null | undefined;
}

/**
 * The resource's georeferenced images, in the Manifest's order, each with its Canvas, so
 * Annotations lists it there. Those it cannot lay on a map (`readGeoreference`) are left
 * out, as the map leaves them out.
 */
export function placesOf(
  manifest: Manifest | null,
  language: string | undefined,
  untitled: (number: number) => LocalizedValue,
): Place[] {
  const overlays = georeferencesOf(manifest);
  if (!manifest || !overlays.length) return [];
  return overlayItems(
    overlays,
    language,
    (index) => untitled(index + 1),
    "overlay-",
  ).flatMap((item, index): Place[] => {
    const { id, canvasId } = overlays[index];
    if (!canvasId) return [];
    return [
      {
        key: item.id,
        overlay: id,
        canvasId,
        name: localize(item.label, language),
        picture: (item.parts[0] as { source?: ThumbnailSource | null }).source,
      },
    ];
  });
}

/**
 * One georeferenced image in the list, as an annotation is: pressed anywhere to show it on
 * the map, and, for the keyboard, a button out of sight that does the same, "Find on the
 * map" and its name, pressed while the map shows it (`asked`).
 */
export function PlaceEntry({
  place,
  asked,
  pointed,
  show,
  hostLanguage,
  request,
  onAsk,
  onHighlight,
}: {
  place: Place;
  /** The one the map shows (`clover.place`), marked as a picked annotation is. */
  asked: boolean;
  /** Pointed at, in the list or on the map. */
  pointed: boolean;
  /** Clover's interface words for finding it on the map, with their language. */
  show: LocalizedValue;
  hostLanguage?: string;
  request?: CloverRequest;
  onAsk: (place: Place) => void;
  onHighlight: (id: string | null) => void;
}) {
  // Clover's words and the place's: both in the page's language, or each in its own.
  const oneLanguage = !show.lang && !langWithin(place.name.lang, hostLanguage);
  return (
    <li
      className="clover-annotations-entry clover-annotations-place"
      data-entry={place.key}
      data-selected={asked}
      data-highlighted={pointed}
      // Pointed at: the Root's, so its map outlines it.
      onMouseEnter={() => onHighlight(place.overlay)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(place.overlay)}
      onBlur={() => onHighlight(null)}
      // A press anywhere on it; the button below is the keyboard's way in.
      onClick={(event) => {
        if ((event.target as Element).closest("a, button")) return;
        onAsk(place);
      }}
    >
      {/*
        Its picture, the map it is, with the map control's pin over its corner
        (Mat, 2026-11-13: "overlay map icon in corner of thumbnail"): decorative,
        as its button says it is on the map.
      */}
      <span className="clover-annotations-place-picture">
        <EntryThumbnail
          className="clover-annotations-thumbnail"
          source={place.picture}
          request={request}
        />
        <svg
          className="clover-annotations-place-glyph"
          viewBox="0 0 512 512"
          aria-hidden="true"
          focusable="false"
        >
          <PlaceGlyph />
        </svg>
      </span>
      <div className="clover-annotations-body clover-cue-text">
        <p {...languageProps(place.name.lang)}>{place.name.text}</p>
      </div>
      <button
        type="button"
        className="clover-annotations-show"
        aria-pressed={asked}
        aria-label={
          oneLanguage ? `${show.text}: ${place.name.text}` : undefined
        }
        style={visuallyHidden}
        onClick={() => onAsk(place)}
      >
        {!oneLanguage && (
          <>
            <span {...languageProps(show.lang)}>{show.text}:</span>{" "}
            <span {...languageProps(place.name.lang)}>{place.name.text}</span>
          </>
        )}
      </button>
    </li>
  );
}
