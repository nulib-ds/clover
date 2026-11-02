import React, { useCallback, useEffect, useRef, useState } from "react";

import type { CanvasControlsConfig } from "./Canvas.types";
import type { ListedAnnotation } from "./Annotations";
import { Chapters, Comment, Information, Place } from "../Body/glyphs";
import type { TransportChapter } from "./media/Transport";
import type { CloverRequest } from "../../core/request";
import Button from "../../ui/Button";
import type { ChoiceGroup, ChoiceSelections } from "./layout";
import ControlCluster, {
  type ControlSpec,
  renderControl,
} from "../../ui/ControlCluster";
import {
  Choice,
  Reset,
  Rotate,
  ZoomExitFullScreen,
  ZoomFullScreen,
  ZoomIn,
  ZoomOut,
} from "../../ui/controlGlyphs";
import type { ControlButtons } from "../../ui/controlButtons";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { localize } from "../../core/value";
import { toggleFullscreen } from "../../lib/fullscreen";
import useFullscreenSupported from "../../hooks/useFullscreenSupported";
import useWithinFullscreen from "../../hooks/useWithinFullscreen";
import { useLoaded } from "../../hooks/useLoaded";
import { Fits } from "./RowFits";
import { SHORTCUTS } from "../../ui/Tip";
import type { CanvasRenderer } from "../../lib/renderer";

/*
 * The annotations and Choice menus, each fetched once its control shows, so it is there
 * by the time it is pressed, and never for a Canvas that offers neither.
 */
const loadAnnotationMenu = () => import("./AnnotationMenu");
const loadChaptersMenu = () => import("./ChaptersMenu");
const loadChoiceMenu = () => import("./ChoiceMenu");
/*
 * The image controls' button and tray (`ImageControls`), loaded only where needed: where
 * the row cannot hold the view's controls, which `Fits` measures, or always where asked
 * (Mat, 2026-11-01: "rename More as ImageControls. load it dynamically").
 */
const loadImageControls = () => import("./ImageControls");

/** OpenSeadragon's `zoomPerClick`. */
const ZOOM_PER_CLICK = 2;

/**
 * The view's controls, which wait behind More where the row cannot hold them all (Mat,
 * 2026-11-01: "the more should be + / - rotate, reset, and fullscreen controls").
 */
const VIEW = new Set<ControlSpec["key"]>([
  "zoomIn",
  "zoomOut",
  "rotateRight",
  "rotateLeft",
  "reset",
  "fullPage",
]);

interface CanvasControlsProps {
  /** The camera the zoom, rotation and reset controls move; none offers them. */
  renderer: CanvasRenderer | null;
  instance: string;
  config: Required<CanvasControlsConfig>;
  controlButtons?: ControlButtons;
  /** A placeholder's toggle (`PlaceholderToggle`), last of the Canvas's own. */
  placeholder?: React.ReactNode;
  /**
   * That toggle is an image's, opening and closing its viewer: More, the tray of the
   * view's controls opening and closing with it.
   */
  placeholderIsMore?: boolean;
  /** The Canvas's `Choice`s. With any, a control to pick among their items appears. */
  choices?: ChoiceGroup[];
  selections?: ChoiceSelections;
  onSelect?: (key: string, index: number) => void;
  /**
   * A recording's chapters, and its element: with any, a control lists them, left of the
   * annotations' (`ChaptersMenu`; Mat, 2026-11-01).
   */
  chapters?: TransportChapter[];
  mediaElement?: HTMLMediaElement | null;
  /** Go to a chapter's start: the Canvas opens the recording first, over its still. */
  onChapter?: (start: number) => void;
  /** How the chapters' pictures are fetched. */
  request?: CloverRequest;
  /** The Canvas's annotations, on its picture and its time. With any, a control lists them. */
  annotations?: ListedAnnotation[];
  /** The pages whose annotations are hidden, which the menu lists with their toggles. */
  hiddenPages?: string[];
  onPageVisibilityChange?: (pageIds: string[], visible: boolean) => void;
  selectedAnnotation?: string | null;
  onAnnotationSelect?: (annotation: ListedAnnotation) => void;
  onAnnotationActivate?: (id: string | null) => void;
  /**
   * The id of the Canvas's caption when it has information to show (`Caption`, which the
   * Canvas renders in its `<figure>`), whether it is open, and the toggle.
   */
  captionId?: string;
  captionOpen?: boolean;
  onCaptionToggle?: () => void;
  /**
   * The id of the box of the Canvas's place (its `navPlace`, else its Manifest's) when it
   * has one (`PlaceBox`), whether it is open, and the toggle.
   */
  placeId?: string;
  placeOpen?: boolean;
  onPlaceToggle?: () => void;
  /** The language to read the Choices' labels in. The reader's, by default. */
  language?: string;
  /** One row, the rest behind More: a Canvas's. A Timeline's wraps onto rows, as yet. */
  fit?: boolean;
  /** When the view's controls wait behind More: where the row is full, or always. */
  more?: "auto" | "always";
  children?: React.ReactNode;
}

/**
 * `Canvas`'s controls: the same cluster `Image` renders — markup, layout hooks and the
 * `controlButtons` contract — driven by click handlers instead of OpenSeadragon's id
 * binding. Ids keep the `<key>-<instance>` shape so `data-button` reads the same.
 *
 * One row, never wrapped (Mat, 2026-11-01): the view's (zoom, the turns, reset, full
 * screen) and a placeholder's toggle, then Choice and the Canvas's own (the place,
 * annotations, the `i`). Where they do not all fit, the view's wait behind More, in their
 * place, the others in sight as its tray runs left from it (`ImageControls.tsx`). A host's own,
 * after them, always keep theirs.
 */
const Controls: React.FC<CanvasControlsProps> = ({
  renderer,
  instance,
  config,
  controlButtons,
  placeholder,
  placeholderIsMore = false,
  choices = [],
  selections = {},
  onSelect,
  annotations = [],
  chapters = [],
  mediaElement = null,
  onChapter,
  request,
  hiddenPages,
  onPageVisibilityChange,
  selectedAnnotation = null,
  onAnnotationSelect,
  onAnnotationActivate,
  captionId,
  captionOpen = false,
  onCaptionToggle,
  placeId,
  placeOpen = false,
  onPlaceToggle,
  language,
  fit = true,
  more: moreWhen = "auto",
  children,
}) => {
  const { t, langOf } = useCloverTranslation();
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const annotationsId = `annotations-${instance}`;
  const annotationsMenuId = `${annotationsId}-menu`;
  // The Information panel's word for them, so no new string is needed.
  const annotationsLabel = t("informationPanelTabsAnnotations");
  const annotationsLang = langOf("informationPanelTabsAnnotations");
  const closeAnnotations = useCallback(
    (restoreFocus: boolean) => {
      setAnnotationsOpen(false);
      onAnnotationActivate?.(null);
      if (restoreFocus) document.getElementById(annotationsId)?.focus();
    },
    [annotationsId, onAnnotationActivate],
  );
  const showAnnotations =
    config.annotations && annotations.length > 0 && onAnnotationSelect;
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const chaptersId = `chapters-${instance}`;
  const chaptersMenuId = `${chaptersId}-menu`;
  const showChapters = chapters.length > 0 && Boolean(onChapter);
  /*
   * Its control gone while it had focus (the next recording has no chapters, or nothing
   * the row would show, so the row goes too): focus goes to the transport's Play, as the
   * transport's own controls hand it on, never to the page (WCAG 2.4.3).
   */
  const chaptersFocused = useRef(false);
  const figure = useRef<Element | null>(null);
  useEffect(() => {
    const follow = () => {
      chaptersFocused.current = document.activeElement?.id === chaptersId;
    };
    document.addEventListener("focusin", follow);
    return () => document.removeEventListener("focusin", follow);
  }, [chaptersId]);
  const handOn = useCallback(() => {
    if (!chaptersFocused.current) return;
    chaptersFocused.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    figure.current
      ?.querySelector<HTMLElement>(
        '.clover-canvas-transport :is([data-button="play"], [data-button="pause"])',
      )
      ?.focus();
  }, []);
  useEffect(() => {
    if (!showChapters) handOn();
  }, [showChapters, handOn]);
  // The row itself gone: after it is, so focus is no longer on its control.
  useEffect(() => () => handOn(), [handOn]);
  const closeChapters = useCallback(
    (restoreFocus: boolean) => {
      setChaptersOpen(false);
      if (restoreFocus) document.getElementById(chaptersId)?.focus();
    },
    [chaptersId],
  );
  const showInformation = config.information && captionId && onCaptionToggle;
  const showPlace = config.map && placeId && onPlaceToggle;
  const choiceId = `choice-${instance}`;
  /*
   * The control is named by the Manifest where it can be: the Choice's own `label` when
   * there is one Choice that has one. Otherwise the IIIF term, so an icon-only button
   * still has a name for assistive technology.
   */
  const ownChoiceLabel =
    choices.length === 1 ? localize(choices[0].label as any, language) : null;
  const choiceLabel = ownChoiceLabel?.text || t("canvasChoice");
  const choiceLang = ownChoiceLabel?.text
    ? ownChoiceLabel.lang
    : langOf("canvasChoice");
  const menuId = `${choiceId}-menu`;
  const AnnotationMenu = useLoaded(
    loadAnnotationMenu,
    Boolean(showAnnotations),
  )?.default;
  const ChaptersMenu = useLoaded(loadChaptersMenu, showChapters)?.default;
  const ChoiceMenu = useLoaded(
    loadChoiceMenu,
    choices.length > 0 && Boolean(onSelect),
  )?.default;
  const closeChoice = useCallback(
    (restoreFocus: boolean) => {
      setChoiceOpen(false);
      if (restoreFocus) document.getElementById(choiceId)?.focus();
    },
    [choiceId],
  );

  // iPhone Safari cannot full-screen an element: the control is not offered there.
  const canFullscreen = useFullscreenSupported();
  const [cluster, setCluster] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    figure.current = cluster?.closest(".clover-canvas") ?? null;
  }, [cluster]);
  /*
   * Whether these controls are inside whatever is full screen, so the full-screen control
   * names and draws the way out: the Viewer's element, or the Canvas's own.
   */
  const isFullscreen = useWithinFullscreen(cluster);
  const [moreOpen, setMoreOpen] = useState(false);
  const annotationsButton = (className?: string) => (
    <Button
      key="annotations"
      className={className}
      id={annotationsId}
      label={annotationsLabel}
      lang={annotationsLang}
      onClick={() => setAnnotationsOpen((open) => !open)}
      expanded={annotationsOpen}
      controls={annotationsMenuId}
    >
      <Comment />
    </Button>
  );
  const controls = (): ControlSpec[] => {
    const specs: ControlSpec[] = [];
    const camera = renderer;
    if (config.zoom && camera) {
      specs.push(
        {
          key: "zoomIn",
          id: `zoomIn-${instance}`,
          shortcut: SHORTCUTS.zoomIn,
          label: t("imageZoomIn"),
          lang: langOf("imageZoomIn"),
          glyph: <ZoomIn />,
          onClick: () => camera.zoomBy(ZOOM_PER_CLICK),
        },
        {
          key: "zoomOut",
          id: `zoomOut-${instance}`,
          shortcut: SHORTCUTS.zoomOut,
          label: t("imageZoomOut"),
          lang: langOf("imageZoomOut"),
          glyph: <ZoomOut />,
          onClick: () => camera.zoomBy(1 / ZOOM_PER_CLICK),
        },
      );
    }
    if (config.fullPage && canFullscreen) {
      specs.push({
        key: "fullPage",
        id: `fullPage-${instance}`,
        label: isFullscreen ? t("imageExitFullScreen") : t("imageFullScreen"),
        lang: langOf(isFullscreen ? "imageExitFullScreen" : "imageFullScreen"),
        glyph: isFullscreen ? <ZoomExitFullScreen /> : <ZoomFullScreen />,
        // Straight from the click: the Fullscreen API only honors a user gesture.
        onClick: (event) => void toggleFullscreen(event.currentTarget),
      });
    }
    if (config.rotation && camera) {
      specs.push(
        {
          key: "rotateRight",
          id: `rotateRight-${instance}`,
          shortcut: SHORTCUTS.rotateRight,
          label: t("imageRotateRight"),
          lang: langOf("imageRotateRight"),
          glyph: <Rotate />,
          onClick: () => camera.rotateBy(90),
        },
        {
          key: "rotateLeft",
          id: `rotateLeft-${instance}`,
          shortcut: SHORTCUTS.rotateLeft,
          label: t("imageRotateLeft"),
          lang: langOf("imageRotateLeft"),
          glyph: <Rotate />,
          onClick: () => camera.rotateBy(-90),
        },
      );
    }
    if (config.reset && camera) {
      specs.push({
        key: "reset",
        id: `reset-${instance}`,
        shortcut: SHORTCUTS.reset,
        label: t("imageResetZoom"),
        lang: langOf("imageResetZoom"),
        glyph: <Reset />,
        // Home also turns the image upright, as `Image`'s reset does.
        onClick: () => camera.home(),
      });
    }
    if (choices.length) {
      specs.push({
        key: "choice",
        id: choiceId,
        label: choiceLabel,
        lang: choiceLang,
        glyph: <Choice />,
        onClick: () => setChoiceOpen((open) => !open),
        expanded: choiceOpen,
        controls: menuId,
      });
    }
    return specs;
  };
  /*
   * Full screen ends the view's controls, over every picture alike, whichever of them a
   * Canvas offers (Mat, 2026-10-29), before the Canvas's own (below).
   */
  const specs = controls();
  const view = [
    ...specs.filter((spec) => spec.key !== "fullPage"),
    ...specs.filter((spec) => spec.key === "fullPage"),
  ].map((spec) => ({
    id: spec.id,
    view: VIEW.has(spec.key),
    node: renderControl(spec, controlButtons),
  }));
  /*
   * Not `ControlSpec`s: those are keyed by the Viewer's `ControlButtons`, and these
   * controls are Canvas's alone, so they are not replaceable through `controlButtons`.
   */
  const own = [
    showPlace && {
      id: `place-${instance}`,
      view: false,
      node: (
        <Button
          key="place"
          id={`place-${instance}`}
          label={t("mapLabel")}
          lang={langOf("mapLabel")}
          onClick={onPlaceToggle}
          expanded={placeOpen}
          controls={placeId}
        >
          <Place />
        </Button>
      ),
    },
    showChapters && {
      id: chaptersId,
      view: false,
      node: (
        <Button
          key="chapters"
          id={chaptersId}
          label={t("playerChapters")}
          lang={langOf("playerChapters")}
          onClick={() => setChaptersOpen((open) => !open)}
          expanded={chaptersOpen}
          controls={chaptersMenuId}
        >
          <Chapters />
        </Button>
      ),
    },
    showAnnotations && {
      id: annotationsId,
      view: false,
      node: annotationsButton(),
    },
    showInformation && {
      id: `information-${instance}`,
      view: false,
      node: (
        <Button
          key="information"
          id={`information-${instance}`}
          label={t("informationPanelTabsAbout")}
          lang={langOf("informationPanelTabsAbout")}
          onClick={onCaptionToggle}
          expanded={captionOpen}
          controls={captionId}
        >
          <Information />
        </Button>
      ),
    },
    Boolean(placeholder) && {
      id: `placeholder-${instance}`,
      view: false,
      node: <React.Fragment key="placeholder">{placeholder}</React.Fragment>,
    },
  ].filter(
    (item): item is { id: string; view: boolean; node: React.ReactElement } =>
      Boolean(item),
  );
  /*
   * The view's first, full screen last, then a placeholder's toggle: what waits behind
   * More, which stands where they do; then Choice and the Canvas's own, the place,
   * annotations and the `i`, at the row's end, in sight whether or not the view's fit
   * beside them (Mat, 2026-11-01: "make it now so order from right to left is: `i`,
   * annotations, map, then the viewer controls"; the Canvas's own led the row for a
   * while that day, and stood after the view's before it).
   */
  const toggle = own.filter((item) => item.id === `placeholder-${instance}`);
  const lead = [...view.filter((item) => item.view), ...toggle];
  const rest = [
    ...view.filter((item) => !item.view),
    ...own.filter((item) => !toggle.includes(item)),
  ];
  const items = [...lead, ...rest];
  // Whether they all fit, measured as the row is drawn: a Canvas's, never a Timeline's.
  const [fits, setFits] = useState(true);
  /*
   * Behind More where the row is full, or always; until it arrives, all on the row. An
   * image's placeholder toggle is More (Mat, 2026-11-01: "the placeholder toggle is the
   * more controls button. it would both open the viewer … but also expand the controls
   * at the same time … the placeholder toggle off would toggle off the viewer. likewise
   * it would also always turn off controls deck"): its tray is open while the view is,
   * its toggle at its end, wherever the Canvas offers the view's controls.
   */
  const always = moreWhen === "always" || placeholderIsMore;
  const ImageControls = useLoaded(
    loadImageControls,
    fit && (always || !fits) && items.some((item) => item.view),
  )?.ImageControls;
  const tucked =
    (fits && !always) || !ImageControls
      ? []
      : items.filter((item) => item.view);
  const deck = placeholderIsMore && tucked.length > 0;
  // Nothing behind it any more: it closes, so it comes back closed.
  useEffect(() => {
    if (!tucked.length) setMoreOpen(false);
  }, [tucked.length]);

  // On the row: all but what waits behind More, and an image's toggle where it is More.
  const shown = (list: typeof items) =>
    list
      .filter(
        (item) =>
          !tucked.includes(item) &&
          !(deck && item.id === `placeholder-${instance}`),
      )
      .map(({ node }) => node);

  return (
    <>
      <ControlCluster fit={fit} clusterRef={setCluster}>
        {/*
          The view's, or More in their place, its tray running left from it as it opens,
          the others kept in sight beside it ("make it so the other controls are still
          visible and don't disappear. just expand the controls to the left"); then the
          Canvas's own.
        */}
        {shown(lead)}
        {ImageControls && tucked.length > 0 && (
          <ImageControls
            instance={instance}
            open={deck || moreOpen}
            onOpenChange={setMoreOpen}
            toggle={deck ? placeholder : undefined}
          >
            {tucked.map(({ node }) => node)}
          </ImageControls>
        )}
        {shown(rest)}
        {children}
      </ControlCluster>
      {fit && !always && cluster && (
        <Fits
          cluster={cluster}
          ids={items.map(({ id }) => id)}
          more={`more-${instance}`}
          fits={fits}
          onFits={setFits}
        />
      )}
      {/*
        The menus are the Canvas's own children, not the controls', as its information
        is: all three hang in one place, below the controls, and stay under them, so a
        control's Tip is never covered (`ControlMenu.css`).
      */}
      {ChaptersMenu && chaptersOpen && showChapters && (
        <ChaptersMenu
          id={chaptersMenuId}
          triggerId={chaptersId}
          label={t("playerChapters")}
          labelLang={langOf("playerChapters")}
          chapters={chapters}
          element={mediaElement}
          onChapter={onChapter!}
          request={request}
          onClose={closeChapters}
        />
      )}
      {AnnotationMenu && annotationsOpen && showAnnotations && (
        <AnnotationMenu
          id={annotationsMenuId}
          triggerId={annotationsId}
          label={annotationsLabel}
          labelLang={annotationsLang}
          annotations={annotations}
          hiddenPages={hiddenPages}
          onPageVisibilityChange={onPageVisibilityChange}
          selected={selectedAnnotation}
          onSelect={onAnnotationSelect}
          onActivate={(id) => onAnnotationActivate?.(id)}
          onClose={closeAnnotations}
        />
      )}
      {ChoiceMenu && choiceOpen && choices.length > 0 && onSelect && (
        <ChoiceMenu
          id={menuId}
          triggerId={choiceId}
          label={choiceLabel}
          labelLang={choiceLang}
          language={language}
          choices={choices}
          selections={selections}
          onSelect={onSelect}
          onClose={closeChoice}
        />
      )}
    </>
  );
};

export default Controls;
