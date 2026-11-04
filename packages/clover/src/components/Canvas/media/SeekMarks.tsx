import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

import { formatTime } from "./useMediaController";
import { alongBar } from "./seekGaps";
import { Steps } from "../../../ui/Steps";
import { hideUntilBack } from "../../../ui/Tip";
import { useCloverTranslation } from "../../../i18n/useCloverTranslation";
import { languageProps } from "../../../i18n/direction";

/** An annotation on the recording's time, as the seek bar marks it. */
export interface SeekMark {
  id: string;
  /** Where it starts, in seconds. */
  start: number;
  label: string;
  /** The language its words are in (WCAG 3.1.2). */
  lang?: string;
}

/** The seek bar's thumb, as wide as `--clover-transport-thumb` (`Transport.css`). */
const THUMB = 12;

/**
 * Those whose points would overlap, as one: each within a target's width of the first of
 * its group, along a bar `width` wide; those that start together where it is unmeasured.
 */
export function groupMarks(
  marks: SeekMark[],
  duration: number,
  width: number,
  target: number,
): SeekMark[][] {
  const x = (mark: SeekMark) =>
    THUMB / 2 + (width - THUMB) * (mark.start / duration);
  const groups: SeekMark[][] = [];
  for (const mark of marks) {
    const group = groups[groups.length - 1];
    const near = group
      ? width > 0
        ? x(mark) - x(group[0]) < target
        : mark.start === group[0].start
      : false;
    if (near) group.push(mark);
    else groups.push([mark]);
  }
  return groups;
}

/** How far each key scrolls a popover's words: a line, or what shows of them. */
const SCROLL_KEYS: Record<string, (words: HTMLElement) => number> = {
  ArrowDown: (words) => parseFloat(getComputedStyle(words).lineHeight) || 16,
  ArrowUp: (words) => -(parseFloat(getComputedStyle(words).lineHeight) || 16),
  PageDown: (words) => words.clientHeight,
  PageUp: (words) => -words.clientHeight,
};

/**
 * From a point, Up and Down and the page keys scroll its popover's words where they run
 * past its room (a short Body), as a hotspot's note scrolls from its hotspot
 * (`scrollNote`, `Annotations.tsx`, which would bring the hotspots' module here): only
 * while there is more that way (WCAG 2.1.1). Left, Right, Home and End are the toolbar's.
 */
function scrollWords(event: React.KeyboardEvent<HTMLElement>): boolean {
  const words = event.currentTarget.querySelector<HTMLElement>(
    ".clover-canvas-transport-mark-words",
  );
  const by = SCROLL_KEYS[event.key];
  if (!words || !by || event.altKey || event.ctrlKey || event.metaKey)
    return false;
  const delta = by(words);
  const room =
    delta > 0
      ? words.scrollHeight - words.clientHeight - words.scrollTop
      : words.scrollTop;
  if (room < 1) return false;
  event.preventDefault();
  words.scrollBy({ top: delta });
  return true;
}

/**
 * The annotations on a recording's time, each a point over the seek bar where it starts
 * (Mat, 2026-11-04: "add points of annotations in the seekbar … points above them (in
 * accent) … styled like a point selector would be in an image … slightly off the
 * seekbar"), a video's and a Timeline's alike, since they share the transport.
 *
 * - Each is a button, its popover its time over its words, as the seek bar's chapter is,
 *   on hover and while focus is with it; pressed, it is picked as from the Canvas's
 *   Annotations menu, which plays from its time.
 * - Those whose points would overlap are one point (`groupMarks`; Mat, 2026-11-04: "we
 *   should be able to toggle multiple use the collection/search results page on pager in
 *   the popover"): its popover shows one of them at a time, with Search's steps
 *   (`Steps`, "2 / 7", Previous and Next), each step picking the next as Search's go to
 *   the next match. So no two points' targets overlap (WCAG 2.5.8).
 * - One stop for the keyboard (a toolbar, WAI-ARIA's roving tabindex): Left and Right go
 *   from one point to the next, Home and End to the first and last, so a recording with
 *   many costs one Tab, before the seek bar's own (WCAG 2.1.1, 2.4.3); Tab from a point
 *   reaches its popover's steps, which show while focus is in it; Up, Down and the page
 *   keys scroll its words where they need more room; Escape puts the popover away
 *   (WCAG 1.4.13), and only it.
 * - Each takes the pointer in an `l` square over the rail, about the top of its point
 *   (WCAG 2.5.8).
 * - Its popover keeps inside the Body as a hotspot's does (Mat, 2026-11-04: "do not have
 *   their tooltip hit/overlap edges. use similar functionality to what we use on xywh"):
 *   placed by its point's place there (`--clover-mark-x`) against its own width, so a
 *   step to longer words keeps it in too, with no measuring.
 * - Its point is drawn apart from it, under the seek bar's input, so the bar's thumb
 *   passes over the points (Mat, 2026-11-04: "make sure seekbar knob is above things"),
 *   and the button, clear, over the input, where the pointer finds it; the button lights
 *   its point while it is pointed at or focused (`lit`).
 */
export function SeekMarks({
  marks,
  duration,
  selected,
  onSelect,
  onActivate,
}: {
  marks: SeekMark[];
  duration: number;
  /** The annotation picked, by its `id`. */
  selected?: string | null;
  onSelect: (id: string) => void;
  /** The one under the pointer or focus, by its `id`, and null as it leaves. */
  onActivate?: (id: string | null) => void;
}) {
  const { t, langOf } = useCloverTranslation();
  /*
   * The bar's width, and a target's, for which points would overlap; and where the bar
   * starts in the Body (the media layer, the size container its popovers keep inside),
   * for each point's place there (`--clover-mark-x`, `Transport.css`).
   */
  const toolbar = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState({ width: 0, target: 0, from: 0 });
  useLayoutEffect(() => {
    const element = toolbar.current;
    if (!element) return;
    const body = element.closest<HTMLElement>(".clover-canvas-media");
    const measure = () => {
      const button = element.querySelector<HTMLElement>(
        ".clover-canvas-transport-mark",
      );
      const next = {
        width: element.clientWidth,
        target: button?.offsetWidth ?? 0,
        from: body
          ? element.getBoundingClientRect().left -
            body.getBoundingClientRect().left
          : 0,
      };
      setBar((was) =>
        was.width === next.width &&
        was.target === next.target &&
        was.from === next.from
          ? was
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // The bar moves in the Body as the player's layout changes, its width the same.
    if (body) observer.observe(body);
    return () => observer.disconnect();
  }, []);
  const groups = useMemo(
    () => groupMarks(marks, duration, bar.width, bar.target),
    [marks, duration, bar],
  );
  // Which of a group's shows, by its first's `id`: the one picked there, else the last
  // stepped to, else its first.
  const [stepped, setStepped] = useState<Record<string, number>>({});
  const shownIn = (group: SeekMark[]) => {
    const picked = group.findIndex((mark) => mark.id === selected);
    if (picked >= 0) return picked;
    return Math.min(stepped[group[0].id] ?? 0, group.length - 1);
  };
  // The one the keyboard comes back to: the last focused, else the one picked, else the first.
  const [focused, setFocused] = useState<string | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const light = (id: string | null) => {
    setLit(id);
    onActivate?.(id);
  };
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  // The groups whose popover Escape put away, until focus or the pointer comes again.
  const escaped = useRef(new Set<string>());
  if (!marks.length || !(duration > 0)) return null;
  const holds = (group: SeekMark[], id?: string | null) =>
    Boolean(id) && group.some((mark) => mark.id === id);
  const stop = Math.max(
    0,
    groups.findIndex((group) => holds(group, focused ?? selected)),
  );
  const moveTo = (index: number) => {
    const next = Math.min(groups.length - 1, Math.max(0, index));
    buttons.current[next]?.focus();
  };
  const along = (group: SeekMark[]) =>
    alongBar((group[0].start / duration) * 100);
  // Its place in the Body, for its popover to keep inside (`--clover-mark-x`).
  const inBody = (group: SeekMark[]) =>
    `${bar.from + THUMB / 2 + (bar.width - THUMB) * (group[0].start / duration)}px`;
  return (
    <>
      <span className="clover-canvas-transport-points" aria-hidden="true">
        {groups.map((group) => (
          <span
            key={group[0].id}
            className="clover-canvas-transport-mark-point"
            data-active={
              holds(group, lit) || holds(group, selected) ? "true" : undefined
            }
            style={{ left: along(group) }}
          />
        ))}
      </span>
      <div
        ref={toolbar}
        className="clover-canvas-transport-marks"
        role="toolbar"
        aria-label={t("informationPanelTabsAnnotations")}
        lang={langOf("informationPanelTabsAnnotations")}
        onKeyDown={(event) => {
          const index = buttons.current.findIndex(
            (button) => button === document.activeElement,
          );
          if (index < 0) return;
          const step =
            getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
          if (event.key === "ArrowRight") moveTo(index + step);
          else if (event.key === "ArrowLeft") moveTo(index - step);
          else if (event.key === "Home") moveTo(0);
          else if (event.key === "End") moveTo(groups.length - 1);
          else return;
          event.preventDefault();
        }}
      >
        {groups.map((group, index) => {
          const shown = shownIn(group);
          const mark = group[shown];
          const time = formatTime(mark.start);
          const place =
            group.length > 1 ? ` ${shown + 1} / ${group.length}` : "";
          const show = (to: number) => {
            setStepped((was) => ({ ...was, [group[0].id]: to }));
            light(group[to].id);
            onSelect(group[to].id);
          };
          return (
            <div
              key={group[0].id}
              className="clover-canvas-transport-mark-group"
              style={
                {
                  left: along(group),
                  ...(bar.width > 0 && { "--clover-mark-x": inBody(group) }),
                } as React.CSSProperties
              }
              onPointerEnter={() => {
                escaped.current.delete(group[0].id);
                light(mark.id);
              }}
              onPointerLeave={() => light(null)}
              onFocus={() => {
                escaped.current.delete(group[0].id);
                setFocused(mark.id);
                light(mark.id);
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  light(null);
              }}
              onKeyDown={(event) => {
                if (event.defaultPrevented) return;
                if (scrollWords(event)) return;
                /*
                 * One Escape closes one thing (`DESIGN.md` §0): the popover while it shows,
                 * and nothing around it; once it is away, the key goes on.
                 */
                if (event.key !== "Escape") return;
                if (escaped.current.has(group[0].id)) return;
                event.preventDefault();
                escaped.current.add(group[0].id);
                // From its steps, back to the point first, so focus is never on what
                // the popover takes away (WCAG 2.4.7).
                const point = buttons.current[index];
                if (point && document.activeElement !== point) point.focus();
                hideUntilBack(event.currentTarget, "tipHidden", [
                  "pointerenter",
                  "focusin",
                ]);
              }}
            >
              <button
                ref={(button) => {
                  buttons.current[index] = button;
                }}
                type="button"
                className="clover-canvas-transport-mark"
                tabIndex={index === stop ? 0 : -1}
                aria-label={`${time} ${mark.label}${place}`}
                {...languageProps(mark.lang)}
                // The one picked, said as a picked hotspot says it (WCAG 4.1.2, 3.2.4).
                aria-current={holds(group, selected) ? "true" : undefined}
                data-active={holds(group, selected) ? "true" : undefined}
                onClick={() => onSelect(mark.id)}
              />
              {/*
               * Its popover, drawn as a control's is (`ui/Tip.css`), beside the button
               * rather than in it, since it may hold the steps. Its words are the
               * button's name already, so only the steps are in the tree.
               */}
              <span className="clover-tip clover-canvas-transport-mark-tip">
                <span
                  className="clover-canvas-transport-mark-words"
                  aria-hidden="true"
                  {...languageProps(mark.lang)}
                >
                  <span className="clover-tip-lead">{time}</span>
                  {mark.label}
                </span>
                {group.length > 1 && (
                  <Steps
                    steps={{
                      position: shown,
                      total: group.length,
                      step: (by) => show(shown + by),
                    }}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
