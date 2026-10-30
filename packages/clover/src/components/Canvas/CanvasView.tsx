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

import type { CanvasAnnotation } from "./Annotations";
import type { AnnotationModel } from "./AnnotationState";
import Caption, { captionLabelId, hasInformation } from "../Body/Caption";
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
  startingChoices,
  placeholderStill,
  resolveDirection,
} from "./layout";
import ExitFullscreen from "../../ui/ExitFullscreen";
import { useControlsVisibility } from "../Body/useControlsVisibility";
import { useNearViewport } from "../Body/useNearViewport";
import useFullscreen from "../../hooks/useFullscreen";
import useWithinFullscreen from "../../hooks/useWithinFullscreen";
import useFullscreenExit from "../../hooks/useFullscreenExit";
import { useLoaded } from "../../hooks/useLoaded";
import { ErrorBoundary } from "../../ui/ErrorBoundary";
import { Loading } from "../../ui/Loading";
import { SHORTCUTS, forwardShortcut } from "../../ui/Tip";
import { useUniqueId } from "../../ui/useUniqueId";
import { visuallyHidden } from "../../ui/visuallyHidden";
import { join } from "../../lib/classnames";
import { type LanguageMapLike, localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { BodyNote, BodyUnloadable } from "../../ui/BodyUnloadable";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useRootLanguage } from "../../react/language";
import { useContainerName } from "../../ui/useContainerName";
import type { CanvasRenderer, SceneImage } from "../../lib/renderer";
import { type Rect, union } from "../../lib/renderer/math/rect";
import { findImageServiceId } from "../../lib/renderer/sources/imageService";
import { type CanvasSurface, type MakeSurface, hasCamera } from "./surface";
import { languageProps } from "../../core/direction";

type CanvasStatus = "loading" | "ready" | "error";

/** Video and sound: only fetched when a Canvas paints them. */
const MediaBody = lazy(() => import("./media/MediaBody"));
/**
 * The hotspots, and the annotations' state (`AnnotationState`), loaded for a Canvas with
 * annotations.
 */
const loadHotspots = () => import("./AnnotationState");
const NO_COMMENTS: Map<string, CanvasAnnotation["annotation"][]> = new Map();
/** A Canvas's annotations' state until its controller loads: nothing listed or picked. */
const NO_MODEL: AnnotationModel = {
  menu: [],
  placed: [],
  timed: [],
  hiddenPages: [],
  setPagesVisible: () => undefined,
  listedCount: 0,
  comments: NO_COMMENTS,
  selected: null,
  select: () => undefined,
  activate: () => undefined,
  release: () => false,
  quietlyOpened: null,
};
// Few Canvases are animations: their clock and bar load when one is shown.
const FrameAnimation = lazy(() => import("./FrameAnimation"));
// A picked annotation's place, on its map (Cookbook 0139): MapLibre with it, on demand.
const PlaceBox = lazy(() => import("./PlaceBox"));

const ALL_CONTROLS: Required<CanvasControlsConfig> = {
  zoom: true,
  fullPage: true,
  rotation: true,
  reset: true,
  annotations: true,
  information: true,
  map: true,
};

/**
 * The keys the viewport answers to while focused, as `aria-keyshortcuts` spells them,
 * and the string that says them in words: the camera's (`GestureController`) and
 * media's (`MediaBody`).
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

export type CanvasViewProps = CloverCanvasProps & {
  /** What it draws on: Canvas's renderer, or a Timeline's surface (`surface.ts`). */
  surface: MakeSurface;
  /**
   * Counts the asks for the annotation selected already ("Find on the image" again, the
   * Root's `found`): each one frames it again (`AnnotationState`).
   */
  refind?: number;
};

/**
 * `Canvas` drawing exactly what it is handed — IIIF Canvases, or plain images — knowing
 * nothing of the Manifest around them. Standalone use renders this directly; inside a
 * `Root`, `Connected.tsx` hands it the current view.
 */
const CanvasView: React.FC<CanvasViewProps> = (props) => {
  // Nothing to show renders nothing, as `Image` does.
  const hasSource =
    Boolean(props.canvases?.length) ||
    toSceneImages(props.body, props.src).length > 0;
  if (!hasSource) return null;
  return (
    <ErrorBoundary>
      <CanvasBody {...props} />
    </ErrorBoundary>
  );
};

const CanvasBody: React.FC<CanvasViewProps> = (props) => {
  const {
    surface: makeSurface,
    manifestId,
    canvases,
    viewingDirection,
    body,
    src,
    isTiledImage = false,
    label,
    partOf,
    language,
    instanceId,
    className,
    options,
    navigator = false,
    controls = true,
    controlButtons,
    annotations: allAnnotations,
    onReady,
    onViewportChange,
    onMediaElement,
    onCaptionChange,
    caption,
    onEnded,
    chapters,
    highlightedChapter,
    onChapterHighlight,
    placeholder = true,
    children,
  } = props;
  const { t } = useCloverTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const [wrapperElement, setWrapperElement] = useState<HTMLElement | null>(
    null,
  );
  const isFullscreen = useFullscreen(wrapperElement);
  // Inside whatever is full screen: the Canvas itself, or a host's element around it.
  const withinFullscreen = useWithinFullscreen(wrapperElement);
  // The way out shown at its top left: full screen itself, or first in its Root that is.
  const exitShown = useFullscreenExit(wrapperElement);
  // Standalone, the Canvas reads the page's language itself, for its strings to mark.
  const root = useRootLanguage(
    setWrapperElement as React.RefCallback<HTMLElement>,
  );
  // Controls and navigator show on a mouse's activity and fade after a pause, as the
  // Player's bar does; under a finger, or a pen that does not hover, a tap on the
  // picture shows and hides them. Focus that no press brought holds them.
  const controlsVisible = useControlsVisibility(
    wrapperElement,
    options?.hideDelay,
    hostRef,
  );
  /*
   * Nothing is fetched until the Canvas comes within half a screen of view: no
   * `info.json` or tiles, and no video, sound or captions (nor the media code itself).
   */
  const nearViewport = useNearViewport(wrapperElement);
  /*
   * A stable id per mounted instance, for control ids; never a new one per render. One of
   * Clover's (`useUniqueId`), never a count of this module's: a page with two copies of
   * Clover (React's and the elements', or both of the elements' entries) counted twice
   * from 1, and their controls' ids met (WCAG 4.1.2).
   */
  const made = useUniqueId();
  const [instance] = useState(() => instanceId ?? `clover-canvas-${made}`);
  const surfaceRef = useRef<CanvasSurface | null>(null);
  const [surface, setSurface] = useState<CanvasSurface | null>(null);
  // The surface's camera, where it has one: Canvas's renderer, never a Timeline's.
  const renderer = hasCamera(surface) ? surface : null;
  const [navigatorElement, setNavigatorElement] =
    useState<HTMLDivElement | null>(null);
  const controlsConfig: Required<CanvasControlsConfig> | null =
    controls === false
      ? null
      : controls === true
        ? ALL_CONTROLS
        : { ...ALL_CONTROLS, ...controls };
  const [status, setStatus] = useState<CanvasStatus>("loading");
  // Nothing it paints could be loaded (an image's address answers with an error).
  const [unloadable, setUnloadable] = useState(false);
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
   * A Canvas's `Choice`s, and which item of each to paint: the first, or the next not
   * disabled where the first is (`startingChoices`), until the reader picks another
   * from the control. A new set of Canvases starts from the first again.
   */
  const choices = useMemo(() => findChoices(canvases ?? []), [canvases]);
  const starting = useMemo(() => startingChoices(choices), [choices]);
  const [picked, setSelections] = useState<ChoiceSelections>({});
  const selections = useMemo(
    () => ({ ...starting, ...picked }),
    [starting, picked],
  );
  const selectChoice = (key: string, index: number) =>
    setSelections((current) => ({ ...current, [key]: index }));
  /*
   * An annotation of one image of a `Choice` (Cookbook 0326: the X-ray's tag) is drawn
   * while that image is the one chosen; one chosen elsewhere (the Annotations list)
   * chooses its image, so it is drawn and framed.
   */
  const layered = useMemo(
    () =>
      allAnnotations?.filter(
        (each) =>
          !each.layer || (selections[each.layer.key] ?? 0) === each.layer.item,
      ),
    [allAnnotations, selections],
  );
  const pickedLayer = allAnnotations?.find(
    (each) => each.layer && each.annotation.id === props.selectedAnnotation,
  )?.layer;
  useEffect(() => {
    if (pickedLayer && (selections[pickedLayer.key] ?? 0) !== pickedLayer.item)
      selectChoice(pickedLayer.key, pickedLayer.item);
    // Only as another is picked: the reader may choose another image meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedLayer?.key, pickedLayer?.item, props.selectedAnnotation]);
  /*
   * The shown Canvases with a `summary` or `metadata`, for the caption the information
   * control slides out. It stays open as the host moves between Canvases, wherever there
   * is something to show.
   */
  const showInformation = Boolean(controlsConfig?.information);
  // The hotspots, and the reading of annotations, loaded for a Canvas with any, hidden too.
  const hasAnnotations = Boolean(allAnnotations?.length);
  const hotspots = useLoaded(loadHotspots, hasAnnotations);
  /*
   * The annotations' state, from its controller once loaded (`AnnotationState`), read
   * through a ref by what outlives a render: the surface's dismiss, the handle.
   */
  const [annotationModel, setAnnotationModel] =
    useState<AnnotationModel | null>(null);
  const model = (hasAnnotations && annotationModel) || NO_MODEL;
  /*
   * The picked annotation's place, where its body is a GeoJSON `Feature` (Cookbook 0139):
   * shown on a map in a box, as the information is, while it is picked.
   */
  const pickedPlace = useMemo(() => {
    const picked = allAnnotations?.find(
      (each) => each.annotation.id === model.selected,
    )?.annotation as Record<string, any> | undefined;
    const body = (
      Array.isArray(picked?.body) ? picked?.body : [picked?.body]
    ).find((each: any) => each?.type === "Feature");
    return picked && body
      ? {
          id: String(picked.id),
          feature: body as Record<string, unknown>,
          name: (body.properties?.label ?? picked.label) as
            | LanguageMapLike
            | undefined,
        }
      : null;
  }, [allAnnotations, model.selected]);
  // Its box open while it is picked, until closed; open again as it is picked again.
  const pickKey = pickedPlace ? `${pickedPlace.id}:${props.refind ?? 0}` : null;
  const [closedPick, setClosedPick] = useState<string | null>(null);
  const pickOpen = pickKey !== null && closedPick !== pickKey;
  /*
   * Where the shown Canvases are, else their Manifest (`navPlace`, Cookbook 0154 and 0240):
   * a map control opens a box of it, as the information control does. Its box is made the
   * first time it opens, MapLibre with it.
   */
  const places = useMemo(() => {
    const own = (canvases ?? [])
      .map((canvas) => (canvas as { navPlace?: any }).navPlace)
      .filter(Boolean);
    const source = own.length ? own : props.navPlace ? [props.navPlace] : [];
    if (!source.length) return null;
    const features = source.flatMap((place: any) =>
      place?.type === "FeatureCollection"
        ? (place.features ?? [])
        : place?.type === "Feature"
          ? [place]
          : [],
    );
    if (!features.length) return null;
    const named =
      features.length === 1 ? features[0]?.properties?.label : undefined;
    return {
      feature: { type: "FeatureCollection", features },
      name: (named ?? props.label) as LanguageMapLike | undefined,
    };
  }, [canvases, props.navPlace, props.label]);
  const placeId = `place-box-${instance}`;
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeShown, setPlaceShown] = useState(false);
  const modelRef = useRef(model);
  modelRef.current = model;
  const releaseAnnotation = useCallback(() => modelRef.current.release(), []);
  // Comments on a whole Canvas (Cookbook 0266, 0019), for the caption.
  const { comments, listedCount } = model;
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
  /*
   * A lone recording plays as a player (`media/Player.tsx`), its accompanying or
   * placeholder images its artwork: none of them is drawn in the scene.
   */
  const scene = useMemo(
    () =>
      canvases?.length
        ? canvasScene(canvases, direction, selections, {
            standIns: canvases.length > 1,
          })
        : null,
    [canvases, direction, selections],
  );
  const bodyImages = useMemo(
    () => toSceneImages(body, src, isTiledImage),
    [body, src, isTiledImage],
  );
  /*
   * The first painted video or sound, if any. Its element is made by the (lazy)
   * `MediaBody`; a video is then placed in the scene like any image, while sound has no
   * picture of its own and is never placed.
   */
  const media = scene?.media[0] ?? null;
  const [mediaElement, setMediaElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const onMediaElementRef = useRef(onMediaElement);
  onMediaElementRef.current = onMediaElement;
  const handleMediaElement = useCallback((element: HTMLVideoElement | null) => {
    setMediaElement(element);
    onMediaElementRef.current?.(element);
  }, []);
  const baseImages = scene ? scene.images : bodyImages;
  /*
   * A lone video or sound Canvas is a player, not a picture to explore: it is always
   * fitted to the Body, the camera stays put, and only full screen is offered from the
   * control cluster.
   */
  const mediaOnly = Boolean(media) && canvases?.length === 1;
  /*
   * A lone recording of sound is a player, as a music app's (Mat, 2026-10-24: Apple
   * Music's and Spotify's): its artwork, its title, the transport, its captions as lyrics
   * and its chapters as tracks, drawn by `MediaBody` (`media/Player.tsx`), never a picture.
   */
  const player = mediaOnly && media?.kind === "audio";
  /*
   * A lone Canvas that paints nothing (Cookbook 0283: a page missing from a book, its
   * `items` empty) is not a picture to explore either: the camera stays put, no zoom,
   * rotation, reset or full screen is offered, and its name shows in its Body (Mat,
   * 2026-10-29).
   */
  const empty =
    canvases?.length === 1 && !media && !animated && baseImages.length === 0;
  /**
   * The reader can move the camera: not a lone recording, nor a Canvas that paints
   * nothing, nor one held still by the host.
   */
  const navigable =
    !mediaOnly && !empty && options?.gestures?.navigable !== false;
  /*
   * The Canvases last drawn: when the host hands over others, frame them afresh. Told
   * apart by their Manifest too, as two Manifests may give their Canvases one id (Cookbook
   * 0230's maps are each `…/canvas/p1`, one 1286 wide, the other 5212): the second would
   * open in the first's view, zoomed in four times (Mat, 2026-10-29).
   */
  const canvasKey = canvases
    ? `${manifestId ?? ""}\n${canvases.map((canvas) => canvas.id).join("|")}`
    : null;
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
  /*
   * A player shows its placeholder as its artwork until it plays, its Play in reach: the
   * placeholder never holds it back.
   */
  const showPlaceholder =
    !player &&
    stills.length > 0 &&
    (media ? mediaOpenedFor !== canvasKey : !imagesOpen);
  /*
   * A lone media Canvas carries all its controls in the transport at the bottom: full
   * screen moves there, and the top cluster (and the scrim behind it) is shown only for a
   * `Choice` to pick from or information to read. Over a placeholder, only information.
   * A Canvas that paints nothing likewise, with nothing to zoom, turn or see full screen
   * (Mat, 2026-10-29).
   */
  const onlyInformation = (
    config: Required<CanvasControlsConfig>,
    { annotations = false, fullPage = false } = {},
  ): Required<CanvasControlsConfig> => ({
    ...config,
    zoom: false,
    rotation: false,
    reset: false,
    fullPage: fullPage && config.fullPage,
    annotations: annotations && config.annotations,
  });
  /*
   * Reached in full screen, a Canvas that paints nothing keeps full screen, and its way
   * out among its controls: it offers no way in, but never puts a reader out of it
   * (Mat, 2026-10-29).
   */
  const fullscreenExit = empty && withinFullscreen;
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
      ? captioned.length || hostControls || listedCount
        ? onlyInformation(controlsConfig, { annotations: true })
        : null
      : mediaOnly || empty
        ? choices.length ||
          captioned.length ||
          hostControls ||
          listedCount ||
          (fullscreenExit && controlsConfig.fullPage)
          ? onlyInformation(controlsConfig, {
              annotations: true,
              fullPage: fullscreenExit,
            })
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
   * Where the video sits: fitted inside its target at its own aspect once `MediaBody`
   * knows its frame size (`onFit`), and its target until then.
   */
  const [fitted, setFitted] = useState<Rect | null>(null);
  const videoPlacement = media ? (fitted ?? media.placement) : null;
  /*
   * An animation's frames that are not images (Cookbook 0489: a video in a region, and
   * text), made by `FrameAnimation` and drawn in the scene as itself, shown with its frame.
   */
  const [frameItems, setFrameItems] = useState<SceneImage[]>(NO_ITEMS);
  const images = useMemo<SceneImage[]>(() => {
    const withVideo =
      media?.kind === "video" && mediaElement && videoPlacement
        ? [
            ...baseImages,
            {
              id: media.id,
              placement: videoPlacement,
              width: videoPlacement.width,
              height: videoPlacement.height,
              media: { element: mediaElement },
            },
          ]
        : baseImages;
    return frameItems.length ? [...withVideo, ...frameItems] : withVideo;
  }, [baseImages, media, mediaElement, videoPlacement, frameItems]);
  // A lone video is framed by the video itself, so it fills the Body.
  const world =
    mediaOnly && media?.kind === "video" && fitted
      ? fitted
      : scene
        ? union(scene.placements)
        : null;
  // Every field matters (a new region is a new picture), so compare them all. An element
  // does not serialize, so the media item's presence stands in for it.
  const imagesKey = JSON.stringify([
    baseImages,
    world,
    images.length !== baseImages.length && [media?.id, videoPlacement],
    frameItems.map((item) => item.id),
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
  // A player's second line: what it is part of, where that is not its own name again.
  const partOfName = useMemo(() => {
    const name = localize(partOf as any, language);
    return name.text && name.text !== ownName?.text ? name : undefined;
  }, [partOf, language, ownName?.text]);
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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const surface = makeSurface(host, optionsRef.current);
    const renderer = hasCamera(surface) ? surface : null;
    surfaceRef.current = surface;
    setSurface(surface);
    surface.setDismiss(releaseAnnotation);

    const offOpen = surface.on("open", () => {
      setCleared(false);
      markDrawn();
      setStatus("ready");
      setSceneVersion((v) => v + 1);
      if (!renderer) return;
      onReadyRef.current?.(
        canvasHandle(
          renderer,
          () => drawnScene.current,
          (id) => {
            const annotation = modelRef.current.placed.find((a) => a.id === id);
            if (!annotation) return false;
            modelRef.current.select(annotation);
            // Its hotspot takes focus, as OpenSeadragon's overlay does in the Viewer.
            Array.from(
              renderer.overlays?.container.querySelectorAll<HTMLElement>(
                "[id]",
              ) ?? [],
            )
              .find((element) => element.id === id)
              ?.focus({ preventScroll: true });
            return true;
          },
        ),
      );
    });
    const offChange = surface.on("change", () => {
      setCleared(false);
      markDrawn();
      setStatus("ready");
      setSceneVersion((v) => v + 1);
    });
    const offError = surface.on("error", () => {
      if (!surface.isOpen) setStatus("error");
    });
    const offUnloadable = surface.on("unloadable", (failed) =>
      setUnloadable(Boolean(failed)),
    );
    const offViewport = surface.on("viewport", () => {
      if (renderer) onViewportChangeRef.current?.(renderer.getBounds());
    });

    return () => {
      offOpen();
      offChange();
      offError();
      offUnloadable();
      offViewport();
      surface.dispose();
      surfaceRef.current = null;
      setSurface(null);
    };
    // A new instanceId is a new viewer; nothing else remounts the surface
    // (`makeSurface` is a module's, and `releaseAnnotation` and `markDrawn` are stable).
  }, [instanceId, makeSurface, releaseAnnotation, markDrawn]);

  useEffect(() => {
    if (!renderer || !navigatorElement) return;
    return renderer.attachNavigator(navigatorElement);
  }, [renderer, navigatorElement]);

  // Held still over nothing: no drag, wheel, pinch or key moves the camera.
  useEffect(() => {
    if (!surface || !empty) return;
    surface.setGestures({ navigable: false });
    return () => surface.setGestures({});
  }, [surface, empty]);

  /*
   * Its way out goes with full screen: had it focus, focus moves to the viewport rather
   * than to the page's body (WCAG 2.4.3).
   */
  const exitFocused = useRef(false);
  useEffect(() => {
    if (fullscreenExit) return;
    const lost =
      !document.activeElement || document.activeElement === document.body;
    if (exitFocused.current && lost) hostRef.current?.focus();
    exitFocused.current = false;
  }, [fullscreenExit]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (showPlaceholder) placeholderShown.current = true;
    if (!surface || !nearViewport || showPlaceholder) return;
    const moved =
      shownCanvases.current !== null && shownCanvases.current !== canvasKey;
    // Loading until it is drawn: at first, and again whenever the view moves on.
    if (!surface.isOpen || moved) setStatus("loading");
    const fit =
      mediaOnly || (placeholderShown.current && surface.isOpen) || moved;
    shownCanvases.current = canvasKey;
    placeholderShown.current = false;
    surface.setImages(images, { world: world ?? undefined, fit });
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
    surfaceRef.current?.clear();
    setCleared(true);
    setStatus("loading");
  }, [manifestId]);

  /*
   * Loading, shown: images on their way to a Body in view, not behind a still. A Canvas
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
        data-unloadable={unloadable || undefined}
        data-has-navigator={showNavigator}
        data-fullscreen={isFullscreen}
        data-exit={exitShown || undefined}
        data-controls={controlsVisible ? "visible" : "hidden"}
        data-media={media?.kind}
        data-player={player ? "" : undefined}
        data-animated={animated ? "" : undefined}
        data-navigable={navigable}
        data-placeholder={
          stills.length && !player ? showPlaceholder : undefined
        }
        ref={root.ref}
        onFocus={(event) => {
          exitFocused.current =
            fullscreenExit && event.target.id === `fullPage-${instance}`;
        }}
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
         * Geometry inline: the Body fills its box with or without the stylesheet. Its
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
        {/* Revealed while this Canvas is full screen, or first in its Root that is. */}
        <ExitFullscreen hidden={!exitShown} />
        {surface && shownControls && (
          <Controls
            renderer={renderer}
            instance={instance}
            config={shownControls}
            controlButtons={controlButtons}
            hasPlaceholder={stills.length > 0}
            choices={showPlaceholder ? [] : choices}
            selections={selections}
            onSelect={selectChoice}
            annotations={model.menu}
            hiddenPages={model.hiddenPages}
            onPageVisibilityChange={model.setPagesVisible}
            selectedAnnotation={model.selected}
            onAnnotationSelect={model.select}
            onAnnotationActivate={model.activate}
            captionId={hasCaption ? captionId : undefined}
            captionOpen={isCaptionOpen}
            onCaptionToggle={() => setCaptionOpen((open) => !open)}
            placeId={places ? placeId : undefined}
            placeOpen={placeOpen}
            onPlaceToggle={() => {
              setPlaceShown(true);
              setPlaceOpen((open) => !open);
            }}
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
           * Geometry inline, so the Body holds its size without the stylesheet. Beneath
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
                <span {...languageProps(root.langOf(description))}>
                  {t(description)}
                </span>
              </React.Fragment>
            ))}
          </span>
        )}
        {/* Nothing it paints could be loaded: said in the middle of the Body. */}
        <BodyUnloadable kind="image" shown={unloadable && !showPlaceholder} />
        {/*
         * A Canvas that paints nothing shows its name in the middle of its Body, as a Body
         * that could not load says so: its label, else its Manifest's, and nothing where
         * neither has one. For the eye alone: the viewport carries the same name.
         */}
        {empty && !showPlaceholder && ownName?.text && (
          <BodyNote text={ownName.text} lang={ownName.lang || undefined} />
        )}
        {/*
         * Sound with no picture of its own, nor one shown for it, names itself in its
         * empty Body (Mat, 2026-10-23: "label these"), for the eye alone: the viewport
         * already carries the name.
         */}
        {media?.kind === "audio" &&
          !player &&
          baseImages.length === 0 &&
          !showPlaceholder &&
          ownName?.text && (
            <p
              className="clover-canvas-sound-label"
              aria-hidden="true"
              {...languageProps(ownName.lang || undefined)}
            >
              {ownName.text}
            </p>
          )}
        {stills.length > 0 && !player && (
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
            request={options?.request}
          />
        )}
        {surface && media && nearViewport && !showPlaceholder && (
          <Suspense fallback={null}>
            {/*
             * Not keyed by the media: from one recording to the next (auto-advance), the
             * transport stays, and so does the keyboard focus on it (WCAG 2.4.3).
             */}
            <MediaBody
              media={media}
              request={options?.request}
              surface={surface}
              instance={instance}
              onElement={handleMediaElement}
              onFit={setFitted}
              onCaptionChange={onCaptionChange}
              caption={caption}
              navigable={navigable}
              fullscreen={mediaOnly && Boolean(controlsConfig?.fullPage)}
              // Inside full screen, the Canvas's or its Root's: the way out to name.
              isFullscreen={withinFullscreen}
              onEnded={onEnded}
              chapters={chapters}
              highlightedChapter={highlightedChapter}
              onChapterHighlight={onChapterHighlight}
              autoPlay={
                !player &&
                stills.length > 0 &&
                model.quietlyOpened !== canvasKey
              }
              language={language}
              notes={model.timed}
              player={
                player && canvases
                  ? {
                      canvas: canvases[0],
                      title: ownName,
                      partOf: partOfName,
                    }
                  : undefined
              }
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
                duration={Number((animated as { duration?: number }).duration)}
                canvas={animated}
                place={scene.placements[canvases!.indexOf(animated)]}
                onItems={setFrameItems}
              />
            </Suspense>
          )}
        {/* The annotations' state, and the hotspots it draws (`AnnotationState`). */}
        {hotspots && hasAnnotations && allAnnotations && (
          <hotspots.AnnotationState
            given={props}
            annotations={layered ?? allAnnotations}
            scene={scene}
            renderer={renderer}
            sceneVersion={sceneVersion}
            drawn={drawn}
            media={media}
            mediaElement={mediaElement}
            showPlaceholder={showPlaceholder}
            canvasKey={canvasKey}
            openImages={setImagesOpen}
            openMedia={setMediaOpenedFor}
            host={hostRef}
            onModel={setAnnotationModel}
            refind={props.refind ?? 0}
          />
        )}
        {loading && <Loading overlay />}
        {pickedPlace && (
          <Suspense fallback={null}>
            <PlaceBox
              id={`place-of-${instance}`}
              open={pickOpen}
              onClose={(restoreFocus) => {
                setClosedPick(pickKey);
                if (restoreFocus)
                  document.getElementById(pickedPlace.id)?.focus();
              }}
              feature={pickedPlace.feature}
              name={pickedPlace.name}
              language={language}
            />
          </Suspense>
        )}
        {places && placeShown && (
          <Suspense fallback={null}>
            <PlaceBox
              id={placeId}
              open={placeOpen}
              onClose={(restoreFocus) => {
                setPlaceOpen(false);
                if (restoreFocus)
                  document.getElementById(`place-${instance}`)?.focus();
              }}
              feature={places.feature}
              name={places.name}
              language={language}
            />
          </Suspense>
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

const NO_FRAMES: AnimationFrame[] = [];
const NO_ITEMS: SceneImage[] = [];

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
