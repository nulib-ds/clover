import React, { useCallback, useState } from "react";

import type { CanvasControlsConfig } from "./Canvas.types";
import type { ListedAnnotation } from "./Annotations";
import { Comment, Information } from "../Body/glyphs";
import Button from "../../ui/Button";
import type { ChoiceGroup, ChoiceSelections } from "./layout";
import ControlCluster, { type ControlSpec } from "../../ui/ControlCluster";
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
import { useLoaded } from "../../hooks/useLoaded";
import { SHORTCUTS } from "../../ui/Tip";
import type { CanvasRenderer } from "../../lib/renderer";

/*
 * The annotations and Choice menus, each fetched once its control shows, so it is there
 * by the time it is pressed, and never for a Canvas that offers neither.
 */
const loadAnnotationMenu = () => import("./AnnotationMenu");
const loadChoiceMenu = () => import("./ChoiceMenu");

/** OpenSeadragon's `zoomPerClick`. */
const ZOOM_PER_CLICK = 2;

interface CanvasControlsProps {
  renderer: CanvasRenderer;
  instance: string;
  config: Required<CanvasControlsConfig>;
  controlButtons?: ControlButtons;
  hasPlaceholder?: boolean;
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
  /** The language to read the Choices' labels in. The reader's, by default. */
  language?: string;
  children?: React.ReactNode;
}

/**
 * `Canvas`'s controls: the same cluster `Image` renders — markup, layout hooks and the
 * `controlButtons` contract — driven by click handlers instead of OpenSeadragon's id
 * binding. Ids keep the `<key>-<instance>` shape so `data-button` reads the same.
 */
const Controls: React.FC<CanvasControlsProps> = ({
  renderer,
  instance,
  config,
  controlButtons,
  hasPlaceholder,
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
  language,
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
  const controls = (isFullscreen: boolean): ControlSpec[] => {
    const specs: ControlSpec[] = [];
    if (config.zoom) {
      specs.push(
        {
          key: "zoomIn",
          id: `zoomIn-${instance}`,
          shortcut: SHORTCUTS.zoomIn,
          label: t("imageZoomIn"),
          lang: langOf("imageZoomIn"),
          glyph: <ZoomIn />,
          onClick: () => renderer.zoomBy(ZOOM_PER_CLICK),
        },
        {
          key: "zoomOut",
          id: `zoomOut-${instance}`,
          shortcut: SHORTCUTS.zoomOut,
          label: t("imageZoomOut"),
          lang: langOf("imageZoomOut"),
          glyph: <ZoomOut />,
          onClick: () => renderer.zoomBy(1 / ZOOM_PER_CLICK),
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
    if (config.rotation) {
      specs.push(
        {
          key: "rotateRight",
          id: `rotateRight-${instance}`,
          shortcut: SHORTCUTS.rotateRight,
          label: t("imageRotateRight"),
          lang: langOf("imageRotateRight"),
          glyph: <Rotate />,
          onClick: () => renderer.rotateBy(90),
        },
        {
          key: "rotateLeft",
          id: `rotateLeft-${instance}`,
          shortcut: SHORTCUTS.rotateLeft,
          label: t("imageRotateLeft"),
          lang: langOf("imageRotateLeft"),
          glyph: <Rotate />,
          onClick: () => renderer.rotateBy(-90),
        },
      );
    }
    if (config.reset) {
      specs.push({
        key: "reset",
        id: `reset-${instance}`,
        shortcut: SHORTCUTS.reset,
        label: t("imageResetZoom"),
        lang: langOf("imageResetZoom"),
        glyph: <Reset />,
        // Home also turns the image upright, as `Image`'s reset does.
        onClick: () => renderer.home(),
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

  return (
    <>
      <ControlCluster
        controls={controls}
        controlButtons={controlButtons}
        hasPlaceholder={hasPlaceholder}
      >
        {/*
          Not `ControlSpec`s: those are keyed by the Viewer's `ControlButtons`, and these
          controls are Canvas's alone, so they are not replaceable through `controlButtons`.
        */}
        {showAnnotations && (
          <Button
            id={annotationsId}
            label={annotationsLabel}
            lang={annotationsLang}
            onClick={() => setAnnotationsOpen((open) => !open)}
            expanded={annotationsOpen}
            controls={annotationsMenuId}
          >
            <Comment />
          </Button>
        )}
        {showInformation && (
          <Button
            id={`information-${instance}`}
            label={t("informationPanelTabsAbout")}
            lang={langOf("informationPanelTabsAbout")}
            onClick={onCaptionToggle}
            expanded={captionOpen}
            controls={captionId}
          >
            <Information />
          </Button>
        )}
        {children}
      </ControlCluster>
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
