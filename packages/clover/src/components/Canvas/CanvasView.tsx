import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  AnnotationPlacer,
  CanvasAnnotation,
  ListedAnnotation,
  PlacedAnnotation,
  TimedAnnotation,
} from "./Annotations";
import { useSvgReader } from "./useSvgReader";
import Caption, { captionLabelId, hasInformation } from "./Caption";
import type {
  CanvasControlsConfig,
  CanvasHandle,
  CloverCanvasOptions,
  CloverCanvasProps,
} from "./Canvas.types";
import Controls from "./Controls";
import Placeholder, { type PlaceholderStill } from "./Placeholder";
import {
  type AnimationFrame,
  type ChoiceSelections,
  animationFrames,
  frameKey,
  canvasRectToWorld,
  canvasScene,
  canvasSize,
  findChoices,
  placeholderStill,
  resolveDirection,
} from "./layout";
import ExitFullscreen from "../../ui/ExitFullscreen";
import { useChromeVisibility } from "./useChromeVisibility";
import { useNearViewport } from "./useNearViewport";
import useFullscreen from "../../hooks/useFullscreen";
import { useLoaded } from "../../hooks/useLoaded";
import { ErrorBoundary } from "../../ui/ErrorBoundary";
import { Loading } from "../../ui/Loading";
import { SHORTCUTS, forwardShortcut } from "../../ui/Tip";
import { visuallyHidden } from "../../ui/visuallyHidden";
import { join } from "../../lib/classnames";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useRootLanguage } from "../../react/language";
import { useContainerName } from "../../ui/useContainerName";
import {
  CanvasRenderer,
  findImageServiceId,
  type SceneImage,
} from "../../lib/renderer";
import { type Rect, union } from "../../lib/renderer/math/rect";

type CanvasStatus = "loading" | "ready" | "error";

/** Video and sound: only fetched when a Canvas paints them. */
const MediaStage = lazy(() => import("./media/MediaStage"));
/** The hotspots, and the placing of them, loaded for a Canvas with annotations. */
const loadHotspots = () => import("./Annotations");
const NO_COMMENTS: Map<string, CanvasAnnotation["annotation"][]> = new Map();
// Few Canvases are animations: their clock and bar load when one is shown.
const FrameAnimation = lazy(() => import("./FrameAnimation"));

const ALL_CONTROLS: Required<CanvasControlsConfig> = {
  zoom: true,
  fullPage: true,
  rotation: true,
  reset: true,
  annotations: true,
  information: true,
};

let instances = 0;

/**
 * The keys the viewport answers to while focused, as `aria-keyshortcuts` spells them,
 * and the string that says them in words: the camera's (`GestureController`) and
 * media's (`MediaStage`).
 */
const CAMERA_KEYS = {
  description: "canvasKeysImage",
  keys: [
    "ArrowLeft ArrowRight ArrowUp ArrowDown",
    SHORTCUTS.zoomIn.keys,
    SHORTCUTS.zoomOut.keys,
    SHORTCUTS.reset.keys,
    SHORTCUTS.rotateRight.keys,
    SHORTCUTS.rotateLeft.keys,
  ].join(" "),
};
const MEDIA_KEYS = {
  description: "canvasKeysMedia",
  keys: [SHORTCUTS.play.keys, "J L", SHORTCUTS.mute.keys].join(" "),
};
/** With annotations, Escape lets go of the picked one, as a click off it does. */
const ANNOTATION_KEYS = {
  description: "canvasKeysAnnotations",
  keys: "Escape",
};

/**
 * `Canvas` drawing exactly what it is handed — IIIF Canvases, or plain images — knowing
 * nothing of the Manifest around them. Standalone use renders this directly; inside a
 * `Root`, `Connected.tsx` hands it the current view.
 */
const CanvasView: React.FC<CloverCanvasProps> = (props) => {
  // Nothing to show renders nothing, as `Image` does.
  const hasSource =
    Boolean(props.canvases?.length) ||
    toSceneImages(props.body, props.src).length > 0;
  if (!hasSource) return null;
  return (
    <ErrorBoundary>
      <CanvasStage {...props} />
    </ErrorBoundary>
  );
};

const CanvasStage: React.FC<CloverCanvasProps> = ({
  manifestId,
  canvases,
  viewingDirection,
  body,
  src,
  isTiledImage = false,
  label,
  language,
  instanceId,
  className,
  options,
  navigator = false,
  controls = true,
  controlButtons,
  annotations,
  onAnnotationActive,
  selectedAnnotation: selectedAnnotationProp,
  animateAnnotations = false,
  highlightedAnnotation,
  onAnnotationSelect,
  onAnnotationLink,
  onReady,
  onViewportChange,
  onMediaElement,
  onCaptionChange,
  caption,
  onEnded,
  chapters,
  placeholder = true,
  children,
}) => {
  const { t } = useCloverTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const [renderer, setRenderer] = useState<CanvasRenderer | null>(null);
  const [navigatorElement, setNavigatorElement] =
    useState<HTMLDivElement | null>(null);
  const [wrapperElement, setWrapperElement] = useState<HTMLElement | null>(
    null,
  );
  const isFullscreen = useFullscreen(wrapperElement);
  // Standalone, the Canvas reads the page's language itself, for its strings to mark.
  const root = useRootLanguage(
    setWrapperElement as React.RefCallback<HTMLElement>,
  );
  // Controls and navigator show on a mouse's activity and fade after a pause, as the
  // Player's bar does; under a finger, or a pen that does not hover, a tap on the
  // picture shows and hides them. Focus that no press brought holds them.
  const chromeVisible = useChromeVisibility(
    wrapperElement,
    options?.hideDelay,
    hostRef,
  );
  /*
   * Nothing is fetched until the Canvas comes within half a screen of view: no
   * `info.json` or tiles, and no video, sound or captions (nor the media code itself).
   */
  const nearViewport = useNearViewport(wrapperElement);
  // A stable id per mounted instance, for control ids; never a new one per render.
  const [instance] = useState(
    () => instanceId ?? `clover-canvas-${++instances}`,
  );
  const controlsConfig: Required<CanvasControlsConfig> | null =
    controls === false
      ? null
      : controls === true
        ? ALL_CONTROLS
        : { ...ALL_CONTROLS, ...controls };
  const [status, setStatus] = useState<CanvasStatus>("loading");
  /** Bumped whenever the scene is laid out, so world-pinned overlays re-place. */
  const [sceneVersion, setSceneVersion] = useState(0);

  // Callbacks and options are read through refs so new identities don't remount.
  const onReadyRef = useRef(onReady);
  const onViewportChangeRef = useRef(onViewportChange);
  const optionsRef = useRef<CloverCanvasOptions | undefined>(options);
  onReadyRef.current = onReady;
  onViewportChangeRef.current = onViewportChange;
  optionsRef.current = options;

  /*
   * IIIF Canvases — one, or the few a host shows together, such as a spread — with each
   * Canvas's painted images composed at their targets and the Canvases laid out by
   * `viewingDirection`. Plain `body`/`src` images otherwise.
   */
  const direction = resolveDirection(viewingDirection);
  /*
   * A Canvas's `Choice`s, and which item of each to paint: the first until the reader
   * picks another from the control. A new set of Canvases starts from the first again.
   */
  const choices = useMemo(() => findChoices(canvases ?? []), [canvases]);
  const [selections, setSelections] = useState<ChoiceSelections>({});
  const selectChoice = (key: string, index: number) =>
    setSelections((current) => ({ ...current, [key]: index }));
  /*
   * The shown Canvases with a `summary` or `metadata`, for the caption the information
   * control slides out. It stays open as the host moves between Canvases, wherever there
   * is something to show.
   */
  const showInformation = Boolean(controlsConfig?.information);
  // The hotspots, and the reading of annotations, loaded for a Canvas with any.
  const hasAnnotations = Boolean(annotations?.length);
  const hotspots = useLoaded(loadHotspots, hasAnnotations);
  /*
   * Comments on a whole Canvas (Cookbook 0266, 0019), by Canvas: with no region to draw
   * them over, the caption shows them, under the Canvas's own words.
   */
  const comments = useMemo(
    () =>
      hotspots
        ? hotspots.wholeCanvasComments(annotations, canvases)
        : NO_COMMENTS,
    [hotspots, annotations, canvases],
  );
  const captioned = useMemo(
    () =>
      showInformation
        ? (canvases ?? []).filter(
            (canvas) => hasInformation(canvas) || comments.has(canvas.id),
          )
        : [],
    [canvases, showInformation, comments],
  );
  const captionId = `caption-${instance}`;
  const [captionOpen, setCaptionOpen] = useState(false);
  const isCaptionOpen = captionOpen && captioned.length > 0;
  const closeCaption = useCallback(
    (restoreFocus: boolean) => {
      setCaptionOpen(false);
      if (restoreFocus)
        document.getElementById(`information-${instance}`)?.focus();
    },
    [instance],
  );
  /*
   * An animation Canvas (painting annotations at `#t=` times) shows one frame at a time.
   * Every frame is in the scene, loading, all but the first hidden — so the first shows
   * alone before anything else loads. `FrameAnimation` (lazy) then plays them by showing
   * one and hiding the rest (`setHidden`): instant, the camera kept, nothing re-placed.
   */
  const animated = useMemo(
    () =>
      (canvases ?? []).find((canvas) => animationFrames(canvas).length) ?? null,
    [canvases],
  );
  const frames = animated ? animationFrames(animated) : NO_FRAMES;
  const scene = useMemo(
    () =>
      canvases?.length ? canvasScene(canvases, direction, selections) : null,
    [canvases, direction, selections],
  );
  const bodyImages = useMemo(
    () => toSceneImages(body, src, isTiledImage),
    [body, src, isTiledImage],
  );
  /*
   * The first painted video or sound, if any. Its element is made by the (lazy) media
   * stage; a video is then placed in the scene like any image, while sound has no picture
   * of its own and is never placed.
   */
  const media = scene?.media[0] ?? null;
  const presentation = options?.media?.presentation ?? "dom";
  const [mediaElement, setMediaElement] = useState<HTMLVideoElement | null>(
    null,
  );
  // What the media stage settled on: `dom` if `texture` was asked of media without CORS.
  const [presented, setPresented] = useState(presentation);
  const onMediaElementRef = useRef(onMediaElement);
  onMediaElementRef.current = onMediaElement;
  const handleMediaElement = useCallback(
    (element: HTMLVideoElement | null, how: "dom" | "texture") => {
      setMediaElement(element);
      setPresented(how);
      onMediaElementRef.current?.(element);
    },
    [],
  );
  const baseImages = scene ? scene.images : bodyImages;
  /*
   * A lone video or sound Canvas is a player, not a picture to explore: it is always
   * fitted to the stage, the camera stays put, and only full screen is offered from the
   * control cluster.
   */
  const mediaOnly = Boolean(media) && canvases?.length === 1;
  /** The reader can move the camera: not a lone recording, nor held still by the host. */
  const navigable = !mediaOnly && options?.gestures?.navigable !== false;
  /** The Canvases last drawn: when the host hands over others, frame them afresh. */
  const canvasKey = canvases?.map((canvas) => canvas.id).join("|") ?? null;
  /*
   * The shown Canvases' `placeholderContainer`s, as the Viewer shows them: a still fitted
   * in place of the Canvas, with a toggle to open it. Until then the Canvas is held back
   * entirely — no tiles, no pan or zoom, no annotations or `Choice`, no video or sound —
   * and only its information stays to hand. Once open, a video's placeholder is still
   * its poster frame.
   */
  const stills = useMemo<PlaceholderStill[]>(() => {
    if (!canvases || !placeholder) return [];
    const found = canvases.flatMap((canvas) => {
      const still = placeholderStill(canvas);
      const alt = localize(canvas.label as any, language);
      return still ? [{ ...still, alt: alt.text, lang: alt.lang }] : [];
    });
    return direction === "right-to-left" || direction === "bottom-to-top"
      ? found.reverse()
      : found;
  }, [canvases, direction, placeholder, language]);
  /*
   * Open or closed is the reader's choice, and it holds as they move from view to view:
   * open one page, and the next opens too, with its still in view until it draws. Video
   * and sound are the exception, since opening one plays it: each starts at its poster.
   */
  const [imagesOpen, setImagesOpen] = useState(false);
  const [mediaOpenedFor, setMediaOpenedFor] = useState<string | null>(null);
  const showPlaceholder =
    stills.length > 0 && (media ? mediaOpenedFor !== canvasKey : !imagesOpen);
  /*
   * A lone media Canvas carries all its chrome in the transport at the bottom: full
   * screen moves there, and the top cluster (and the scrim behind it) is shown only for a
   * `Choice` to pick from or information to read. Over a placeholder, only information.
   */
  const onlyInformation = (
    config: Required<CanvasControlsConfig>,
    { annotations = false } = {},
  ): Required<CanvasControlsConfig> => ({
    ...config,
    zoom: false,
    rotation: false,
    reset: false,
    fullPage: false,
    annotations: annotations && config.annotations,
  });
  /*
   * A host's own controls (the information panel's toggle) are kept wherever the cluster
   * would otherwise go: over a placeholder and over a lone video or sound, where Clover's
   * own image controls have no place, the cluster stays for them.
   */
  const hostControls = React.Children.count(children) > 0;
  /*
   * Over a placeholder, the annotations menu stays too: a pick from it opens the Canvas
   * and frames the annotation there, as a pick from a list beside it does. Over a lone
   * video or sound, it lists those on the recording's time (Cookbook 0103).
   */
  const shownControls = !controlsConfig
    ? null
    : showPlaceholder
      ? captioned.length || hostControls || annotations?.length
        ? onlyInformation(controlsConfig, { annotations: true })
        : null
      : mediaOnly
        ? choices.length ||
          captioned.length ||
          hostControls ||
          annotations?.length
          ? onlyInformation(controlsConfig, { annotations: true })
          : null
        : controlsConfig;
  /*
   * No overview of a video, which the navigator cannot draw playing. Sound keeps it for
   * an accompanying image it can be moved around, and has none otherwise.
   */
  const showNavigator =
    navigator &&
    !showPlaceholder &&
    (media
      ? media.kind === "audio" && !mediaOnly && baseImages.length > 0
      : true);
  /*
   * The video's own frame size, once known. A Canvas may declare a shape the file does
   * not have (Cookbook 0074 declares portrait for a landscape film), so the video is
   * fitted inside its target at its real aspect rather than stretched or letterboxed.
   */
  const videoSize = useVideoSize(media?.kind === "video" ? mediaElement : null);
  const videoPlacement = useMemo(
    () => (media ? containAspect(media.placement, videoSize) : null),
    [media, videoSize],
  );
  const images = useMemo<SceneImage[]>(
    () =>
      media?.kind === "video" && mediaElement && videoPlacement
        ? [
            ...baseImages,
            {
              id: media.id,
              placement: videoPlacement,
              width: videoPlacement.width,
              height: videoPlacement.height,
              media: { element: mediaElement, presentation: presented },
            },
          ]
        : baseImages,
    [baseImages, media, mediaElement, presented, videoPlacement],
  );
  // A lone video is framed by the video itself, so it fills the stage.
  const world =
    mediaOnly && media?.kind === "video" && videoSize && videoPlacement
      ? videoPlacement
      : scene
        ? union(scene.placements)
        : null;
  // Every field matters (a new region is a new picture), so compare them all. An element
  // does not serialise, so the media item's presence stands in for it.
  const imagesKey = JSON.stringify([
    baseImages,
    world,
    images.length !== baseImages.length && [
      media?.id,
      presented,
      videoPlacement,
    ],
  ]);
  const shownCanvases = useRef<string | null>(null);
  /** Back at the placeholder since last drawn: reopening frames the Canvas afresh. */
  const placeholderShown = useRef(false);
  const togglePlaceholder = () => {
    if (media) setMediaOpenedFor(showPlaceholder ? canvasKey : null);
    else setImagesOpen(showPlaceholder);
    // Closed, the pick is let go: nothing of it shows, and pressing it again reopens.
    if (!showPlaceholder) releaseAnnotation();
  };
  /*
   * The viewport always has a name: the given label, else the first Canvas's or body's,
   * else a generic one, each with its language. Not as a `lang` on the viewport, which
   * holds the hotspots: a name in another language is a hidden element's.
   */
  const firstBody = Array.isArray(body) ? body[0] : body;
  const ownName = [label, canvases?.[0]?.label, firstBody?.label]
    .map((value) => localize(value as any, language))
    .find((value) => value.text);
  const viewportName = useContainerName(
    ownName?.text || t("canvasImage"),
    ownName ? ownName.lang : root.langOf("canvasImage"),
    false,
    root.hostLanguage,
  );
  /*
   * The viewport says that it can be operated, and how (WCAG 4.1.2): a role description
   * over its `img` or `group` role, and its keys, in `aria-keyshortcuts` and in words in
   * its description. The camera's keys where the reader can move it, and media's where
   * there is media; none behind a placeholder, where no key does anything. An attribute
   * cannot carry a language, so the role keeps its own name where Clover's strings are
   * not in the page's language (WCAG 3.1.2).
   */
  const viewportKeys = showPlaceholder
    ? []
    : [
        ...(navigable ? [CAMERA_KEYS] : []),
        ...(media ? [MEDIA_KEYS] : []),
        ...(hasAnnotations ? [ANNOTATION_KEYS] : []),
      ];
  const keysId = `keys-${instance}`;
  const roleDescription =
    navigable && !showPlaceholder && !root.langOf("canvasRoleDescription")
      ? t("canvasRoleDescription")
      : undefined;
  const hasCaption = Boolean(shownControls) && captioned.length > 0;
  // The captioned Canvases' labels name the figure, whether or not the caption is open.
  const figureLabel = hasCaption
    ? captioned
        .map((canvas, index) =>
          localize(canvas.label as any, language).text
            ? captionLabelId(captionId, index)
            : null,
        )
        .filter(Boolean)
        .join(" ") || undefined
    : undefined;

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
   * The Canvases the renderer has laid out, with their placements: set when it reports a
   * new layout (`open`, `change`), so the handle's Canvas-coordinate methods never use the
   * placements of Canvases that are still loading.
   */
  const latestScene = useRef({ canvases, scene, canvasKey });
  latestScene.current = { canvases, scene, canvasKey };
  const drawnScene = useRef<{
    key: string | null;
    canvases: NonNullable<CloverCanvasProps["canvases"]>;
    placements: Rect[];
  } | null>(null);
  const markDrawn = useCallback(() => {
    const { canvases, scene, canvasKey } = latestScene.current;
    drawnScene.current =
      canvases && scene && shownCanvases.current === canvasKey
        ? { key: canvasKey, canvases, placements: scene.placements }
        : null;
  }, []);
  /*
   * Whether the Canvases handed over are the ones drawn. On a move, the last view stays
   * up until the next one's first tiles arrive: its hotspots and a pick's framing wait for
   * that, so none is laid over the last view's pictures, and the camera moves in the
   * scene it will end in: the spread fitted first, then the annotation (`sceneVersion`
   * is bumped as the new scene is drawn).
   */
  const drawn = !canvases || drawnScene.current?.key === canvasKey;

  /*
   * The annotations that can be drawn, shared by the hotspots and the annotations menu,
   * with one highlight between them: the hovered or focused one, else the one last
   * picked (from the menu or by clicking its hotspot).
   */
  const readSvg = useSvgReader(annotations);
  const placedAnnotations = useMemo<PlacedAnnotation[]>(
    () =>
      hotspots && renderer && annotations?.length && sceneVersion > 0 && drawn
        ? hotspots.placeAnnotations(
            annotations,
            placeAnnotation ??
              ((rect, _, targetIndex) =>
                renderer.itemRectToWorld(targetIndex, rect)),
            readSvg,
            language,
          )
        : [],
    [
      hotspots,
      renderer,
      annotations,
      sceneVersion,
      drawn,
      placeAnnotation,
      readSvg,
      language,
    ],
  );
  /*
   * Behind a placeholder nothing is drawn, so nothing is placed: the menu lists them as
   * the planned layout places them, for their names; a pick opens the Canvas.
   */
  const listedAnnotations = useMemo<PlacedAnnotation[]>(
    () =>
      placedAnnotations.length || !hotspots || !placeAnnotation
        ? placedAnnotations
        : hotspots.placeAnnotations(
            annotations ?? [],
            placeAnnotation,
            readSvg,
            language,
          ),
    [
      placedAnnotations,
      hotspots,
      placeAnnotation,
      annotations,
      readSvg,
      language,
    ],
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
  /*
   * One on the recording's time (Cookbook 0103) goes to where it starts: its cue shows
   * there, and the recording keeps playing or stays paused as it was.
   */
  const mediaElementRef = useRef(mediaElement);
  mediaElementRef.current = mediaElement;
  const sought = useRef<string | null>(null);
  const selectAnnotation = useCallback((annotation: ListedAnnotation) => {
    setOwnSelected(annotation.id);
    onAnnotationActiveRef.current?.(annotation.id);
    onAnnotationSelectRef.current?.(annotation.id);
    if (held.current) return;
    if ("start" in annotation) {
      const element = mediaElementRef.current;
      if (!element) return;
      sought.current = annotation.id;
      element.currentTime = annotation.start;
      return;
    }
    framed.current = annotation.id;
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
            hostRef.current?.focus({ preventScroll: true });
            releaseAnnotation();
            if (annotation.link) onAnnotationLinkRef.current?.(annotation.link);
          }
        : undefined,
    [canFollow, releaseAnnotation],
  );
  // For the handle's `zoomToAnnotation`, which outlives any one render.
  const placedRef = useRef(placedAnnotations);
  placedRef.current = placedAnnotations;
  // A pick not framed yet (a host's, or one made behind the placeholder) is framed once
  // its hotspot is placed, which is once its view is drawn.
  useEffect(() => {
    if (!selectedAnnotation) {
      framed.current = null;
      return;
    }
    if (framed.current === selectedAnnotation) return;
    const placed = placedAnnotations.find(
      (annotation) => annotation.id === selectedAnnotation,
    );
    if (!placed) return; // Not placed yet; the next layout tries again.
    framed.current = placed.id;
    rendererRef.current?.fitAnnotation(placed.world, !glide.current);
  }, [selectedAnnotation, placedAnnotations]);
  /*
   * Annotations on a stretch of the recording's time (Cookbook 0103): cues while it plays,
   * listed in the menu after those on the picture.
   */
  const timedAnnotations = useMemo<TimedAnnotation[]>(
    () =>
      hotspots && media
        ? hotspots.timeAnnotations(annotations ?? [], language)
        : [],
    [hotspots, media, annotations, language],
  );
  const menuAnnotations = useMemo<ListedAnnotation[]>(
    () =>
      timedAnnotations.length
        ? [...listedAnnotations, ...timedAnnotations]
        : listedAnnotations,
    [listedAnnotations, timedAnnotations],
  );
  // A pick on that time not gone to yet (a host's, or one made behind the placeholder)
  // is gone to once the recording is there.
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
  held.current = showPlaceholder;
  useEffect(() => {
    pendingPick.current = selectedAnnotation ?? null;
  }, [selectedAnnotation]);
  useEffect(() => {
    const id = pendingPick.current;
    if (!id || !annotations?.some((each) => each.annotation?.id === id)) return;
    pendingPick.current = null;
    if (!showPlaceholder) return;
    if (!media) {
      setImagesOpen(true);
      return;
    }
    setMediaOpenedFor(canvasKey);
    setQuietlyOpened(canvasKey);
  }, [selectedAnnotation, annotations, showPlaceholder, media, canvasKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new CanvasRenderer(host, optionsRef.current);
    rendererRef.current = renderer;
    setRenderer(renderer);
    renderer.setDismiss(releaseAnnotation);

    const offOpen = renderer.on("open", () => {
      setCleared(false);
      markDrawn();
      setStatus("ready");
      setSceneVersion((v) => v + 1);
      onReadyRef.current?.(
        canvasHandle(
          renderer,
          () => drawnScene.current,
          (id) => {
            const annotation = placedRef.current.find((a) => a.id === id);
            if (!annotation) return false;
            selectAnnotation(annotation);
            // Its hotspot takes focus, as OpenSeadragon's overlay does in the Viewer.
            Array.from(
              renderer.overlays.container.querySelectorAll<HTMLElement>("[id]"),
            )
              .find((element) => element.id === id)
              ?.focus({ preventScroll: true });
            return true;
          },
        ),
      );
    });
    const offChange = renderer.on("change", () => {
      setCleared(false);
      markDrawn();
      setStatus("ready");
      setSceneVersion((v) => v + 1);
    });
    const offError = renderer.on("error", () => {
      if (!renderer.isOpen) setStatus("error");
    });
    const offViewport = renderer.on("viewport", () => {
      onViewportChangeRef.current?.(renderer.getBounds());
    });

    return () => {
      offOpen();
      offChange();
      offError();
      offViewport();
      renderer.dispose();
      rendererRef.current = null;
      setRenderer(null);
    };
    // A new instanceId is a new viewer; nothing else remounts the renderer
    // (`selectAnnotation`, `releaseAnnotation` and `markDrawn` are stable).
  }, [instanceId, selectAnnotation, releaseAnnotation, markDrawn]);

  useEffect(() => {
    if (!renderer || !navigatorElement) return;
    return renderer.attachNavigator(navigatorElement);
  }, [renderer, navigatorElement]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (showPlaceholder) placeholderShown.current = true;
    if (!renderer || !nearViewport || showPlaceholder) return;
    const moved =
      shownCanvases.current !== null && shownCanvases.current !== canvasKey;
    // Loading until it is drawn: at first, and again whenever the view moves on.
    if (!renderer.isOpen || moved) setStatus("loading");
    const fit =
      mediaOnly || (placeholderShown.current && renderer.isOpen) || moved;
    shownCanvases.current = canvasKey;
    placeholderShown.current = false;
    renderer.setImages(images, { world: world ?? undefined, fit });
    // `imagesKey` stands in for `images`, whose identity changes on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesKey, instanceId, mediaElement, nearViewport, showPlaceholder]);

  // Another Manifest: the last one's images go at once, before the next is drawn.
  const shownManifest = useRef(manifestId);
  /* Cleared for another Manifest: nothing of the last one shows, its placeholder included. */
  const [cleared, setCleared] = useState(false);
  useLayoutEffect(() => {
    if (manifestId === shownManifest.current) return;
    shownManifest.current = manifestId;
    rendererRef.current?.clear();
    setCleared(true);
    setStatus("loading");
  }, [manifestId]);

  /*
   * Loading, shown: images on their way to a stage in view, not behind a still. A Canvas
   * that paints none (sound alone) has nothing to wait for, so never says so.
   */
  const loading =
    status === "loading" &&
    images.length > 0 &&
    nearViewport &&
    !showPlaceholder;

  return (
    <HostLanguageContext.Provider value={root.hostLanguage}>
      <figure
        aria-labelledby={figureLabel}
        className={join("clover-canvas", className)}
        data-testid="clover-canvas"
        data-status={status}
        data-has-navigator={showNavigator}
        data-fullscreen={isFullscreen}
        data-chrome={chromeVisible ? "visible" : "hidden"}
        data-media={media?.kind}
        data-animated={animated ? "" : undefined}
        data-navigable={navigable}
        data-placeholder={stills.length ? showPlaceholder : undefined}
        ref={root.ref}
        onKeyDown={(event) => {
          /*
           * Escape closes the open caption from anywhere in the figure, leaving focus
           * where it is, so a hotspot or control it covers comes back into sight without
           * moving focus (WCAG 2.4.11). Inside the caption, its own handler takes it.
           */
          if (
            event.key === "Escape" &&
            isCaptionOpen &&
            !event.defaultPrevented
          ) {
            // It closes, and nothing around it: not a modal `<dialog>` (the Lightbox).
            event.preventDefault();
            closeCaption(false);
            return;
          }
          /*
           * Escape lets go of the picked annotation, as a click off it does, unless a menu
           * is open (Escape closes that first), and nothing around it closes as well.
           */
          if (
            event.key === "Escape" &&
            !event.defaultPrevented &&
            !event.currentTarget.querySelector(".clover-canvas-menu") &&
            releaseAnnotation()
          ) {
            event.preventDefault();
            return;
          }
          // The Canvas's keys work from its own controls too, as their popovers say.
          forwardShortcut(event, hostRef.current);
        }}
        /*
         * Geometry inline: the stage fills its box with or without the stylesheet. Its
         * own stacking context, so the viewport can lie beneath everything else in it.
         */
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          margin: 0,
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        {/* A dark wash behind the controls, so they read over a bright picture. */}
        {(shownControls || showNavigator) && (
          <div className="clover-canvas-scrim" aria-hidden="true" />
        )}
        {/* Revealed by CSS only while this wrapper is the full-screen element. */}
        <ExitFullscreen hidden={!isFullscreen} />
        {renderer && shownControls && (
          <Controls
            renderer={renderer}
            instance={instance}
            config={shownControls}
            controlButtons={controlButtons}
            hasPlaceholder={stills.length > 0}
            choices={showPlaceholder ? [] : choices}
            selections={selections}
            onSelect={selectChoice}
            annotations={menuAnnotations}
            selectedAnnotation={selectedAnnotation}
            onAnnotationSelect={selectAnnotation}
            onAnnotationActivate={activateAnnotation}
            captionId={hasCaption ? captionId : undefined}
            captionOpen={isCaptionOpen}
            onCaptionToggle={() => setCaptionOpen((open) => !open)}
            language={language}
          >
            {children}
          </Controls>
        )}
        {showNavigator && (
          <div
            ref={setNavigatorElement}
            className="clover-canvas-navigator"
            data-testid="clover-canvas-navigator"
            aria-hidden="true"
          />
        )}
        <div
          ref={hostRef}
          className="clover-canvas-viewport"
          /*
           * Geometry inline, so the stage holds its size without the stylesheet. Beneath
           * the rest of the figure, so without it the controls, laid out in the flow
           * over the picture, still take their presses (WCAG 2.5.8).
           */
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            zIndex: -1,
          }}
          data-testid="clover-canvas-viewport"
          /*
           * An `img` role makes its children presentational, which would hide annotation
           * buttons from assistive technology. With hotspots it is a named group instead.
           */
          role={hasAnnotations ? "group" : "img"}
          aria-roledescription={roleDescription}
          {...viewportName.props}
          aria-describedby={viewportKeys.length ? keysId : undefined}
          aria-keyshortcuts={
            viewportKeys.map(({ keys }) => keys).join(" ") || undefined
          }
          aria-busy={loading}
          tabIndex={0}
        />
        {viewportName.node}
        {viewportKeys.length > 0 && (
          <span id={keysId} style={visuallyHidden}>
            {viewportKeys.map(({ description }, index) => (
              <React.Fragment key={description}>
                {index > 0 && " "}
                <span lang={root.langOf(description)}>{t(description)}</span>
              </React.Fragment>
            ))}
          </span>
        )}
        {stills.length > 0 && (
          <Placeholder
            instance={instance}
            stills={stills}
            vertical={
              direction === "top-to-bottom" || direction === "bottom-to-top"
            }
            media={Boolean(media)}
            active={showPlaceholder}
            lingering={status === "loading" && !cleared}
            onToggle={togglePlaceholder}
          />
        )}
        {renderer && media && nearViewport && !showPlaceholder && (
          <Suspense fallback={null}>
            {/*
             * Not keyed by the media: from one recording to the next (auto-advance), the
             * transport stays, and so does the keyboard focus on it (WCAG 2.4.3).
             */}
            <MediaStage
              media={media}
              presentation={presentation}
              request={options?.request}
              renderer={renderer}
              instance={instance}
              onElement={handleMediaElement}
              onCaptionChange={onCaptionChange}
              caption={caption}
              navigable={navigable}
              fullscreen={mediaOnly && Boolean(controlsConfig?.fullPage)}
              isFullscreen={isFullscreen}
              onEnded={onEnded}
              chapters={chapters}
              autoPlay={stills.length > 0 && quietlyOpened !== canvasKey}
              language={language}
              notes={timedAnnotations}
            />
          </Suspense>
        )}
        {renderer &&
          animated &&
          scene?.frames[frameKey(animated)] &&
          !showPlaceholder && (
            <Suspense fallback={null}>
              <FrameAnimation
                key={animated.id}
                renderer={renderer}
                frames={frames}
                byFrame={scene.frames[frameKey(animated)]}
                animationKey={animated.id}
                sceneVersion={sceneVersion}
                autoplay={options?.animation?.autoplay}
                loop={options?.animation?.loop}
                onEnded={onEnded}
                language={language}
              />
            </Suspense>
          )}
        {hotspots &&
          renderer &&
          hasAnnotations &&
          sceneVersion > 0 &&
          !showPlaceholder && (
            <hotspots.default
              renderer={renderer}
              placed={placedAnnotations}
              sceneVersion={sceneVersion}
              active={
                hoveredAnnotation ?? highlightedAnnotation ?? selectedAnnotation
              }
              selected={selectedAnnotation}
              onActivate={activateAnnotation}
              onSelect={selectAnnotation}
              onFollow={followLink}
            />
          )}
        {/* Last, as a `<figcaption>` must be first or last in its `<figure>`. */}
        {hasCaption && (
          <Caption
            id={captionId}
            canvases={captioned}
            comments={comments}
            open={isCaptionOpen}
            onClose={closeCaption}
            language={language}
          />
        )}
        {loading && <Loading overlay />}
      </figure>
    </HostLanguageContext.Provider>
  );
};

/**
 * The handle `onReady` hands a host: the renderer's camera and coordinate methods, plus
 * what only the component knows, such as which annotation has which hotspot. Delegates
 * rather than exposing the renderer itself.
 */
function canvasHandle(
  renderer: CanvasRenderer,
  drawn: () => {
    canvases: NonNullable<CloverCanvasProps["canvases"]>;
    placements: Rect[];
  } | null,
  zoomToAnnotation: (id: string) => boolean,
): CanvasHandle {
  return {
    fitCanvasRect(canvasId, rect, immediate) {
      const scene = drawn();
      const index = scene?.canvases.findIndex((c) => c.id === canvasId) ?? -1;
      if (!scene || index === -1) return false;
      renderer.fitBounds(
        canvasRectToWorld(scene.canvases[index], scene.placements[index], rect),
        immediate,
      );
      return true;
    },
    getCanvasRegion() {
      const scene = drawn();
      if (!scene) return null;
      return canvasRegion(
        renderer.getBounds(),
        scene.canvases,
        scene.placements,
      );
    },
    get backendKind() {
      return renderer.backendKind;
    },
    get atHome() {
      return renderer.isAtHome;
    },
    fitBounds: (bounds, immediate) => renderer.fitBounds(bounds, immediate),
    fitItemRect: (index, rect, immediate) =>
      renderer.fitItemRect(index, rect, immediate),
    itemRectToWorld: (index, rect) => renderer.itemRectToWorld(index, rect),
    getBounds: () => renderer.getBounds(),
    getHomeBounds: () => renderer.getHomeBounds(),
    getCamera: () => renderer.getCamera(),
    home: (immediate) => renderer.home(immediate),
    zoomBy: (factor, at, animate) => renderer.zoomBy(factor, at, animate),
    panBy: (dx, dy, animate) => renderer.panBy(dx, dy, animate),
    setRotation: (degrees, immediate) =>
      renderer.setRotation(degrees, immediate),
    getRotation: () => renderer.getRotation(),
    rotateBy: (degrees) => renderer.rotateBy(degrees),
    worldToScreenPoint: (point) => renderer.worldToScreenPoint(point),
    screenToWorldPoint: (point) => renderer.screenToWorldPoint(point),
    on: (event, listener) => renderer.on(event, listener),
    zoomToAnnotation,
  };
}

/** A video element's frame size, kept current as metadata arrives or the stream changes. */
function useVideoSize(element: HTMLVideoElement | null) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    setSize(null);
    if (!element) return;
    const read = () => {
      const { videoWidth: width, videoHeight: height } = element;
      if (width > 0 && height > 0) {
        setSize((current) =>
          current?.width === width && current.height === height
            ? current
            : { width, height },
        );
      }
    };
    read();
    element.addEventListener("loadedmetadata", read);
    element.addEventListener("resize", read);
    return () => {
      element.removeEventListener("loadedmetadata", read);
      element.removeEventListener("resize", read);
    };
  }, [element]);
  return size;
}

/** The largest rectangle of `size`'s aspect centred inside `box`; `box` until it is known. */

const NO_FRAMES: AnimationFrame[] = [];

export function containAspect(
  box: Rect,
  size: { width: number; height: number } | null,
): Rect {
  if (!size || !box.width || !box.height) return box;
  const scale = Math.min(box.width / size.width, box.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

/**
 * Painting bodies (or plain sources) as scene images. A body with an image service is
 * tiled from that service, with `body.id` as the fallback should the service fail; one
 * without is drawn as the static image it is.
 */
export function toSceneImages(
  body: CloverCanvasProps["body"],
  src: CloverCanvasProps["src"],
  isTiledImage = false,
): SceneImage[] {
  const bodies = Array.isArray(body) ? body : body ? [body] : [];
  if (bodies.length) {
    return bodies
      .map((resource, index): SceneImage | null => {
        const service = findImageServiceId(resource.service);
        if (!service && !resource.id) return null;
        return {
          id: `${index}:${resource.id ?? service}|${resource.region ?? ""}`,
          service,
          url: resource.id,
          width: resource.width,
          height: resource.height,
          region: resource.region,
        };
      })
      .filter((image): image is SceneImage => image !== null);
  }

  const sources = Array.isArray(src) ? src : src ? [src] : [];
  return sources.filter(Boolean).map((uri, index) => ({
    id: `${index}:${uri}`,
    ...(isTiledImage ? { service: uri } : { url: uri }),
  }));
}

/**
 * The visible part of whichever Canvas fills most of `bounds`, in that Canvas's own
 * coordinates and clipped to it: a region ready for `xywh=`.
 */
export function canvasRegion(
  bounds: Rect,
  canvases: NonNullable<CloverCanvasProps["canvases"]>,
  placements: Rect[],
): { canvasId: string; rect: Rect } | null {
  let best: { index: number; area: number; clip: Rect } | null = null;
  placements.forEach((place, index) => {
    const x = Math.max(bounds.x, place.x);
    const y = Math.max(bounds.y, place.y);
    const width = Math.min(bounds.x + bounds.width, place.x + place.width) - x;
    const height =
      Math.min(bounds.y + bounds.height, place.y + place.height) - y;
    if (width <= 0 || height <= 0) return;
    const area = width * height;
    if (!best || area > best.area) {
      best = { index, area, clip: { x, y, width, height } };
    }
  });
  if (!best) return null;
  const { index, clip } = best as { index: number; clip: Rect };
  const canvas = canvases[index];
  const place = placements[index];
  const size = canvasSize(canvas);
  const kx = size.width / place.width;
  const ky = size.height / place.height;
  return {
    canvasId: canvas.id,
    rect: {
      x: Math.round((clip.x - place.x) * kx),
      y: Math.round((clip.y - place.y) * ky),
      width: Math.round(clip.width * kx),
      height: Math.round(clip.height * ky),
    },
  };
}

export default CanvasView;
