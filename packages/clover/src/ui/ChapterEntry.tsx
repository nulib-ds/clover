import React, { memo } from "react";

import type { CloverRequest } from "../core/request";
import type { ThumbnailSource } from "../core/thumbnail";
import { languageProps } from "../i18n/direction";
import { CueTime } from "./Cue";
import { useThumbnail } from "./EntryThumbnail";

/**
 * A captured thumbnail's size, fetched at about twice the width it is shown
 * (`.clover-chapter-picture`, `ui/ChapterEntry.css`): one size wherever a chapter is
 * listed, so Contents, the chapters menu and the seek bar's popover ask for one address
 * and the browser loads it once.
 */
export const CHAPTER_THUMBNAIL_SIZE = 192;

/**
 * A chapter as Clover lists it wherever it does (nulib-ds/clover#441): Contents' Ranges on
 * a recording's time, the chapters menu over the Body, and the seek bar's popover. Its
 * captured thumbnail (a Range's `thumbnail`, Cookbook 0229) at its start, then its label
 * over its time, muted, so its name reads label, then time, as it is laid out (WCAG
 * 1.3.2). Each list gives it its own element and keyboard model (Contents' buttons, the
 * menu's radios), and marks the current one its own way.
 *
 * A list uses it where its chapters have captured thumbnails, so every chapter keeps the
 * slot, an empty one where it has none of its own, and their words line up. Its picture
 * is an entry's (`.clover-entry-thumbnail`, `ui/EntryThumbnail.css`), its size set before
 * it arrives, so nothing moves; it loads as it comes into view (`loading="lazy"`), and is
 * decorative, as the words beside it name the chapter. Memoized: a list's rows are drawn
 * again only as what they show changes.
 */
export const ChapterEntry = memo(function ChapterEntry({
  label,
  lang,
  start,
  picture,
  request,
}: {
  label: React.ReactNode;
  /** The label's language, where it is not the page's. */
  lang?: string;
  /** Where it starts, in seconds: shown under its label. */
  start: number;
  picture: ThumbnailSource | null | undefined;
  request?: CloverRequest;
}) {
  return (
    <span className="clover-chapter">
      <ChapterPicture source={picture} request={request} />
      <span className="clover-chapter-words">
        <span
          className="clover-cue-text clover-chapter-label"
          {...languageProps(lang)}
        >
          {label}
        </span>
        <CueTime start={start} className="clover-chapter-time" />
      </span>
    </span>
  );
});

const PICTURE = "clover-entry-thumbnail clover-chapter-picture";

// Memoized apart, so a row whose time alone changes (the popover's) keeps its picture.
const ChapterPicture = memo(
  function ChapterPicture({
    source,
    request,
  }: {
    source: ThumbnailSource | null | undefined;
    request?: CloverRequest;
  }) {
    const src = useThumbnail(source, CHAPTER_THUMBNAIL_SIZE, request);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
      <img
        className={PICTURE}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
      />
    ) : (
      // Its room while it is made, muted; empty, where it has none.
      <span className={PICTURE} data-empty={source ? undefined : ""} />
    );
  },
  // By what it asks for: a source made again each render is the same picture.
  (before, after) =>
    before.request === after.request &&
    JSON.stringify(before.source) === JSON.stringify(after.source),
);
