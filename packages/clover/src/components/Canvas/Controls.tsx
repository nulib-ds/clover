import React, { useCallback, useEffect, useState } from "react";

import type { CanvasControlsConfig } from "./Canvas.types";
import type { ListedAnnotation } from "./Annotations";
import { Comment, Information, Place } from "../Body/glyphs";
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
import { SHORTCUTS } from "../../ui/Tip";
import type { CanvasRenderer } from "../../lib/renderer";

/*
 * The annotations and Choice menus, each fetched once its control shows, so it is there
 * by the time it is pressed, and never for a Canvas that offers neither.
 */
const loadAnnotationMenu = () => import("./AnnotationMenu");
const loadChoiceMenu = () => import("./ChoiceMenu");
// More, and the measuring that says when it is needed: any Canvas's, never a Timeline's.
const loadMore = () => import("./More");

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
 * One row, never wrapped (Mat, 2026-11-01): where they do not all fit, the view's (zoom,
 * the turns, reset, full screen) wait behind More, at the end of the others (Choice and
 * the Canvas's own: annotations, place, the `i`, a placeholder's toggle), which keep
 * their order and stay in sight as its tray runs left from it (`More.tsx`). A host's
 * own, after them, always keep theirs.
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
  /*
   * Whether these controls are inside whatever is full screen, so the full-screen control
   * names and draws the way out: the Viewer's element, or the Canvas's own.
   */
  const isFullscreen = useWithinFullscreen(cluster);
  const [moreOpen, setMoreOpen] = useState(false);
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
   * Canvas offers: left of the Canvas's own, the `i` among them (Mat, 2026-10-29).
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
    showAnnotations && {
      id: annotationsId,
      view: false,
      node: (
        <Button
          key="annotations"
          id={annotationsId}
          label={annotationsLabel}
          lang={annotationsLang}
          onClick={() => setAnnotationsOpen((open) => !open)}
          expanded={annotationsOpen}
          controls={annotationsMenuId}
        >
          <Comment />
        </Button>
      ),
    },
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
  const items = [...view, ...own];
  // Whether they all fit, measured where More is, which loads for a Canvas alone.
  const [fits, setFits] = useState(true);
  const more = useLoaded(loadMore, fit);
  const More = more?.More;
  /*
   * Behind More where the row is full, or always; until it arrives, all on the row. An
   * image's placeholder toggle is More (Mat, 2026-11-01: "the placeholder toggle is the
   * more controls button. it would both open the viewer … but also expand the controls
   * at the same time … the placeholder toggle off would toggle off the viewer. likewise
   * it would also always turn off controls deck"): its tray is open while the view is,
   * its toggle at its end, wherever the Canvas offers the view's controls.
   */
  const always = moreWhen === "always" || placeholderIsMore;
  const tucked =
    (fits && !always) || !More ? [] : items.filter((item) => item.view);
  const deck = placeholderIsMore && tucked.length > 0;
  // Nothing behind it any more: it closes, so it comes back closed.
  useEffect(() => {
    if (!tucked.length) setMoreOpen(false);
  }, [tucked.length]);

  return (
    <>
      <ControlCluster fit={fit} clusterRef={setCluster}>
        {/*
          The others in their order, then More, far right (Mat, 2026-11-01: "put it far
          right"); open, its tray runs left from it, the others kept in sight beside it
          ("make it so the other controls are still visible and don't disappear. just
          expand the controls to the left").
        */}
        {items
          .filter(
            (item) =>
              !tucked.includes(item) &&
              !(deck && item.id === `placeholder-${instance}`),
          )
          .map(({ node }) => node)}
        {More && tucked.length > 0 && (
          <More
            instance={instance}
            open={deck || moreOpen}
            onOpenChange={setMoreOpen}
            toggle={deck ? placeholder : undefined}
          >
            {tucked.map(({ node }) => node)}
          </More>
        )}
        {children}
      </ControlCluster>
      {more && fit && !always && cluster && (
        <more.Fits
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
