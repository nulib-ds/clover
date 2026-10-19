import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import type { CanvasHandle, CloverCanvasProps } from "./Canvas.types";
import CanvasView from "./CanvasView";
import { type IIIFCanvas, paintedMedia } from "./layout";
import { selectDrawnSets } from "../../core/annotation-sets";
import type { AnnotationLink } from "../../core/link";
import { showLink } from "../../core/show-link";
import { chaptersOf } from "../../core/ranges";
import { localize } from "../../core/value";
import { hasBehavior } from "../../core/selectors";
import type { CanvasAnnotation } from "./Annotations";
import { useClover, useCloverSelector } from "../../react/context";
import {
  useActiveCanvas,
  useManifest,
  useSequence,
  useVisibleCanvases,
} from "../../react/hooks";

/**
 * `Canvas` inside a `Root`: the Root's current view, drawn.
 *
 * - **Deep links.** A pending target (a content state, a Manifest's `start`) opens its
 *   Canvas past the placeholder, frames its region once the Canvas is laid out, and seeks
 *   to its time once the media can. Then it is consumed, and the placeholder stays away
 *   for that view: a link into a Canvas never lands on its cover.
 * - **Reporting.** The visible region goes to the viewport channel on every camera move,
 *   the media element to the media channel, and the caption file the reader chooses to
 *   the captions channel — never to the store, so panning and playback re-render nothing.
 * - **Auto-advance.** When playback ends on a Manifest or Canvas with `auto-advance`, the
 *   next view plays; with `repeat`, the last wraps to the first.
 */
const ConnectedCanvas: React.FC<CloverCanvasProps> = ({
  options,
  onReady,
  onViewportChange,
  onMediaElement,
  onCaptionChange,
  caption: givenCaption,
  onEnded,
  placeholder = true,
  label,
  language: givenLanguage,
  annotations: givenAnnotations,
  chapters: givenChapters,
  ...rest
}) => {
  const context = useClover("Canvas");
  const { clover } = context;
  // The caption file to show: the host's, or the one chosen in the Root (a Transcript's).
  const rootCaption = useSyncExternalStore(
    clover.captions.subscribe,
    clover.captions.get,
    clover.captions.get,
  );
  const caption = givenCaption ?? rootCaption;
  // The Root's language, unless the Canvas is given its own.
  const language = givenLanguage ?? context.language;
  const canvases = useVisibleCanvases() as unknown as IIIFCanvas[];
  const { direction } = useSequence();
  const manifest = useManifest();
  const active = useActiveCanvas();
  /*
   * The Manifest the Canvases are from, or "loading" while the next one loads: choosing
   * another of a Collection's members clears the Canvas at once, not when it arrives.
   */
  const manifestId = useCloverSelector((state) =>
    state.status === "loading" ? "loading" : (state.manifest?.id ?? ""),
  );
  const target = useCloverSelector((state) => state.target);
  const sets = useCloverSelector((state) =>
    selectDrawnSets(state.manifest, state.addedSets, state.search.set),
  );
  const hiddenSets = useCloverSelector((state) => state.hiddenSets);
  const selectedAnnotation = useCloverSelector((state) => state.annotationId);
  const highlighted = useSyncExternalStore(
    clover.highlight.subscribe,
    clover.highlight.get,
    clover.highlight.get,
  );

  const canvasKey = canvases.map((canvas) => canvas.id).join("|");
  /*
   * The visible sets' annotations on the Canvases shown, as hotspots. Each targets its
   * Canvas by index, for one whose target names no Canvas of the view.
   */
  const annotations = useMemo<CanvasAnnotation[]>(() => {
    if (givenAnnotations) return givenAnnotations;
    const shown = canvases.map((canvas) => canvas.id);
    return sets
      .filter((set) => !hiddenSets.includes(set.id))
      .flatMap((set) =>
        set.entries
          .filter((entry) => shown.includes(entry.canvasId))
          .map((entry) => ({
            annotation: entry.annotation as CanvasAnnotation["annotation"],
            targetIndex: shown.indexOf(entry.canvasId),
            ...(set.label ? { pageLabel: set.label } : {}),
          })),
      );
  }, [givenAnnotations, sets, hiddenSets, canvases]);
  const shows = (canvasId?: string) =>
    Boolean(canvasId) && canvases.some((canvas) => canvas.id === canvasId);
  const deepLinked = target ? shows(target.canvasId) : false;
  /*
   * The view a deep link opened. Kept after the target is consumed, so the placeholder
   * does not come back over the region the reader was sent to.
   */
  const opened = useRef<string | null>(null);
  if (deepLinked) opened.current = canvasKey;
  const showPlaceholder = placeholder && opened.current !== canvasKey;

  const handle = useRef<CanvasHandle | null>(null);
  const media = useRef<HTMLVideoElement | null>(null);
  // A time or autoplay means nothing to a view without video or sound.
  const hasMedia = useMemo(
    () => canvases.some((canvas) => paintedMedia(canvas).length > 0),
    [canvases],
  );
  /*
   * Chapters of the Canvas playing, from the Manifest's Ranges, unless the host gives
   * its own.
   */
  const mediaCanvas = hasMedia
    ? canvases.find((canvas) => paintedMedia(canvas).length > 0)
    : undefined;
  const rangeChapters = useMemo(
    () =>
      chaptersOf(manifest, mediaCanvas?.id ?? null, mediaCanvas?.duration).map(
        (chapter) => {
          // The label's language goes with it, for the transport to tag (WCAG 3.1.2).
          const value = localize(chapter.label, language);
          return {
            label: value.text,
            lang: value.lang,
            start: chapter.start,
            end: chapter.end,
          };
        },
      ),
    [manifest, mediaCanvas, language],
  );
  const hasMediaRef = useRef(hasMedia);
  hasMediaRef.current = hasMedia;

  /** Apply what can be applied of the pending target; consume it once all of it is. */
  const applyTarget = useCallback(() => {
    const pending = clover.store.get().target;
    if (!pending) return;
    const visible = clover.store.get().canvasId;
    if (!handle.current || !visible) return;
    if (pending.region) {
      const { x, y, w, h } = pending.region;
      const placed = handle.current.fitCanvasRect(
        pending.canvasId,
        { x, y, width: w, height: h },
        true,
      );
      if (!placed) return; // Not laid out yet: the next `change` tries again.
    }
    const element = media.current;
    if (
      hasMediaRef.current &&
      (pending.time !== undefined || pending.autoplay)
    ) {
      if (!element) return; // The media element is not made yet.
      const play = () => {
        if (pending.time !== undefined) element.currentTime = pending.time;
        if (pending.autoplay) element.play().catch(() => undefined);
      };
      if (element.readyState >= HTMLMediaElement.HAVE_METADATA) play();
      else element.addEventListener("loadedmetadata", play, { once: true });
    }
    clover.consumeTarget();
  }, [clover]);

  useEffect(() => {
    if (target) applyTarget();
  }, [target, canvasKey, applyTarget]);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const handleReady = useCallback(
    (ready: CanvasHandle) => {
      handle.current = ready;
      ready.on("change", applyTarget);
      applyTarget();
      onReadyRef.current?.(ready);
    },
    [applyTarget],
  );

  const handleViewport = useCallback(
    (
      bounds: Parameters<NonNullable<CloverCanvasProps["onViewportChange"]>>[0],
    ) => {
      const region = handle.current?.getCanvasRegion();
      clover.viewport.emit(
        region
          ? {
              canvasId: region.canvasId,
              region: {
                x: region.rect.x,
                y: region.rect.y,
                w: region.rect.width,
                h: region.rect.height,
              },
            }
          : null,
      );
      onViewportChange?.(bounds);
    },
    [clover, onViewportChange],
  );

  const handleMediaElement = useCallback(
    (element: HTMLVideoElement | null) => {
      media.current = element;
      clover.media.emit(element);
      if (element) applyTarget();
      onMediaElement?.(element);
    },
    [clover, applyTarget, onMediaElement],
  );

  const handleEnded = useCallback(() => {
    onEnded?.();
    if (
      hasBehavior(manifest, "auto-advance") ||
      hasBehavior(active, "auto-advance")
    ) {
      clover.next({ autoplay: true, wrap: hasBehavior(manifest, "repeat") });
    }
  }, [clover, manifest, active, onEnded]);

  // A linking hotspot's Canvas (Cookbook 0022), shown as the Root shows any.
  const followLink = useCallback(
    (link: AnnotationLink) => void showLink(clover, link),
    [clover],
  );

  // The Root's request settings, unless the Canvas is given its own.
  const request = options?.request ?? clover.request;
  // An animation Canvas plays and loops as the Manifest's or Canvas's behavior says.
  const autoplay =
    hasBehavior(active, "auto-advance") ||
    hasBehavior(manifest, "auto-advance");
  const loop = hasBehavior(active, "repeat") || hasBehavior(manifest, "repeat");
  const connectedOptions = useMemo(
    () => ({
      ...options,
      request,
      animation: options?.animation ?? { autoplay, loop },
    }),
    [options, request, autoplay, loop],
  );

  if (!canvases.length) return null;
  return (
    <CanvasView
      {...rest}
      manifestId={manifestId}
      canvases={canvases}
      viewingDirection={direction}
      language={language}
      label={
        label ??
        (active?.label as CloverCanvasProps["label"]) ??
        (manifest?.label as CloverCanvasProps["label"])
      }
      options={connectedOptions}
      placeholder={showPlaceholder}
      onReady={handleReady}
      onViewportChange={handleViewport}
      onMediaElement={handleMediaElement}
      caption={caption}
      onCaptionChange={(caption) => {
        // To the Root, for its Transcript to follow; then to the host.
        clover.captions.emit(caption?.id ?? null);
        onCaptionChange?.(caption);
      }}
      onEnded={handleEnded}
      annotations={annotations}
      chapters={givenChapters ?? rangeChapters}
      selectedAnnotation={selectedAnnotation}
      highlightedAnnotation={highlighted}
      onAnnotationSelect={(id) => clover.selectAnnotation(id)}
      onAnnotationLink={rest.onAnnotationLink ?? followLink}
      onAnnotationActive={(id) => {
        clover.highlight.emit(id);
        rest.onAnnotationActive?.(id);
      }}
    />
  );
};

export default ConnectedCanvas;
