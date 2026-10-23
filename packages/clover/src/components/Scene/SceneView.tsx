import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { SceneEngine } from "./drawing";
import { attachOrbitGestures } from "./gestures";
import {
  type Bounds,
  type Orbit,
  homeOrbit,
  sameOrbit,
  turned,
  zoomed,
} from "./orbit";
import { type IIIFScene, sceneBackground, sceneModels } from "./models";
import { Caret, RotatePad, showOrientation } from "./RotatePad";
import type { IIIFCanvas } from "../Canvas/layout";
import Caption, { captionLabelId, hasInformation } from "../Body/Caption";
import { BodyAlert } from "../Body/BodyAlert";
import { Information } from "../Body/glyphs";
import { useControlsVisibility } from "../Body/useControlsVisibility";
import { useNearViewport } from "../Body/useNearViewport";
import type { CloverRequest } from "../../core/request";
import { requestKey } from "../../core/request";
import { localize } from "../../core/value";
import useFullscreen from "../../hooks/useFullscreen";
import useFullscreenSupported from "../../hooks/useFullscreenSupported";
import useWithinFullscreen from "../../hooks/useWithinFullscreen";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { toggleFullscreen } from "../../lib/fullscreen";
import {
  type ContextHolder,
  claimContext,
  returnContext,
} from "../../lib/renderer/backends/contexts";
import { useRootLanguage } from "../../react/language";
import Button from "../../ui/Button";
import ControlCluster, {
  type ControlSpec,
  renderControl,
} from "../../ui/ControlCluster";
import type { ControlButtons } from "../../ui/controlButtons";
import {
  Reset,
  ZoomExitFullScreen,
  ZoomFullScreen,
  ZoomIn,
  ZoomOut,
} from "../../ui/controlGlyphs";
import { ErrorBoundary } from "../../ui/ErrorBoundary";
import ExitFullscreen from "../../ui/ExitFullscreen";
import { Loading } from "../../ui/Loading";
import { SHORTCUTS, forwardShortcut } from "../../ui/Tip";
import { useContainerName } from "../../ui/useContainerName";
import { useUniqueId } from "../../ui/useUniqueId";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * The Scene's drawing: Clover's own, or three.js's for a Scene that asks for it (`engine`),
 * each loaded when a Scene that draws with it first comes near the window.
 */
const ENGINES = {
  clover: () => import("./cloverEngine"),
  three: () => import("./engine"),
};

/** Which of the Scene's controls to show. All are on by default. */
export interface SceneControlsConfig {
  zoom?: boolean;
  fullPage?: boolean;
  rotation?: boolean;
  reset?: boolean;
  /** An `i` control that slides out the Scene's `summary` and `metadata`. */
  information?: boolean;
}

export interface SceneProps {
  /**
   * A Presentation 4 Scene to draw: the models it paints, where it places them. Upgrade
   * older resources with `toPresentation4()`. Inside a `Root`, leave it out to draw the
   * Root's view.
   */
  scene?: IIIFScene;
  /**
   * A Scene to load and draw, on its own, outside any `Root`: a URL or an object, in any
   * Presentation version, fetched with `options.request`. A Manifest gives its first
   * Scene.
   */
  iiifContent?: string | Record<string, unknown>;
  /** The view's accessible name: the Scene's own label by default. */
  label?: unknown;
  /** The language to read IIIF text in. The reader's, by default; inside a `Root`, the Root's. */
  language?: string;
  className?: string;
  /** All of Clover's controls (`true`, the default), none (`false`), or all but those set `false`. */
  controls?: boolean | SceneControlsConfig;
  /** Replace any control with your own component, as `Canvas` takes them. */
  controlButtons?: ControlButtons;
  options?: {
    /** Credentials and headers for the Scene and its models. Inside a `Root`, the Root's. */
    request?: CloverRequest;
    /** Milliseconds the controls stay after a mouse stops moving, as `Canvas`'s. */
    hideDelay?: number;
  };
  /**
   * The Manifest the Scene is from: when it changes, the last one's models go at once. A
   * `Root` sets it.
   */
  manifestId?: string;
  /**
   * What draws the models: Clover's own WebGL2 renderer (`"clover"`, the default), or
   * three.js (`"three"`), loaded only for a Scene that asks for it, for what Clover's does
   * not draw yet (compressed models, animations, glTF's material extensions).
   */
  engine?: "clover" | "three";
  /** Rendered after the controls in the cluster: a host's own controls. */
  children?: React.ReactNode;
}

const ALL_CONTROLS: Required<SceneControlsConfig> = {
  zoom: true,
  fullPage: true,
  rotation: true,
  reset: true,
  information: true,
};

/** A control's turn, and a key's: an eighth of the way round, or a twelfth up or down. */
const TURN = Math.PI / 4;
const TILT = Math.PI / 12;
/** An arrow key's turn: half a control's, a whole one with Shift. */
const KEY_TURN = TURN / 2;
/** A control's or a key's zoom. */
const ZOOM = 1.5;

/**
 * The keys the viewport answers to, as `aria-keyshortcuts` spells them: the arrows turn
 * the models, R and Shift+R as the rotate controls do, plus and minus zoom, 0 resets.
 */
const KEYS = [
  "ArrowLeft ArrowRight ArrowUp ArrowDown",
  SHORTCUTS.rotateRight.keys,
  SHORTCUTS.rotateLeft.keys,
  SHORTCUTS.zoomIn.keys,
  SHORTCUTS.zoomOut.keys,
  SHORTCUTS.reset.keys,
].join(" ");

type Status =
  | { state: "waiting" }
  | { state: "loading" }
  | { state: "ready" }
  | { state: "error"; error: Error };

/**
 * `Scene` drawing exactly what it is handed: a Presentation 4 Scene, its models lit and
 * framed, on Canvas's Body (its controls, information and full screen), turned
 * and zoomed by pointer, key or control. Standalone use renders this directly; inside a
 * `Root`, `Connected.tsx` hands it the current view.
 */
export function SceneView(props: SceneProps) {
  if (!props.scene) return null;
  return (
    <ErrorBoundary>
      <SceneBody {...props} scene={props.scene} />
    </ErrorBoundary>
  );
}

function SceneBody({
  scene,
  label,
  language,
  className,
  controls = true,
  controlButtons,
  options,
  manifestId,
  engine: drawWith = "clover",
  children,
}: SceneProps & { scene: IIIFScene }) {
  const { t } = useCloverTranslation();
  const [wrapper, setWrapper] = useState<HTMLElement | null>(null);
  const root = useRootLanguage(setWrapper as React.RefCallback<HTMLElement>);
  const hostRef = useRef<HTMLDivElement>(null);
  const isFullscreen = useFullscreen(wrapper);
  const canFullscreen = useFullscreenSupported();
  const controlsVisible = useControlsVisibility(
    wrapper,
    options?.hideDelay,
    hostRef,
  );
  // Nothing is fetched, its drawing included, until the Scene comes within reach of view.
  const nearViewport = useNearViewport(wrapper);
  const made = useUniqueId();
  const instance = `clover-scene-${made}`;
  const config: Required<SceneControlsConfig> | null =
    controls === false
      ? null
      : controls === true
        ? ALL_CONTROLS
        : { ...ALL_CONTROLS, ...controls };

  const models = sceneModels(scene);
  const background = sceneBackground(scene);
  const request = options?.request;
  // What is drawn: a new key loads it afresh; anything else keeps the drawing.
  const drawingKey = JSON.stringify([
    scene.id,
    models,
    requestKey(request),
    drawWith,
  ]);
  // Another Manifest is on its way: the last one's models go at once, as a Canvas's do.
  const cleared = manifestId === "loading";

  const [status, setStatus] = useState<Status>({ state: "waiting" });
  const engine = useRef<SceneEngine | null>(null);
  const bounds = useRef<Bounds | null>(null);
  const home = useRef<Orbit | null>(null);
  const orbit = useRef<Orbit | null>(null);
  const frame = useRef(0);
  /**
   * Bumped when the graphics context comes back (`release`, below): the Scene is drawn
   * again, the camera where the reader left it.
   */
  const [generation, setGeneration] = useState(0);
  const holder = useRef<ContextHolder>({
    hiddenSince: null,
    release: () => undefined,
  });
  /** It gave its context back (or was refused one): it takes one again in view. */
  const released = useRef(false);
  /** The controls' corner (zoom, full screen, the rotate pad), and the way home's glyph. */
  const navigation = useRef<HTMLDivElement>(null);
  const indicator = useRef<SVGGElement>(null);
  // Whatever is full screen holds the Scene: its own figure, or a Viewer round it.
  const withinFullscreen = useWithinFullscreen(wrapper);

  /** Draw once in the next frame, however many moves come before it. */
  const redraw = useCallback(() => {
    if (frame.current || !engine.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (!orbit.current) return;
      engine.current?.draw(orbit.current);
      showOrientation(indicator.current, orbit.current);
    });
  }, []);

  /** Home for the Body's shape, as it is now. */
  const homeFor = useCallback(() => {
    const host = hostRef.current;
    const aspect =
      host && host.clientHeight ? host.clientWidth / host.clientHeight : 1;
    return bounds.current ? homeOrbit(bounds.current, aspect) : null;
  }, []);

  const move = useCallback(
    (next: (current: Orbit, home: Orbit) => Orbit) => {
      if (!orbit.current || !home.current) return;
      orbit.current = next(orbit.current, home.current);
      redraw();
    },
    [redraw],
  );
  /** While the view turns, by any means, the pad's disc lights (`data-turning`). */
  const turning = useRef(0);
  const turn = useCallback(
    (dTheta: number, dPhi: number) => {
      move((current) => turned(current, dTheta, dPhi));
      const corner = navigation.current;
      if (!corner) return;
      corner.setAttribute("data-turning", "");
      window.clearTimeout(turning.current);
      turning.current = window.setTimeout(
        () => corner.removeAttribute("data-turning"),
        400,
      );
    },
    [move],
  );
  useEffect(() => () => window.clearTimeout(turning.current), []);
  const zoom = useCallback(
    (factor: number) =>
      move((current, start) => zoomed(current, factor, start)),
    [move],
  );
  // The height a drag is measured against, the pad's disc's as the view's own.
  const viewHeight = useCallback(() => hostRef.current?.clientHeight ?? 0, []);
  const reset = useCallback(() => {
    home.current = homeFor();
    orbit.current = home.current;
    redraw();
  }, [homeFor, redraw]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !nearViewport) return;
    if (cleared) {
      setStatus({ state: "loading" });
      return;
    }
    let live = true;
    let drawing: SceneEngine | null = null;
    const giveBack = () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      drawing?.dispose();
      drawing = null;
      engine.current = null;
      returnContext(holder.current);
    };
    holder.current.release = () => {
      // Another view on the page needs the context, and this one is out of sight.
      giveBack();
      released.current = true;
      if (live) setStatus({ state: "waiting" });
    };
    released.current = false;
    if (!claimContext(holder.current)) {
      // Every context Clover may hold is on screen: wait, as a queue does, till it is
      // back in view after one is free.
      released.current = true;
      setStatus({ state: "waiting" });
      return () => {
        live = false;
      };
    }
    setStatus({ state: "loading" });
    (ENGINES[drawWith] ?? ENGINES.clover)()
      .then(({ createEngine }) => {
        if (!live) return;
        drawing = createEngine(host, {
          onLost: () => {
            giveBack();
            if (live)
              setStatus({
                state: "error",
                error: new Error(
                  "The browser took back the 3D view's graphics.",
                ),
              });
          },
        });
        engine.current = drawing;
        return drawing.load(models, request).then((found) => {
          if (!live) return;
          bounds.current = found;
          // A Scene drawn again keeps the camera where the reader left it.
          home.current = homeFor();
          orbit.current ??= home.current;
          setStatus({ state: "ready" });
          redraw();
        });
      })
      .catch((error: unknown) => {
        if (!live) return;
        giveBack();
        setStatus({
          state: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    return () => {
      live = false;
      giveBack();
    };
    // `drawingKey` stands in for the Scene, its models, the request and the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingKey, cleared, nearViewport, generation, homeFor, redraw]);

  // Another Scene, or another Manifest's: the camera starts at its home.
  useEffect(() => {
    orbit.current = null;
  }, [drawingKey]);

  /*
   * Whether the Scene is in view, for the contexts' rationing: one out of view the
   * longest gives its context up first, and one that gave it up takes it back on return.
   */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      holder.current.hiddenSince = entry?.isIntersecting
        ? null
        : performance.now();
      if (entry?.isIntersecting && released.current)
        setGeneration((count) => count + 1);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // The Body resized: the surface follows, and a camera at home keeps the models fitted.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      // On a small Body the controls take smaller cells, 24px at least (`Scene.css`).
      const rem =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      navigation.current?.toggleAttribute(
        "data-compact",
        host.clientWidth < 32 * rem || host.clientHeight < 24 * rem,
      );
      if (!engine.current) return;
      engine.current.resize();
      const atHome =
        orbit.current && home.current && sameOrbit(orbit.current, home.current);
      home.current = homeFor();
      if (atHome) orbit.current = home.current;
      // Drawn at once: resizing a canvas clears it, and a frame later would flash.
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      if (!orbit.current) return;
      engine.current.draw(orbit.current);
      showOrientation(indicator.current, orbit.current);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [homeFor]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || status.state !== "ready") return;
    return attachOrbitGestures(host, { turn, zoom });
  }, [status.state, turn, zoom]);

  const onViewportKey = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    // With Shift, larger steps: a control's turn, or twice its tilt.
    const step = event.shiftKey ? TURN : KEY_TURN;
    const tilt = event.shiftKey ? 2 * TILT : TILT;
    switch (event.key) {
      case "ArrowLeft":
        turn(step, 0);
        break;
      case "ArrowRight":
        turn(-step, 0);
        break;
      case "ArrowUp":
        turn(0, tilt);
        break;
      case "ArrowDown":
        turn(0, -tilt);
        break;
      case "r":
        turn(-TURN, 0);
        break;
      case "R":
        turn(TURN, 0);
        break;
      case "+":
      case "=":
        zoom(ZOOM);
        break;
      case "-":
      case "_":
        zoom(1 / ZOOM);
        break;
      case "0":
        reset();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // The Scene's own words, when it has a summary or metadata, as a Canvas's caption shows.
  const captionId = `caption-${instance}`;
  const captioned = useMemo(
    () =>
      config?.information && hasInformation(scene as IIIFCanvas)
        ? [scene as IIIFCanvas]
        : [],
    [config?.information, scene],
  );
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
  const figureLabel =
    captioned.length && localize(scene.label as never, language).text
      ? captionLabelId(captionId, 0)
      : undefined;

  // The viewport always has a name: the given label, else the Scene's, else a generic one.
  const ownName = [label, scene.label]
    .map((value) => localize(value as never, language))
    .find((value) => value.text);
  const viewportName = useContainerName(
    ownName?.text || t("sceneModel"),
    ownName ? ownName.lang : root.langOf("sceneModel"),
    false,
    root.hostLanguage,
  );
  const keysId = `keys-${instance}`;
  const roleDescription = !root.langOf("sceneRoleDescription")
    ? t("sceneRoleDescription")
    : undefined;

  const spec = (
    key: ControlSpec["key"],
    words: string,
    glyph: React.ReactElement,
    onClick: () => void,
    shortcut?: ControlSpec["shortcut"],
  ): ControlSpec => ({
    key,
    id: `${key}-${instance}`,
    label: t(words),
    lang: root.langOf(words),
    glyph,
    onClick,
    ...(shortcut ? { shortcut } : {}),
  });

  /*
   * Zoom and full screen, in the lower right beside the rotate pad, their row ending left
   * of its down arrow (Mat, 2026-10-23: "bring zoom/full screen controls down"). The top
   * right keeps what never fades there: the `i`, and a host's own (a template's toggle).
   */
  const toolSpecs = (fullscreen: boolean): ControlSpec[] => {
    if (!config) return [];
    return [
      ...(config.zoom
        ? [
            spec(
              "zoomIn",
              "imageZoomIn",
              <ZoomIn />,
              () => zoom(ZOOM),
              SHORTCUTS.zoomIn,
            ),
            spec(
              "zoomOut",
              "imageZoomOut",
              <ZoomOut />,
              () => zoom(1 / ZOOM),
              SHORTCUTS.zoomOut,
            ),
          ]
        : []),
      ...(config.fullPage && canFullscreen
        ? [
            {
              key: "fullPage" as const,
              id: `fullPage-${instance}`,
              label: t(fullscreen ? "imageExitFullScreen" : "imageFullScreen"),
              lang: root.langOf(
                fullscreen ? "imageExitFullScreen" : "imageFullScreen",
              ),
              glyph: fullscreen ? <ZoomExitFullScreen /> : <ZoomFullScreen />,
              // Straight from the click: the Fullscreen API only honors a user gesture.
              onClick: (event: React.MouseEvent<HTMLButtonElement>) =>
                void toggleFullscreen(event.currentTarget),
            },
          ]
        : []),
    ];
  };

  /*
   * The rotate pad (`RotatePad.tsx`; Mat, 2026-10-23): each way to turn on its side, and
   * at its center the way home, which shows where the view is. Named as a group.
   */
  const padName = useContainerName(
    t("sceneRotate"),
    root.langOf("sceneRotate"),
    false,
    root.hostLanguage,
  );
  const padControls = config
    ? {
        ...(config.rotation && {
          rotateUp: spec(
            "rotateUp",
            "sceneRotateUp",
            <Caret rotate={-90} />,
            () => turn(0, TILT),
          ),
          rotateLeft: spec(
            "rotateLeft",
            "imageRotateLeft",
            <Caret rotate={180} />,
            () => turn(TURN, 0),
            SHORTCUTS.rotateLeft,
          ),
          rotateRight: spec(
            "rotateRight",
            "imageRotateRight",
            <Caret rotate={0} />,
            () => turn(-TURN, 0),
            SHORTCUTS.rotateRight,
          ),
          rotateDown: spec(
            "rotateDown",
            "sceneRotateDown",
            <Caret rotate={90} />,
            () => turn(0, -TILT),
          ),
        }),
        ...(config.reset && {
          reset: spec(
            "reset",
            "sceneResetView",
            <Reset />,
            reset,
            SHORTCUTS.reset,
          ),
        }),
      }
    : {};

  const tools = toolSpecs(withinFullscreen);

  const loading =
    status.state === "loading" || (status.state === "waiting" && nearViewport);

  return (
    <HostLanguageContext.Provider value={root.hostLanguage}>
      <figure
        aria-labelledby={figureLabel}
        className={join("clover-canvas", "clover-scene", className)}
        data-testid="clover-scene"
        data-status={
          status.state === "ready"
            ? "ready"
            : status.state === "error"
              ? "error"
              : "loading"
        }
        data-fullscreen={isFullscreen}
        data-controls={controlsVisible ? "visible" : "hidden"}
        data-navigable="true"
        ref={root.ref}
        onKeyDown={(event) => {
          // Escape closes the open caption from anywhere in the figure, as a Canvas's does.
          if (
            event.key === "Escape" &&
            isCaptionOpen &&
            !event.defaultPrevented
          ) {
            event.preventDefault();
            closeCaption(false);
            return;
          }
          // The Scene's keys work from its own controls too, as their popovers say.
          forwardShortcut(event, hostRef.current);
        }}
        // Geometry inline: the figure fills its box with or without the stylesheet.
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          margin: 0,
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        {config && <div className="clover-canvas-scrim" aria-hidden="true" />}
        <ExitFullscreen hidden={!isFullscreen} />
        {(captioned.length > 0 || React.Children.count(children) > 0) && (
          <ControlCluster controls={() => []} controlButtons={controlButtons}>
            {captioned.length > 0 && (
              <Button
                id={`information-${instance}`}
                label={t("informationPanelTabsAbout")}
                lang={root.langOf("informationPanelTabsAbout")}
                onClick={() => setCaptionOpen((open) => !open)}
                expanded={isCaptionOpen}
                controls={captionId}
              >
                <Information />
              </Button>
            )}
            {children}
          </ControlCluster>
        )}
        {(tools.length > 0 || Object.keys(padControls).length > 0) && (
          <div ref={navigation} className="clover-scene-navigation">
            {tools.length > 0 && (
              <div className="clover-scene-tools">
                {tools.map((tool) => renderControl(tool, controlButtons))}
              </div>
            )}
            {Object.keys(padControls).length > 0 && (
              <RotatePad
                controls={padControls}
                controlButtons={controlButtons}
                turn={turn}
                zoom={zoom}
                span={viewHeight}
                indicator={indicator}
                name={padName}
              />
            )}
          </div>
        )}
        <div
          ref={hostRef}
          className="clover-canvas-viewport"
          // Geometry inline, beneath the rest of the figure, as a Canvas's viewport is.
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            zIndex: -1,
            ...(background ? { backgroundColor: background } : {}),
          }}
          data-testid="clover-scene-viewport"
          role="img"
          aria-roledescription={roleDescription}
          {...viewportName.props}
          aria-describedby={keysId}
          aria-keyshortcuts={KEYS}
          aria-busy={loading}
          tabIndex={0}
          onKeyDown={onViewportKey}
        />
        {viewportName.node}
        <span
          id={keysId}
          style={visuallyHidden}
          lang={root.langOf("sceneKeys")}
        >
          {t("sceneKeys")}
        </span>
        {status.state === "error" && (
          <BodyAlert error={status.error} className="clover-scene-error" />
        )}
        {loading && <Loading overlay />}
        {/* Last, as a `<figcaption>` must be first or last in its `<figure>`. */}
        {captioned.length > 0 && (
          <Caption
            id={captionId}
            canvases={captioned}
            open={isCaptionOpen}
            onClose={closeCaption}
            language={language}
          />
        )}
      </figure>
    </HostLanguageContext.Provider>
  );
}

export default SceneView;
