import React, { useEffect, useState } from "react";

import { CloseViewer, OpenViewer, Play } from "../Body/glyphs";
import Button from "../../ui/Button";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import type { CloverRequest } from "../../core/request";
import type { ThumbnailSource } from "../../core/thumbnail";
import { STILL_SIZE } from "./layout";
import { languageProps } from "../../i18n/direction";

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
 * the first placeholder that needs it, so a Canvas with none never carries it. Apart from
 * `useThumbnail` (`ui/EntryThumbnail.tsx`) for that reason: every Canvas draws this up
 * front, and that hook imports the resolver.
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
      {...languageProps(still.alt ? still.lang : undefined)}
      src={src}
      style={style}
    />
  ) : (
    <span style={style} />
  );
}

/**
 * The placeholder's toggle, named for what it opens and closes, as the Viewer's toggle
 * is: "Close image viewer", not a bare "Close" beside the caption's own (WCAG 2.4.6). An
 * image's opens and closes with a magnifier, one of the row's controls, as the `i` and
 * annotations are (Mat, 2026-11-01: "placeholder should not be a special case"), drawn
 * there by `Controls.tsx`; a video's is Play in the middle of its still, drawn by
 * `Placeholder`, and gone once it opens (Mat, 2026-11-01).
 *
 * Pressed, an image's goes from one place to the other, and where it had focus, focus
 * follows it; a video's Play goes as the video opens, and focus goes to its transport's
 * Pause, or its view while the transport arrives, never to the page (WCAG 2.4.3).
 */
export function PlaceholderToggle({
  instance,
  media,
  active,
  onToggle,
  more = false,
}: Pick<PlaceholderProps, "instance" | "media" | "active" | "onToggle"> & {
  /**
   * An image's that is More, opening and closing the view's controls with the view: named
   * as More is (Mat, 2026-11-01: "it should be the same in both cases"). Where the Canvas
   * offers none, it opens and closes the image viewer alone, and says so.
   */
  more?: boolean;
}) {
  const { t, langOf } = useCloverTranslation();
  const id = `placeholder-${instance}`;
  const toggleKey = media
    ? "playerPlay"
    : more
      ? active
        ? "canvasExpandControls"
        : "canvasCollapseControls"
      : active
        ? "imageViewerOpen"
        : "imageViewerClose";
  return (
    <Button
      className="clover-canvas-placeholder-toggle"
      id={id}
      label={t(toggleKey)}
      lang={langOf(toggleKey)}
      /*
       * As More, a disclosure as More is (WCAG 4.1.2; DESIGN.md §0, one thing alike
       * wherever it shows): expanded while the view, and its tray of controls, are open.
       */
      expanded={more && !media ? !active : undefined}
      controls={more && !media ? `more-${instance}-list` : undefined}
      onClick={(event) => {
        const focused = document.activeElement === event.currentTarget;
        const figure = event.currentTarget.closest(".clover-canvas");
        onToggle();
        if (focused)
          requestAnimationFrame(() =>
            (
              document.getElementById(id) ??
              figure?.querySelector<HTMLElement>(
                '.clover-canvas-transport :is([data-button="pause"], [data-button="play"])',
              ) ??
              figure?.querySelector<HTMLElement>(".clover-canvas-viewport")
            )?.focus(),
          );
      }}
    >
      {/* A video's opens as play; an image's opens and closes with a magnifier. */}
      {media ? <Play /> : active ? <OpenViewer /> : <CloseViewer />}
    </Button>
  );
}

/**
 * A Canvas's `placeholderContainer`, shown as the Viewer shows it: a still image fitted
 * to the Body and centered, in place of the Canvas until the reader opens it. Nothing
 * of the Canvas is fetched, and none of its controls shown, until then.
 *
 * Its toggle (`PlaceholderToggle`), among the row's controls, opens an image's Canvas
 * and, once open, goes back to the placeholder; a click on the image opens it too. A
 * video's is Play in the middle of the still, drawn here, until it opens, and none after. Several Canvases with
 * placeholders (a spread) are fitted together as one picture, edge to edge.
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
  // Each image's share of the run, at a common height (a row) or width (a column).
  const shares = stills.map(({ width, height }) =>
    vertical ? height / width : width / height,
  );
  const total = shares.reduce((sum, share) => sum + share, 0);
  const ratio = vertical ? 1 / total : total;

  return (
    <>
      {/* A video's Play, in the middle of its still, until it opens. */}
      {media && active && (
        <PlaceholderToggle
          instance={instance}
          media
          active
          onToggle={onToggle}
        />
      )}
      {/* An image's still stays mounted, hidden, once open, so collapsing shows it loaded: a new <img> would flash the Body empty for a frame. */}
      {(active || lingering || !media) && (
        <div
          aria-hidden={active ? undefined : true}
          className="clover-canvas-placeholder"
          data-hidden={!active && !lingering}
          data-lingering={!active && lingering}
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
