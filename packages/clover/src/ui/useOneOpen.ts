import { useEffect, useRef } from "react";
import { useUniqueId } from "./useUniqueId";

/** The popups open now, each with a way to close it. */
const opened = new Map<string, { current: () => void }>();

/**
 * Clover's popups open one at a time: the Canvas's menus (annotations, Choice, an
 * animation's frames) and its information, and the playback controls' menus. Opening
 * one closes whichever other is open, anywhere on the page, as a menu bar
 * does, and however it was opened: a key opens a popup without the press outside that
 * closes a menu.
 *
 * Each still closes itself as it did (Escape, a press outside). Closed by another, a popup
 * leaves focus where it is, since it has moved on to the one that opened. A popup of your
 * own joins them with its open state and the way to close it:
 *
 * ```tsx
 * const [open, setOpen] = useState(false);
 * Clover.useOneOpen(open, () => setOpen(false));
 * ```
 */
export function useOneOpen(open: boolean, close: () => void) {
  const id = useUniqueId();
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => (open ? join(id, latest) : undefined), [open, id]);
}

/** One popup opened: every other closed, and it held until the release it returns. */
function join(id: string, close: { current: () => void }) {
  for (const [other, closeOther] of [...opened]) {
    if (other !== id) closeOther.current();
  }
  opened.set(id, close);
  return () => {
    opened.delete(id);
  };
}

let own = 0;

/**
 * `useOneOpen` without React, for a page's script (`root.clover.oneOpen`): call it as a
 * popup of your own opens, with the way to close it, and call what it returns as it
 * closes. Opening it closes whichever of Clover's is open, and one of Clover's opening
 * closes it.
 */
export const openOne = (close: () => void) =>
  join(`page-${(own += 1)}`, { current: close });
