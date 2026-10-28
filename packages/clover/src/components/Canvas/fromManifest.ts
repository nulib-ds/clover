import { useMemo } from "react";

import type { CanvasHandle, CloverCanvasProps } from "./Canvas.types";
import type { IIIFCanvas } from "./layout";
import type { Target } from "../../core/content-state";
import type { Manifest } from "../../core/presentation";
import type { chaptersOf } from "../../core/ranges";
import { localize } from "../../core/value";

/*
 * What a Canvas reads from the Manifest around it, alike in a Root (`Connected.tsx`) and
 * loading its own (`LoadedCanvas.tsx`): the chapters of what it plays, and a deep link's
 * region and time.
 */

type Chapters = NonNullable<CloverCanvasProps["chapters"]>;

/**
 * The chapters of the Canvas playing (`playing`, none for a view without video or sound),
 * from the Manifest's Ranges (`read`, `chaptersOf`: handed in, so a Canvas loading its own
 * loads it only for what plays), each label in `language` and tagged with its own (WCAG
 * 3.1.2), for the transport to mark, list and name.
 */
export function useRangeChapters(
  manifest: Manifest | null | undefined,
  playing: IIIFCanvas | undefined,
  language: string | undefined,
  read: typeof chaptersOf | null,
): Chapters {
  return useMemo(
    () =>
      (
        read?.(manifest ?? null, playing?.id ?? null, playing?.duration) ?? []
      ).map((chapter) => {
        const value = localize(chapter.label, language);
        return {
          ...(chapter.id ? { id: chapter.id } : {}),
          label: value.text,
          lang: value.lang,
          start: chapter.start,
          end: chapter.end,
          ...(chapter.thumbnail ? { thumbnail: chapter.thumbnail } : {}),
        };
      }),
    [manifest, playing, language, read],
  );
}

/**
 * Applies what it can of a deep link's target (a content state, a Manifest's `start`):
 * its region framed once the Canvas is laid out (`handle`, from `onReady`), then its time
 * sought and playback begun once the media element can. Only a region waits for the
 * handle: a recording with nothing to draw is never laid out, and its time is still
 * applied. True once all of it is, for the caller to let it go; false while the Canvas or
 * its media is not ready, to try again when it is.
 */
export function applyTarget(
  target: Target,
  handle: CanvasHandle | null,
  media: HTMLVideoElement | null,
  hasMedia: boolean,
): boolean {
  if (target.region) {
    if (!handle) return false;
    const { x, y, w, h } = target.region;
    const placed = handle.fitCanvasRect(
      target.canvasId,
      { x, y, width: w, height: h },
      true,
    );
    if (!placed) return false; // Not laid out yet.
  }
  // A time or autoplay means nothing to a view without video or sound.
  if (hasMedia && (target.time !== undefined || target.autoplay)) {
    if (!media) return false; // The media element is not made yet.
    const play = () => {
      if (target.time !== undefined) media.currentTime = target.time;
      if (target.autoplay) media.play().catch(() => undefined);
    };
    if (media.readyState >= HTMLMediaElement.HAVE_METADATA) play();
    else media.addEventListener("loadedmetadata", play, { once: true });
  }
  return true;
}
