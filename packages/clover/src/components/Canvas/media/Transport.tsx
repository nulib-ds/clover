import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { TransportButton } from "./TransportButton";
import { useBarHeight } from "./useBarHeight";
import { type MediaController, formatTime } from "./useMediaController";
import type { CloverRequest } from "../../../core/request";
import { type ThumbnailSource, imageSource } from "../../../core/thumbnail";
import {
  EntryThumbnail,
  PICTURE_SIZE,
  useThumbnail,
} from "../../../ui/EntryThumbnail";
import { join } from "../../../lib/classnames";
import { languageCode } from "../../../ui/languageCode";
import { SHORTCUTS, Tip } from "../../../ui/Tip";
import { useOneOpen } from "../../../ui/useOneOpen";
import {
  CaptionsIcon,
  ChaptersIcon,
  ExitFullScreenIcon,
  FullScreenIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
} from "../../../ui/mediaIcons";
import { useContainerName } from "../../../ui/useContainerName";
import { useCloverTranslation } from "../../../i18n/useCloverTranslation";
import { toggleFullscreen } from "../../../lib/fullscreen";
import useFullscreenSupported from "../../../hooks/useFullscreenSupported";

interface TransportProps {
  instance: string;
  controller: MediaController;
  kind: "video" | "audio";
  /**
   * The caption tracks: each one's name, the language it is written in, and the language
   * of its cues.
   */
  captions: Array<{ label: string; lang?: string; language?: string }>;
  /** The caption track showing, or -1 for none. */
  activeCaption: number;
  onCaptionChange: (index: number) => void;
  /** Offer full screen at the end of the bar (a lone media Canvas has no other controls). */
  fullscreen?: boolean;
  isFullscreen?: boolean;
  /** The video, which goes full screen in the system player where the root cannot. */
  video?: HTMLVideoElement | null;
  /** Chapters, from the Manifest's Ranges: marked on the seek bar and listed in a menu. */
  chapters?: TransportChapter[];
  /** A chapter (its `id`) marked from outside, as hovering it in `Contents` does. */
  highlightedChapter?: string | null;
  /** The chapter under the pointer on the seek bar, by its `id`; null as it leaves. */
  onChapterHighlight?: (id: string | null) => void;
  /** How the chapters' pictures are fetched: the host's credentials and headers. */
  request?: CloverRequest;
}

export interface TransportChapter {
  /** Its Range's id, by which a list beside the Canvas names it. */
  id?: string;
  label: string;
  /** The language the label is written in (WCAG 3.1.2). */
  lang?: string;
  start: number;
  end?: number;
  /**
   * A picture of it (its Range's `thumbnail`, Cookbook 0229): a URL, shown as it is, or a
   * IIIF image, asked of its service as its `info.json` allows.
   */
  thumbnail?: string | Record<string, unknown>;
}

/** A chapter's picture as a source, a URL given as it is. */
const chapterPicture = (chapter?: TransportChapter) =>
  typeof chapter?.thumbnail === "string"
    ? { src: chapter.thumbnail }
    : imageSource(chapter?.thumbnail as Record<string, any> | undefined);

/**
 * The seek bar's mask: opaque but for a gap `--clover-transport-gap` wide at each share of
 * it (a chapter's start, in percent), cut out of the bar (`Transport.css`).
 */
function gapMask(at: number[]): string {
  const half = "var(--clover-transport-gap) / 2";
  const stops = at.flatMap((share) => [
    `#000 0 calc(${share}% - ${half})`,
    `transparent 0 calc(${share}% + ${half})`,
  ]);
  return `linear-gradient(to right, ${[...stops, "#000 0"].join(", ")})`;
}

/** The chapter playing at `time`: the last to start at or before it, or -1. */
export function chapterAt(chapters: TransportChapter[], time: number): number {
  let found = -1;
  chapters.forEach((candidate, index) => {
    if (candidate.start <= time) found = index;
  });
  return found;
}

/** An option of a transport menu: its name, its language, and a time to show before it. */
interface TransportOption {
  label: string;
  lang?: string;
  time?: string;
  /** The language of what it chooses (a caption track's cues), shown as its code. */
  language?: string;
  /** A picture of what it chooses (a chapter's), under it while it is chosen. */
  thumbnail?: ThumbnailSource | null;
}

/**
 * Whether a page may set the volume. iOS leaves it to the device's buttons, and reads
 * back 1 whatever it is set to, so a slider there would move and do nothing.
 */
let volumeSettable: boolean | undefined;
function canSetVolume(): boolean {
  if (volumeSettable === undefined) {
    if (typeof document === "undefined") return true;
    const probe = document.createElement("video");
    probe.volume = 0.5;
    volumeSettable = probe.volume === 0.5;
  }
  return volumeSettable;
}

/**
 * Places an open menu from where its button is, whichever row of the bar it wrapped
 * onto: no taller than the Body leaves above the button, and moved along, if it must
 * be, to lie within the transport's inset from the Body's sides (WCAG 1.4.10). What
 * nothing scrolls to, off the Body, cannot be read.
 */
function placeMenu(
  options: HTMLElement,
  wrapper: HTMLElement,
  transport: HTMLElement,
  bodyBox: HTMLElement,
) {
  const room = bodyBox.getBoundingClientRect();
  // At rest: the transport stands on the Body's foot, and tucks (`Canvas.css`) with
  // its button, so the distance between them holds while it moves.
  const above =
    room.height -
    (transport.getBoundingClientRect().bottom -
      wrapper.getBoundingClientRect().top);
  options.style.setProperty("--clover-transport-menu-above", `${above}px`);
  options.style.removeProperty("--clover-transport-menu-shift");
  const box = options.getBoundingClientRect();
  const inset = parseFloat(getComputedStyle(transport).paddingRight) || 0;
  const shift = Math.max(
    room.left + inset - box.left,
    Math.min(0, room.right - inset - box.right),
  );
  if (shift) {
    options.style.setProperty("--clover-transport-menu-shift", `${shift}px`);
  }
}

/**
 * A menu button over a set of radio options: open on press, closed by Escape, an outside
 * press, a second press, picking an option with a pointer or Enter, or keyboard focus
 * moving on past it. The arrow keys move through the options and leave it open, as a
 * Choice's menu does. Closing from inside hands focus back to the button. Captions and
 * chapters both use it.
 */
function TransportMenu({
  id,
  label,
  labelLang,
  button,
  icon,
  active,
  current,
  options,
  selected,
  onSelect,
  request,
  asMenu = false,
}: {
  id: string;
  label: string;
  /** The language of `label`, where it is not the page's. */
  labelLang?: string;
  button: string;
  icon: React.ReactNode;
  active?: boolean;
  /** The option in use, given to assistive technology as the button's description. */
  current?: TransportOption;
  options: TransportOption[];
  selected: number;
  onSelect: (index: number) => void;
  /** How the options' pictures are fetched. */
  request?: CloverRequest;
  /**
   * Drawn as the Canvas's other menus are (`ControlMenu.css`), on Clover's ground rather
   * than the bar's dark: the chapters', as the annotations' menu is (Mat, 2026-10-28).
   */
  asMenu?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLFieldSetElement>(null);
  // Whether the last press in the menu was a pointer's, whose pick closes it. `detail`
  // cannot tell: Chrome and Safari pass a label's click on to its radio with `detail` 0,
  // as they send an arrow key's.
  const pointer = useRef(false);
  const name = useContainerName(label, labelLang);
  const coded = options.some((option) => languageCode(option.language));
  useOneOpen(open, () => setOpen(false));
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        // Escape from inside the menu hands focus back to its button, not to the page,
        // and closes nothing else: not a modal `<dialog>` around it, nor a floating
        // Panel. Heard in the capture phase, before the page's handlers.
        if (menu.current?.contains(document.activeElement)) {
          event.preventDefault();
          trigger.current?.focus();
        }
      } else if (menu.current?.contains(event.target as Node)) {
        // A press inside the menu: its options and its button handle it.
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close, true);
    };
  }, [open]);
  // Placed before it paints, and again as the Body, the bar or its options (a track
  // the media adds) change size.
  useLayoutEffect(() => {
    const options = list.current;
    const wrapper = menu.current;
    const transport = wrapper?.closest<HTMLElement>(".clover-canvas-transport");
    const bodyBox = wrapper?.closest<HTMLElement>(".clover-canvas-media");
    if (!open || !options || !wrapper || !transport || !bodyBox) return;
    const place = () => placeMenu(options, wrapper, transport, bodyBox);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(bodyBox);
    observer.observe(transport);
    observer.observe(options);
    return () => observer.disconnect();
  }, [open]);
  return (
    <div
      className="clover-canvas-transport-menu"
      ref={menu}
      // Open over the Body, it would cover the control focus moves on to (WCAG
      // 2.4.11), so it closes, leaving focus there. Focus that goes nowhere (a press on
      // the menu's own text, another window) leaves it open.
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (open && next instanceof Node && !menu.current?.contains(next)) {
          setOpen(false);
        }
      }}
    >
      <button
        aria-controls={id}
        aria-describedby={current ? `${id}-current` : undefined}
        aria-expanded={open}
        aria-label={label}
        lang={labelLang}
        className="clover-canvas-transport-button"
        data-active={active ? "" : undefined}
        data-button={button}
        onClick={() => setOpen((value) => !value)}
        ref={trigger}
        type="button"
      >
        {icon}
        <Tip label={label} />
      </button>
      {current && (
        // Hidden, yet still read as the description: the name stays the Tip's.
        <span hidden id={`${id}-current`} lang={current.lang}>
          {current.label}
        </span>
      )}
      {open && name.node}
      {open && (
        <fieldset
          {...name.props}
          className={join(
            "clover-canvas-transport-options",
            asMenu && "clover-canvas-menu",
          )}
          id={id}
          ref={list}
        >
          {options.map((option, index) => {
            const code = languageCode(option.language);
            return (
              <label
                className="clover-canvas-transport-option"
                key={index}
                onPointerDown={() => {
                  pointer.current = true;
                }}
              >
                <input
                  checked={selected === index}
                  name={id}
                  onChange={() => onSelect(index)}
                  onClick={() => {
                    if (pointer.current) dismiss();
                  }}
                  onKeyDown={(event) => {
                    pointer.current = false;
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onSelect(index);
                      dismiss();
                    }
                  }}
                  type="radio"
                />
                {option.time && (
                  <>
                    <span className="clover-cue-time">{option.time}</span>{" "}
                  </>
                )}
                {/*
                 * The code of its cues' language ("EN", "IT"), where any option has one: so a
                 * reader who cannot read a name can still tell its language. An option
                 * without one (Off) keeps the column, its cell empty and unread.
                 */}
                {coded &&
                  (code ? (
                    <>
                      <span className="clover-canvas-transport-code">
                        {code}
                      </span>{" "}
                    </>
                  ) : (
                    <span
                      className="clover-canvas-transport-code"
                      aria-hidden="true"
                    />
                  ))}
                {/* Only the name carries its language: the time is in digits. */}
                <span className="clover-cue-text" lang={option.lang}>
                  {option.label}
                </span>
                {/* The chosen one's picture under it, as Contents shows the current one's. */}
                {selected === index && (
                  <EntryThumbnail
                    source={option.thumbnail}
                    request={request}
                    large
                  />
                )}
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

/** The popover an element holds itself, if it holds one. */
const tipIn = (element: Element) =>
  element.querySelector<HTMLElement>(":scope > .clover-tip");

/** Whether keyboard focus is on an element: where `:focus-visible` is unknown, not. */
const focusVisible = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
};

/**
 * Clover's own transport for a Canvas's video or sound, styled as the Player's bar:
 * the seek bar across the top, play, volume and time below, captions to the right.
 *
 * Native controls throughout — a range input is the seek bar and the volume — so every
 * control is reachable and named without a widget library, and drives the element only
 * through the headless controller.
 */
const Transport: React.FC<TransportProps> = ({
  instance,
  controller,
  kind,
  captions,
  activeCaption,
  onCaptionChange,
  fullscreen = false,
  isFullscreen = false,
  video,
  chapters = [],
  highlightedChapter = null,
  onChapterHighlight,
  request,
}) => {
  const { t, langOf } = useCloverTranslation();
  // Where the root cannot go full screen (iPhone), a video still can, in the system player.
  const canFullscreen = useFullscreenSupported() || kind === "video";
  const bar = useRef<HTMLDivElement>(null);
  useBarHeight(bar);
  const { paused, currentTime, duration, buffered, muted, volume } = controller;
  // The chapter playing.
  const chapter = chapterAt(chapters, currentTime);
  /*
   * The chapter under the pointer on the seek bar: its stretch of the bar drawn out, the
   * time under the pointer and the chapter's title in a popover over it, and the host
   * told (`onChapterHighlight`), for a list beside the Canvas to mark. Keyboard focus on
   * the bar shows the playing chapter's, at the time playing. Set only as the pointer
   * crosses from one chapter to the next, and its time from one second to the next, so a
   * move along the bar renders little. One marked from outside (`highlightedChapter`) has
   * its stretch drawn out only: a popover away from the pointer could not be hovered
   * (WCAG 1.4.13).
   */
  const [pointed, setPointed] = useState(-1);
  // The second under the pointer, as the popover writes it (Mat, 2026-10-28: "show where
  // the cursor is within the range").
  const [pointedAt, setPointedAt] = useState(0);
  const pointedRef = useRef(-1);
  const point = (index: number) => {
    if (pointedRef.current === index) return;
    pointedRef.current = index;
    setPointed(index);
    onChapterHighlight?.(chapters[index]?.id ?? null);
  };
  const [seekFocused, setSeekFocused] = useState(false);
  const previewed = pointed >= 0 ? pointed : seekFocused ? chapter : -1;
  // Its picture over its words, as a hotspot's popover shows its image.
  const preview = useThumbnail(
    chapterPicture(chapters[previewed]),
    PICTURE_SIZE,
    request,
  );
  const marked =
    pointed >= 0
      ? pointed
      : chapters.findIndex(
          (each) => each.id !== undefined && each.id === highlightedChapter,
        );
  /*
   * While the popover shows, the caption cues stay above it: how far its top is from the
   * figure's foot, `--clover-transport-preview-top`, which the captions keep their foot
   * over (`MediaBody.css`). Taken from the popover alone, so a cue's own glide never
   * skews it; measured as it shows, and again if it wraps.
   */
  const seekArea = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const area = seekArea.current;
    const figure = area?.closest<HTMLElement>(".clover-canvas");
    const tip = area && previewed >= 0 ? tipIn(area) : null;
    if (!figure || !tip) return;
    const top = "--clover-transport-preview-top";
    const place = () =>
      figure.style.setProperty(
        top,
        `${figure.getBoundingClientRect().bottom - tip.getBoundingClientRect().top}px`,
      );
    place();
    const observer = new ResizeObserver(place);
    observer.observe(tip);
    return () => {
      observer.disconnect();
      figure.style.removeProperty(top);
    };
  }, [previewed]);
  // Where a chapter lies along the bar, in percent of it.
  const along = (index: number) => {
    const { start, end = duration } = chapters[index];
    return {
      left: (start / duration) * 100,
      width: ((end - start) / duration) * 100,
    };
  };

  const playKey = paused ? "playerPlay" : "playerPause";
  const captionsOff = {
    label: t("playerCaptionsOff"),
    lang: langOf("playerCaptionsOff"),
  };
  const muteKey = muted ? "playerUnmute" : "playerMute";
  const fullscreenKey = isFullscreen
    ? "imageExitFullScreen"
    : "imageFullScreen";
  const progress = duration ? (currentTime / duration) * 100 : 0;
  // A gap in the seek bar where each chapter after the first begins (Mat, 2026-10-28).
  const gaps = useMemo(
    () =>
      duration > 0 && chapters.length > 1
        ? gapMask(
            chapters.slice(1).map((item) => (item.start / duration) * 100),
          )
        : undefined,
    [chapters, duration],
  );
  const loaded = duration ? (buffered / duration) * 100 : 0;
  const hasFullscreen = fullscreen && canFullscreen;

  /*
   * The control keyboard focus is on. One the next recording does not have (it has no
   * captions, or no chapters) goes with focus on it, which would drop focus to the page:
   * Play takes it instead (WCAG 2.4.3). Focus that left for somewhere else forgets it.
   */
  const focused = useRef<HTMLElement | null>(null);
  const play = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const control = focused.current;
    if (!control || control.isConnected) return;
    focused.current = null;
    const active = document.activeElement;
    if (!active || active === document.body) play.current?.focus();
  }, [captions.length, chapters.length, hasFullscreen]);

  return (
    <div
      className="clover-canvas-transport"
      data-kind={kind}
      data-testid="clover-canvas-transport"
      onFocus={(event) => {
        focused.current = event.target;
      }}
      onBlur={(event) => {
        const control = event.target;
        const next = event.relatedTarget;
        if (next instanceof Node) {
          if (!event.currentTarget.contains(next)) focused.current = null;
          return;
        }
        // To nowhere: a press beside the bar, another window, or the control removed.
        // Only a removed one is kept, for the effect above.
        queueMicrotask(() => {
          if (focused.current === control && control.isConnected) {
            focused.current = null;
          }
        });
      }}
    >
      <div
        ref={seekArea}
        className="clover-canvas-transport-seek-area"
        onPointerMove={(event) => {
          // Over its popover, the chapter it shows stays.
          if (!duration || (event.target as Element).closest(".clover-tip"))
            return;
          const box = event.currentTarget.getBoundingClientRect();
          const at = Math.min(
            duration,
            Math.max(0, ((event.clientX - box.left) / box.width) * duration),
          );
          setPointedAt(Math.floor(at));
          point(chapterAt(chapters, at));
        }}
        onPointerLeave={() => point(-1)}
        style={
          previewed >= 0 && duration > 0
            ? ({
                "--clover-transport-preview": `${
                  along(previewed).left + along(previewed).width / 2
                }%`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <input
          aria-label={t("playerSeek")}
          lang={langOf("playerSeek")}
          // Where it is, and in which chapter, as the popover shows it to the eye.
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}${
            chapter >= 0 ? `, ${chapters[chapter].label}` : ""
          }`}
          className="clover-canvas-transport-seek"
          onFocus={(event) => setSeekFocused(focusVisible(event.currentTarget))}
          onBlur={() => setSeekFocused(false)}
          max={duration || 0}
          min={0}
          onChange={(event) => controller.seek(Number(event.target.value))}
          step="any"
          data-gaps={gaps ? "" : undefined}
          style={
            {
              "--clover-transport-progress": `${progress}%`,
              "--clover-transport-loaded": `${loaded}%`,
              // The mask, and where the thumb is along it, which it never cuts.
              ...(gaps && {
                "--clover-transport-gaps": gaps,
                "--clover-transport-at": progress / 100,
              }),
            } as React.CSSProperties
          }
          type="range"
          value={currentTime}
        />
        {marked >= 0 && duration > 0 && (
          <span
            aria-hidden="true"
            className="clover-canvas-transport-chapter-span"
            style={{
              left: `${along(marked).left}%`,
              width: `${along(marked).width}%`,
            }}
          />
        )}
        {previewed >= 0 && duration > 0 && (
          // Made anew for each chapter, so it measures itself into the Body each time.
          <Tip
            key={previewed}
            lead={formatTime(pointed >= 0 ? pointedAt : currentTime)}
            label={chapters[previewed].label}
            lang={chapters[previewed].lang}
            image={preview}
          />
        )}
      </div>

      {/*
       * One row while it fits. On a narrow Body, two: the time and chapter over the
       * buttons (`Transport.css`), so none is cut off (WCAG 1.4.10).
       */}
      <div className="clover-canvas-transport-bar" ref={bar}>
        <TransportButton
          words={playKey}
          button={paused ? "play" : "pause"}
          shortcut={SHORTCUTS.play}
          onClick={controller.toggle}
          buttonRef={play}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </TransportButton>

        <TransportButton
          words={muteKey}
          button="mute"
          shortcut={SHORTCUTS.mute}
          onClick={controller.toggleMute}
        >
          {muted || volume === 0 ? <VolumeMutedIcon /> : <VolumeHighIcon />}
        </TransportButton>
        {canSetVolume() && (
          <input
            aria-label={t("playerVolume")}
            lang={langOf("playerVolume")}
            className="clover-canvas-transport-volume"
            max={1}
            min={0}
            onChange={(event) =>
              controller.setVolume(Number(event.target.value))
            }
            step={0.05}
            style={
              {
                "--clover-transport-progress": `${(muted ? 0 : volume) * 100}%`,
              } as React.CSSProperties
            }
            type="range"
            value={muted ? 0 : volume}
          />
        )}

        {/* Where it is: the time, and the chapter playing. It takes the room between. */}
        <span className="clover-canvas-transport-status">
          <span className="clover-canvas-transport-time">
            <span
              aria-label={t("playerCurrentTime")}
              lang={langOf("playerCurrentTime")}
            >
              {formatTime(currentTime)}
            </span>
            <span aria-hidden="true"> / </span>
            <span
              aria-label={t("playerDuration")}
              lang={langOf("playerDuration")}
            >
              {formatTime(duration)}
            </span>
          </span>
          {chapter >= 0 && (
            <span
              className="clover-canvas-transport-chapter"
              lang={chapters[chapter].lang}
            >
              {chapters[chapter].label}
            </span>
          )}
        </span>

        {/*
         * The controls at the end keep together, at the end of their row, and wrap onto
         * a row of their own, the bar's last, where they would not fit beside the rest.
         */}
        {(chapters.length > 0 || captions.length > 0 || hasFullscreen) && (
          <div className="clover-canvas-transport-end">
            {chapters.length > 0 && (
              <TransportMenu
                id={`${instance}-chapters`}
                label={t("playerChapters")}
                labelLang={langOf("playerChapters")}
                button="chapters"
                icon={<ChaptersIcon />}
                options={chapters.map((item) => ({
                  label: item.label,
                  lang: item.lang,
                  time: formatTime(item.start),
                  thumbnail: chapterPicture(item),
                }))}
                selected={chapter}
                onSelect={(index) => controller.seek(chapters[index].start)}
                request={request}
                asMenu
              />
            )}
            {captions.length > 0 && (
              <TransportMenu
                id={`${instance}-captions`}
                label={t("playerCaptions")}
                labelLang={langOf("playerCaptions")}
                button="captions"
                icon={<CaptionsIcon on={activeCaption >= 0} />}
                active={activeCaption >= 0}
                current={captions[activeCaption] ?? captionsOff}
                options={[captionsOff, ...captions]}
                selected={activeCaption + 1}
                onSelect={(index) => onCaptionChange(index - 1)}
              />
            )}
            {hasFullscreen && (
              <TransportButton
                words={fullscreenKey}
                button="fullscreen"
                // Straight from the click: the Fullscreen API only honors a
                // user gesture.
                onClick={(event) =>
                  void toggleFullscreen(event.currentTarget, video)
                }
              >
                {isFullscreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}
              </TransportButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Transport;
