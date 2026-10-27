import { useCallback, useEffect, useState } from "react";

export interface MediaState {
  paused: boolean;
  currentTime: number;
  /** The element's, once known; the Canvas's declared duration until then. */
  duration: number;
  muted: boolean;
  volume: number;
  /** Seconds buffered from the start of the current range. */
  buffered: number;
}

export interface MediaController extends MediaState {
  play: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  skip: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const EVENTS = [
  "play",
  "pause",
  "ended",
  "timeupdate",
  "durationchange",
  "loadedmetadata",
  "volumechange",
  "progress",
  "seeked",
];

/**
 * Headless playback state and commands for a media element: what a transport renders and
 * calls. It holds no UI, so any transport — Clover's, or a host's own — drives the same
 * element the same way.
 */
export function useMediaController(
  element: HTMLMediaElement | null,
  declaredDuration?: number,
): MediaController {
  const read = useCallback(
    (el: HTMLMediaElement | null): MediaState => {
      const duration =
        el && Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : (declaredDuration ?? 0);
      let buffered = 0;
      if (el && el.buffered.length) {
        buffered = el.buffered.end(el.buffered.length - 1);
      }
      return {
        paused: el?.paused ?? true,
        currentTime: el?.currentTime ?? 0,
        duration,
        muted: el?.muted ?? false,
        volume: el?.volume ?? 1,
        buffered,
      };
    },
    [declaredDuration],
  );

  const [state, setState] = useState<MediaState>(() => read(element));

  useEffect(() => {
    setState(read(element));
    if (!element) return;
    const sync = () => setState(read(element));
    EVENTS.forEach((type) => element.addEventListener(type, sync));
    return () =>
      EVENTS.forEach((type) => element.removeEventListener(type, sync));
  }, [element, read]);

  const play = useCallback(() => {
    // A rejected play (autoplay policy, no source yet) leaves the state as it was.
    element?.play()?.catch?.(() => undefined);
  }, [element]);
  const pause = useCallback(() => element?.pause(), [element]);
  const toggle = useCallback(
    () => (element?.paused ? play() : pause()),
    [element, play, pause],
  );
  const seek = useCallback(
    (seconds: number) => {
      if (!element) return;
      const max = Number.isFinite(element.duration)
        ? element.duration
        : state.duration;
      element.currentTime = Math.max(0, Math.min(max || seconds, seconds));
    },
    [element, state.duration],
  );
  const skip = useCallback(
    (seconds: number) => element && seek(element.currentTime + seconds),
    [element, seek],
  );
  const setVolume = useCallback(
    (volume: number) => {
      if (!element) return;
      element.volume = Math.max(0, Math.min(1, volume));
      element.muted = element.volume === 0;
    },
    [element],
  );
  const toggleMute = useCallback(() => {
    if (element) element.muted = !element.muted;
  }, [element]);

  return { ...state, play, toggle, seek, skip, setVolume, toggleMute };
}

// Where it is, as a player counts it, written as every time in Clover is.
export { formatTime } from "../../../lib/time";
