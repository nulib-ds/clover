import React from "react";

import { join } from "../lib/classnames";
import { formatTime } from "../lib/time";

/**
 * Where a row on a recording's time starts, one way wherever Clover lists one (Mat,
 * 2026-10-26: "make sure cues in vtt transcripts and annotations on time use the same
 * component"): a Transcript's cue, an annotation's (Cookbook 0103), in `Annotations`
 * and in the Canvas's menu, and a Contents Range's ("time ranges should be rendered like
 * cues and time annotations"). `m:ss`, or `h:mm:ss`, from the second it starts in, as the
 * transport counts; at the smaller text size, muted, in even figures, on the first line
 * of the words beside it, which take `clover-cue-text`. Styles are `ui/Cue.css`.
 */
export function CueTime({
  start,
  className,
}: {
  /** Seconds from the recording's start. */
  start: number;
  /** The part's own class, beside `clover-cue-time`. */
  className?: string;
}) {
  return (
    <span className={join("clover-cue-time", className)}>
      {formatTime(start)}
    </span>
  );
}
