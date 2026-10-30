import React, { useEffect, useState } from "react";

import type { CloverRequest } from "../core/request";
import { type ThumbnailSource, resolveThumbnail } from "../core/thumbnail";
import { join } from "../lib/classnames";

/** An entry's picture: an `l` square (about a line), fetched at twice that for dense screens. */
export const ENTRY_THUMBNAIL_SIZE = 52;

/**
 * A chapter's picture, large: as wide as `--clover-picture` (`styles/scale.css`), fetched
 * at about twice that.
 */
export const PICTURE_SIZE = 336;

/**
 * A picture's URL at about `size` pixels on its longer side: the image itself at once, or
 * its service's once its own `info.json` is read (`resolveThumbnail`), never written from
 * the service's id; undefined until then, and for no source. The one way Clover resolves
 * a picture as it draws one where an entry's picture loads (Mat, 2026-10-28: "make this
 * one dry too"): an entry's (`EntryThumbnail`), a chapter's in the seek bar's popover,
 * and a player's artwork, which loads with the transport and its chapters.
 *
 * A picture of the words beside it goes at once for another's, so none shows under words
 * it is not of (an entry's, the popover's). `hold`: keep the last one while the next is
 * made, where one replaces another in place (a player's artwork as it starts, which would
 * otherwise flash its note).
 *
 * Items, the `Thumbnail` part, a Canvas's placeholder stills and Document's sheets keep
 * their own (2026-10-29): they load where no entry's picture does, so sharing this took
 * no copy off their pages and, as elements, made it a chunk of its own each paid for
 * (Items 180 B, each primitive 171 B); the placeholder loads the resolver only when a
 * still needs it, as every Canvas draws one up front; and a template imports only the
 * parts.
 */
export function useThumbnail(
  source: ThumbnailSource | null | undefined,
  size: number,
  request?: CloverRequest,
  hold = false,
): string | undefined {
  const [src, setSrc] = useState(source?.src);
  // By what it asks for, so a source made again each render asks once.
  const key = source ? JSON.stringify(source) : "";
  useEffect(() => {
    if (!source || source.src) return setSrc(source?.src);
    if (!hold) setSrc(undefined);
    let live = true;
    void resolveThumbnail(source, size, request).then(
      (url) => live && setSrc(url),
    );
    return () => {
      live = false;
    };
    // `key` stands in for `source`; `request` is the Root's, the same for its life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]);
  return src;
}

/**
 * The picture with an entry's words in a list: beside them, small (an annotation's
 * region); or under them, `large`, the current chapter's (a Range's `thumbnail`, in
 * Contents and the chapters' menu). Decorative, as its words name it, and nothing until
 * it is known.
 */
export function EntryThumbnail({
  source,
  request,
  large = false,
  className,
}: {
  source: ThumbnailSource | null | undefined;
  request?: CloverRequest;
  large?: boolean;
  className?: string;
}) {
  const src = useThumbnail(
    source,
    large ? PICTURE_SIZE : ENTRY_THUMBNAIL_SIZE,
    request,
  );
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
    <img
      className={join("clover-entry-thumbnail", className)}
      data-large={large ? "" : undefined}
      src={src}
      alt=""
      // Large, its height is the picture's own.
      {...(!large && {
        width: ENTRY_THUMBNAIL_SIZE / 2,
        height: ENTRY_THUMBNAIL_SIZE / 2,
      })}
      loading="lazy"
      decoding="async"
    />
  );
}
