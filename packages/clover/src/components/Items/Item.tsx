import React, { Suspense, lazy, useEffect, useRef, useState } from "react";

import type { ItemModel, ItemPart } from "../../core/items";
import { isSound } from "../../core/annotations";
import type { CloverRequest } from "../../core/request";
import { resolveThumbnail, thumbnailSource } from "../../core/thumbnail";
import { localize } from "../../core/value";
import { NEAR_VIEWPORT_MARGIN, useNearViewport } from "../Body/useNearViewport";
import { watchClamp } from "./clamped";
import { languageProps } from "../../i18n/direction";
import { readDate } from "../../core/dates";
import { formatTime } from "../../lib/time";
// A member's date, written only where one has a date (Cookbook 0318), so a strip never
// carries its writing.
const NavDate = lazy(() =>
  import("../../ui/NavDate").then(({ NavDate }) => ({ default: NavDate })),
);

/**
 * A part's thumbnail URL: the image itself, or its service's once its `info.json` is read,
 * which waits until the item comes `near` (a strip of a thousand reads a strip's worth).
 * `none` when the resource has no image to ask for at all (sound with no picture). Its
 * own, not `ui/EntryThumbnail.tsx`'s `useThumbnail`: a strip loads where no entry's
 * picture does, and as elements the shared hook was a chunk of its own, 180 B more on a
 * page with Items (2026-10-29).
 */
function useThumbnail(
  part: ItemPart,
  size: number,
  request: CloverRequest | undefined,
  near: boolean,
) {
  const source =
    part.source !== undefined ? part.source : thumbnailSource(part.resource);
  const [src, setSrc] = useState(source?.src);
  const key = source?.src ?? source?.service ?? source?.fallback;
  useEffect(() => {
    if (!source) return setSrc(undefined);
    if (source.src) return setSrc(source.src);
    if (!near) return;
    let current = true;
    resolveThumbnail(source, size, request).then((url) => {
      if (current) setSrc(url);
    });
    return () => {
      current = false;
    };
    // `key` stands in for `source`, a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size, near]);
  return { src, none: !source };
}

/**
 * A speaker, for sound with nothing to picture. Its own, not the player's icon: sharing
 * that module would bring every player icon up front with the thumbnails.
 */
const Speaker = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 512 512">
    <path d="M232 416a24 24 0 01-14.9-5.2L125.8 336H56a24 24 0 01-24-24V200a24 24 0 0124-24h69.8l91.3-74.8A24 24 0 01256 120v272a24 24 0 01-24 24z" />
    <path
      d="M336 176a112 112 0 010 160M384 128a176 176 0 010 256"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="32"
    />
  </svg>
);

function Picture({
  part,
  size,
  request,
  alt,
  altLang,
}: {
  part: ItemPart;
  size: number;
  request?: CloverRequest;
  alt: string;
  /** The language of the `alt`, a label's. */
  altLang?: string;
}) {
  /*
   * Near the screen, or in a slider near the edge of the box that scrolls it, found by
   * the markup, as the stylesheet that makes it scroll may come after.
   */
  const [box, setBox] = useState<HTMLSpanElement | null>(null);
  const near = useNearViewport(
    box,
    NEAR_VIEWPORT_MARGIN,
    box?.closest('[data-layout="slider"] .clover-items-viewport'),
  );
  const { src, none } = useThumbnail(part, size, request, near);
  const [loaded, setLoaded] = useState(false);
  /*
   * The Canvas's own shape, as the image's width and height attributes, so its card has
   * its width before the thumbnail arrives: no shift as it loads, and a strip never
   * holds hundreds of zero-wide cards (all "in view", all fetched). Square where the
   * resource has no size (sound, a Collection's member) until its image arrives.
   */
  const { width, height } = (part.resource ?? {}) as {
    width?: number;
    height?: number;
  };
  const ratio = width && height ? width / height : 1;
  /*
   * Nothing to show yet, or ever (sound with no picture): the picture keeps the box an
   * image would have, so its cell does not collapse to its caption. Sound says so.
   */
  return (
    <span
      ref={setBox}
      className="clover-items-picture"
      data-loaded={loaded}
      data-empty={src ? undefined : true}
      // Its Canvas's shape, kept once its image is in, for a layout that holds to it.
      style={
        src && !(width && height)
          ? undefined
          : ({ "--clover-items-ratio": ratio } as React.CSSProperties)
      }
    >
      {!src && none && isSound(part.media) && <Speaker />}
      {src && (
        <img
          src={src}
          alt={alt}
          {...languageProps(alt ? altLang : undefined)}
          // Sized here so a picture never fills its container without the stylesheet.
          width={size}
          height={Math.round(size / ratio)}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}
      {part.duration ? (
        <span className="clover-items-duration">
          {formatTime(part.duration)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One card's label. Under a slider's or grid's pictures it runs to three lines and is
 * cut short after (`Items.css`). Cut short, a full copy shows over the card's picture,
 * from where its lines end upward, while the item is hovered or focused (WCAG 1.4.12),
 * so nothing beside or below it moves and a slider's scrolling box cannot clip it. The
 * copy exists only while the label is cut (`clamped.ts`). It is `hidden` until the
 * stylesheet shows it, and hidden from assistive technology, which has the item's whole
 * name.
 */
function ItemLabel({
  text,
  lang,
  first,
}: {
  text: string;
  lang?: string;
  first: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !text) return;
    return watchClamp(node, setCut);
  }, [text]);
  return (
    <span className="clover-items-label" data-clamped={cut || undefined}>
      {/* Inline without the stylesheet; a grid cell trims it with it. */}
      {!first && " "}
      <span
        ref={ref}
        className="clover-items-label-text"
        {...languageProps(text ? lang : undefined)}
      >
        {text}
      </span>
      {cut && (
        <span
          className="clover-items-label-full"
          {...languageProps(lang)}
          aria-hidden="true"
          hidden
        >
          {text}
        </span>
      )}
    </span>
  );
}

export interface ItemFigureProps {
  item: ItemModel;
  size: number;
  language?: string;
  request?: CloverRequest;
  /** Show the item's summary below its label (a Collection's members have them). */
  showSummary?: boolean;
}

/**
 * An item as a figure: a card for each of its Canvases (two, side by side, for a spread;
 * all of them for a continuous Manifest), each its picture with its own label under it,
 * and a duration for video and sound. The Manifest's `behavior` decides what one item
 * holds, so the cards of one item meet with no gap between them, labels and all.
 *
 * The pictures and the labels are in rows of the figure's grid (one column per Canvas),
 * the labels in its `figcaption`. Without the stylesheet the labels read inline, a space
 * between them. A picture's `alt` is empty when its label already names it, so a screen
 * reader does not read it twice.
 *
 * The figure has no role of its own: Chromium and Firefox leave a figure's text out of the
 * name they give the option or link around it, which the label must reach.
 */
export function ItemFigure({
  item,
  size,
  language,
  request,
  showSummary = false,
}: ItemFigureProps) {
  const labels = item.parts.map((part) =>
    localize(item.parts.length === 1 ? item.label : part.label, language),
  );
  const summary = showSummary ? localize(item.summary, language) : null;
  // A member's date and summary, under its label (Cookbook 0318).
  const navDate = showSummary ? readDate(item.navDate) : null;
  const labeled = labels.some((label) => label.text);
  return (
    <figure
      role="none"
      className="clover-items-figure"
      data-parts={item.parts.length}
      data-media={item.parts[0]?.media?.toLowerCase()}
      style={{ "--parts": item.parts.length } as React.CSSProperties}
    >
      <span className="clover-items-pictures">
        {item.parts.map((part, index) => {
          const alt = labels[index].text
            ? { text: "" }
            : localize(part.label, language);
          return (
            <Picture
              key={part.id}
              part={part}
              size={size}
              request={request}
              alt={alt.text}
              altLang={alt.lang}
            />
          );
        })}
      </span>
      {(labeled || navDate || summary?.text) && (
        <figcaption className="clover-items-caption">
          {labels.map((label, index) => (
            <ItemLabel
              key={item.parts[index].id}
              text={label.text}
              lang={label.lang}
              first={index === 0}
            />
          ))}
          {navDate && (
            <Suspense fallback={null}>
              <NavDate value={item.navDate} className="clover-items-date" />
            </Suspense>
          )}
          {summary?.text && (
            <span
              className="clover-items-summary"
              {...languageProps(summary.lang)}
            >
              {/* IIIF allows a little HTML here; shown as text, its tags go. */}
              {summary.text.replace(/<[^>]*>/g, "")}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
