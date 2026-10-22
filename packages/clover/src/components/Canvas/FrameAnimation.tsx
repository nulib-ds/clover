import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import ChoiceMenu from "./ChoiceMenu";
import { type AnimationFrame, resolveBody } from "./layout";
import { useBarHeight } from "./media/useBarHeight";
import { imageSource } from "../../core/thumbnail";
import { Tip } from "../../ui/Tip";
import type { CanvasRenderer } from "../../lib/renderer";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { PauseIcon, PlayIcon } from "../../ui/mediaIcons";

export interface AnimationState {
  frame: number;
  playing: boolean;
  /** Loop at the end: the `repeat` behavior to start with, then the reader's choice. */
  repeat: boolean;
  setFrame: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setRepeat: (repeat: boolean) => void;
}

/** How long a frame not yet loaded is waited for before it is looked at again. */
const HOLD_MS = 50;

/** The frames menu's pictures: about this many pixels on their longer side. */
const FRAME_IMAGE = 128;

/**
 * A frame's picture for the frames menu, as the scene paints it (its region cut out):
 * small where its image service can size one, else the image itself, which the scene has
 * already loaded to play it.
 */
function frameImage(frame: AnimationFrame): string | undefined {
  const { body } = frame.annotation;
  const resolved = resolveBody(Array.isArray(body) ? body[0] : body);
  if (!resolved) return undefined;
  const source = imageSource(resolved.body, FRAME_IMAGE, resolved.region);
  return source?.src ?? source?.fallback;
}

/**
 * An animation's clock: the frame shown and whether it plays. Each frame stays for its
 * own span; at the end it loops when asked, and stops otherwise. A new animation (`key`)
 * starts from its first frame, playing if `autoplay` — never for a reader who asks the
 * system for reduced motion.
 *
 * A frame that `isReady` says cannot be drawn yet is not shown: the current one holds,
 * and the next is looked at again shortly, so a first pass over frames still loading
 * never blinks empty.
 */
export function useAnimation(
  frames: AnimationFrame[],
  key: string | null,
  {
    autoplay = false,
    loop = false,
    isReady,
    onEnded,
  }: {
    autoplay?: boolean;
    loop?: boolean;
    isReady?: (frame: number) => boolean;
    /** The last frame has had its time, not looping: a Root's auto-advance moves on. */
    onEnded?: () => void;
  },
): AnimationState {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(loop);
  const ready = useRef(isReady);
  ready.current = isReady;
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    setFrame(0);
    setRepeat(loop);
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(autoplay && frames.length > 1 && !reduced);
    // A new animation, not a new array for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const current = frames[Math.min(frame, frames.length - 1)];
    const ms = Math.max(40, (current.end - current.start) * 1000);
    let timer = setTimeout(function advance() {
      const atEnd = frame + 1 >= frames.length;
      if (atEnd && !repeat) {
        setPlaying(false);
        ended.current?.();
        return;
      }
      const next = atEnd ? 0 : frame + 1;
      if (ready.current && !ready.current(next)) {
        timer = setTimeout(advance, HOLD_MS);
        return;
      }
      setFrame(next);
    }, ms);
    return () => clearTimeout(timer);
  }, [playing, frame, frames, repeat]);

  return { frame, playing, repeat, setFrame, setPlaying, setRepeat };
}

/**
 * The bar of an animation Canvas: a scrubber over its frames, previous, play or pause,
 * next, and which frame shows. Styled as, and fading with, the media transport.
 *
 * Which frame shows is also the control that lists them all, as 3.x's frames strip did:
 * the menu a Canvas's Choice opens, one radio per frame with its picture and its label
 * from the Manifest, the frame showing checked. Opening it pauses, and choosing one
 * shows it, as stepping does.
 */
export function FrameControls({
  frames,
  animation,
  language,
}: {
  frames: AnimationFrame[];
  animation: AnimationState;
  /** The language to read the frames' labels in. The reader's, by default. */
  language?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  const { frame, playing, repeat, setFrame, setPlaying, setRepeat } = animation;
  const last = frames.length - 1;
  const triggerId = `${useUniqueId().replace(/:/g, "")}-frames`;
  const menuId = `${triggerId}-menu`;
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  useBarHeight(bar);
  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) document.getElementById(triggerId)?.focus();
    },
    [triggerId],
  );
  // One group, as a Canvas's Choice is: the frames, by the Manifest's labels.
  const group = useMemo(
    () => ({
      key: "frame",
      items: frames.map((f) => ({
        label: (f.annotation as { label?: unknown }).label,
        id: f.annotation.id,
        image: frameImage(f),
      })),
    }),
    [frames],
  );
  const position = t("framePosition", {
    index: frame + 1,
    total: frames.length,
  });
  // Stepping by hand pauses, and stops at the ends, as the pager does. At an end the
  // button is only `aria-disabled`, so it keeps focus (WCAG 2.4.3), and a press there
  // does nothing.
  const step = (by: number) => {
    const next = Math.min(last, Math.max(0, frame + by));
    if (next === frame) return;
    setPlaying(false);
    setFrame(next);
  };
  return (
    <div
      className="clover-canvas-transport"
      data-kind="frames"
      data-testid="clover-canvas-frames"
    >
      <div className="clover-canvas-transport-seek-area">
        <input
          aria-label={t("frameSeek")}
          aria-valuetext={position}
          lang={langOf("frameSeek")}
          className="clover-canvas-transport-seek"
          max={last}
          min={0}
          step={1}
          type="range"
          value={frame}
          onChange={(event) => {
            setPlaying(false);
            setFrame(Number(event.target.value));
          }}
          style={
            {
              "--clover-transport-progress": `${last ? (frame / last) * 100 : 0}%`,
            } as React.CSSProperties
          }
        />
      </div>
      {/* On a narrow stage, which frame shows wraps below the buttons. */}
      <div className="clover-canvas-transport-bar" ref={bar}>
        <button
          type="button"
          className="clover-canvas-transport-button"
          aria-label={t("framePrevious")}
          lang={langOf("framePrevious")}
          aria-disabled={frame === 0 || undefined}
          onClick={() => step(-1)}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 16 16"
          >
            <path
              d="M10 3L5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <Tip label={t("framePrevious")} />
        </button>
        <button
          type="button"
          className="clover-canvas-transport-button"
          data-button={playing ? "pause" : "play"}
          aria-label={playing ? t("playerPause") : t("playerPlay")}
          lang={langOf(playing ? "playerPause" : "playerPlay")}
          onClick={() => {
            // Playing from the last frame starts again.
            if (!playing && frame === last) setFrame(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
          <Tip label={playing ? t("playerPause") : t("playerPlay")} />
        </button>
        <button
          type="button"
          className="clover-canvas-transport-button"
          aria-label={t("frameNext")}
          lang={langOf("frameNext")}
          aria-disabled={frame === last || undefined}
          onClick={() => step(1)}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 16 16"
          >
            <path
              d="M6 3l5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <Tip label={t("frameNext")} />
        </button>
        <button
          type="button"
          className="clover-canvas-transport-button"
          data-button="repeat"
          aria-label={t("frameRepeat")}
          lang={langOf("frameRepeat")}
          aria-pressed={repeat}
          onClick={() => setRepeat(!repeat)}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 16 16"
          >
            <path
              d="M3 7V6a2 2 0 0 1 2-2h7l-2-2M13 9v1a2 2 0 0 1-2 2H4l2 2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <Tip label={t("frameRepeat")} />
        </button>
        <span className="clover-canvas-transport-frames">
          <button
            type="button"
            id={triggerId}
            className="clover-canvas-transport-time"
            aria-controls={open ? menuId : undefined}
            aria-expanded={open}
            onClick={() => {
              // Opening pauses: the frames are there to choose from, not to chase.
              if (!open) setPlaying(false);
              setOpen(!open);
            }}
          >
            <span aria-live="off" lang={langOf("framePosition")}>
              {position}
            </span>
            <svg
              aria-hidden="true"
              focusable="false"
              width="12"
              height="12"
              viewBox="0 0 12 12"
            >
              <path
                d="M3 7.5l3-3 3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {open && (
            <ChoiceMenu
              id={menuId}
              triggerId={triggerId}
              label={t("frameSeek")}
              labelLang={langOf("frameSeek")}
              language={language}
              choices={[group]}
              selections={{ frame }}
              onSelect={(_key, index) => {
                setPlaying(false);
                setFrame(index);
              }}
              onClose={close}
            />
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * An animation Canvas's frames, played: its clock, which frame the renderer shows (the
 * others stay loaded, hidden), and its bar. Loaded on demand: few Canvases are animations.
 */
export default function FrameAnimation({
  renderer,
  frames,
  byFrame,
  animationKey,
  sceneVersion,
  autoplay,
  loop,
  onEnded,
  language,
}: {
  renderer: CanvasRenderer;
  frames: AnimationFrame[];
  /** The scene's image ids for each frame (`canvasScene().frames`). */
  byFrame: string[][];
  animationKey: string;
  /** Bumped when the renderer's items change, so the current frame is shown again. */
  sceneVersion: number;
  autoplay?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  language?: string;
}) {
  const animation = useAnimation(frames, animationKey, {
    autoplay,
    loop,
    onEnded,
    isReady: (frame) =>
      (byFrame[frame] ?? []).every((id) => renderer.isReady(id)),
  });
  useEffect(() => {
    const shown = new Set(byFrame[animation.frame] ?? []);
    renderer.setHidden(byFrame.flat().filter((id) => !shown.has(id)));
  }, [renderer, byFrame, animation.frame, sceneVersion]);
  /*
   * In the media layer, as a video's transport is: it fades with the chrome, and sizes
   * its menu against the stage (`MediaStage.css`).
   */
  return (
    <div className="clover-canvas-media" data-kind="frames">
      <FrameControls
        frames={frames}
        animation={animation}
        language={language}
      />
    </div>
  );
}
