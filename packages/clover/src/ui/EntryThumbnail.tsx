import React, { useEffect, useRef, useState } from "react";

import type { CloverRequest } from "../core/request";
import { type ThumbnailSource, resolveThumbnail } from "../core/thumbnail";
import { join } from "../lib/classnames";

/**
 * An entry's picture, large: a book's current Range's in Contents, as wide as
 * `--clover-picture` (`styles/scale.css`), fetched at about twice that. The map's place
 * pictures are the same size (`Map/MapView`'s own copy, so a map never loads this module
 * up front).
 */
export const PICTURE_SIZE = 336;

/**
 * A picture's URL at about `size` pixels on its longer side: the image itself at once, or
 * its service's once its own `info.json` is read (`resolveThumbnail`), never written from
 * the service's id; undefined until then, and for no source. The one way Clover resolves
 * a picture as it draws one where an entry's picture loads (Mat, 2026-10-28: "make this
 * one dry too"): a book's current entry's (`EntryThumbnail`), a chapter's
 * (`ChapterEntry`, in Contents, the chapters menu and the seek bar's popover), and a
 * player's artwork, which loads with the transport and its chapters. An annotation's
 * picture has its own module, `ui/AnnotationPicture`, so a list of them never loads this
 * one with it.
 *
 * A picture of the words beside it goes at once for another's, so none shows under words
 * it is not of (an entry's, the popover's). `hold`: keep the last one while the next is
 * made, where one replaces another in place, for as long as the key given stays the same
 * (a recording's Canvas: its artwork as it starts, which would otherwise flash its note).
 * Another key's goes at once, as nothing of a Canvas shows once the view has moved on
 * from it (Mat, 2026-11-06).
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
  hold?: string,
): string | undefined {
  const [src, setSrc] = useState(source?.src);
  // By what it asks for, so a source made again each render asks once.
  const key = source ? JSON.stringify(source) : "";
  const heldFor = useRef(hold);
  useEffect(() => {
    const held = hold !== undefined && heldFor.current === hold;
    heldFor.current = hold;
    if (!source || source.src) return setSrc(source?.src);
    if (!held) setSrc(undefined);
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
 * The current entry's picture under its words, large: a book's Range's `thumbnail`, in
 * Contents (a recording's chapters each show theirs beside them, `ChapterEntry`). Its
 * height is the picture's own. Decorative, as its words name it, and nothing until it is
 * known.
 */
export function EntryThumbnail({
  source,
  request,
  className,
}: {
  source: ThumbnailSource | null | undefined;
  request?: CloverRequest;
  className?: string;
}) {
  const src = useThumbnail(source, PICTURE_SIZE, request);
  if (!src) return null;
  return (
    <img
      className={join("clover-entry-thumbnail", className)}
      data-large=""
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}
