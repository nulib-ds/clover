import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One tab stop for a set of options, moved with the arrow keys: the WAI-ARIA "roving
 * tabindex". The option in focus has `tabIndex={0}`, the rest `-1`, so Tab enters and
 * leaves the set in one press.
 *
 * Enter or Space activates. Arrows, Home and End move focus, and with `onMove` the
 * selection follows focus, as in a radio group.
 */
export interface RovingFocusOptions {
  /** Which arrows step: left/right, up/down, or both (a grid read as one line). */
  orientation?: "horizontal" | "vertical" | "both";
  /** Right-to-left: the left arrow steps forward. */
  rtl?: boolean;
  /** Enter or Space on an option, with the key's own event. */
  onActivate?: (index: number, event: React.KeyboardEvent) => void;
  /** Focus moved to an option by an arrow, Home or End: to select as focus moves. */
  onMove?: (index: number, event: React.KeyboardEvent) => void;
}

export function useRovingFocus(
  count: number,
  selected: number,
  {
    orientation = "both",
    rtl = false,
    onActivate,
    onMove,
  }: RovingFocusOptions = {},
) {
  const [focused, setFocused] = useState(Math.max(0, selected));
  const elements = useRef<Array<HTMLElement | null>>([]);
  const activate = useRef(onActivate);
  activate.current = onActivate;
  const move = useRef(onMove);
  move.current = onMove;

  // A selection made elsewhere (a pager, a link) moves the tab stop with it.
  useEffect(() => {
    if (selected >= 0) setFocused(selected);
  }, [selected]);

  const clamped = Math.min(focused, Math.max(0, count - 1));

  const focusAt = useCallback((index: number) => {
    setFocused(index);
    elements.current[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const forward = rtl ? "ArrowLeft" : "ArrowRight";
      const backward = rtl ? "ArrowRight" : "ArrowLeft";
      const horizontal = orientation !== "vertical";
      const vertical = orientation !== "horizontal";
      let next: number | null = null;
      if (
        (horizontal && event.key === forward) ||
        (vertical && event.key === "ArrowDown")
      ) {
        next = Math.min(count - 1, index + 1);
      } else if (
        (horizontal && event.key === backward) ||
        (vertical && event.key === "ArrowUp")
      ) {
        next = Math.max(0, index - 1);
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = count - 1;
      } else if (event.key === "Enter" || event.key === " ") {
        // The host sees the event as it came, as a click's arrives; only then is Space
        // kept from scrolling the page.
        activate.current?.(index, event);
        event.preventDefault();
        return;
      }
      if (next === null) return;
      event.preventDefault();
      focusAt(next);
      if (next !== index) move.current?.(next, event);
    },
    [count, orientation, rtl, focusAt],
  );

  /** Props for option `index`. */
  const itemProps = (index: number) => ({
    ref: (element: HTMLElement | null) => {
      elements.current[index] = element;
    },
    tabIndex: index === clamped ? 0 : -1,
    onKeyDown: (event: React.KeyboardEvent) => onKeyDown(event, index),
    onFocus: () => setFocused(index),
  });

  return { focused: clamped, itemProps };
}
