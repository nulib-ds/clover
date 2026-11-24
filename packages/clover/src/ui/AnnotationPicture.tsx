import React, { useEffect, useState } from "react";

import type { CloverRequest } from "../core/request";
import { type ThumbnailSource, resolveThumbnail } from "../core/thumbnail";
import { join } from "../lib/classnames";
import { fetchInfo } from "../lib/renderer/sources/imageService";
import {
  type RegionShare,
  sizedImageUrl,
} from "../lib/renderer/sources/sizedImage";

/**
 * An annotation's picture, beside it wherever it is listed (`ui/AnnotationEntry`'s
 * `EntryPicture`): the Annotations section and the Canvas's annotations menu, a
 * georeferenced image's among them. Its region cut by its image's server where the server
 * can cut, the whole image where it marks all of it; else, where the server cannot cut (a
 * level 0 server, as mapsnap's Sanborn sheets are), the whole image at a size the server
 * lists, cut here (Mat, 2026-11-16: "Those and regions"; none, from 2026-10-19, to spare
 * the download). The size is the smallest listed that gives the region the picture's
 * pixels on its shorter side, else the largest, never more than the image has, so a small
 * region costs one of the larger sizes, shared by every region on its image.
 *
 * Its own module, loaded as a list first shows a picture, and never with a recording's
 * transport (`ui/EntryThumbnail` is that): a menu that loads it without the transport
 * would otherwise split that module into a chunk of its own (nulib-ds/clover#440). Its
 * square holds its room while it is made, muted, and gives it up where none can be.
 */

/**
 * An annotation's picture: an `l` square (about a line), fetched at twice that for dense
 * screens, the one size for every list, so the browser loads each once.
 */
const ENTRY_THUMBNAIL_SIZE = 52;

/** Where to cut, and the whole image's width over its height. */
interface Cut {
  share: RegionShare;
  ratio: number;
}

async function resolvePicture(
  source: ThumbnailSource,
  request?: CloverRequest,
): Promise<{ src: string; cut?: Cut } | null> {
  const src = await resolveThumbnail(source, ENTRY_THUMBNAIL_SIZE, request);
  const share = source.region;
  if (src || !source.service || !share || typeof share === "string")
    return src ? { src } : null;
  try {
    const info = await fetchInfo(source.service, { request });
    const shorter = Math.min(
      share.width * info.width,
      share.height * info.height,
    );
    const whole = sizedImageUrl(
      info,
      Math.max(info.width, info.height) *
        Math.min(1, ENTRY_THUMBNAIL_SIZE / Math.max(shorter, 1)),
    );
    return whole
      ? { src: whole, cut: { share, ratio: info.width / info.height } }
      : null;
  } catch {
    return null;
  }
}

export default function AnnotationPicture({
  source,
  request,
  className,
}: {
  source: ThumbnailSource;
  request?: CloverRequest;
  className?: string;
}) {
  // Undefined while it is made, null where none can be.
  const [picture, setPicture] = useState<{ src: string; cut?: Cut } | null>();
  // By what it asks for, so a source made again each render asks once.
  const key = JSON.stringify(source);
  useEffect(() => {
    setPicture(undefined);
    let live = true;
    void resolvePicture(source, request).then(
      (found) => live && setPicture(found),
    );
    return () => {
      live = false;
    };
    // `key` stands in for `source`; `request` is the Root's, the same for its life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const classes = join("clover-entry-thumbnail", className);
  if (picture === null) return null;
  if (!picture) return <span className={classes} />;
  const { src, cut } = picture;
  if (!cut)
    return (
      <img
        className={classes}
        src={src}
        alt=""
        width={ENTRY_THUMBNAIL_SIZE / 2}
        height={ENTRY_THUMBNAIL_SIZE / 2}
        loading="lazy"
        decoding="async"
      />
    );
  /*
   * Cut as `object-fit: cover` fills the square with a server's cut: the region's shorter
   * side across the square, centered, the rest of the image beyond its edge. In shares of
   * the square, so it holds at whatever size the square is drawn; the square a flex item of
   * its entry, and so a block. Its clipping inline, as only this draws it, so the image
   * never spills out on a page without Clover's stylesheet.
   */
  const { share, ratio } = cut;
  const width = Math.max(1 / share.width, ratio / share.height);
  const height = width / ratio;
  const percent = (value: number) => `${value * 100}%`;
  return (
    <span
      className={classes}
      data-cut=""
      style={{ position: "relative", overflow: "hidden" }}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        style={{
          position: "absolute",
          maxWidth: "none",
          width: percent(width),
          height: percent(height),
          left: percent((1 - share.width * width) / 2 - share.x * width),
          top: percent((1 - share.height * height) / 2 - share.y * height),
        }}
      />
    </span>
  );
}
