import type { CloverRequest } from "../../../core/request";
import React, { useEffect, useMemo, useState } from "react";

import type { TimedAnnotation } from "../Annotations";
import type { MediaPlacement } from "../layout";
import Transport, { type TransportChapter } from "./Transport";
import { type CaptionOption, useCaptionTracks } from "./useCaptionTracks";
import { useMediaController } from "./useMediaController";
import { useMediaElement } from "./useMediaElement";
import { type LanguageMapLike, localize } from "../../../core/value";
import { cueText } from "../../../core/vtt";
import type { CanvasRenderer } from "../../../lib/renderer";
import { useOptionalClover } from "../../../react/context";

const SKIP_SECONDS = 10;
/** A moment's annotation (`#t=` with no end) shows this long, to read a few words. */
const MOMENT_SECONDS = 3;

export interface MediaStageProps {
  media: MediaPlacement;
  presentation: "dom" | "texture";
  request?: CloverRequest;
  renderer: CanvasRenderer;
  instance: string;
  /**
   * The element, once made (and `null` when it goes), and how it is presented — `dom`
   * when `texture` was asked for but the media would not load with CORS.
   */
  onElement: (
    element: HTMLVideoElement | null,
    presentation: "dom" | "texture",
  ) => void;
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
  /** The language to read IIIF text in. The Root's, or the reader's. */
  language?: string;
  /**
   * Annotations on the recording's time (Cookbook 0103): each shows as a cue while its
   * stretch plays, as a caption does, under its AnnotationPage's label.
   */
  notes?: TimedAnnotation[];
}

/**
 * A Canvas's video or sound: the element, its transport, and its captions.
 *
 * Loaded only when a Canvas paints media, so a page of images never downloads it. The
 * picture itself is the renderer's: this hands it the element to place, and leaves zoom,
 * pan and fullscreen to the Canvas around it.
 *
 * - A click on the picture plays or pauses, as the Player's does; double-click still
 *   zooms, except on a lone media Canvas, which never moves. On the focused Canvas, Space or K plays and pauses, M mutes, and J / L skip
 *   back and forward ten seconds.
 * - Captions are drawn here from the active track's cues, above the transport, so they
 *   read at any zoom whichever way the video is presented. The tracks are the
 *   Manifest's and any the media carries itself (`useCaptionTracks`). Annotations on
 *   the recording's time show among them, each while its stretch plays.
 * - It stays mounted from one recording to the next, as auto-advance moves on, so the
 *   transport keeps keyboard focus (WCAG 2.4.3); the element and captions start afresh.
 * - Sound plays through the same element and transport, over the Canvas's accompanying
 *   or placeholder image when it has one.
 */
const MediaStage: React.FC<MediaStageProps> = ({
  media,
  presentation,
  request,
  renderer,
  instance,
  onElement,
  onEnded,
  onCaptionChange,
  caption,
  navigable = true,
  fullscreen = false,
  isFullscreen = false,
  autoPlay = false,
  chapters,
  language: givenLanguage,
  notes,
}) => {
  // IIIF text in the Root's language, or the reader's when there is no Root.
  const rootLanguage = useOptionalClover()?.language;
  const language = givenLanguage ?? rootLanguage;
  const { element, presentation: presented } = useMediaElement(media, {
    presentation,
    request,
    language,
  });
  const controller = useMediaController(element, media.duration);
  // The Manifest's tracks, named in the reader's language and tagged with it (WCAG 3.1.2).
  const own = useMemo<CaptionOption[]>(
    () =>
      media.captions.map((caption, index) => {
        const name = localize(caption.label as LanguageMapLike, language);
        return {
          label: name.text || caption.language || String(index + 1),
          labelLang: name.text ? name.lang : undefined,
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
    onElement(element, presented);
    return () => onElement(null, presented);
  }, [element, presented, onElement]);

  useEffect(() => {
    if (!element || !onEnded) return;
    element.addEventListener("ended", onEnded);
    return () => element.removeEventListener("ended", onEnded);
  }, [element, onEnded]);

  // The commands are stable per element; the controller object is new every update.
  const { play, toggle, toggleMute, skip } = controller;

  /*
   * A browser that will not play without a fresh gesture (Safari, once the stage has
   * loaded) leaves it paused, its transport ready; `play` swallows the refusal.
   */
  useEffect(() => {
    if (autoPlay) play();
  }, [autoPlay, play]);

  // A click on the picture plays and pauses; double-click (and pinch) still zoom.
  useEffect(() => {
    renderer.setGestures({
      clickToZoom: false,
      dblClickToZoom: true,
      navigable,
    });
    const off = renderer.on("tap", () => toggle());
    return () => {
      off();
      renderer.setGestures({});
    };
  }, [renderer, toggle, navigable]);

  useEffect(() => {
    const host = renderer.host;
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
  }, [renderer, toggle, toggleMute, skip]);

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

  return (
    <div
      className="clover-canvas-media"
      data-kind={media.kind}
      data-testid="clover-canvas-media"
    >
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
      />
      {/*
        After the transport: the stylesheet lifts the cues clear of it. The annotations
        over the captions, which keep the line nearest the bar.
      */}
      {cues.length + playing.length > 0 && (
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
      )}
    </div>
  );
};

export default MediaStage;
