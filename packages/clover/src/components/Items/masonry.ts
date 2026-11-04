/**
 * Items' `masonry` layout: a `grid` whose pictures keep their own proportions, each cell
 * packed up under the one above it. The track's rows are thin (`Items.css`), and each
 * item spans as many as its own height and the gap below it: the grid still places the
 * items left to right, each in the first room it fits, so they keep their reading order
 * (CSS columns would fill top to bottom, and the arrow keys would cross the order).
 *
 * Each item is measured whole, not its figure: the item keeps room around the figure for
 * its ring. It is measured again as its picture loads and its label wraps, and items the
 * track adds later are measured as they come. Loaded only for a masonry layout
 * (`Items.tsx`), so no other layout carries it.
 *
 * Its thin rows apply only once it is here (`data-masonry`, `Items.css`): until its
 * code arrives, or if it never does, the items sit in an ordinary grid, never one over
 * another.
 *
 * Returns what lets it go: the items' spans cleared, the watching stopped.
 */
export function attachMasonry(box: HTMLElement): () => void {
  box.dataset.masonry = "";
  const items = () =>
    Array.from(
      box.querySelectorAll<HTMLElement>(
        ".clover-items-track > .clover-items-item",
      ),
    );
  const span = (item: HTMLElement) => {
    const track = item.parentElement;
    if (!track) return;
    const style = getComputedStyle(track);
    const row = parseFloat(style.gridAutoRows) || 1;
    const gap = parseFloat(style.columnGap) || 0;
    const height = item.getBoundingClientRect().height;
    item.style.gridRowEnd = `span ${Math.max(1, Math.ceil((height + gap) / row))}`;
  };
  const sizes =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) =>
          entries.forEach((entry) => span(entry.target as HTMLElement)),
        );
  const watch = () =>
    items().forEach((item) => {
      sizes?.observe(item);
      span(item);
    });
  const added = new MutationObserver(watch);
  added.observe(box, { childList: true, subtree: true });
  watch();
  return () => {
    added.disconnect();
    sizes?.disconnect();
    items().forEach((item) => item.style.removeProperty("grid-row-end"));
    delete box.dataset.masonry;
  };
}
