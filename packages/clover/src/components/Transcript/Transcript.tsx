import React, {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { canvasCaptions } from "../Canvas/layout";
import type { IIIFCanvas } from "../Canvas/layout";
import { selectVisibleCanvases } from "../../core/selectors";
import { localize } from "../../core/value";
import { type Cue, cueAt, loadVtt, parseVtt } from "../../core/vtt";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { formatDuration } from "../Items/Item";

export interface TranscriptProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** Keep the current cue in view as it plays. Default true. */
  follow?: boolean;
}

/**
 * The words of the video or sound in view, from its WebVTT captions: one entry per cue,
 * the current one marked as it plays, and a press on any entry seeking there.
 *
 * Playback re-renders the transcript only when the current cue changes, and writes nothing
 * to the Root's store. With several caption files (one per language), a menu picks one.
 * The file is the one the Canvas loads for its captions, fetched once.
 */
export const Transcript = forwardRef<HTMLElement, TranscriptProps>(
  function Transcript(
    { as: Tag = "div", follow = true, className, ...rest },
    ref,
  ) {
    const { t, langOf } = useCloverTranslation();
    const { clover, language } = useClover("Transcript");
    const canvases = useCloverSelector((state) =>
      selectVisibleCanvases(state.manifest, state.canvasId),
    ) as unknown as IIIFCanvas[];
    const canvas = canvases.find(
      (candidate) => canvasCaptions(candidate).length > 0,
    );
    const tracks = useMemo(
      () => (canvas ? canvasCaptions(canvas) : []),
      [canvas],
    );
    const [choice, setChoice] = useState(0);
    const track = tracks[choice] ?? tracks[0];

    const [cues, setCues] = useState<Cue[]>([]);
    useEffect(() => {
      setCues([]);
      if (!track) return;
      let live = true;
      loadVtt(track.id, clover.request)
        .then((text) => live && setCues(parseVtt(text)))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [track, clover]);

    const element = useSyncExternalStore(
      clover.media.subscribe,
      clover.media.get,
      clover.media.get,
    );
    const active = useActiveCue(element, cues);

    // Keep the current cue in view while playing, within the transcript's own scroll.
    const list = useRef<HTMLOListElement>(null);
    useEffect(() => {
      if (!follow || active < 0 || !element || element.paused) return;
      const item = list.current?.children[active] as HTMLElement | undefined;
      item?.scrollIntoView?.({ block: "nearest" });
    }, [active, follow, element]);

    const id = useId();
    if (!canvas || !track) return null;

    const seek = (cue: Cue) => {
      if (element) {
        element.currentTime = cue.start;
        return;
      }
      // Not playing yet (behind a placeholder, say): go there, opening at that time.
      clover.goTo(canvas.id, { time: cue.start });
    };

    return (
      <Tag ref={ref} className={join("clover-transcript", className)} {...rest}>
        {tracks.length > 1 && (
          <label className="clover-transcript-track">
            <span lang={langOf("playerCaptions")}>{t("playerCaptions")}</span>{" "}
            <select
              value={choice}
              onChange={(event) => setChoice(Number(event.target.value))}
            >
              {tracks.map((option, index) => {
                const label = localize(option.label as any, language);
                return (
                  <option
                    key={option.id}
                    value={index}
                    lang={label.text ? label.lang : undefined}
                  >
                    {label.text || option.language || index + 1}
                  </option>
                );
              })}
            </select>
          </label>
        )}
        <ol
          ref={list}
          className="clover-transcript-cues"
          id={`${id}-cues`}
          lang={
            track.language && track.language !== "none"
              ? track.language
              : undefined
          }
        >
          {cues.map((cue, index) => (
            <li
              key={`${cue.start}-${index}`}
              className="clover-transcript-cue"
              aria-current={index === active ? "true" : undefined}
            >
              <button type="button" onClick={() => seek(cue)}>
                <span className="clover-transcript-time">
                  {formatDuration(cue.start)}
                </span>
                <span className="clover-transcript-text">
                  {cue.voice && (
                    <span className="clover-transcript-voice">
                      {cue.voice}:{" "}
                    </span>
                  )}
                  {cue.text}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Tag>
    );
  },
);

/** The cue at the element's time, updated on `timeupdate` and seeks: a number, not a tick. */
function useActiveCue(element: HTMLVideoElement | null, cues: Cue[]) {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!element || !cues.length) {
      setActive(-1);
      return;
    }
    const update = () => setActive(cueAt(cues, element.currentTime));
    update();
    element.addEventListener("timeupdate", update);
    element.addEventListener("seeked", update);
    return () => {
      element.removeEventListener("timeupdate", update);
      element.removeEventListener("seeked", update);
    };
  }, [element, cues]);
  return active;
}
