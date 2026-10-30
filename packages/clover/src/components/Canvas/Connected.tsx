import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { CanvasHandle, CloverCanvasProps } from "./Canvas.types";
import CanvasView, { type CanvasViewProps } from "./CanvasView";
import { applyTarget as apply, useRangeChapters } from "./fromManifest";
import { type IIIFCanvas, canvasCaptions, paintedMedia } from "./layout";
import {
  selectDrawnSets,
  selectHiddenSets,
  selectUnlistedSets,
} from "../../core/annotation-sets";
import type { AnnotationLink } from "../../core/link";
import { showLink } from "../../core/show-link";
import { chaptersOf } from "../../core/ranges";
import { hasBehavior } from "../../core/selectors";
import type { CanvasAnnotation } from "./Annotations";
import { sameLanguage } from "../../i18n/config";
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
const ConnectedCanvas: React.FC<CanvasViewProps> = ({
  options,
  onReady,
  onViewportChange,
  onMediaElement,
  onCaptionChange,
  caption: givenCaption,
  onEnded,
  placeholder = true,
  label,
  partOf,
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
    selectDrawnSets(
      state.manifest,
      state.addedSets,
      state.search.set,
      state.regions,
    ),
  );
  /*
   * What the menu never offers, as the Annotations list leaves it out (Mat, 2026-10-26):
   * the search's hits, which Search lists, and the OCR that starts hidden, unless the
   * reader's host has shown it (`shownSets`).
   */
  const unlistedSets = useCloverSelector((state) =>
    selectUnlistedSets(
      state.manifest,
      state.addedSets,
      state.hiddenSets,
      state.shownSets,
    ),
  );
  const hiddenSets = useCloverSelector((state) =>
    selectHiddenSets(
      state.manifest,
      state.addedSets,
      state.hiddenSets,
      state.shownSets,
    ),
  );
  const selectedAnnotation = useCloverSelector((state) => state.annotationId);
  /*
   * The annotation selected already, asked for again ("Find on the image" once the view
   * has moved, Cookbook 0021): framed again (`refind`), as a new one is framed as it is
   * selected, focus staying where the reader asked.
   */
  const selectedRef = useRef(selectedAnnotation);
  selectedRef.current = selectedAnnotation;
  const [refind, setRefind] = useState(0);
  useEffect(
    () =>
      clover.found.subscribe((id) => {
        if (id && id === selectedRef.current) setRefind((count) => count + 1);
      }),
    [clover],
  );
  const highlighted = useSyncExternalStore(
    clover.highlight.subscribe,
    clover.highlight.get,
    clover.highlight.get,
  );
  // The chapter hovered in `Contents`, marked on the seek bar; and the seek bar's, there.
  const highlightedChapter = useSyncExternalStore(
    clover.chapter.subscribe,
    clover.chapter.get,
    clover.chapter.get,
  );

  const canvasKey = canvases.map((canvas) => canvas.id).join("|");
  /*
   * Every set's annotations on the Canvases shown, as hotspots, each with its set as its
   * page: those of a hidden set are not drawn (`hiddenPages`), but stay in the menu, where
   * the set's toggle shows them again, as the Annotations list's does. Each targets its
   * Canvas by index, for one whose target names no Canvas of the view.
   */
  const annotations = useMemo<CanvasAnnotation[]>(() => {
    if (givenAnnotations) return givenAnnotations;
    const shown = canvases.map((canvas) => canvas.id);
    return sets.flatMap((set) =>
      set.entries
        .filter((entry) => shown.includes(entry.canvasId))
        .map((entry) => ({
          annotation: entry.annotation as CanvasAnnotation["annotation"],
          targetIndex: shown.indexOf(entry.canvasId),
          pageId: set.id,
          ...(set.label ? { pageLabel: set.label } : {}),
          ...(entry.place ? { place: entry.place } : {}),
          ...(entry.layer
            ? { layer: { key: entry.layer.key, item: entry.layer.item } }
            : {}),
        })),
    );
  }, [givenAnnotations, sets, canvases]);
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
  const rangeChapters = useRangeChapters(
    manifest,
    mediaCanvas,
    language,
    chaptersOf,
  );
  const hasMediaRef = useRef(hasMedia);
  hasMediaRef.current = hasMedia;

  /*
   * The Root's language wins (Mat, 2026-10-28: "always let root win"): as it changes, or
   * another recording plays, the caption file in it is the one shown while captions are
   * on, the Transcript's with it (`clover.captions`). A file chosen in the Captions menu
   * holds until then. Only the Root's: a Canvas given a `caption` keeps it.
   */
  const rootLanguage =
    givenCaption === undefined ? context.language : undefined;
  const mediaCanvasId = mediaCanvas?.id;
  useEffect(() => {
    if (!rootLanguage || !mediaCanvas) return;
    const file = canvasCaptions(mediaCanvas).find(
      (track) => track.language && sameLanguage(track.language, rootLanguage),
    );
    if (file && clover.captions.get() !== file.id)
      clover.captions.emit(file.id);
    // By the Canvas's id, as its object is made again each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootLanguage, mediaCanvasId, clover]);

  /** Apply what can be applied of the pending target; consume it once all of it is. */
  const applyTarget = useCallback(() => {
    const pending = clover.store.get().target;
    if (!pending) return;
    const visible = clover.store.get().canvasId;
    if (!visible) return;
    if (!apply(pending, handle.current, media.current, hasMediaRef.current))
      return; // The next `change`, or the media element, tries again.
    clover.consumeTarget();
  }, [clover]);

  /*
   * The element of the Canvas left is let go as the Canvas changes: a target's time
   * waits for the new Canvas's own (`handleMediaElement`), never set on one being emptied
   * (Cookbook 0065: a chapter on the other Canvas arrived at 0:00).
   */
  const lastCanvas = useRef(canvasKey);
  useEffect(() => {
    if (lastCanvas.current !== canvasKey) {
      lastCanvas.current = canvasKey;
      media.current = null;
    }
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
      navPlace={(manifest as { navPlace?: unknown } | null)?.navPlace}
      canvases={canvases}
      viewingDirection={direction}
      language={language}
      label={
        label ??
        (active?.label as CloverCanvasProps["label"]) ??
        (manifest?.label as CloverCanvasProps["label"])
      }
      partOf={partOf ?? (manifest?.label as CloverCanvasProps["partOf"])}
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
      hiddenPages={hiddenSets}
      unlistedPages={unlistedSets}
      onPageVisibilityChange={(pageIds, visible) =>
        pageIds.forEach((id) => clover.setSetVisible(id, visible))
      }
      chapters={givenChapters ?? rangeChapters}
      highlightedChapter={highlightedChapter}
      onChapterHighlight={(id) => clover.chapter.emit(id)}
      selectedAnnotation={selectedAnnotation}
      refind={refind}
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
