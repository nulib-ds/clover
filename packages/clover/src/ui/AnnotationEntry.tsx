import React, { useMemo } from "react";

import type { AnnotationBodyEntry } from "../core/annotation-bodies";
import { plainTextOf } from "../core/annotation-name";
import { shownBodies } from "../core/shown-bodies";
import type { ParsedAnnotationTarget } from "../core/annotations";
import { regionSource } from "../core/region";
import type { CloverRequest } from "../core/request";
import type { ThumbnailSource } from "../core/thumbnail";
import { localize } from "../core/value";
import { useLoaded } from "../hooks/useLoaded";
import { languageProps } from "../i18n/direction";
import { CueTime } from "./Cue";
import { EntryPicture } from "./EntryPicture";
import { useBodyAlt } from "./bodyAlt";

/*
 * One annotation as a list shows it, wherever it is listed (nulib-ds/clover#440): the
 * Annotations section's entries and the Canvas's annotations menu over the Body, each
 * around it in its own element and keyboard model (the section's entries and their
 * buttons, the menu's radios). Where it starts on a recording's time, the picture of what
 * it marks, then what it says: the same pieces, the same classes and so the same rules
 * (`Annotations.css`), and the same picture, asked for at one size and address by both,
 * so the browser loads it once.
 */

/** What an entry is drawn from: where it points, and what it says. */
export interface EntryOf {
  target: ParsedAnnotationTarget;
  bodies: AnnotationBodyEntry[];
  /** An annotation of one image of a `Choice` (Cookbook 0326), by that image's id. */
  layer?: { image?: string };
}

const loadSvgShape = () => import("../core/svg-shape");

/**
 * Where the picture of what an entry marks comes from: its region of the Canvas, or the box
 * its shape fills, cut small once its image's `info.json` is read (`regionSource`;
 * `AnnotationPicture`, which cuts it here where the server cannot); and one on the whole
 * Canvas, the whole of it, at a size the server lists (Mat, 2026-11-16: "they do relate
 * to a targeted canvas and or region"). None for an entry that shows an image of its own
 * (0377), a point, a stretch of a recording's time, or an image without a service.
 */
export function useRegionSource(
  entry: EntryOf,
  canvas?: Record<string, any>,
): ThumbnailSource | null {
  // A shape (an SvgSelector, Cookbook 0261) by the box it fills, its reader loaded for one.
  const { rect: own, svg: shape, point, t } = entry.target;
  const svg = own ? undefined : shape;
  const reader = useLoaded(loadSvgShape, Boolean(svg));
  return useMemo(() => {
    const box = svg ? reader?.readSvgShape(svg)?.box : undefined;
    const rect =
      own ??
      (box
        ? { x: box.x, y: box.y, w: box.width, h: box.height }
        : !shape && !point && !t && canvas?.width && canvas?.height
          ? { x: 0, y: 0, w: canvas.width, h: canvas.height }
          : undefined);
    if (!rect || !canvas || entry.bodies.some((body) => body.image))
      return null;
    return regionSource(canvas, rect, entry.layer?.image);
  }, [entry, canvas, own, shape, point, t, svg, reader]);
}

/**
 * An entry's time, picture and words, in that order, inside the element a list gives it:
 * `children` are its words, the section's in full (`EntryBodies`) and the menu's as one
 * line of text (`EntryWords`), with anything a list adds after them.
 */
export function EntryContent({
  start,
  picture,
  request,
  children,
}: {
  /** Where it starts on a recording's time, in seconds. */
  start?: number;
  picture: ThumbnailSource | null | undefined;
  request?: CloverRequest;
  children: React.ReactNode;
}) {
  return (
    <>
      {start !== undefined && (
        <CueTime start={start} className="clover-annotations-time" />
      )}
      <EntryPicture source={picture} request={request} />
      <div className="clover-annotations-body clover-cue-text">{children}</div>
    </>
  );
}

/**
 * What an annotation says, as plain words: each text body's text (`EntryBodies` shows
 * its markup), a place by its name, and an image as an image. For a list whose entries
 * are labels, where links and headings of the annotation's own cannot go: the Canvas's
 * annotations menu. With nothing to say, `fallback`, its number.
 */
export function EntryWords({
  bodies,
  language,
  fallback,
}: {
  bodies: AnnotationBodyEntry[];
  language?: string;
  fallback: string;
}) {
  const shown = shownBodies(bodies, language);
  const altOf = useBodyAlt(shown, language);
  const said = shown.some(
    (body) => body.image || (body.place ? body.label : body.value?.trim()),
  );
  if (!said) return <span className="clover-annotations-text">{fallback}</span>;
  return (
    <>
      {shown.map((body, index) => {
        if (body.image) {
          const alt = altOf(body);
          return (
            // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
            <img
              key={index}
              src={body.image}
              alt={alt.text}
              {...languageProps(alt.text ? alt.lang : undefined)}
              width={200}
              loading="lazy"
              className="clover-annotations-image"
            />
          );
        }
        const text = body.place
          ? localize(body.label, language)
          : {
              text: plainTextOf(body),
              lang:
                body.language && body.language !== "none"
                  ? body.language
                  : undefined,
            };
        return text.text ? (
          <span
            key={index}
            className="clover-annotations-text"
            {...languageProps(text.lang)}
          >
            {text.text}
          </span>
        ) : null;
      })}
    </>
  );
}
