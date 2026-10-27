import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useUniqueId } from "../../ui/useUniqueId";
import { createPortal } from "react-dom";

import {
  type CaptionTrack,
  type IIIFCanvas,
  type TextTranscript,
  canvasCaptions,
  canvasTextTranscripts,
} from "../Canvas/layout";
import { selectVisibleCanvases } from "../../core/selectors";
import { localize } from "../../core/value";
import {
  type Cue,
  cueAt,
  loadText,
  loadVtt,
  paragraphsOf,
  parseVtt,
} from "../../core/vtt";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { playFrom } from "../../lib/time";
import { useClover, useCloverSelector } from "../../react/context";
import { bringIntoView, scrollerOf } from "../../ui/bringIntoView";
import { CueTime } from "../../ui/Cue";
import { FieldPill } from "../../ui/FieldPill";
import { languageCode } from "../../ui/languageCode";
import { useSectionActions } from "../../ui/Sections";
import type { StepsModel } from "../../ui/Steps";
import { Tip } from "../../ui/Tip";
import { useContainerName } from "../../ui/useContainerName";
import { visuallyHidden } from "../../ui/visuallyHidden";

export interface TranscriptProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** Keep the current cue in view as it plays. Default true. */
  follow?: boolean;
  /**
   * A field over the captions' cues to find words in, and steps through the cues that
   * have them, as Search steps through hits. Default true; captions only.
   */
  find?: boolean;
  /**
   * The find field held in view as the cues scroll under it: at the top of the box that
   * scrolls them, or, in a Panel's accordion, under the stuck headings, as Search's is.
   * Default `false`.
   */
  sticky?: boolean;
  /**
   * The find field's size, as Search's: `large` (the default), or `small`, a tad smaller,
   * for a narrow column, as the templates' Panels take it.
   */
  size?: "large" | "small";
}

/** Cues drawn at a time, in a long transcript. */
const CHUNK = 40;

/** Case aside, how a cue's words and what is typed are compared. */
const fold = (text: string) => text.toLocaleLowerCase();

/** A cue's text with each place `query` is found in it marked. */
function marked(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const folded = fold(text);
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (
    let at = folded.indexOf(query);
    at >= 0;
    at = folded.indexOf(query, at + query.length)
  ) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at}>{text.slice(at, at + query.length)}</mark>);
    from = at + query.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}

/** A file the transcript reads: a caption track's timed cues, or a plain-text transcript. */
type TranscriptFile =
  | (CaptionTrack & { kind: "captions" })
  | (TextTranscript & { kind: "text" });

/**
 * The words of the video or sound in view. From its WebVTT captions: one entry per cue,
 * the current one marked as it plays, and a press on any entry seeking there. From a
 * transcript as plain text (Cookbook 0017's `rendering`, 0253's `provides: transcript`):
 * its paragraphs, untimed, in the file's language. The captions come first.
 *
 * Playback re-renders the transcript only when the current cue changes, and writes nothing
 * to the Root's store. A caption file is the one the Canvas loads for its captions,
 * fetched once.
 *
 * With several caption files (one per language), a row of their language codes ("EN",
 * "IT") picks one: native radios, each named by its code and its file's label, in that
 * label's language. In an information panel's accordion the row sits beside the
 * Transcript's heading (`useSectionActions`), where it is not lost in the cues; elsewhere
 * it is over them.
 */
export const Transcript = forwardRef<HTMLElement, TranscriptProps>(
  function Transcript(
    {
      as: Tag = "div",
      follow = true,
      find = true,
      sticky = false,
      size = "large",
      className,
      ...rest
    },
    ref,
  ) {
    const { t, langOf } = useCloverTranslation();
    const { clover, language } = useClover("Transcript");
    const canvases = useCloverSelector((state) =>
      selectVisibleCanvases(state.manifest, state.canvasId),
    ) as unknown as IIIFCanvas[];
    const canvas = canvases.find(
      (candidate) =>
        canvasCaptions(candidate).length > 0 ||
        canvasTextTranscripts(candidate).length > 0,
    );
    const tracks = useMemo<TranscriptFile[]>(
      () =>
        canvas
          ? [
              ...canvasCaptions(canvas).map((each) => ({
                ...each,
                kind: "captions" as const,
              })),
              ...canvasTextTranscripts(canvas).map((each) => ({
                ...each,
                kind: "text" as const,
              })),
            ]
          : [],
      [canvas],
    );
    const [choice, setChoice] = useState(0);
    const track = tracks[choice] ?? tracks[0];
    /*
     * One choice of language for the captions and the transcript, through the Root
     * (`clover.captions`): a caption file chosen in the Canvas's own Captions menu is the
     * one read here, chosen before this mounted or after, and one chosen here is the one
     * the Canvas shows while its captions are on. Off leaves the language as it was.
     */
    useEffect(() => {
      const follow = (id: string | null) => {
        const index = tracks.findIndex(
          (option) => option.kind === "captions" && option.id === id,
        );
        if (index >= 0) setChoice(index);
      };
      follow(clover.captions.get());
      return clover.captions.subscribe(follow);
    }, [clover, tracks]);

    const [cues, setCues] = useState<Cue[]>([]);
    const [paragraphs, setParagraphs] = useState<string[]>([]);
    useEffect(() => {
      setCues([]);
      setParagraphs([]);
      if (!track) return;
      let live = true;
      (track.kind === "captions"
        ? loadVtt(track.id, clover.request).then(
            (text) => live && setCues(parseVtt(text)),
          )
        : loadText(track.id, clover.request).then(
            (text) => live && setParagraphs(paragraphsOf(text)),
          )
      ).catch(() => undefined);
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

    /*
     * Keep the current cue in view while playing, within the transcript's own scroll:
     * never the page, which the reader may have scrolled elsewhere.
     */
    const list = useRef<HTMLOListElement>(null);
    useEffect(() => {
      if (!follow || active < 0 || !element || element.paused) return;
      const item = list.current?.children[active] as HTMLElement | undefined;
      if (item) bringIntoView(item, "nearest");
    }, [active, follow, element]);

    /*
     * Finding in the cues (Mat, 2026-10-26: "make vtt transcripts searchable"): as the
     * reader types, the cues with the words are marked and counted, the first current, and
     * the steps (or Enter) go through them, each seeking the recording there as a press on
     * it does and bringing it into view in the list. Nothing moves while typing.
     */
    const [draft, setDraft] = useState("");
    const query = fold(draft.trim());
    const matches = useMemo(
      () =>
        query
          ? cues.flatMap((cue, index) =>
              fold(cue.text).includes(query) ? [index] : [],
            )
          : [],
      [cues, query],
    );
    const [match, setMatch] = useState<{ query: string; at: number }>({
      query: "",
      at: 0,
    });
    const at = match.query === query ? match.at : 0;
    const field = useRef<HTMLInputElement>(null);
    const stepped = useRef(false);

    /*
     * A long transcript is drawn a chunk at a time, as Search's hits are: the first
     * `CHUNK` cues, then the next as the list's end nears its scrolling box, or as focus
     * reaches one of its last few, so Tab never runs out before the cues do. The cue
     * playing and the match current are always among them. Where nothing can tell the
     * end is near (no `IntersectionObserver`), all.
     */
    const [more, setMore] = useState<{ cues: Cue[]; count: number }>({
      cues: [],
      count: CHUNK,
    });
    const limit = more.cues === cues ? more.count : CHUNK;
    const extend = () => setMore({ cues, count: limit + CHUNK });
    const extendRef = useRef(extend);
    extendRef.current = extend;
    const lazy = typeof IntersectionObserver !== "undefined";
    const drawn = lazy
      ? Math.min(
          cues.length,
          Math.max(limit, active + 1, (matches[at] ?? -1) + 1),
        )
      : cues.length;
    const end = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const node = end.current;
      if (!node || !lazy || drawn >= cues.length) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting))
            extendRef.current();
        },
        { root: scrollerOf(node), rootMargin: "0px 0px 400px 0px" },
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, [lazy, drawn, cues.length]);

    // The match current brought into view in the list: as it is found, and as it is
    // stepped to.
    const currentMatch = matches[at];
    useEffect(() => {
      if (currentMatch === undefined) return;
      const item = list.current?.children[currentMatch] as
        | HTMLElement
        | undefined;
      if (item) bringIntoView(item, "nearest");
      stepped.current = false;
    }, [currentMatch, query]);

    /*
     * Held in view, the field's height is written to the part (`--clover-transcript-
     * find`), so a cue scrolled to or followed lands clear of it (WCAG 2.4.11).
     */
    const hasCues = cues.length > 0;
    useEffect(() => {
      const held = field.current?.closest<HTMLElement>(
        ".clover-transcript-find",
      );
      const part = held?.parentElement;
      if (!sticky || !held || !part || typeof ResizeObserver === "undefined")
        return;
      const observer = new ResizeObserver(() =>
        part.style.setProperty(
          "--clover-transcript-find",
          `${held.offsetHeight}px`,
        ),
      );
      observer.observe(held);
      return () => {
        observer.disconnect();
        part.style.removeProperty("--clover-transcript-find");
      };
    }, [sticky, hasCues, find]);

    const id = useUniqueId();
    const actions = useSectionActions();
    // The row is named for what it picks among: caption files, or transcripts of any kind.
    const nameKey = tracks.every((each) => each.kind === "captions")
      ? "playerCaptions"
      : "transcriptLabel";
    const name = useContainerName(t(nameKey), langOf(nameKey));
    if (!canvas || !track) return null;
    /*
     * What each file shows: a caption file its language's code ("EN"), a plain-text file
     * "TXT" after them (with its language's, "TXT EN", where there are several). A code
     * shows only where it tells its file apart: two that would show the same show labels.
     */
    const texts = tracks.filter((each) => each.kind === "text").length;
    const shown = tracks.map((each) => {
      const code = languageCode(each.language);
      if (each.kind === "captions") return code;
      return texts > 1 && code ? `TXT ${code}` : "TXT";
    });
    const codes = shown.map((code) =>
      code && shown.filter((each) => each === code).length === 1
        ? code
        : undefined,
    );
    const lang =
      track.language && track.language !== "none" ? track.language : undefined;

    const languages = tracks.length > 1 && (
      <>
        {name.node}
        <fieldset {...name.props} className="clover-transcript-languages">
          {tracks.map((option, index) => {
            const label = localize(option.label as any, language);
            const code = codes[index];
            const text = label.text || option.language || String(index + 1);
            return (
              <label key={option.id} className="clover-transcript-language">
                <input
                  type="radio"
                  name={`${id}-language`}
                  checked={index === choice}
                  onChange={() => {
                    setChoice(index);
                    // A caption file is the captions' choice too; plain text is not one.
                    if (option.kind === "captions")
                      clover.captions.emit(option.id);
                  }}
                />
                {/*
                 * Named by the code it shows, then its file's own label in that label's
                 * language, which the code stands in for on screen and its popover shows
                 * (WCAG 2.5.3, 3.1.2).
                 */}
                {code && (
                  <>
                    <span className="clover-transcript-code">{code}</span>{" "}
                  </>
                )}
                <span
                  style={code ? visuallyHidden : undefined}
                  lang={label.text ? label.lang : undefined}
                >
                  {text}
                </span>
                {/* Its label on hover and focus, as the controls' names show. */}
                {code && label.text && (
                  <Tip label={label.text} lang={label.lang} />
                )}
              </label>
            );
          })}
        </fieldset>
      </>
    );

    /*
     * To its time: playing from there when the reader pressed it (`playFrom`), held as it
     * was while they step through what they found, so finding plays nothing.
     */
    const seek = (cue: Cue, play = true) => {
      if (element) {
        if (play) playFrom(element, cue.start);
        else element.currentTime = cue.start;
        return;
      }
      // Not playing yet (behind a placeholder, say): go there, opening at that time.
      clover.goTo(canvas.id, { time: cue.start });
    };

    const go = (index: number) => {
      const cue = cues[matches[index]];
      if (!cue) return;
      stepped.current = true;
      setMatch({ query, at: index });
      seek(cue, false);
    };
    const steps: StepsModel = {
      position: matches.length ? at : -1,
      total: matches.length,
      step: (by) => go(at + by),
    };
    const count = matches.length;
    const statusKey = !query
      ? null
      : count === 0
        ? "contentSearchResultsNone"
        : count === 1
          ? "contentSearchResult"
          : "contentSearchResults";
    const finding = find && track.kind === "captions" && cues.length > 0 && (
      <div className="clover-transcript-find">
        {/* The same field as Search's (Mat, 2026-10-26). */}
        <FieldPill
          ref={field}
          id={`${id}-find`}
          value={draft}
          onChange={setDraft}
          // Enter, or the submit, goes to the match current, then on through them.
          onSubmit={() => {
            if (!count) return;
            const gone = match.query === query && stepped.current;
            go(gone ? (at + 1) % count : at);
          }}
          onClear={() => {
            setDraft("");
            field.current?.focus();
          }}
          results={query ? steps : null}
          size={size}
          classes={{ form: "clover-transcript-find-field" }}
        />
        {/* Read by assistive technology as it changes (WCAG 4.1.3); the pill shows it. */}
        <p
          className="clover-transcript-find-status"
          role="status"
          lang={statusKey ? langOf(statusKey) : undefined}
        >
          {statusKey ? t(statusKey, { count }) : ""}
        </p>
      </div>
    );

    return (
      <Tag
        ref={ref}
        className={join("clover-transcript", className)}
        data-sticky={sticky || undefined}
        {...rest}
      >
        {languages && (actions ? createPortal(languages, actions) : languages)}
        {finding}
        {track.kind === "text" ? (
          // Untimed: the words alone, a paragraph each, nothing to press.
          <div className="clover-transcript-body" lang={lang}>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <ol
            ref={list}
            className="clover-transcript-cues"
            id={`${id}-cues`}
            lang={lang}
          >
            {cues.slice(0, drawn).map((cue, index) => (
              <li
                key={`${cue.start}-${index}`}
                className="clover-transcript-cue"
                aria-current={index === active ? "true" : undefined}
                data-match={
                  query && matches.includes(index)
                    ? index === currentMatch
                      ? "current"
                      : "true"
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => seek(cue)}
                  onFocus={() => {
                    if (drawn < cues.length && index >= drawn - 5) extend();
                  }}
                >
                  <CueTime
                    start={cue.start}
                    className="clover-transcript-time"
                  />
                  <span className="clover-transcript-text clover-cue-text">
                    {cue.voice && (
                      <span className="clover-transcript-voice">
                        {cue.voice}:{" "}
                      </span>
                    )}
                    {marked(cue.text, query)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {/* Where the next chunk of cues is asked for, as it nears the view. */}
        {track.kind === "captions" && drawn < cues.length && (
          <div
            ref={end}
            className="clover-transcript-more"
            aria-hidden="true"
          />
        )}
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
