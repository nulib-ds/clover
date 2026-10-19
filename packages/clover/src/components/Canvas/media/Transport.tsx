import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useBarHeight } from "./useBarHeight";
import { type MediaController, formatTime } from "./useMediaController";
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
  /** Offer full screen at the end of the bar (a lone media Canvas has no other chrome). */
  fullscreen?: boolean;
  isFullscreen?: boolean;
  /** The video, which goes full screen in the system player where the root cannot. */
  video?: HTMLVideoElement | null;
  /** Chapters, from the Manifest's Ranges: marked on the seek bar and listed in a menu. */
  chapters?: TransportChapter[];
}

export interface TransportChapter {
  label: string;
  /** The language the label is written in (WCAG 3.1.2). */
  lang?: string;
  start: number;
  end?: number;
}

/** An option of a transport menu: its name, its language, and a time to show before it. */
interface TransportOption {
  label: string;
  lang?: string;
  time?: string;
  /** The language of what it chooses (a caption track's cues), shown as its code. */
  language?: string;
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
 * onto: no taller than the stage leaves above the button, and moved along, if it must
 * be, to lie within the transport's inset from the stage's sides (WCAG 1.4.10). What
 * nothing scrolls to, off the stage, cannot be read.
 */
function placeMenu(
  options: HTMLElement,
  wrapper: HTMLElement,
  transport: HTMLElement,
  stage: HTMLElement,
) {
  const room = stage.getBoundingClientRect();
  // At rest: the transport stands on the stage's foot, and tucks (`Canvas.css`) with
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
        // InformationPanel. Heard in the capture phase, before the page's handlers.
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
  // Placed before it paints, and again as the stage, the bar or its options (a track
  // the media adds) change size.
  useLayoutEffect(() => {
    const options = list.current;
    const wrapper = menu.current;
    const transport = wrapper?.closest<HTMLElement>(".clover-canvas-transport");
    const stage = wrapper?.closest<HTMLElement>(".clover-canvas-media");
    if (!open || !options || !wrapper || !transport || !stage) return;
    const place = () => placeMenu(options, wrapper, transport, stage);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(stage);
    observer.observe(transport);
    observer.observe(options);
    return () => observer.disconnect();
  }, [open]);
  return (
    <div
      className="clover-canvas-transport-menu"
      ref={menu}
      // Open over the stage, it would cover the control focus moves on to (WCAG
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
          className="clover-canvas-transport-options"
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
                    <span>{option.time}</span>{" "}
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
                <span lang={option.lang}>{option.label}</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

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
}) => {
  const { t, langOf } = useCloverTranslation();
  // Where the root cannot go full screen (iPhone), a video still can, in the system player.
  const canFullscreen = useFullscreenSupported() || kind === "video";
  const bar = useRef<HTMLDivElement>(null);
  useBarHeight(bar);
  const { paused, currentTime, duration, buffered, muted, volume } = controller;
  // The chapter playing: the last to start at or before now.
  let chapter = -1;
  chapters.forEach((candidate, index) => {
    if (candidate.start <= currentTime) chapter = index;
  });

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
      <div className="clover-canvas-transport-seek-area">
        <input
          aria-label={t("playerSeek")}
          lang={langOf("playerSeek")}
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
          className="clover-canvas-transport-seek"
          max={duration || 0}
          min={0}
          onChange={(event) => controller.seek(Number(event.target.value))}
          step="any"
          style={
            {
              "--clover-transport-progress": `${progress}%`,
              "--clover-transport-loaded": `${loaded}%`,
            } as React.CSSProperties
          }
          type="range"
          value={currentTime}
        />
        {duration > 0 &&
          chapters
            .slice(1)
            .map((marker, index) => (
              <span
                aria-hidden="true"
                className="clover-canvas-transport-chapter-marker"
                key={index}
                style={{ left: `${(marker.start / duration) * 100}%` }}
              />
            ))}
      </div>

      {/*
       * One row while it fits. On a narrow stage, two: the time and chapter over the
       * buttons (`Transport.css`), so none is cut off (WCAG 1.4.10).
       */}
      <div className="clover-canvas-transport-bar" ref={bar}>
        <button
          aria-label={t(playKey)}
          lang={langOf(playKey)}
          aria-keyshortcuts={SHORTCUTS.play.keys}
          className="clover-canvas-transport-button"
          data-button={paused ? "play" : "pause"}
          onClick={controller.toggle}
          ref={play}
          type="button"
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
          <Tip label={t(playKey)} shortcut={SHORTCUTS.play} />
        </button>

        <button
          aria-label={t(muteKey)}
          lang={langOf(muteKey)}
          aria-keyshortcuts={SHORTCUTS.mute.keys}
          className="clover-canvas-transport-button"
          data-button="mute"
          onClick={controller.toggleMute}
          type="button"
        >
          {muted || volume === 0 ? <VolumeMutedIcon /> : <VolumeHighIcon />}
          <Tip label={t(muteKey)} shortcut={SHORTCUTS.mute} />
        </button>
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
                }))}
                selected={chapter}
                onSelect={(index) => controller.seek(chapters[index].start)}
              />
            )}
            {captions.length > 0 && (
              <TransportMenu
                id={`${instance}-captions`}
                label={t("playerCaptions")}
                labelLang={langOf("playerCaptions")}
                button="captions"
                icon={<CaptionsIcon />}
                active={activeCaption >= 0}
                current={captions[activeCaption] ?? captionsOff}
                options={[captionsOff, ...captions]}
                selected={activeCaption + 1}
                onSelect={(index) => onCaptionChange(index - 1)}
              />
            )}
            {hasFullscreen && (
              <button
                aria-label={t(fullscreenKey)}
                lang={langOf(fullscreenKey)}
                className="clover-canvas-transport-button"
                data-button="fullscreen"
                // Straight from the click: the Fullscreen API only honours a
                // user gesture.
                onClick={(event) =>
                  void toggleFullscreen(event.currentTarget, video)
                }
                type="button"
              >
                {isFullscreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}
                <Tip label={t(fullscreenKey)} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Transport;
