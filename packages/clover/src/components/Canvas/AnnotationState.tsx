import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Annotations, {
  type AnnotationPlacer,
  type CanvasAnnotation,
  type ListedAnnotation,
  type PlacedAnnotation,
  type TimedAnnotation,
  goToTrack,
  placeAnnotations,
  timeAnnotations,
  wholeCanvasComments,
} from "./Annotations";
import type { CloverCanvasProps } from "./Canvas.types";
import { type MediaPlacement, canvasRectToWorld, canvasScene } from "./layout";
import { useSvgReader } from "./useSvgReader";
import { isRegionText, parseAnnotationTarget } from "../../core/annotations";
import type { CanvasRenderer } from "../../lib/renderer";
import { playFrom } from "../../lib/time";

const NO_PAGES: string[] = [];

/**
 * What the Canvas reads of its annotations' state, from the controller that holds it
 * (`AnnotationState`). Until the controller loads, the Canvas has none of it: no menu,
 * nothing picked, as before the hotspots arrive.
 */
export interface AnnotationModel {
  /** The menu's: every annotation placed, a hidden page's too, then those on the time. */
  menu: ListedAnnotation[];
  /** Those a hotspot stands for: the shown pages' only. */
  placed: PlacedAnnotation[];
  /** Cues on the recording's time, of the shown pages. */
  timed: TimedAnnotation[];
  hiddenPages: string[];
  setPagesVisible: (pageIds: string[], visible: boolean) => void;
  /** How many the menu would list, for whether it is offered over a placeholder. */
  listedCount: number;
  /** Comments on a whole Canvas, by Canvas, for the caption. */
  comments: Map<string, CanvasAnnotation["annotation"][]>;
  selected: string | null;
  select: (annotation: ListedAnnotation) => void;
  activate: (id: string | null) => void;
  /** Let go of the pick: whether there was one. */
  release: () => boolean;
  /** The Canvas the controller opened past its placeholder, not to play it. */
  quietlyOpened: string | null;
}

export interface AnnotationStateProps {
  /** The Canvas's own props: its annotations and what the host says of them. */
  given: CloverCanvasProps;
  annotations: CanvasAnnotation[];
  scene: ReturnType<typeof canvasScene> | null;
  renderer: CanvasRenderer | null;
  /** Bumped as the scene is laid out: hotspots are placed again. */
  sceneVersion: number;
  /** Whether the Canvases handed over are the ones drawn. */
  drawn: boolean;
  media: MediaPlacement | null;
  mediaElement: HTMLVideoElement | null;
  showPlaceholder: boolean;
  canvasKey: string | null;
  /** Open the Canvas past its placeholder: its images, or its recording, by key. */
  openImages: (open: boolean) => void;
  openMedia: (key: string | null) => void;
  /** The viewport, which a followed link gives focus to. */
  host: React.RefObject<HTMLDivElement | null>;
  onModel: (model: AnnotationModel | null) => void;
  /** Counts the asks for the selected annotation again: each frames it again. */
  refind?: number;
}

/**
 * The Canvas's annotation state, in the hotspots' chunk with them: only a Canvas with
 * annotations loads it (Mat, 2026-10-27). It holds what was the Canvas's own: which pages
 * show, the hotspots' placing, the hovered and the picked annotation, framing a pick
 * once its view is drawn, going to one on a recording's time, and opening the Canvas
 * past its placeholder for a pick. It draws the hotspots, and hands the Canvas the
 * rest (`onModel`): the menu, the cues, the caption's comments, and what to call.
 */
export function AnnotationState({
  given,
  annotations: allAnnotations,
  scene,
  renderer,
  sceneVersion,
  drawn,
  media,
  mediaElement,
  showPlaceholder,
  canvasKey,
  openImages,
  openMedia,
  host,
  onModel,
  refind = 0,
}: AnnotationStateProps) {
  const {
    canvases,
    language,
    hiddenPages: hiddenPagesProp,
    unlistedPages: unlistedPagesProp,
    onPageVisibilityChange,
    onAnnotationActive,
    selectedAnnotation: selectedAnnotationProp,
    animateAnnotations = false,
    highlightedAnnotation,
    onAnnotationSelect,
    onAnnotationLink,
  } = given;
  /*
   * AnnotationPages hidden from the picture: the host's (`hiddenPages`), or the Canvas's
   * own. Nothing of theirs is drawn, nor shown as a cue or in the caption; the menu still
   * lists them, under their page's hide toggle, to show them again.
   */
  const [ownHiddenPages, setOwnHiddenPages] = useState<string[]>([]);
  const [ownShownPages, setOwnShownPages] = useState<string[]>([]);
  const controlledPages = hiddenPagesProp !== undefined;
  /*
   * Its own pages that start hidden, as a Root's do (`startsHidden`): a still Canvas's
   * OCR, `supplementing` text on its regions, until the menu shows it. A whole page's
   * transcription and a recording's are kept.
   */
  const ownQuietPages = useMemo(() => {
    if (controlledPages) return NO_PAGES;
    const quiet = new Map<string, boolean>();
    for (const each of allAnnotations) {
      if (!each.pageId) continue;
      const still = !(Number(canvases?.[each.targetIndex]?.duration) > 0);
      const supplements =
        still &&
        isRegionText(
          each.annotation.motivation,
          parseAnnotationTarget(
            (Array.isArray(each.annotation.target)
              ? each.annotation.target[0]
              : each.annotation.target) as never,
          ),
        );
      quiet.set(each.pageId, (quiet.get(each.pageId) ?? true) && supplements);
    }
    const ids = [...quiet].filter(([, on]) => on).map(([id]) => id);
    return ids.length ? ids : NO_PAGES;
  }, [controlledPages, allAnnotations, canvases]);
  const ownPages = useMemo(() => {
    const quiet = ownQuietPages.filter(
      (id) => !ownShownPages.includes(id) && !ownHiddenPages.includes(id),
    );
    return quiet.length ? [...ownHiddenPages, ...quiet] : ownHiddenPages;
  }, [ownHiddenPages, ownShownPages, ownQuietPages]);
  const hiddenPages = hiddenPagesProp ?? ownPages;
  /*
   * The pages the menu never offers (`unlistedPages`), or, alone, its own OCR, as the
   * Annotations list leaves them out (Mat, 2026-10-26). With none left, no menu control.
   */
  const unlistedPages = unlistedPagesProp ?? ownQuietPages;
  const listed = useCallback(
    <T extends { pageId?: string }>(list: T[]) =>
      unlistedPages.length
        ? list.filter(
            (each) => !each.pageId || !unlistedPages.includes(each.pageId),
          )
        : list,
    [unlistedPages],
  );
  const listedCount = useMemo(
    () => listed(allAnnotations).length,
    [allAnnotations, listed],
  );
  /** Those of the pages shown: all of them while none is hidden, the same list. */
  const shown = useCallback(
    <T extends { pageId?: string }>(list: T[]) =>
      hiddenPages.length
        ? list.filter(
            (each) => !each.pageId || !hiddenPages.includes(each.pageId),
          )
        : list,
    [hiddenPages],
  );
  const onPageVisibilityRef = useRef(onPageVisibilityChange);
  onPageVisibilityRef.current = onPageVisibilityChange;
  const setPagesVisible = useCallback(
    (pageIds: string[], visible: boolean) => {
      onPageVisibilityRef.current?.(pageIds, visible);
      if (controlledPages) return;
      setOwnHiddenPages((hidden) => {
        const rest = hidden.filter((id) => !pageIds.includes(id));
        return visible ? rest : [...rest, ...pageIds];
      });
      setOwnShownPages((shown) => {
        const rest = shown.filter((id) => !pageIds.includes(id));
        return visible ? [...rest, ...pageIds] : rest;
      });
    },
    [controlledPages],
  );
  /*
   * Comments on a whole Canvas (Cookbook 0266, 0019), by Canvas: with no region to draw
   * them over, the caption shows them, under the Canvas's own words.
   */
  const comments = useMemo(
    () => wholeCanvasComments(shown(allAnnotations), canvases),
    [allAnnotations, shown, canvases],
  );

  /*
   * An annotation lands on the Canvas it targets, wherever that Canvas has been placed;
   * `targetIndex` counts the handed Canvases when the target names none of them.
   */
  const placeAnnotation = useMemo<AnnotationPlacer | undefined>(() => {
    if (!scene || !canvases) return undefined;
    return (rect, targetId, targetIndex) => {
      const found = canvases.findIndex((canvas) => canvas.id === targetId);
      const index = found === -1 ? targetIndex : found;
      const placement = scene.placements[index];
      return placement
        ? canvasRectToWorld(canvases[index], placement, rect)
        : null;
    };
  }, [scene, canvases]);

  /*
   * The annotations that can be drawn, shared by the hotspots and the annotations menu,
   * with one highlight between them: the hovered or focused one, else the one last
   * picked (from the menu or by clicking its hotspot).
   */
  const readSvg = useSvgReader(allAnnotations);
  // Every annotation placed once, a hidden page's too: the menu lists them all.
  const allPlaced = useMemo<PlacedAnnotation[]>(
    () =>
      renderer && sceneVersion > 0 && drawn
        ? placeAnnotations(
            allAnnotations,
            placeAnnotation ??
              ((rect, _, targetIndex) =>
                renderer.itemRectToWorld(targetIndex, rect)),
            readSvg,
            language,
          )
        : [],
    [
      renderer,
      allAnnotations,
      sceneVersion,
      drawn,
      placeAnnotation,
      readSvg,
      language,
    ],
  );
  // The hotspots: the shown pages' only.
  const placedAnnotations = useMemo(() => shown(allPlaced), [allPlaced, shown]);
  /*
   * Behind a placeholder nothing is drawn, so nothing is placed: the menu lists them as
   * the planned layout places them, for their names; a pick opens the Canvas.
   */
  const listedAnnotations = useMemo<PlacedAnnotation[]>(
    () =>
      allPlaced.length || !placeAnnotation
        ? allPlaced
        : placeAnnotations(allAnnotations, placeAnnotation, readSvg, language),
    [allPlaced, placeAnnotation, allAnnotations, readSvg, language],
  );
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(
    null,
  );
  /*
   * The picked annotation: the Canvas's own, or a host's (`selectedAnnotation`), which a
   * list beside the Canvas can change. A host's pick is framed once its hotspot is placed,
   * so picking one on another Canvas frames it after the move.
   */
  const [ownSelected, setOwnSelected] = useState<string | null>(null);
  const controlledSelection = selectedAnnotationProp !== undefined;
  const selectedAnnotation = controlledSelection
    ? selectedAnnotationProp
    : ownSelected;
  const framed = useRef<string | null>(null);
  const onAnnotationActiveRef = useRef(onAnnotationActive);
  onAnnotationActiveRef.current = onAnnotationActive;
  const onAnnotationSelectRef = useRef(onAnnotationSelect);
  onAnnotationSelectRef.current = onAnnotationSelect;
  const activateAnnotation = useCallback((id: string | null) => {
    setHoveredAnnotation(id);
    onAnnotationActiveRef.current?.(id);
  }, []);
  // A pick is framed at once, unless the host asks for the glide (`animateAnnotations`).
  const glide = useRef(animateAnnotations);
  glide.current = animateAnnotations;
  // Behind a placeholder there is nothing to frame yet: the pick opens it, and is framed
  // once drawn (below), as a host's is.
  const held = useRef(false);
  held.current = showPlaceholder;
  /*
   * One on the recording's time (Cookbook 0103) goes to where it starts: its cue shows
   * there, and the recording keeps playing or stays paused as it was.
   */
  const mediaElementRef = useRef(mediaElement);
  mediaElementRef.current = mediaElement;
  const rendererRef = useRef(renderer);
  rendererRef.current = renderer;
  const sought = useRef<string | null>(null);
  // Read as it is chosen, so `selectAnnotation` stays stable.
  const hiddenPagesRef = useRef(hiddenPages);
  hiddenPagesRef.current = hiddenPages;
  const setPagesVisibleRef = useRef(setPagesVisible);
  setPagesVisibleRef.current = setPagesVisible;
  const selectAnnotation = useCallback((annotation: ListedAnnotation) => {
    // One of a hidden page, chosen from the menu, shows its page again, as in a Root.
    if (annotation.pageId && hiddenPagesRef.current.includes(annotation.pageId))
      setPagesVisibleRef.current([annotation.pageId], true);
    setOwnSelected(annotation.id);
    onAnnotationActiveRef.current?.(annotation.id);
    onAnnotationSelectRef.current?.(annotation.id);
    if (held.current) return;
    if ("start" in annotation) {
      const element = mediaElementRef.current;
      if (!element) return;
      sought.current = annotation.id;
      // Pressed in the menu or on its hotspot: from its time, playing.
      playFrom(element, annotation.start);
      return;
    }
    framed.current = annotation.id;
    /*
     * One that follows a recording is not framed, since it moves. Picked while it is not
     * on the recording, the recording goes to where it starts, as one on its time does;
     * picked where it is (its hotspot, pressed), nothing moves.
     */
    if (annotation.track) {
      const element = mediaElementRef.current;
      if (element && goToTrack(annotation, element))
        sought.current = annotation.id;
      return;
    }
    rendererRef.current?.fitAnnotation(annotation.world, !glide.current);
  }, []);
  /*
   * Let go of the pick: a click or tap on the Canvas off every hotspot, or Escape in it
   * (WCAG 2.1.1). Whether there was one, so that tap does nothing more.
   */
  const selectedRef = useRef(selectedAnnotation);
  selectedRef.current = selectedAnnotation;
  const releaseAnnotation = useCallback(() => {
    if (!selectedRef.current) return false;
    setOwnSelected(null);
    framed.current = null;
    onAnnotationSelectRef.current?.(null);
    return true;
  }, []);
  /*
   * A linking hotspot pressed (Cookbook 0022): where it leads, shown by the host, the
   * Root, or what the Canvas loaded. Focus goes first to the viewport, which stays as the
   * view moves on, rather than going with the hotspot (WCAG 2.4.3).
   */
  const onAnnotationLinkRef = useRef(onAnnotationLink);
  onAnnotationLinkRef.current = onAnnotationLink;
  const canFollow = Boolean(onAnnotationLink);
  const followLink = useMemo(
    () =>
      canFollow
        ? (annotation: PlacedAnnotation) => {
            host.current?.focus({ preventScroll: true });
            releaseAnnotation();
            if (annotation.link) onAnnotationLinkRef.current?.(annotation.link);
          }
        : undefined,
    [canFollow, releaseAnnotation, host],
  );
  /*
   * A pick not framed yet (a host's, or one made behind the placeholder) is framed once
   * its hotspot is placed, which is once its view is drawn. One of a hidden page has no
   * hotspot, but is framed, or gone to on its recording, all the same, from where the
   * menu lists it: hiding a page hides only what is drawn.
   */
  // Asked for again, the selected one is framed again (Cookbook 0021: once the view moved).
  const lastRefind = useRef(refind);
  useEffect(() => {
    if (!selectedAnnotation) {
      framed.current = null;
      return;
    }
    if (lastRefind.current !== refind) {
      lastRefind.current = refind;
      framed.current = null;
    }
    if (framed.current === selectedAnnotation) return;
    const find = (list: PlacedAnnotation[]) =>
      list.find((annotation) => annotation.id === selectedAnnotation);
    const drawnOne = find(placedAnnotations);
    const placed = drawnOne ?? find(allPlaced);
    if (!placed) return; // Not placed yet; the next layout tries again.
    framed.current = placed.id;
    if (placed.track) {
      // One that follows a recording moves: its hotspot goes to it, not framed.
      if (!drawnOne && mediaElement) goToTrack(placed, mediaElement);
      return;
    }
    renderer?.fitAnnotation(placed.world, !glide.current);
  }, [
    selectedAnnotation,
    placedAnnotations,
    allPlaced,
    mediaElement,
    renderer,
    refind,
  ]);
  /*
   * Annotations on a stretch of the recording's time (Cookbook 0103): cues while it plays,
   * listed in the menu after those on the picture.
   */
  const allTimed = useMemo<TimedAnnotation[]>(
    () => (media ? timeAnnotations(allAnnotations, language) : []),
    [media, allAnnotations, language],
  );
  // The cues: the shown pages' only; the menu lists them all.
  const timedAnnotations = useMemo(() => shown(allTimed), [allTimed, shown]);
  const menuAnnotations = useMemo<ListedAnnotation[]>(
    () =>
      listed(
        allTimed.length
          ? [...listedAnnotations, ...allTimed]
          : listedAnnotations,
      ),
    [listedAnnotations, allTimed, listed],
  );
  /*
   * A pick on that time not gone to yet (a host's, or one made behind the placeholder) is
   * gone to once the recording is there. (One that follows the recording, the hotspots
   * go to themselves.)
   */
  useEffect(() => {
    if (!selectedAnnotation) {
      sought.current = null;
      return;
    }
    if (sought.current === selectedAnnotation || !mediaElement) return;
    const timed = timedAnnotations.find(
      (annotation) => annotation.id === selectedAnnotation,
    );
    if (!timed) return;
    sought.current = timed.id;
    mediaElement.currentTime = timed.start;
  }, [selectedAnnotation, timedAnnotations, mediaElement]);
  /*
   * A pick (from a list beside the Canvas, a link, or its own menu over the placeholder)
   * opens it past its placeholder once the annotation is in this view: the reader asked
   * to see it there. A recording opened so is not played, as its play button would.
   */
  const pendingPick = useRef<string | null>(null);
  const [quietlyOpened, setQuietlyOpened] = useState<string | null>(null);
  useEffect(() => {
    pendingPick.current = selectedAnnotation ?? null;
  }, [selectedAnnotation]);
  useEffect(() => {
    const id = pendingPick.current;
    if (!id || !allAnnotations.some((each) => each.annotation?.id === id))
      return;
    pendingPick.current = null;
    if (!showPlaceholder) return;
    if (!media) {
      openImages(true);
      return;
    }
    openMedia(canvasKey);
    setQuietlyOpened(canvasKey);
  }, [
    selectedAnnotation,
    allAnnotations,
    showPlaceholder,
    media,
    canvasKey,
    openImages,
    openMedia,
  ]);

  const model = useMemo<AnnotationModel>(
    () => ({
      menu: menuAnnotations,
      placed: placedAnnotations,
      timed: timedAnnotations,
      hiddenPages,
      setPagesVisible,
      listedCount,
      comments,
      selected: selectedAnnotation ?? null,
      select: selectAnnotation,
      activate: activateAnnotation,
      release: releaseAnnotation,
      quietlyOpened,
    }),
    [
      menuAnnotations,
      placedAnnotations,
      timedAnnotations,
      hiddenPages,
      setPagesVisible,
      listedCount,
      comments,
      selectedAnnotation,
      selectAnnotation,
      activateAnnotation,
      releaseAnnotation,
      quietlyOpened,
    ],
  );
  // Before paint, so the Canvas draws with it in the same frame.
  useLayoutEffect(() => onModel(model), [model, onModel]);
  useLayoutEffect(() => () => onModel(null), [onModel]);

  return renderer && sceneVersion > 0 && !showPlaceholder ? (
    <Annotations
      renderer={renderer}
      placed={placedAnnotations}
      sceneVersion={sceneVersion}
      active={hoveredAnnotation ?? highlightedAnnotation ?? selectedAnnotation}
      selected={selectedAnnotation}
      onActivate={activateAnnotation}
      onSelect={selectAnnotation}
      onFollow={followLink}
      // The recording a tracked hotspot follows, where there is one to follow.
      media={media ? mediaElement : undefined}
    />
  ) : null;
}
