import React from "react";

import type { TimelineProps } from "./Timeline";
import { playerSurface } from "./playerSurface";
import ConnectedCanvas from "../Canvas/Connected";
import { join } from "../../lib/classnames";
import { useVisibleCanvases } from "../../react/hooks";

/**
 * A `Timeline` inside a `Root`: the Root's view, when it is a Timeline, played as the
 * connected Canvas plays sound (its deep links' times, the media and captions channels,
 * its chapters from the Ranges, auto-advance at the end). Nothing for any other view.
 * Loaded on demand, by a `Timeline` in a Root and by `Body` for a Timeline view, so a
 * page that never shows one never carries it.
 */
export default function ConnectedTimeline({
  className,
  ...props
}: Omit<TimelineProps, "timeline">) {
  const view = useVisibleCanvases();
  if (!view.some((container) => container.type === "Timeline")) return null;
  return (
    <ConnectedCanvas
      {...props}
      className={join("clover-timeline", className)}
      navigator={false}
      surface={playerSurface}
    />
  );
}
