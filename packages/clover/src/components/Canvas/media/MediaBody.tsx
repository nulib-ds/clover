import type { CloverRequest } from "../../../core/request";
import React, { useEffect, useMemo, useState } from "react";

import type { TimedAnnotation } from "../Annotations";
import type { MediaPlacement } from "../layout";
import { type PlayerInfo, PlayerChapters, PlayerFace } from "./Player";
import Transport, { type TransportChapter, chapterAt } from "./Transport";
import { type CaptionOption, useCaptionTracks } from "./useCaptionTracks";
import { useMediaController } from "./useMediaController";
import { captionName, useMediaElement } from "./useMediaElement";
import { cueText } from "../../../core/vtt";
import { playFrom } from "../../../lib/time";
import type { CanvasSurface } from "../surface";
import type { Rect } from "../../../lib/renderer";
import { useOptionalClover } from "../../../react/context";
import { BodyUnloadable } from "../../../ui/BodyUnloadable";

const SKIP_SECONDS = 10;
/** A moment's annotation (`#t=` with no end) shows this long, to read a few words. */
const MOMENT_SECONDS = 3;

export interface MediaBodyProps {
  media: MediaPlacement;
  request?: CloverRequest;
  /** What the Canvas draws on, whose viewport takes the clicks and keys. */
  surface: CanvasSurface;
  instance: string;
  /** The element, once made, and `null` when it goes. */
  onElement: (element: HTMLVideoElement | null) => void;
  /**
   * Where a video sits in its target, fitted at its own aspect once its frame size is
   * known, and `null` until then: a Canvas may declare a shape the file does not have
   * (Cookbook 0074 declares portrait for a landscape film), so the video is fitted inside
   * rather than stretched or letterboxed.
   */
  onFit?: (placement: Rect | null) => void;
  onEnded?: () => void;
  /** The reader chose a caption track: the Manifest's file, or `null` (Off, or the media's own). */
  onCaptionChange?: (caption: { id: string; language?: string } | null) => void;
  /** The Manifest's caption file to show while captions are on, by its `id`. */
  caption?: string | null;
  /** Whether the reader may pan and zoom; off for a lone video or sound. */
  navigable?: boolean;
  /** Put full screen in the transport, as a lone media Canvas does. */
  fullscreen?: boolean;
  isFullscreen?: boolean;
  /**
   * Start playing as soon as the element exists: the reader opened the Canvas from its
   * placeholder, so the press that opened it was a press of play.
   */
  autoPlay?: boolean;
  /** Chapters, for the transport. */
  chapters?: TransportChapter[];
  /** A chapter to mark on the seek bar, by its `id`, and the one the pointer is on. */
  highlightedChapter?: string | null;
  onChapterHighlight?: (id: string | null) => void;
  /** The language to read IIIF text in. The Root's, or the reader's. */
  language?: string;
  /**
   * Annotations on the recording's time (Cookbook 0103): each shows as a cue while its
   * stretch plays, as a caption does, under its AnnotationPage's label.
   */
  notes?: TimedAnnotation[];
  /**
   * A lone recording of sound, played as a player (`Player.tsx`): its artwork, title and
   * what it is part of, its cues as lyrics and its chapters as tracks, around the
   * transport.
   */
  player?: PlayerInfo;
}

/**
 * A Canvas's video or sound: the element, its transport, and its captions.
 *
 * Loaded only when a Canvas paints media, so a page of images never downloads it. The
 * picture itself is the surface's (the renderer, or a Timeline's): this hands it the
 * element to place, and leaves zoom, pan and fullscreen to the Canvas around it.
 *
 * - A click on the picture plays or pauses, as the Player's does; double-click still
 *   zooms, except on a lone media Canvas, which never moves. On the focused Canvas, Space or K plays and pauses, M mutes, and J / L skip
 *   back and forward ten seconds.
 * - Captions are drawn here from the active track's cues, above the transport, so they
 *   read at any zoom. The tracks are the
 *   Manifest's and any the media carries itself (`useCaptionTracks`). Annotations on
 *   the recording's time show among them, each while its stretch plays.
 * - It stays mounted from one recording to the next, as auto-advance moves on, so the
 *   transport keeps keyboard focus (WCAG 2.4.3); the element and captions start afresh.
 * - Sound plays through the same element and transport, over the Canvas's accompanying
 *   or placeholder image when it has one.
 */
const MediaBody: React.FC<MediaBodyProps> = ({
  media,
  request,
  surface,
  instance,
  onElement,
  onFit,
  onEnded,
  onCaptionChange,
  caption,
  navigable = true,
  fullscreen = false,
  isFullscreen = false,
  autoPlay = false,
  chapters,
  highlightedChapter,
  onChapterHighlight,
  language: givenLanguage,
  notes,
  player,
}) => {
  // IIIF text in the Root's language, or the reader's when there is no Root.
  const rootLanguage = useOptionalClover()?.language;
  const language = givenLanguage ?? rootLanguage;
  const element = useMediaElement(media, { request, language });
  const controller = useMediaController(element, media.duration);
  const failed = useMediaFailed(element);
  // The Manifest's tracks, named in the reader's language and tagged with it (WCAG 3.1.2).
  const own = useMemo<CaptionOption[]>(
    () =>
      media.captions.map((caption, index) => {
        const name = captionName(caption, index, language);
        return {
          label: name.text,
          labelLang: name.lang,
          language: caption.language,
        };
      }),
    [media.captions, language],
  );
  // The first track shows by default, as the Player shows it.
  const captions = useCaptionTracks(element, own, media.id);
  /*
   * A caption file chosen elsewhere (a transcript's language) is the one shown, while one
   * shows: Off stays off, and the reader's own choice in the menu is told back as theirs.
   */
  const { active: shown, select } = captions;
  useEffect(() => {
    if (!caption || shown < 0) return;
    const index = media.captions.findIndex((each) => each.id === caption);
    if (index >= 0 && index !== shown) select(index);
    // Only as the file asked for changes: the reader's menu stays theirs in between.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caption, media.captions]);
  const [cues, setCues] = useState<string[]>([]);

  useEffect(() => {
    onElement(element);
    return () => onElement(null);
  }, [element, onElement]);

  const size = useVideoSize(media.kind === "video" ? element : null);
  const fit = useMemo(
    () => size && containAspect(media.placement, size),
    [media.placement, size],
  );
  useEffect(() => {
    onFit?.(fit);
    return () => onFit?.(null);
  }, [fit, onFit]);

  useEffect(() => {
    if (!element || !onEnded) return;
    element.addEventListener("ended", onEnded);
    return () => element.removeEventListener("ended", onEnded);
  }, [element, onEnded]);

  // The commands are stable per element; the controller object is new every update.
  const { play, toggle, toggleMute, skip } = controller;

  /*
   * A browser that will not play without a fresh gesture (Safari, once the Body has
   * loaded) leaves it paused, its transport ready; `play` swallows the refusal.
   */
  useEffect(() => {
    if (autoPlay) play();
  }, [autoPlay, play]);

  // A click on the picture plays and pauses; double-click (and pinch) still zoom.
  useEffect(() => {
    surface.setGestures({
      clickToZoom: false,
      dblClickToZoom: true,
      navigable,
    });
    const off = surface.on("tap", () => toggle());
    return () => {
      off();
      surface.setGestures({});
    };
  }, [surface, toggle, navigable]);

  useEffect(() => {
    const host = surface.host;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== host || event.altKey || event.metaKey) return;
      if (event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "k") toggle();
      else if (key === "m") toggleMute();
      else if (key === "j") skip(-SKIP_SECONDS);
      else if (key === "l") skip(SKIP_SECONDS);
      else return;
      event.preventDefault();
    };
    host.addEventListener("keydown", onKeyDown);
    return () => host.removeEventListener("keydown", onKeyDown);
  }, [surface, toggle, toggleMute, skip]);

  // Draw the chosen track's cues.
  const { track } = captions;
  useEffect(() => {
    setCues([]);
    if (!track) return;
    const update = () =>
      setCues(
        Array.from(track.activeCues ?? []).map((cue) => {
          // The words alone: tags dropped and character references decoded, by the
          // browser where it can (`text` is the cue as written), else as `Transcript` does.
          const vtt = cue as VTTCue;
          return vtt.getCueAsHTML?.()?.textContent ?? cueText(vtt.text ?? "");
        }),
      );
    track.addEventListener("cuechange", update);
    update();
    return () => track.removeEventListener("cuechange", update);
  }, [track]);

  const captionLabels = useMemo(
    () =>
      captions.options.map(({ label, labelLang, language }) => ({
        label,
        lang: labelLang,
        language,
      })),
    [captions.options],
  );

  // The cues are in their track's language (WCAG 3.1.2); IIIF's "none" is not a tag.
  const captionLanguage = captions.options[captions.active]?.language;

  /*
   * A player's artwork turns from its placeholder to its accompanying Canvas once it has
   * played, and holds there, as the IIIF has them: one before, one while it plays.
   */
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(false), [media.id]);
  const { paused } = controller;
  useEffect(() => {
    if (!paused) setStarted(true);
  }, [paused]);

  // The annotations whose stretch is playing, in the order given.
  const { currentTime } = controller;
  const playing = useMemo(
    () =>
      (notes ?? []).filter(
        (note) =>
          note.label &&
          currentTime >= note.start &&
          currentTime < (note.end ?? note.start + MOMENT_SECONDS),
      ),
    [notes, currentTime],
  );

  const transport = (
    <Transport
      instance={instance}
      controller={controller}
      kind={media.kind}
      captions={captionLabels}
      activeCaption={captions.active}
      onCaptionChange={(index) => {
        captions.select(index);
        // The Manifest's files come first in the menu; past them, the media's own.
        const chosen = media.captions[index];
        onCaptionChange?.(
          chosen ? { id: chosen.id, language: chosen.language } : null,
        );
      }}
      fullscreen={fullscreen}
      isFullscreen={isFullscreen}
      video={media.kind === "video" ? element : null}
      chapters={chapters}
      highlightedChapter={highlightedChapter}
      onChapterHighlight={onChapterHighlight}
      request={request}
    />
  );
  /*
   * After the transport: the stylesheet lifts the cues clear of it. The annotations over
   * the captions, which keep the line nearest the bar. In a player, they are its lyrics.
   */
  const cuesShown = cues.length + playing.length > 0 && (
    <div className="clover-canvas-captions" aria-live="off">
      {playing.map((note) => (
        <span
          className="clover-canvas-captions-cue"
          data-kind="annotation"
          key={note.id}
        >
          {note.page && (
            <span
              className="clover-canvas-captions-cue-label"
              lang={note.page.lang}
            >
              {note.page.text}
            </span>
          )}
          <span lang={note.lang}>{note.label}</span>
        </span>
      ))}
      {cues.map((text, index) => (
        <span
          className="clover-canvas-captions-cue"
          key={index}
          lang={
            captionLanguage && captionLanguage !== "none"
              ? captionLanguage
              : undefined
          }
        >
          {text}
        </span>
      ))}
    </div>
  );

  if (player) {
    // The chapter playing, as the transport finds it: the last begun.
    const current = chapterAt(chapters ?? [], currentTime);
    /*
     * In reading order, which is also the keyboard's: what it is, its lyrics, the
     * transport, then its tracks, under it as an album's are under its player.
     */
    return (
      <div
        className="clover-canvas-media"
        data-kind={media.kind}
        data-player=""
        data-testid="clover-canvas-media"
      >
        <div className="clover-canvas-player">
          <PlayerFace
            player={player}
            started={started}
            request={request}
            language={language}
          />
          {cuesShown}
          {transport}
          <BodyUnloadable kind={media.kind} shown={failed} room />
          {chapters && chapters.length > 0 && (
            <PlayerChapters
              chapters={chapters}
              current={current}
              // A track pressed plays from its start, as every time a part lists does.
              onSeek={(seconds) => element && playFrom(element, seconds)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="clover-canvas-media"
      data-kind={media.kind}
      data-testid="clover-canvas-media"
    >
      {transport}
      {cuesShown}
      <BodyUnloadable kind={media.kind} shown={failed} room />
    </div>
  );
};

export default MediaBody;

/**
 * Whether the element could not load what it was given (its `error`, a source that
 * answers with an error or that the browser cannot play), until it is given another.
 */
function useMediaFailed(element: HTMLVideoElement | null) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(Boolean(element?.error));
    if (!element) return;
    const fail = () => setFailed(Boolean(element.error));
    const retry = () => setFailed(false);
    element.addEventListener("error", fail);
    element.addEventListener("loadstart", retry);
    return () => {
      element.removeEventListener("error", fail);
      element.removeEventListener("loadstart", retry);
    };
  }, [element]);
  return failed;
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

/** The largest rectangle of `size`'s aspect centered inside `box`; `box` until it is known. */

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
