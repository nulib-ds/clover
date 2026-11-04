import React, { useEffect, useRef, useState } from "react";

import ControlMenu from "./ControlMenu";
import {
  type TransportChapter,
  chapterAt,
  chapterPicture,
} from "./media/Transport";
import { formatTime } from "./media/useMediaController";
import type { CloverRequest } from "../../core/request";
import { languageProps } from "../../i18n/direction";
import { useContainerName } from "../../i18n/useContainerName";
import { EntryThumbnail } from "../../ui/EntryThumbnail";

interface ChaptersMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  label: string;
  labelLang?: string;
  chapters: TransportChapter[];
  /** The recording's element, where it is: none yet over the placeholder's still. */
  element: HTMLMediaElement | null;
  /** Go to a chapter's start, opening the recording first where it is not yet. */
  onChapter: (start: number) => void;
  /** Over the recording's still: the arrow keys only move the check (below). */
  overStill?: boolean;
  /** How the chapters' pictures are fetched. */
  request?: CloverRequest;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
}

/**
 * A recording's chapters, from the controls at the top, beside its annotations (Mat,
 * 2026-11-01: "to the left of it place the chapters toggle … should no longer be below";
 * the transport's menu until then): each with where it starts, as radio buttons, the one
 * playing checked and its picture under it, as Contents shows the current entry's. A
 * pointer's pick, or Enter, goes there and closes the menu; the arrow keys go from one to
 * the next and leave it open, as the transport's menus did. Over the recording's still
 * (`overStill`), where going there opens the recording and plays it, the arrow keys only
 * move the check, so looking through the names never starts the sound (WCAG 3.2.2):
 * Enter or a press goes. Each label carries its language (WCAG 3.1.2).
 */
const ChaptersMenu: React.FC<ChaptersMenuProps> = ({
  id,
  triggerId,
  label,
  labelLang,
  chapters,
  element,
  onChapter,
  overStill = false,
  request,
  onClose,
}) => {
  const name = useContainerName(label, labelLang);
  const [time, setTime] = useState(() => element?.currentTime ?? 0);
  useEffect(() => {
    if (!element) return;
    const update = () => setTime(element.currentTime);
    update();
    element.addEventListener("timeupdate", update);
    element.addEventListener("seeked", update);
    return () => {
      element.removeEventListener("timeupdate", update);
      element.removeEventListener("seeked", update);
    };
  }, [element]);
  const current = chapterAt(chapters, time);
  // Whether the last press was a pointer's, whose pick closes the menu.
  const pointer = useRef(false);
  const go = (index: number) => {
    onChapter(chapters[index].start);
    setTime(chapters[index].start);
  };
  return (
    <ControlMenu
      data-testid="clover-canvas-chapters"
      id={id}
      onClose={onClose}
      triggerId={triggerId}
    >
      <fieldset className="clover-canvas-menu-group" {...name.props}>
        {chapters.map((chapter, index) => (
          <label
            className="clover-canvas-menu-item clover-canvas-chapters-item"
            key={chapter.id ?? index}
            onPointerDown={() => {
              pointer.current = true;
            }}
          >
            <input
              type="radio"
              name={id}
              checked={index === current}
              onChange={() => {
                // Over the still, a key's move only marks it: Enter goes (below).
                if (overStill && !pointer.current)
                  setTime(chapters[index].start);
                else go(index);
              }}
              onClick={() => {
                if (pointer.current) onClose(true);
              }}
              onKeyDown={(event) => {
                pointer.current = false;
                if (event.key === "Enter") {
                  event.preventDefault();
                  go(index);
                  onClose(true);
                }
              }}
            />
            <span className="clover-cue-time">{formatTime(chapter.start)}</span>{" "}
            {/* Only the name carries its language: the time is in digits. */}
            <span
              className="clover-cue-text"
              {...languageProps(chapter.lang || undefined)}
            >
              {chapter.label}
            </span>
            {index === current && (
              <EntryThumbnail
                source={chapterPicture(chapter)}
                request={request}
                large
              />
            )}
          </label>
        ))}
      </fieldset>
      {name.node}
    </ControlMenu>
  );
};

export default ChaptersMenu;
