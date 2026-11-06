import type { CloverRequest } from "../../../core/request";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Types alone: the hotspots' module loads only for a Canvas with annotations.
import type {
  ListedAnnotation,
  PlacedAnnotation,
  TimedAnnotation,
} from "../Annotations";
import type { MediaPlacement } from "../layout";
import { type PlayerInfo, PlayerFace } from "./Player";
import Transport, { type TransportChapter } from "./Transport";
import type { SeekMark } from "./SeekMarks";
import { type CaptionOption, useCaptionTracks } from "./useCaptionTracks";
import { useMediaController } from "./useMediaController";
import { captionName, useMediaElement } from "./useMediaElement";
import { cueText } from "../../../core/vtt";
import { type CanvasSurface, hasCamera } from "../surface";
import type { Rect } from "../../../lib/renderer";
import { useOptionalClover } from "../../../react/context";
import { BodyUnloadable } from "../../../ui/BodyUnloadable";
import { languageProps } from "../../../i18n/direction";
import { startingLanguage } from "../../../i18n/languages";

const SKIP_SECONDS = 10;
/** A moment's annotation (`#t=` with no end) shows this long, to read a few words. */
const MOMENT_SECONDS = 3;

export interface MediaBodyProps {
  media: MediaPlacement;
  request?: CloverRequest;
  /** A lone video, which may fill the Body: its fit's toggle in the transport. */
  fillable?: boolean;
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
   * The annotations placed on the picture: those that follow the recording
   * (`xywh=…&t=…`) are marked on the seek bar where they start, as those on its time are.
   */
  marked?: PlacedAnnotation[];
  /** The annotation picked, by its `id`. */
  selectedAnnotation?: string | null;
  /** Pick one, as the Canvas's Annotations menu does; none, and the seek bar marks none. */
  onAnnotationSelect?: (annotation: ListedAnnotation) => void;
  onAnnotationActivate?: (id: string | null) => void;
  /**
   * A lone recording of sound, played as a player (`Player.tsx`): its artwork, title and
   * what it is part of in the middle, the transport and its cues along the foot.
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
  fillable = false,
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
  marked,
  selectedAnnotation,
  onAnnotationSelect,
  onAnnotationActivate,
  player,
}) => {
  // IIIF text in the Root's language, or the reader's when there is no Root.
  const rootLanguage = useOptionalClover()?.language;
  const language = givenLanguage ?? rootLanguage;
  const element = useMediaElement(media, { request, language });
  const controller = useMediaController(element, media.duration);
  /*
   * A lone video, fitted to the Body (the default) or filling it, centered either way
   * (Mat, 2026-11-01: "add a toggle to full/contain video. it should always center
   * regardless. contain is default"): filled, the part of the video that has the Body's
   * shape, about its middle (`fillRect`), framed again as the Body resizes and as the next
   * one opens. Here, with the video's own code, so a picture's page carries none of it.
   */
  const [filled, setFilled] = useState(false);
  const filledRef = useRef(filled);
  filledRef.current = filled;
  const frameVideo = useCallback(
    (immediate: boolean) => {
      if (!hasCamera(surface)) return;
      if (!filledRef.current) return surface.home(immediate);
      const world = surface.getHomeBounds();
      const host = surface.host;
      if (!world || !host?.clientWidth || !host.clientHeight) return;
      surface.fitBounds(
        fillRect(world, host.clientWidth / host.clientHeight),
        immediate,
      );
    },
    [surface],
  );
  // Pressed: to the other fit, as the camera moves (none where less motion is asked).
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    if (fillable) frameVideo(false);
  }, [filled, fillable, frameVideo]);
  // Filled, framed again as the Body resizes and as the next video opens.
  useEffect(() => {
    if (!fillable || !filled || !hasCamera(surface)) return;
    const again = () => frameVideo(true);
    const observer = new ResizeObserver(again);
    observer.observe(surface.host);
    const offOpen = surface.on("open", again);
    const offChange = surface.on("change", again);
    return () => {
      observer.disconnect();
      offOpen();
      offChange();
    };
  }, [fillable, filled, surface, frameVideo]);
  const fill = useMemo(
    () =>
      fillable
        ? { filled, onToggle: () => setFilled((was) => !was) }
        : undefined,
    [fillable, filled],
  );
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
  /*
   * The track to start on: the one in the visitor's language, by the rule every choice
   * of language starts by (`startingLanguage`: the Root's language where it has one, else
   * the visitor's, then the interface's, then the page's), else the first (Mat,
   * 2026-11-05: "all language derived properties ... lean to the end user's language").
   */
  const startCaption = useMemo(() => {
    const tags = media.captions.flatMap((caption) => caption.language ?? []);
    if (tags.length < 2) return 0;
    const tag = startingLanguage(tags, language);
    return Math.max(
      0,
      media.captions.findIndex((caption) => caption.language === tag),
    );
  }, [media.captions, language]);
  const captions = useCaptionTracks(element, own, media.id, startCaption);
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

  /*
   * The annotations on the recording's time, those on its time alone and those that follow
   * its picture, each a point on the seek bar where it starts (`SeekMarks`), in time's
   * order: the shown pages' only, as their cues and hotspots are.
   */
  const marking = useMemo(() => {
    const byId = new Map<string, ListedAnnotation>();
    const marks: SeekMark[] = [];
    for (const annotation of [
      ...(notes ?? []),
      ...(marked ?? []).filter((each) => each.track?.length),
    ]) {
      // Its own start, or its track's (`startOf`, which would bring the hotspots here).
      const start =
        "start" in annotation ? annotation.start : annotation.track?.[0]?.start;
      if (start === undefined || !annotation.label || byId.has(annotation.id))
        continue;
      byId.set(annotation.id, annotation);
      marks.push({
        id: annotation.id,
        start,
        label: annotation.label,
        lang: annotation.lang,
      });
    }
    marks.sort((a, b) => a.start - b.start);
    return { marks, byId };
  }, [notes, marked]);

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
      fill={fill}
      marks={marking.marks}
      selectedMark={selectedAnnotation}
      onMarkSelect={
        onAnnotationSelect &&
        ((id) => {
          const annotation = marking.byId.get(id);
          if (annotation) onAnnotationSelect(annotation);
        })
      }
      onMarkActivate={onAnnotationActivate}
    />
  );
  const noteLines = playing.map((note) => (
    <span
      className="clover-canvas-captions-cue"
      data-kind="annotation"
      key={note.id}
    >
      {note.page && (
        <span
          className="clover-canvas-captions-cue-label"
          {...languageProps(note.page.lang)}
        >
          {note.page.text}
        </span>
      )}
      <span {...languageProps(note.lang)}>{note.label}</span>
    </span>
  ));
  const captionLines = cues.map((text, index) => (
    <span
      className="clover-canvas-captions-cue"
      key={index}
      {...languageProps(
        captionLanguage && captionLanguage !== "none"
          ? captionLanguage
          : undefined,
      )}
    >
      {text}
    </span>
  ));
  /*
   * After the transport: the stylesheet lifts the cues clear of it. The annotations over
   * the captions, which keep the line nearest the bar. A player sets its annotations
   * apart, along its top (Mat, 2026-11-01: "bring timeline annotations up"), its
   * captions at its foot as a video's.
   */
  const cuesShown = cues.length + playing.length > 0 && (
    <div className="clover-canvas-captions" aria-live="off">
      {noteLines}
      {captionLines}
    </div>
  );

  if (player) {
    /*
     * In reading order, which is also the keyboard's: what it is, its cues, then the
     * transport, whose Chapters menu lists its chapters (Mat, 2026-11-01: "remove this
     * chapter control here. we should just have the regular one"; listed as tracks under
     * the player until then).
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
          {/*
           * Its captions alone: its annotations on their time are the seek bar's points
           * (Mat, 2026-11-04: "remove annotation bar in the top"; along its top until
           * then), each read in its popover and listed in the Annotations menu. One box
           * where the player is short (`Player.css`), none otherwise.
           */}
          <div className="clover-canvas-player-cues">
            {cues.length > 0 && (
              <div className="clover-canvas-captions" aria-live="off">
                {captionLines}
              </div>
            )}
          </div>
          {transport}
          <BodyUnloadable kind={media.kind} shown={failed} room />
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

/**
 * The part of `world` a view of the given shape (its width over its height) shows when
 * it fills the view, about the middle: the whole of its height and the middle of its
 * width where it is wider than the view, else the reverse. Framed, it fills the view.
 */
export function fillRect(world: Rect, shape: number): Rect {
  return world.width / world.height > shape
    ? {
        x: world.x + (world.width - world.height * shape) / 2,
        y: world.y,
        width: world.height * shape,
        height: world.height,
      }
    : {
        x: world.x,
        y: world.y + (world.height - world.width / shape) / 2,
        width: world.width,
        height: world.width / shape,
      };
}

/**
 * The largest rectangle of `size`'s aspect centered inside `box`; `box` until it is known.
 * A box of no area (a Canvas that gives a `duration` and no `width` or `height`, Cookbook
 * 0015) has nothing to fit inside: the video at its own frame size, where the box starts.
 */
export function containAspect(
  box: Rect,
  size: { width: number; height: number } | null,
): Rect {
  if (!size) return box;
  if (!box.width || !box.height)
    return { x: box.x, y: box.y, width: size.width, height: size.height };
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
