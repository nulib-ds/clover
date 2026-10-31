import React, { useEffect, useRef } from "react";

export interface DragToCloseOptions {
  /** Whether it can be dragged now: the pane is open, and over the page. */
  enabled: boolean;
  /** The edge it slides in from, and goes back to: `"end"` (right) or `"start"`. */
  side: "start" | "end";
  onClose: () => void;
  /** The wash over the page behind it, to fade as the pane goes. */
  scrim?: React.RefObject<HTMLElement | null>;
  /** What sits on the pane's edge and moves with it (its toggle, on its spine). */
  alongside?: React.RefObject<HTMLElement | null>;
  /**
   * The pane has no slide of its own (it is simply hidden): the drag finishes the motion
   * off the edge itself, then closes it. By default its own slide out carries on.
   */
  exits?: boolean;
}

/** The drag's code, loaded once for the page, the first time a pane can be dragged. */
let drag: Promise<typeof import("./dragToClose")> | undefined;
let loaded: typeof import("./dragToClose") | undefined;
const load = () =>
  (drag ??= import("./dragToClose").then((module) => (loaded = module)));

/**
 * Starts loading the drag's code as the reader reaches for a floating pane's toggle
 * (pointed at, pressed or focused; Mat, 2026-10-31), so it is there as the pane opens: a
 * swipe right after is never missed while it loads. A layout whose panes sit beside the
 * page never calls it.
 */
export function preloadDrag() {
  void load();
}

/**
 * A pane that slides over the page goes back the way it came when it is dragged there,
 * as an app's drawer does: it follows the finger (or pen) toward its edge, and let go past
 * a third of its width, or flicked, it closes; short of that it springs back. A drag up or
 * down is left to scroll the pane, and a press that does not move is still a press.
 *
 * Light by design: it moves the pane by its own `translate`, set as the pointer moves,
 * never through React, so a drag renders nothing. The template's own slide (its
 * `transform`) carries on from wherever the drag let go. Mouse drags are left alone, to
 * select text as they always have.
 *
 * Its code (`dragToClose.ts`) loads the first time the pane can be dragged: on a wide
 * layout, never.
 */
export function useDragToClose(
  pane: React.RefObject<HTMLElement | null>,
  {
    enabled,
    side,
    onClose,
    scrim,
    alongside,
    exits = false,
  }: DragToCloseOptions,
) {
  const latest = useRef({ enabled, side, onClose, scrim, alongside, exits });
  latest.current = { enabled, side, onClose, scrim, alongside, exits };

  useEffect(() => {
    const element = pane.current;
    if (!element) return;
    // Opened again, or closed: what a drag left is cleared (none before the code loads).
    loaded?.reset(element, latest);
    if (!enabled) return;
    let live = true;
    let detach: (() => void) | undefined;
    void load().then((module) => {
      if (live) detach = module.attach(element, latest);
    });
    return () => {
      live = false;
      detach?.();
    };
  }, [pane, enabled]);
}
