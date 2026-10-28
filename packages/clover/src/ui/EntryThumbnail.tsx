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
 * A source's URL at about `size` pixels on its longer side, once its service's own
 * `info.json` is read (`resolveThumbnail`); undefined until then, and for no source.
 */
export function useThumbnail(
  source: ThumbnailSource | null | undefined,
  size: number,
  request?: CloverRequest,
): string | undefined {
  const [src, setSrc] = useState<string>();
  // By what it asks for, so a source made again each render asks once.
  const key = source ? JSON.stringify(source) : "";
  useEffect(() => {
    setSrc(undefined);
    if (!source) return;
    let live = true;
    void resolveThumbnail(source, size, request).then(
      (url) => live && setSrc(url),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size, request]);
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
