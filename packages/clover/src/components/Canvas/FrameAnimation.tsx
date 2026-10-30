import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { createPortal } from "react-dom";

import ChoiceMenu from "./ChoiceMenu";
import {
  type AnimationFrame,
  type IIIFCanvas,
  canvasSize,
  resolveBody,
} from "./layout";
import { isSound, parseAnnotationTarget } from "../../core/annotations";
import { bodiesOf } from "../../core/painting";
import type { Rect, SceneImage } from "../../lib/renderer";
import { Markup } from "../../ui/Markup";
import { Tip } from "../../ui/Tip";
import { visuallyHidden } from "../../ui/visuallyHidden";
import { useBarHeight } from "./media/useBarHeight";
import { imageSource, resolveThumbnail } from "../../core/thumbnail";
import type { CloverRequest } from "../../core/request";
import { useOptionalClover } from "../../react/context";
import { TransportButton } from "./media/TransportButton";
import type { CanvasRenderer } from "../../lib/renderer";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import {
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
} from "../../ui/mediaIcons";
import { formatTime } from "../../lib/time";
import { gapMask, gapsOf, seekShare } from "./media/seekGaps";
import { placeMenu } from "./media/placeMenu";

export interface AnimationState {
  /** The frame last to start by the clock's time: the one the bar names, its menu checks. */
  frame: number;
  /** The frames showing at that time: each one whose span holds it, so several at once. */
  shown: number[];
  /** Where the clock is, in seconds of the Canvas's time. */
  time: number;
  /** How long it runs: the Canvas's `duration`, else its last frame's end. */
  total: number;
  playing: boolean;
  /** Loop at the end: the `repeat` behavior to start with, then the reader's choice. */
  repeat: boolean;
  /** Go to a frame: to its start. */
  setFrame: (frame: number) => void;
  /** Go to a time, playing on from it if it plays. */
  seek: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;
  setRepeat: (repeat: boolean) => void;
}

/**
 * A time on the bar, as a player counts it, a whole second; with its tenth where the whole
 * runs under ten seconds (a Muybridge plate's second), where whole seconds say nothing.
 */
export const clockTime = (seconds: number, total: number) =>
  total < 10
    ? `${formatTime(seconds)}.${Math.min(9, Math.floor(((seconds || 0) % 1) * 10))}`
    : formatTime(seconds);

/** Whether keyboard focus is on an element: where `:focus-visible` is unknown, not. */
const focusVisible = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
};

/** How long a frame not yet loaded is waited for before it is looked at again. */
const HOLD_MS = 50;

/** How often the bar's time is brought up to date as it plays, as a player's is. */
const TICK_MS = 250;

/** The frame last to start at or before a time: the bar's, and its menu's. */
const frameAt = (frames: AnimationFrame[], time: number) => {
  let found = 0;
  frames.forEach((frame, index) => {
    if (frame.start <= time) found = index;
  });
  return found;
};

/** The frames whose span holds a time; at the end, those that last to it. */
export function framesAt(
  frames: AnimationFrame[],
  time: number,
  total: number,
): number[] {
  const at = Math.min(time, total);
  const shown: number[] = [];
  frames.forEach((frame, index) => {
    if (
      frame.start <= at &&
      (at < frame.end || (at >= total && frame.end >= total))
    )
      shown.push(index);
  });
  return shown;
}

/** The next time after this one at which a frame starts or ends, or the end. */
const nextChange = (frames: AnimationFrame[], time: number, total: number) => {
  let next = total;
  for (const frame of frames) {
    if (frame.start > time && frame.start < next) next = frame.start;
    if (frame.end > time && frame.end < next) next = frame.end;
  }
  return next;
};

/** The frames menu's pictures: about this many pixels on their longer side. */
const FRAME_IMAGE = 128;

/**
 * The frames' pictures for the frames menu, as the scene paints them (a region cut out),
 * each asked of its image service as its `info.json` says it can answer (read already, to
 * play the frames), small where it can size one; else the image itself.
 */
function useFrameImages(
  frames: AnimationFrame[],
  request: CloverRequest | undefined,
): (string | undefined)[] {
  const [images, setImages] = useState<(string | undefined)[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all(
      frames.map((frame) => {
        const { body } = frame.annotation;
        const resolved = resolveBody(Array.isArray(body) ? body[0] : body);
        // A picture of an image only: a video's or text's frame is named by its number.
        const source =
          resolved?.body.type === "Image"
            ? imageSource(resolved.body, resolved.region)
            : undefined;
        return source
          ? resolveThumbnail(source, FRAME_IMAGE, request)
          : undefined;
      }),
    ).then((urls) => live && setImages(urls));
    return () => {
      live = false;
    };
  }, [frames, request]);
  return images;
}

/**
 * An animation's clock, over the Canvas's own time (its `duration`; Mat, 2026-10-29: "as
 * this manifest has a duration. this should be reflected on the canvas"): where it is,
 * whether it plays, and the frames that show there, each for its own span, so several may
 * show at once. At the end it loops when asked, and stops otherwise. A new animation
 * (`key`) starts from its beginning, playing if `autoplay` — never for a reader who asks
 * the system for reduced motion.
 *
 * A frame that `isReady` says cannot be drawn yet is not shown: the clock holds before it,
 * and looks again shortly, so a first pass over frames still loading never blinks empty.
 */
export function useAnimation(
  frames: AnimationFrame[],
  key: string | null,
  {
    autoplay = false,
    loop = false,
    duration,
    isReady,
    onEnded,
  }: {
    autoplay?: boolean;
    loop?: boolean;
    /** The Canvas's `duration`, which the clock runs over. */
    duration?: number;
    isReady?: (frame: number) => boolean;
    /** The end has come, not looping: a Root's auto-advance moves on. */
    onEnded?: () => void;
  },
): AnimationState {
  const total = useMemo(() => {
    if (duration && Number.isFinite(duration) && duration > 0) return duration;
    const ends = frames.map((frame) => frame.end).filter(Number.isFinite);
    return ends.length ? Math.max(...ends) : 0;
  }, [frames, duration]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(loop);
  // A move by the reader, so a clock playing goes on from there.
  const [moved, setMoved] = useState(0);
  const now = useRef(0);
  const ready = useRef(isReady);
  ready.current = isReady;
  const ended = useRef(onEnded);
  ended.current = onEnded;

  const seek = useCallback(
    (seconds: number) => {
      const at = Math.max(0, Math.min(total, seconds));
      now.current = at;
      setTime(at);
      setMoved((count) => count + 1);
    },
    [total],
  );

  useEffect(() => {
    now.current = 0;
    setTime(0);
    setRepeat(loop);
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(autoplay && frames.length > 1 && !reduced);
    // A new animation, not a new array for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!playing || frames.length < 2 || !(total > 0)) return;
    // Played from the end, it starts again.
    let from = { at: Date.now(), time: now.current >= total ? 0 : now.current };
    let timer: ReturnType<typeof setTimeout>;
    const go = (seconds: number) => {
      now.current = seconds;
      setTime(seconds);
    };
    // Up to date each tick, and at each moment a frame comes or goes.
    const wait = (time: number) =>
      Math.max(
        0,
        Math.min(TICK_MS, (nextChange(frames, time, total) - time) * 1000),
      );
    const tick = () => {
      const before = now.current;
      let time = from.time + (Date.now() - from.at) / 1000;
      if (time >= total) {
        if (!repeat) {
          go(total);
          setPlaying(false);
          ended.current?.();
          return;
        }
        time = 0;
        from = { at: Date.now(), time: 0 };
      }
      const showing = framesAt(frames, before, total);
      const coming = framesAt(frames, time, total).filter(
        (index) => !showing.includes(index),
      );
      if (ready.current && coming.some((index) => !ready.current!(index))) {
        from = { at: Date.now(), time: before };
        timer = setTimeout(tick, HOLD_MS);
        return;
      }
      go(time);
      timer = setTimeout(tick, wait(time));
    };
    if (from.time !== now.current) go(from.time);
    timer = setTimeout(tick, wait(from.time));
    return () => clearTimeout(timer);
  }, [playing, frames, total, repeat, moved]);

  const frame = frameAt(frames, time);
  const shownKey = framesAt(frames, time, total).join(",");
  const shown = useMemo(
    () => (shownKey ? shownKey.split(",").map(Number) : []),
    [shownKey],
  );
  const setFrame = useCallback(
    (index: number) => seek(frames[index]?.start ?? 0),
    [frames, seek],
  );
  return {
    frame,
    shown,
    time,
    total,
    playing,
    repeat,
    setFrame,
    seek,
    setPlaying,
    setRepeat,
  };
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
  sound,
}: {
  frames: AnimationFrame[];
  animation: AnimationState;
  /** The language to read the frames' labels in. The reader's, by default. */
  language?: string;
  /** Frames that play sound (a video, Cookbook 0489): whether it is muted, and a switch. */
  sound?: { muted: boolean; toggle: () => void };
}) {
  const { t, langOf } = useCloverTranslation();
  const {
    frame,
    time,
    total,
    playing,
    repeat,
    setFrame,
    seek,
    setPlaying,
    setRepeat,
  } = animation;
  // Where frames start, each once: the steps, as a recording's chapters are.
  const starts = useMemo(
    () => [...new Set(frames.map((each) => each.start))].sort((a, b) => a - b),
    [frames],
  );
  let here = 0;
  starts.forEach((start, index) => {
    if (start <= time) here = index;
  });
  const progress = total > 0 ? (Math.min(time, total) / total) * 100 : 0;
  // A gap in the seek bar where a frame begins or ends with none to follow, as a chapter's.
  const gaps = useMemo(() => {
    const at = gapsOf(frames, total);
    return at.length ? gapMask(at) : undefined;
  }, [frames, total]);
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
  const images = useFrameImages(frames, useOptionalClover()?.clover.request);
  // One group, as a Canvas's Choice is: the frames, by the Manifest's labels.
  const group = useMemo(
    () => ({
      key: "frame",
      items: frames.map((f, n) => ({
        label: (f.annotation as { label?: unknown }).label,
        id: f.annotation.id,
        image: images[n],
      })),
    }),
    [frames, images],
  );
  const [pointedAt, setPointedAt] = useState<string | null>(null);
  const [seekFocused, setSeekFocused] = useState(false);
  const seekArea = useRef<HTMLDivElement>(null);
  // Which frame shows, as a figure, "5 / 5", shown and read alike: no word, as Search's
  // place among its hits shows (Mat, 2026-10-29).
  const position = `${frame + 1} / ${frames.length}`;
  // With no pointer over it, the popover is over where it is, for keyboard focus.
  useLayoutEffect(() => {
    if (pointedAt === null)
      seekArea.current?.style.setProperty(
        "--clover-transport-preview",
        `${progress}%`,
      );
  }, [pointedAt, progress]);
  // Its menu, placed from its button within the Body, as the chapters' is (WCAG 1.4.10).
  const holder = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const wrapper = holder.current;
    const options = wrapper?.querySelector<HTMLElement>(".clover-canvas-menu");
    const transport = wrapper?.closest<HTMLElement>(".clover-canvas-transport");
    const bodyBox = wrapper?.closest<HTMLElement>(".clover-canvas-media");
    if (!open || !wrapper || !options || !transport || !bodyBox) return;
    const place = () => placeMenu(options, wrapper, transport, bodyBox);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(bodyBox);
    observer.observe(transport);
    observer.observe(options);
    return () => observer.disconnect();
  }, [open]);
  // Stepping by hand goes to where the step before or after starts, pausing, and stops
  // at the ends, as the pager does. At an end the button is only `aria-disabled`, so it
  // keeps focus (WCAG 2.4.3), and a press there does nothing.
  const step = (by: number) => {
    const to = starts[here + by];
    if (to === undefined) return;
    setPlaying(false);
    setFrame(frames.findIndex((each) => each.start === to));
  };
  return (
    <div
      className="clover-canvas-transport"
      data-kind="frames"
      data-testid="clover-canvas-frames"
    >
      {/*
       * The time under the pointer, in the chapters' popover (`Tip`), its time alone: over
       * the pointer, kept inside the Body, put away by Escape (WCAG 1.4.13); while keyboard
       * focus is on the seek bar, the time it is at, over the thumb.
       */}
      <div
        className="clover-canvas-transport-seek-area"
        onPointerMove={(event) => {
          if (!total || (event.target as Element).closest(".clover-tip"))
            return;
          const box = event.currentTarget.getBoundingClientRect();
          setPointedAt(
            clockTime(
              seekShare(event.currentTarget, event.clientX) * total,
              total,
            ),
          );
          // Moved under the pointer as it goes, without a render for each move.
          event.currentTarget.style.setProperty(
            "--clover-transport-preview",
            `${((event.clientX - box.left) / box.width) * 100}%`,
          );
        }}
        onPointerLeave={() => setPointedAt(null)}
        ref={seekArea}
      >
        {(pointedAt !== null || seekFocused) && (
          <Tip label="" lead={pointedAt ?? clockTime(time, total)} />
        )}
        <input
          aria-label={t("playerSeek")}
          // Where it is, and which frame shows, as the bar shows them to the eye.
          aria-valuetext={`${clockTime(time, total)} / ${clockTime(total, total)}, ${position}`}
          onFocus={(event) => setSeekFocused(focusVisible(event.currentTarget))}
          onBlur={() => setSeekFocused(false)}
          lang={langOf("playerSeek")}
          className="clover-canvas-transport-seek"
          max={total}
          min={0}
          step="any"
          type="range"
          value={Math.min(time, total)}
          onChange={(event) => seek(Number(event.target.value))}
          data-gaps={gaps ? "" : undefined}
          style={
            {
              "--clover-transport-progress": `${progress}%`,
              ...(gaps && {
                "--clover-transport-gaps": gaps,
                "--clover-transport-at": progress / 100,
              }),
            } as React.CSSProperties
          }
        />
      </div>
      {/*
       * One row while it fits. On a narrow Body, the time over the buttons, and which
       * frame shows with its steps at the end of their row, or a row lower (`Transport.css`).
       */}
      <div className="clover-canvas-transport-bar" ref={bar}>
        <TransportButton
          words={playing ? "playerPause" : "playerPlay"}
          button={playing ? "pause" : "play"}
          onClick={() => {
            // Playing from the end starts again.
            if (!playing && time >= total) seek(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </TransportButton>
        <TransportButton
          words="frameRepeat"
          button="repeat"
          pressed={repeat}
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
        </TransportButton>
        {sound && (
          <TransportButton
            words={sound.muted ? "playerUnmute" : "playerMute"}
            button="mute"
            onClick={sound.toggle}
          >
            {sound.muted ? <VolumeMutedIcon /> : <VolumeHighIcon />}
          </TransportButton>
        )}
        {/* Where it is, as a recording's transport shows it; the seek bar says it too. */}
        <span className="clover-canvas-transport-status" aria-hidden="true">
          <span className="clover-canvas-transport-time">
            {clockTime(time, total)} / {clockTime(total, total)}
          </span>
        </span>
        {/*
         * Which frame shows and its steps, together at the end, as Search's place among
         * its hits and its steps are; Play keeps its place first, as a video's does.
         */}
        <div className="clover-canvas-transport-end">
          <span className="clover-canvas-transport-frames" ref={holder}>
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
              <span className="clover-canvas-transport-place" aria-live="off">
                <span>{position}</span>
                {/*
                 * The widest place, unseen in the same spot: it keeps the room, so nothing
                 * beside it moves as the place grows. Without the stylesheet, `hidden`.
                 */}
                <span
                  className="clover-canvas-transport-place-room"
                  aria-hidden="true"
                  hidden
                >
                  {frames.length} / {frames.length}
                </span>
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
                label={t("playerChapters")}
                labelLang={langOf("playerChapters")}
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
          <TransportButton
            words="commonPrevious"
            disabled={here === 0}
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
          </TransportButton>
          <TransportButton
            words="commonNext"
            disabled={here === starts.length - 1}
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
          </TransportButton>
        </div>
      </div>
    </div>
  );
}

/** A frame that is no image (Cookbook 0489): video or sound, or text, drawn as itself. */
interface FrameItem {
  /** Its frame's place among the frames. */
  index: number;
  id: string;
  kind: "video" | "audio" | "text";
  body: Record<string, any>;
  /** Where it is in the scene's world, as the Canvas's images are placed. */
  placement: Rect;
}

/** The frames that paint video, sound or text, where the scene puts each. */
function itemsOf(
  frames: AnimationFrame[],
  canvas: IIIFCanvas,
  place: Rect,
): FrameItem[] {
  const size = canvasSize(canvas);
  const kx = place.width / (size.width || 1);
  const ky = place.height / (size.height || 1);
  return frames.flatMap((frame, index) => {
    const body = bodiesOf(frame.annotation as Record<string, any>)[0] as
      | Record<string, any>
      | undefined;
    const type = body?.type;
    const kind =
      type === "Video"
        ? "video"
        : isSound(type)
          ? "audio"
          : type === "TextualBody" && typeof body?.value === "string"
            ? "text"
            : null;
    if (!kind || !body || (kind !== "text" && typeof body.id !== "string"))
      return [];
    const rect = parseAnnotationTarget(frame.annotation.target as any)?.rect;
    const target = rect
      ? { x: rect.x, y: rect.y, width: rect.w, height: rect.h }
      : { x: 0, y: 0, width: size.width, height: size.height };
    return [
      {
        index,
        id: `${frame.annotation.id ?? index}#${kind}`,
        kind,
        body,
        placement: {
          x: place.x + target.x * kx,
          y: place.y + target.y * ky,
          width: target.width * kx,
          height: target.height * ky,
        },
      },
    ];
  });
}

/**
 * Painted text (Cookbook 0489: "Press Play"), in its region, as large as fits it: IIIF's
 * HTML keeps no `style`, so the size the text was written at is not read, and the box
 * the annotation targets decides it. Laid out in the scene's units, so it scales with the
 * view as the images do. Hidden from assistive technology, which reads it outside the
 * picture (`FrameAnimation`).
 */
function PaintedText({
  host,
  item,
  shown,
  language,
}: {
  host: HTMLElement;
  item: FrameItem;
  shown: boolean;
  language?: string;
}) {
  useEffect(() => {
    if (!shown || host.dataset.fitted) return;
    let frame = 0;
    const fit = () => {
      if (!host.isConnected) {
        frame = requestAnimationFrame(fit);
        return;
      }
      const { width, height } = item.placement;
      const fits = (size: number) => {
        host.style.fontSize = `${size}px`;
        return host.scrollWidth <= width + 1 && host.scrollHeight <= height + 1;
      };
      let low = 1;
      let high = height * 0.8;
      if (!fits(high))
        for (let step = 0; step < 16; step += 1) {
          const middle = (low + high) / 2;
          if (fits(middle)) low = middle;
          else high = middle;
        }
      else low = high;
      host.style.fontSize = `${low}px`;
      host.dataset.fitted = "";
    };
    frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [host, item, shown]);
  return createPortal(
    <Markup
      as="div"
      markup={{ [item.body.language ?? "none"]: [item.body.value] }}
      format={item.body.format}
      language={language}
    />,
    host,
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
  duration,
  canvas,
  place,
  onItems,
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
  /** The Canvas's `duration`, which its clock runs over. */
  duration?: number;
  /** The Canvas, and where the scene puts it, to place frames that are no image. */
  canvas?: IIIFCanvas;
  place?: Rect;
  /** Frames that are no image, as scene items to draw, each shown with its frame. */
  onItems?: (items: SceneImage[]) => void;
}) {
  const animation = useAnimation(frames, animationKey, {
    autoplay,
    loop,
    duration,
    onEnded,
    isReady: (frame) =>
      (byFrame[frame] ?? []).every((id) => renderer.isReady(id)),
  });
  // Its video, sound and text: each made once, and let go with the animation.
  const items = useMemo(
    () => (canvas && place ? itemsOf(frames, canvas, place) : []),
    [frames, canvas, place],
  );
  const [made, setMade] = useState<{ item: FrameItem; element: HTMLElement }[]>(
    [],
  );
  useEffect(() => {
    const elements = items.map((item) => {
      if (item.kind === "text") {
        const host = document.createElement("div");
        host.className = "clover-canvas-painted-text";
        host.setAttribute("aria-hidden", "true");
        return { item, element: host };
      }
      const media = document.createElement(item.kind);
      media.preload = "auto";
      (media as HTMLVideoElement).playsInline = true;
      media.src = item.body.id;
      return { item, element: media as HTMLElement };
    });
    setMade(elements);
    return () => {
      for (const { element } of elements) {
        if (!(element instanceof HTMLMediaElement)) continue;
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
    };
  }, [items]);
  // Drawn in the scene: the video and the text, never sound, which has no picture.
  const report = useRef(onItems);
  report.current = onItems;
  useEffect(() => {
    report.current?.(
      made
        .filter(({ item }) => item.kind !== "audio")
        .map(({ item, element }) => ({
          id: item.id,
          placement: item.placement,
          width: item.placement.width,
          height: item.placement.height,
          media: { element },
          hidden: true,
        })),
    );
    return () => report.current?.([]);
  }, [made]);

  /*
   * Played on the animation's clock (Cookbook 0489: the video from its own start, 11 s
   * in): playing while its frame shows and the clock runs, else paused, and put back on
   * the clock where the two drift apart, or as the reader seeks. Muted to start where it
   * starts itself (`autoplay`), so no sound plays unasked (WCAG 1.4.2).
   */
  const [muted, setMuted] = useState(Boolean(autoplay));
  useEffect(() => {
    for (const { item, element } of made) {
      if (!(element instanceof HTMLMediaElement)) continue;
      element.muted = muted;
      if (!animation.shown.includes(item.index)) {
        if (!element.paused) element.pause();
        continue;
      }
      const own = Math.max(0, animation.time - frames[item.index].start);
      const drift = Math.abs(element.currentTime - own);
      if (drift > (animation.playing ? 1 : 0.1)) {
        try {
          element.currentTime = own;
        } catch {
          // Not seekable yet: it is put on the clock once it is.
        }
      }
      if (animation.playing && element.paused)
        void element.play()?.catch(() => undefined);
      else if (!animation.playing && !element.paused) element.pause();
    }
  }, [made, frames, animation.shown, animation.time, animation.playing, muted]);

  useEffect(() => {
    const shown = new Set([
      ...animation.shown.flatMap((frame) => byFrame[frame] ?? []),
      ...made
        .filter(({ item }) => animation.shown.includes(item.index))
        .map(({ item }) => item.id),
    ]);
    renderer.setHidden(
      [...byFrame.flat(), ...made.map(({ item }) => item.id)].filter(
        (id) => !shown.has(id),
      ),
    );
  }, [renderer, byFrame, made, animation.shown, sceneVersion]);
  const texts = made.filter(({ item }) => item.kind === "text");
  const sound = made.some(({ item }) => item.kind !== "text");
  /*
   * In the media layer, as a video's transport is: it fades with the rest of the
   * controls, and sizes its menu against the Body (`MediaBody.css`).
   */
  return (
    <div className="clover-canvas-media" data-kind="frames">
      {/*
       * The text showing, read here, outside the picture, which assistive technology
       * reads as one image (WCAG 1.1.1, 1.3.1).
       */}
      {texts.some(({ item }) => animation.shown.includes(item.index)) && (
        <div style={visuallyHidden}>
          {texts
            .filter(({ item }) => animation.shown.includes(item.index))
            .map(({ item }) => (
              <Markup
                key={item.id}
                as="p"
                markup={{ [item.body.language ?? "none"]: [item.body.value] }}
                format={item.body.format}
                language={language}
              />
            ))}
        </div>
      )}
      {texts.map(({ item, element }) => (
        <PaintedText
          key={item.id}
          host={element}
          item={item}
          shown={animation.shown.includes(item.index)}
          language={language}
        />
      ))}
      <FrameControls
        frames={frames}
        animation={animation}
        language={language}
        sound={
          sound ? { muted, toggle: () => setMuted((was) => !was) } : undefined
        }
      />
    </div>
  );
}
