import { useEffect, useLayoutEffect } from "react";

/* Layout effects only where there is a layout: a server render has none. */
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Lays `element` on a Split's bar, its spine: centred across the bar, or with `cap` all
 * of it over the pane before the bar but its far rounded end, which hangs over the pane
 * after it (the bar where that end's curve begins); and down at the top of `from` (the
 * stage whose controls it sits among), where its stylesheet adds the space. Render it in the Split right after the `SplitHandle`; it is placed by `left` and
 * `--clover-template-spine-top`, measured again as the panes or it resize (the bar
 * dragged, a title wrapping, a count growing). Where the bar is hidden (a pane floating
 * over the page as a drawer), it sits so on that pane's inner edge instead. Its
 * `translate` is left free, for a drag to move it with its pane (`useDragToClose`).
 *
 * A control there belongs to the panel beside it, not the Canvas, which clips what leaves
 * it, nor the panel, which scrolls; and not inside the handle, whose `separator` role
 * makes its contents presentational.
 */
export function useSpine(
  element: React.RefObject<HTMLElement>,
  from: () => HTMLElement | null | undefined,
  enabled: boolean,
  { cap = false }: { cap?: boolean } = {},
) {
  useLayout(() => {
    const node = element.current;
    const split = node?.parentElement;
    const handle = node?.previousElementSibling as HTMLElement | null;
    if (!enabled || !node || !split || !handle) return;
    const place = () => {
      const pane = handle.previousElementSibling as HTMLElement | null;
      const rtl = getComputedStyle(node).direction === "rtl";
      const centre =
        handle.offsetWidth || !pane
          ? handle.offsetLeft + handle.offsetWidth / 2
          : pane.offsetLeft + (rtl ? 0 : pane.offsetWidth);
      // How much of it is over the pane before the bar: half, or all but its far end's
      // radius (half its height, a pill's). That pane is on the right in a right-to-left
      // page.
      const before = cap
        ? node.offsetWidth - node.offsetHeight / 2
        : node.offsetWidth / 2;
      node.style.left = `${centre - (rtl ? node.offsetWidth - before : before)}px`;
      const top = from();
      node.style.setProperty(
        "--clover-template-spine-top",
        `${top ? top.getBoundingClientRect().top - split.getBoundingClientRect().top : 0}px`,
      );
    };
    place();
    const resized = new ResizeObserver(place);
    for (const child of Array.from(split.children)) resized.observe(child);
    const top = from();
    if (top) resized.observe(top);
    return () => resized.disconnect();
    // `from` is read when measuring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, enabled, cap]);
}
