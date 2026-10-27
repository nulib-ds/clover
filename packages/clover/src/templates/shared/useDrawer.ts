import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useDragToClose } from "./useDragToClose";
import type { useFollowFocus } from "./useFollowFocus";
import { panelFocus, useSlide } from "./useSlide";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface DrawerOptions {
  /** The pane's `id`, which its toggle's `aria-controls` names. */
  id: string;
  /**
   * Whether there is room for it beside the page (`useWideEnough`): `undefined` until
   * measured, and beside until then, as on the server.
   */
  beside: boolean | undefined;
  /** Whether it starts open beside the page. Over the page it always starts closed. */
  defaultOpen: boolean;
  /** The edge it floats from over the page, and is dragged back to. */
  side: "start" | "end";
  /** Where focus goes as the reader opens it over the page. Default: the panel's. */
  focus?: (pane: HTMLElement) => HTMLElement | null | undefined;
  /** Over the page it slides in and out; `false`, it simply shows and hides. */
  slides?: boolean;
  /** What sits on its edge and moves with it as it is dragged (its toggle, on its spine). */
  alongside?: React.RefObject<HTMLElement | null>;
  /**
   * The layout's `useFollowFocus`, one for all its drawers, so that a later follow takes
   * over from any before it.
   */
  followFocus: ReturnType<typeof useFollowFocus>;
}

/**
 * A pane beside the page where there is room, and a drawer over it where there is not:
 * Document's panel and thumbnails. One rule (Mat, 2026-10-27), which Default's panel
 * follows in its own code (one drawer; through this hook it would weigh more):
 *
 * - Beside the page it opens as the host asks, then as the reader chooses.
 * - Over the page it starts closed, whatever the host asks, and closes as the layout
 *   narrows under it: open, it would cover what the reader came for, focus behind it
 *   (WCAG 2.4.11). Focus in it goes to its toggle. Widening brings it back beside.
 * - Opened over the page, it takes focus (`focus`). Escape anywhere, a press on the wash
 *   beside it, a drag back off the way it came or its toggle puts it away, and focus in
 *   it goes to its toggle; focus elsewhere is left where it is.
 *
 * Its toggle is the button whose `aria-controls` names it. A toggle the template draws
 * in another place as the pane opens or closes is followed there (`useFollowFocus`).
 */
export function useDrawer({
  id,
  beside: measured,
  defaultOpen,
  side,
  focus = panelFocus,
  slides = true,
  alongside,
  followFocus,
}: DrawerOptions) {
  const pane = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const over = measured === false;
  /*
   * Two choices: open beside the page (the host's to start with), and open over it. The
   * reader's toggle over the page sets both, so widening keeps a pane they opened.
   */
  const [openBeside, setOpenBeside] = useState(defaultOpen);
  const [openOver, setOpenOver] = useState(false);
  const open = over ? openOver : openBeside;

  const toggle = () =>
    document.querySelector<HTMLElement>(`button[aria-controls~="${id}"]`);
  const follow = () => followFocus(toggle);
  // Focus in the pane as it goes is handed to its toggle, never left on what is hidden.
  const handBack = () => {
    if (!pane.current?.contains(document.activeElement)) return;
    toggle()?.focus();
    follow();
  };
  /*
   * Opening over the page, the pane takes focus, as an overlay should: the reader's next
   * keys belong to it. It goes in as the pane shows, once its slide takes `hidden` off,
   * a commit or two later: tried after each, three at most. Otherwise focus follows the
   * toggle.
   */
  const tries = useRef(0);
  const setOpen = (next: boolean) => {
    tries.current = over && next ? 3 : 0;
    if (!tries.current) follow();
    if (over) setOpenOver(next);
    setOpenBeside(next);
  };
  const close = () => {
    handBack();
    setOpen(false);
  };

  /*
   * Narrowed under it open beside the page: focus in the pane, or on its toggle, goes to
   * the toggle in its new place, before paint. Where focus was is read as the render
   * begins, while the toggle is still on its spine: the commit takes it away, and focus
   * with it, and another drawer's toggle may have had it.
   */
  const was = useRef(measured);
  const held = useRef(false);
  if (was.current === true && measured === false) {
    const active = document.activeElement;
    held.current = Boolean(
      active && (pane.current?.contains(active) || toggle()?.contains(active)),
    );
  }
  useIsomorphicLayoutEffect(() => {
    if (held.current) {
      held.current = false;
      toggle()?.focus();
      follow();
    }
    // Beside the page again: over it, it starts closed next time.
    if (measured === true) setOpenOver(false);
    was.current = measured;
  }, [measured]);

  const slide = useSlide(slides && over && open);
  const sliding = slides && over;
  const shown = sliding ? slide.mounted : open;
  const opened = sliding ? slide.open : open;
  useEffect(() => {
    if (!tries.current || !pane.current) return;
    tries.current -= 1;
    const target = focus(pane.current);
    target?.focus({ preventScroll: true });
    if (target && document.activeElement === target) tries.current = 0;
  });
  useDragToClose(pane, {
    enabled: over && opened,
    side,
    onClose: close,
    scrim,
    alongside,
    exits: !slides,
  });

  return {
    pane,
    /** Over the page, where there is no room beside it. */
    over,
    open,
    /** In the layout: open, or over the page still sliding out. Its pane's `hidden` is `!shown`. */
    shown,
    /** Open and, over the page, slid in: its pane's `data-open`. */
    opened,
    setOpen,
    close,
    /** For the layout's `onKeyDown`: Escape anywhere puts it away over the page. */
    onKeyDown: (event: React.KeyboardEvent) => {
      if (over && open && event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        close();
      }
    },
    /*
     * The wash over the page beside it, while it is over the page and shown. A press on it
     * takes no focus, so focus in the pane is still there to hand back to its toggle,
     * never left to fall to the page (WCAG 2.4.3).
     */
    scrim: over &&
      shown && {
        ref: scrim,
        "data-open": opened,
        "aria-hidden": true,
        onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
        onClick: close,
      },
  };
}
