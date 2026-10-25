import React, { useEffect, useState } from "react";

import { Close, CloseViewer, OpenViewer, Play } from "../Body/glyphs";
import Button from "../../ui/Button";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import type { CloverRequest } from "../../core/request";
import type { ThumbnailSource } from "../../core/thumbnail";
import { STILL_SIZE } from "./layout";

export interface PlaceholderStill {
  /** Its image, or its image service, asked as its `info.json` allows (`placeholderStill`). */
  source: ThumbnailSource;
  width: number;
  height: number;
  alt: string;
  /** The language of `alt`, the Canvas's label. */
  lang?: string;
}

interface PlaceholderProps {
  instance: string;
  /** The shown Canvases' placeholder images, in the order they are laid out. */
  stills: PlaceholderStill[];
  /** Laid out in a column (`top-to-bottom`, `bottom-to-top`) rather than a row. */
  vertical: boolean;
  /**
   * The Canvas is video or sound: the toggle is a large play button in the middle, as
   * a video player's is, and opening plays.
   */
  media: boolean;
  /** Whether the placeholder is showing, rather than the Canvas itself. */
  active: boolean;
  /**
   * The Canvas has been opened but has not drawn yet: the still stays in view, inert,
   * so opening does not flash an empty Body while the first tiles load.
   */
  lingering: boolean;
  onToggle: () => void;
  /** How Clover fetches: the `info.json` a still's service is read from. */
  request?: CloverRequest;
}

/**
 * A still's URL: the image itself, or its service's, made once its `info.json` is read
 * (`resolveThumbnail`), never written from the service's id. The resolver is loaded with
 * the first placeholder that needs it, so a Canvas with none never carries it.
 */
function useStill(
  source: ThumbnailSource,
  request: CloverRequest | undefined,
): string | undefined {
  const [src, setSrc] = useState(source.src);
  const key = source.src ?? source.service ?? source.fallback;
  useEffect(() => {
    if (source.src) return setSrc(source.src);
    let live = true;
    void import("../../core/thumbnail")
      .then(({ resolveThumbnail }) =>
        resolveThumbnail(source, STILL_SIZE, request),
      )
      .then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
    // `key` stands in for `source`, a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return src;
}

/** One still, sized to its share of the run, drawn once its URL is made. */
function Still({
  still,
  request,
  style,
}: {
  still: PlaceholderStill;
  request?: CloverRequest;
  style: React.CSSProperties;
}) {
  const src = useStill(still.source, request);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
    <img
      alt={still.alt}
      lang={still.alt ? still.lang : undefined}
      src={src}
      style={style}
    />
  ) : (
    <span style={style} />
  );
}

/**
 * A Canvas's `placeholderContainer`, shown as the Viewer shows it: a still image fitted
 * to the Body and centered, in place of the Canvas until the reader opens it. Nothing
 * of the Canvas is fetched, and none of its controls shown, until then.
 *
 * The toggle in the top right opens the Canvas and, once open, goes back to the
 * placeholder; a click on the image opens it too. Several Canvases with placeholders (a
 * spread) are fitted together as one picture, edge to edge.
 */
const Placeholder: React.FC<PlaceholderProps> = ({
  instance,
  stills,
  vertical,
  media,
  active,
  lingering,
  onToggle,
  request,
}) => {
  const { t, langOf } = useCloverTranslation();
  const toggleKey = media
    ? active
      ? "playerPlay"
      : "playerClose"
    : active
      ? "imageViewerOpen"
      : "imageViewerClose";
  // Each image's share of the run, at a common height (a row) or width (a column).
  const shares = stills.map(({ width, height }) =>
    vertical ? height / width : width / height,
  );
  const total = shares.reduce((sum, share) => sum + share, 0);
  const ratio = vertical ? 1 / total : total;

  return (
    <>
      {/*
       * Named for what it opens and closes, as the Viewer's toggle is: "Close player",
       * not a bare "Close" beside the caption's own (WCAG 2.4.6).
       */}
      <Button
        className="clover-canvas-placeholder-toggle"
        id={`placeholder-${instance}`}
        label={t(toggleKey)}
        lang={langOf(toggleKey)}
        onClick={onToggle}
      >
        {/* A video's opens as play; an image's opens and closes with a magnifier. */}
        {media ? (
          active ? (
            <Play />
          ) : (
            <Close />
          )
        ) : active ? (
          <OpenViewer />
        ) : (
          <CloseViewer />
        )}
      </Button>
      {(active || lingering) && (
        <div
          aria-hidden={active ? undefined : true}
          className="clover-canvas-placeholder"
          data-lingering={!active}
          data-media={media}
          data-testid="clover-canvas-placeholder"
          data-vertical={vertical}
          onClick={active ? onToggle : undefined}
        >
          <div
            className="clover-canvas-placeholder-frame"
            style={{ "--ratio": ratio } as React.CSSProperties}
          >
            {stills.map((still, index) => (
              <Still
                key={index}
                still={still}
                request={request}
                style={{
                  [vertical ? "height" : "width"]:
                    `${(shares[index] / total) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default Placeholder;
