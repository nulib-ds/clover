import { useIsomorphicLayoutEffect as useLayout } from "./useSlide";

/**
 * How far down its bar a spine's toggle sits: at the top of `from` (the Body whose
 * controls it sits among), written to the spine as `--clover-template-spine-top`, measured
 * again as the panes or `from` resize (the bar dragged, a title wrapping). Where it sits
 * across the bar is the stylesheet's: the spine is a box of no width in the Split's row,
 * right after the bar, which the toggle hangs from.
 *
 * A control there belongs to the panel beside it, not the Canvas, which clips what leaves
 * it, nor the panel, which scrolls; and not inside the handle, whose `separator` role
 * makes its contents presentational.
 */
export function useSpineTop(
  element: React.RefObject<HTMLElement | null>,
  from: () => HTMLElement | null | undefined,
  enabled: boolean,
) {
  useLayout(() => {
    const node = element.current;
    const split = node?.parentElement;
    if (!enabled || !node || !split) return;
    const place = () => {
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
    /*
     * Its Root's first content in (`data-pending` gone, the panes shown): placed before the
     * browser lays that out, as a mutation is heard straight after the change, a resize
     * only once it is laid out, by when the toggle had shown where the Body had been.
     */
    const root = node.closest(".clover-root");
    const shown = new MutationObserver(place);
    if (root)
      shown.observe(root, {
        attributes: true,
        attributeFilter: ["data-pending"],
      });
    return () => {
      resized.disconnect();
      shown.disconnect();
    };
    // `from` is read when measuring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, enabled]);
}
