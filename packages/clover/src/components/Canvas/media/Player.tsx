import React, { useEffect, useMemo, useState } from "react";

import type { CloverRequest } from "../../../core/request";
import {
  type ThumbnailSource,
  resolveThumbnail,
  stillSource,
  thumbnailSource,
} from "../../../core/thumbnail";
import { type LanguageMapLike, localize } from "../../../core/value";
import { useCloverTranslation } from "../../../i18n/useCloverTranslation";
import { useContainerName } from "../../../ui/useContainerName";
import type { IIIFCanvas } from "../layout";
import type { TransportChapter } from "./Transport";
import { formatTime } from "./useMediaController";

/*
 * A lone recording of sound, played as a music app plays one (Mat, 2026-10-24: Apple
 * Music's and Spotify's players): its artwork beside its title and what it is part of,
 * on a ground of the artwork's own colors, the transport under them, and its chapters as
 * tracks. Canvas's transport, captions and annotations are kept as they are; this draws
 * what a picture would have.
 *
 * The artwork is the recording's own: its placeholder Canvas until it first plays, then
 * its accompanying Canvas (the IIIF's "while it plays", a score, a sleeve), each falling
 * back to the other, and else its thumbnail. Each is asked of its image service as its
 * `info.json` allows (`resolveThumbnail`), never larger than it is, and shown at its own
 * shape, never cropped square.
 */

export interface PlayerInfo {
  /** The recording's Canvas (a Timeline): its placeholder and accompanying Canvases. */
  canvas: IIIFCanvas;
  /** Its name, which names the viewport too: drawn as its title, for the eye alone. */
  title?: { text: string; lang?: string };
  /** What it is part of (its Manifest), under the title. */
  partOf?: { text: string; lang?: string };
}

/** The artwork's longer side, in pixels: sharp at a tall player's size on a dense screen. */
const ART_SIZE = 1200;
/** The ground's: a few pixels of the artwork's colors, spread soft across the player. */
const GROUND_SIZE = 32;

interface Artwork {
  source: ThumbnailSource;
  /** Its shape, width over height, where its Canvas says. */
  ratio?: number;
  /** Its Canvas's label, as its text alternative. */
  alt?: { text: string; lang?: string };
}

/** A Canvas as artwork: the image it paints (else its thumbnail), its shape and name. */
function artworkOf(
  canvas: IIIFCanvas,
  language: string | undefined,
): Artwork | null {
  const source = stillSource(canvas);
  if (!source) return null;
  const width = Number(canvas.width);
  const height = Number(canvas.height);
  const name = localize(canvas.label as LanguageMapLike, language);
  return {
    source,
    ratio: width > 0 && height > 0 ? width / height : undefined,
    alt: name.text ? name : undefined,
  };
}

/** A source's URL at about `size` pixels, once its service's `info.json` is read. */
function useResolved(
  source: ThumbnailSource | null | undefined,
  size: number,
  request: CloverRequest | undefined,
) {
  const key = source
    ? `${source.src ?? source.service ?? source.fallback}|${size}`
    : "";
  const [src, setSrc] = useState(source?.src);
  useEffect(() => {
    if (!source) return setSrc(undefined);
    if (source.src) return setSrc(source.src);
    let live = true;
    void resolveThumbnail(source, size, request).then(
      (url) => live && setSrc(url),
    );
    return () => {
      live = false;
    };
    // `key` stands in for `source`, a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]);
  return src;
}

/** A note, for a recording with no artwork, as a music app shows one. */
const Note = () => (
  <svg
    aria-hidden="true"
    className="clover-canvas-player-note"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <path
      d="M9 18V5l11-2v13"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);

/**
 * The player's face: the ground of the artwork's colors, the artwork, and the title with
 * what it is part of. `started`: it has played, so the accompanying Canvas shows.
 */
export function PlayerFace({
  player,
  started,
  request,
  language,
}: {
  player: PlayerInfo;
  started: boolean;
  request?: CloverRequest;
  language?: string;
}) {
  const { canvas, title, partOf } = player;
  const before = canvas.placeholderContainer ?? canvas.accompanyingContainer;
  const during = canvas.accompanyingContainer ?? canvas.placeholderContainer;
  const shown = started ? during : before;
  const art = useMemo<Artwork | null>(() => {
    if (shown) return artworkOf(shown, language);
    // No Canvas for it: its own thumbnail, a sleeve's, at whatever shape it has.
    const { thumbnail } = canvas as { thumbnail?: unknown };
    const source = thumbnailSource({ thumbnail });
    return source ? { source } : null;
  }, [shown, canvas, language]);
  const src = useResolved(art?.source, ART_SIZE, request);
  const ground = useResolved(art?.source, GROUND_SIZE, request);
  const [loaded, setLoaded] = useState<string>();
  return (
    <>
      <div
        className="clover-canvas-player-ground"
        data-art={ground ? "" : undefined}
        aria-hidden="true"
      >
        {ground && (
          // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
          <img alt="" decoding="async" src={ground} />
        )}
      </div>
      <div
        className="clover-canvas-player-art"
        data-loaded={src && loaded === src ? "" : undefined}
        style={
          {
            "--clover-player-art-ratio": art?.ratio ?? 1,
          } as React.CSSProperties
        }
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
          <img
            // Anew for another picture, so the one coming in fades in over the ground.
            key={src}
            alt={art?.alt?.text ?? ""}
            lang={art?.alt?.lang || undefined}
            decoding="async"
            onLoad={() => setLoaded(src)}
            src={src}
          />
        ) : (
          <Note />
        )}
      </div>
      <div className="clover-canvas-player-head">
        {title?.text && (
          <p
            className="clover-canvas-player-title"
            aria-hidden="true"
            lang={title.lang || undefined}
          >
            {title.text}
          </p>
        )}
        {partOf?.text && (
          <p
            className="clover-canvas-player-part-of"
            lang={partOf.lang || undefined}
          >
            {partOf.text}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * The chapters as a music app lists an album's tracks: numbered, each with where it
 * starts, the one playing marked (`aria-current`, and in words and weight, never by color
 * alone), a press going to it, as the transport's Chapters menu does. Where the player is
 * too short for it, the stylesheet leaves it out, and the menu stays.
 */
export function PlayerChapters({
  chapters,
  current,
  onSeek,
}: {
  chapters: TransportChapter[];
  current: number;
  onSeek: (seconds: number) => void;
}) {
  const { t, langOf, hostLanguage } = useCloverTranslation();
  const name = useContainerName(
    t("playerChapters"),
    langOf("playerChapters"),
    false,
    hostLanguage,
  );
  return (
    <>
      <ol className="clover-canvas-player-chapters" {...name.props}>
        {chapters.map((chapter, index) => (
          <li key={chapter.id ?? index}>
            <button
              type="button"
              className="clover-canvas-player-chapter"
              aria-current={index === current ? "true" : undefined}
              onClick={() => onSeek(chapter.start)}
            >
              <span
                className="clover-canvas-player-chapter-number"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span
                className="clover-canvas-player-chapter-label"
                lang={chapter.lang || undefined}
              >
                {chapter.label}
              </span>{" "}
              {/* Apart from the label in its name, as on screen: "Allegro 12:30". */}
              <span className="clover-canvas-player-chapter-time">
                {formatTime(chapter.start)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {name.node}
    </>
  );
}
