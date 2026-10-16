import { useEffect, useMemo, useState } from "react";

/** A caption track as the transport offers it. */
export interface CaptionOption {
  /** Its name in the Captions menu. */
  label: string;
  /** The language the name is written in, when known (WCAG 3.1.2). */
  labelLang?: string;
  /** The language of its cues. */
  language?: string;
}

/**
 * The reader's choice: one of the Manifest's tracks by its index, a track the media
 * carries itself, or -1 for none.
 */
type Choice = number | TextTrack;

interface Selection {
  choice: Choice;
  /** The reader chose it, from Clover's menu or the system player's. */
  picked: boolean;
  /** The recording it was made for: another starts from its own first track. */
  key: string;
}

type SystemVideo = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitPresentationMode?: string;
};

/** The events that hand the video to the system's own player, or take it back. */
const SYSTEM_EVENTS = [
  "webkitbeginfullscreen",
  "webkitendfullscreen",
  "enterpictureinpicture",
  "leavepictureinpicture",
  "webkitpresentationmodechanged",
];

const NO_TRACKS: TextTrack[] = [];

const isCaptions = (track: TextTrack) =>
  track.kind === "captions" || track.kind === "subtitles";

/**
 * Whether the system's player has the video: an iPhone's full screen, or picture in
 * picture. An event that begins or ends one is believed over the properties, which may
 * not have caught up.
 */
function inSystemPlayer(video: SystemVideo, type: string): boolean {
  if (type === "webkitbeginfullscreen" || type === "enterpictureinpicture") {
    return true;
  }
  const fullscreen =
    type !== "webkitendfullscreen" && Boolean(video.webkitDisplayingFullscreen);
  const pictureInPicture =
    type !== "leavepictureinpicture" &&
    (video.webkitPresentationMode === "picture-in-picture" ||
      (typeof document !== "undefined" &&
        document.pictureInPictureElement === video));
  return fullscreen || pictureInPicture;
}

/**
 * A video's caption tracks: the Manifest's, and any the media carries itself (an HLS
 * stream's subtitles and CEA-608/708 captions, a file's own tracks). Each is offered in
 * the Captions menu, and the chosen one's cues are Clover's to draw.
 *
 * - The Manifest's `<track>`s come first in `textTracks`, in order, as HTML lists a
 *   video's tracks, so they are known by position. Tracks the media adds come after
 *   them, named by their own label, else their language, else their place in the menu.
 * - Clover draws the chosen track, so it is `hidden`: its cues are live, and the
 *   browser draws none. The Manifest's others stay `hidden` too; the media's others are
 *   `disabled`, which tells hls.js to stop loading them. Whatever else changes a mode
 *   (iOS Safari choosing by the reader's caption settings, hls.js) is set back.
 * - Until the reader chooses, a track of the media's that the browser shows by the
 *   reader's settings, or the stream by its default, is the one shown, where the
 *   Manifest offers none.
 * - The system's player (an iPhone's full screen, picture in picture) draws only a track
 *   that is `showing`, and Clover's captions stay on the page. While it has the video,
 *   the chosen track is `showing`, and a choice made in its own menu is the reader's.
 */
export function useCaptionTracks(
  element: HTMLVideoElement | null,
  own: CaptionOption[],
  key: string,
): {
  options: CaptionOption[];
  /** The option chosen, or -1 for none. */
  active: number;
  select: (index: number) => void;
  /** The chosen track, whose cues to draw. */
  track: TextTrack | undefined;
} {
  const ownCount = own.length;
  const first = ownCount ? 0 : -1;
  const [selection, setSelection] = useState<Selection>({
    choice: first,
    picked: false,
    key,
  });
  // Another recording: its first track, as the Player starts each one.
  if (selection.key !== key) {
    setSelection({ choice: first, picked: false, key });
  }
  const { choice, picked } = selection;
  const [stream, setStream] = useState<TextTrack[]>(NO_TRACKS);
  const [system, setSystem] = useState(false);

  // The media's own caption tracks, as it adds them.
  useEffect(() => {
    const list = element?.textTracks;
    if (!list) {
      setStream(NO_TRACKS);
      return;
    }
    const read = () => {
      const found = Array.from(list).slice(ownCount).filter(isCaptions);
      setStream((current) =>
        current.length === found.length &&
        current.every((track, index) => track === found[index])
          ? current
          : found.length
            ? found
            : NO_TRACKS,
      );
    };
    read();
    list.addEventListener?.("addtrack", read);
    list.addEventListener?.("removetrack", read);
    return () => {
      list.removeEventListener?.("addtrack", read);
      list.removeEventListener?.("removetrack", read);
    };
  }, [element, ownCount]);

  // Whether the system's player has the video.
  useEffect(() => {
    setSystem(false);
    if (!element) return;
    const video = element as SystemVideo;
    const update = (event: Event) =>
      setSystem(inSystemPlayer(video, event.type));
    SYSTEM_EVENTS.forEach((type) => video.addEventListener(type, update));
    return () =>
      SYSTEM_EVENTS.forEach((type) => video.removeEventListener(type, update));
  }, [element]);

  // Every track's mode, kept as the choice says whatever else changes it.
  useEffect(() => {
    const list = element?.textTracks;
    if (!list) return;
    const tracks = () => Array.from(list);
    const resolve = (all: TextTrack[]) =>
      typeof choice === "number"
        ? choice >= 0
          ? all[choice]
          : undefined
        : all.includes(choice)
          ? choice
          : undefined;
    const apply = () => {
      const all = tracks();
      const chosen = resolve(all);
      all.forEach((track, index) => {
        const mode: TextTrackMode | null =
          track === chosen
            ? system
              ? "showing"
              : "hidden"
            : index < ownCount
              ? "hidden"
              : isCaptions(track)
                ? "disabled"
                : null;
        if (mode && track.mode !== mode) track.mode = mode;
      });
    };
    // A track the browser or the stream shows, before the reader has chosen any.
    const adopt = () => {
      if (picked || ownCount || choice !== -1) return false;
      const shown = tracks()
        .slice(ownCount)
        .find((track) => isCaptions(track) && track.mode === "showing");
      if (!shown) return false;
      setSelection({ choice: shown, picked: false, key });
      return true;
    };
    // The system player's own menu: the track it shows is the reader's choice.
    const follow = () => {
      const all = tracks();
      const at = all.findIndex(
        (track, index) =>
          (index < ownCount || isCaptions(track)) && track.mode === "showing",
      );
      if (all[at] === resolve(all)) return;
      setSelection({
        choice: at < 0 ? -1 : at < ownCount ? at : all[at],
        picked: true,
        key,
      });
    };
    if (system || !adopt()) apply();
    const onChange = () => {
      if (system) follow();
      else if (!adopt()) apply();
    };
    list.addEventListener?.("change", onChange);
    return () => list.removeEventListener?.("change", onChange);
    // `stream` too: a track the media adds fires no `change`, and `addTextTrack` (as
    // hls.js adds captions) makes it `hidden`, not `disabled`.
  }, [element, choice, picked, system, ownCount, key, stream]);

  const options = useMemo(
    () => [
      ...own,
      ...stream.map((track, index) => ({
        label: track.label || track.language || String(own.length + index + 1),
        labelLang: track.label ? track.language || undefined : undefined,
        language: track.language || undefined,
      })),
    ],
    [own, stream],
  );
  // A media track that has gone counts as none.
  const at = typeof choice === "number" ? -1 : stream.indexOf(choice);
  const active =
    typeof choice === "number" ? choice : at < 0 ? -1 : ownCount + at;
  const track =
    typeof choice === "number"
      ? choice >= 0
        ? Array.from(element?.textTracks ?? NO_TRACKS)[choice]
        : undefined
      : stream[at];

  const select = (index: number) =>
    setSelection({
      choice:
        index < 0
          ? -1
          : index < ownCount
            ? index
            : (stream[index - ownCount] ?? -1),
      picked: true,
      key,
    });

  return { options, active, select, track };
}
